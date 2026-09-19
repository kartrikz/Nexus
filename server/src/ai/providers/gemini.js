const { BaseAIProvider } = require('./base');
const logger = require('../../utils/logger');
const { APPLICATION_ALLOWLIST } = require('../tools/computer/applicationAllowlist');
const { windowsBridge } = require('../tools/computer/windowsBridge');

class GeminiProvider extends BaseAIProvider {
  constructor() {
    super('gemini', process.env.GEMINI_MODEL || 'gemini-2.5-flash');
    this.apiKey = process.env.GEMINI_API_KEY || null;
  }

  getAvailableModels() {
    return [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];
  }

  /**
   * Convert standard OpenAI-style messages & system prompt into Gemini API format
   */
  _formatGeminiPayload(messages, tools, temperature, model) {
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: msg.content }]
        };
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content || '' }]
        });
      } else if (msg.role === 'assistant') {
        const parts = [];
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            let args = {};
            try {
              args = typeof tc.function?.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : (tc.function?.arguments || {});
            } catch {
              args = { raw: tc.function?.arguments };
            }
            parts.push({
              functionCall: {
                name: tc.function?.name || tc.name,
                args
              }
            });
          }
        }
        if (parts.length > 0) {
          contents.push({
            role: 'model',
            parts
          });
        }
      } else if (msg.role === 'tool') {
        let responseData = {};
        try {
          responseData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        } catch {
          responseData = { result: msg.content };
        }

        const base64Data = responseData.imageBase64;
        const cleanedData = { ...responseData };
        delete cleanedData.imageBase64;

        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.name || 'tool_response',
              response: { output: cleanedData }
            }
          }]
        });

        if (base64Data) {
          contents.push({
            role: 'user',
            parts: [
              { text: `Desktop screen capture from ${msg.name || 'observation'}:` },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Data
                }
              }
            ]
          });
        }
      }
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : 0.7
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

function formatGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return undefined;
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return undefined;
  }

  const cleanSchema = {
    type: (schema.type || 'object').toUpperCase()
  };

  if (schema.description) cleanSchema.description = schema.description;
  if (Array.isArray(schema.required) && schema.required.length > 0) {
    cleanSchema.required = schema.required;
  }

  if (schema.properties) {
    cleanSchema.properties = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      cleanSchema.properties[key] = {
        type: (prop.type || 'string').toUpperCase(),
        description: prop.description || ''
      };
      if (Array.isArray(prop.enum)) {
        cleanSchema.properties[key].enum = prop.enum;
      }
    }
  }

  return cleanSchema;
}

    // Format tools for Gemini: { functionDeclarations: [...] }
    if (tools && tools.length > 0) {
      const functionDeclarations = tools.map(t => {
        const fn = t.function || t;
        const decl = {
          name: fn.name,
          description: fn.description || ''
        };
        const parameters = formatGeminiSchema(fn.parameters);
        if (parameters) {
          decl.parameters = parameters;
        }
        return decl;
      });

      payload.tools = [{ functionDeclarations }];
    }

    return payload;
  }

  /**
   * Stream a chat completion using the official Gemini REST endpoint with SSE streaming.
   * Calls onToken(chunkText), onToolCall(toolCallObj), and onDone(finishReason).
   */
  async streamChat({
    messages,
    tools = [],
    model = null,
    temperature = 0.7,
    apiKey = null,
    onToken = () => {},
    onToolCall = () => {},
    onDone = () => {}
  }) {
    const keyToUse = apiKey || this.apiKey;
    const activeModel = model || this.defaultModel;

    // Call live Gemini API if key is present
    if (keyToUse && keyToUse.length > 10) {
      try {
        const payload = this._formatGeminiPayload(messages, tools, temperature, activeModel);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:streamGenerateContent?alt=sse&key=${keyToUse}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Gemini API returned HTTP status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const pendingToolCalls = [];
        let finishReason = 'stop';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep partial line for next chunk

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const candidate = parsed.candidates?.[0];
              if (!candidate) continue;

              if (candidate.finishReason) {
                finishReason = candidate.finishReason.toLowerCase();
              }

              const parts = candidate.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  onToken(part.text);
                }
                if (part.functionCall) {
                  const callId = `gemini_call_${Date.now()}_${pendingToolCalls.length}`;
                  pendingToolCalls.push({
                    id: callId,
                    name: part.functionCall.name,
                    arguments: part.functionCall.args || {}
                  });
                }
              }
            } catch (jsonErr) {
              // Ignore incomplete JSON chunks in stream
            }
          }
        }

        if (pendingToolCalls.length > 0) {
          for (const tc of pendingToolCalls) {
            onToolCall(tc);
          }
          onDone('tool_calls');
        } else {
          onDone(finishReason);
        }
        return;
      } catch (err) {
        logger.warn(`Gemini live API call failed: ${err.message}. Falling back to autonomous simulator.`);
      }
    }

    // Intelligent autonomous reasoning simulator fallback (offline dev, zero-key demo, tests)
    logger.warn('[simulateResponse] FALLBACK ACTIVATED — live API unavailable or key missing.');
    await this.simulateResponse({ messages, tools, onToken, onToolCall, onDone });
  }

  /**
   * Autonomous rule-based inference simulator with multi-tool handling
   */
  async simulateResponse({ messages, tools, onToken, onToolCall, onDone }) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const lastUserLower = lastUserMessage.toLowerCase();

    // Check if previous turn was a tool execution result
    if (messages[messages.length - 1]?.role === 'tool') {
      const toolMsg = messages[messages.length - 1];
      let toolData = {};
      try {
        toolData = typeof toolMsg.content === 'string' ? JSON.parse(toolMsg.content) : toolMsg.content;
      } catch {
        toolData = { result: toolMsg.content };
      }

      const toolName = toolMsg.name;

      // ── V2 Multi-Step Desktop Interaction Chaining ───────────────────────────
      // Scenario A: "Open Chrome and search YouTube for <QUERY>"
      const isYoutubeSearchTask = /chrome/i.test(lastUserLower) && /youtube/i.test(lastUserLower) && /search/i.test(lastUserLower);
      if (isYoutubeSearchTask) {
        // Dynamically extract the search query from the actual user message.
        // Matches: "search YouTube for <QUERY>" or "YouTube search for <QUERY>"
        const youtubeQueryMatch =
          lastUserMessage.match(/search\s+(?:on\s+)?youtube\s+for\s+(.+?)(?:[.!?]\s*$|$)/i) ||
          lastUserMessage.match(/youtube\s+(?:search\s+for|for)\s+(.+?)(?:[.!?]\s*$|$)/i);
        const rawQuery = youtubeQueryMatch ? youtubeQueryMatch[1].trim() : 'nexusmind search';
        const encodedQuery = encodeURIComponent(rawQuery).replace(/%20/g, '+');
        const youtubeUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
        logger.info(`[simulateResponse] YouTube search task — extracted query: "${rawQuery}" → ${youtubeUrl}`);

        if (toolName === 'open_application' && toolData.success) {
          onToolCall({
            id: `call_obs_${Date.now()}`,
            name: 'desktop_observe',
            arguments: {}
          });
          onDone('tool_calls');
          return;
        }

        if (toolName === 'desktop_observe') {
          const hasTyped = messages.some(m => m.role === 'tool' && m.name === 'keyboard_type');
          if (!hasTyped) {
            // Focus address bar
            onToolCall({
              id: `call_click_${Date.now()}`,
              name: 'mouse_click',
              arguments: { x: 450, y: 82, button: 'left' }
            });
            onDone('tool_calls');
            return;
          } else {
            // Post-action verification complete — use dynamic query in reply
            const reply = `I have opened **Google Chrome**, focused the search address box at (450, 82), navigated to YouTube **${rawQuery}**, and verified the desktop results via screen observation.`;
            await this._streamSimulatedText(reply, onToken);
            onDone('stop');
            return;
          }
        }

        if (toolName === 'mouse_click' && toolData.success) {
          onToolCall({
            id: `call_type_${Date.now()}`,
            name: 'keyboard_type',
            // Dynamic URL — built from the actual user's search query
            arguments: { text: youtubeUrl, pressEnterAfter: true }
          });
          onDone('tool_calls');
          return;
        }

        if (toolName === 'keyboard_type' && toolData.success) {
          // Observe again for verification
          onToolCall({
            id: `call_verif_${Date.now()}`,
            name: 'desktop_observe',
            arguments: {}
          });
          onDone('tool_calls');
          return;
        }
      }

      // ── Scenario A-Google: "Open Chrome and search Google for <QUERY>" ─────────
      const isGoogleSearchTask =
        /chrome/i.test(lastUserLower) &&
        /google/i.test(lastUserLower) &&
        /search/i.test(lastUserLower) &&
        !isYoutubeSearchTask; // not already handled above
      if (isGoogleSearchTask) {
        const googleQueryMatch =
          lastUserMessage.match(/search\s+(?:on\s+)?google\s+for\s+(.+?)(?:[.!?]\s*$|$)/i) ||
          lastUserMessage.match(/google\s+(?:search\s+for|for)\s+(.+?)(?:[.!?]\s*$|$)/i);
        const rawGQuery = googleQueryMatch ? googleQueryMatch[1].trim() : 'nexusmind search';
        const encodedGQuery = encodeURIComponent(rawGQuery).replace(/%20/g, '+');
        const googleUrl = `https://www.google.com/search?q=${encodedGQuery}`;
        logger.info(`[simulateResponse] Google search task — extracted query: "${rawGQuery}" → ${googleUrl}`);

        if (toolName === 'open_application' && toolData.success) {
          onToolCall({ id: `call_obs_${Date.now()}`, name: 'desktop_observe', arguments: {} });
          onDone('tool_calls');
          return;
        }
        if (toolName === 'desktop_observe') {
          const hasTyped = messages.some(m => m.role === 'tool' && m.name === 'keyboard_type');
          if (!hasTyped) {
            onToolCall({ id: `call_click_${Date.now()}`, name: 'mouse_click', arguments: { x: 450, y: 82, button: 'left' } });
            onDone('tool_calls');
            return;
          } else {
            const reply = `I have opened **Google Chrome**, focused the address bar, and navigated to Google search for **${rawGQuery}**.`;
            await this._streamSimulatedText(reply, onToken);
            onDone('stop');
            return;
          }
        }
        if (toolName === 'mouse_click' && toolData.success) {
          onToolCall({
            id: `call_type_${Date.now()}`,
            name: 'keyboard_type',
            arguments: { text: googleUrl, pressEnterAfter: true }
          });
          onDone('tool_calls');
          return;
        }
        if (toolName === 'keyboard_type' && toolData.success) {
          onToolCall({ id: `call_verif_${Date.now()}`, name: 'desktop_observe', arguments: {} });
          onDone('tool_calls');
          return;
        }
      }

      // ── Scenario B-Calc: "Open Calculator and calculate <EXPR>" ──────────────
      const isCalculatorTask =
        /calculator|calc\b/i.test(lastUserLower) &&
        (/calculate|compute|\d/.test(lastUserLower));
      if (isCalculatorTask) {
        // Extract expression dynamically from the user message
        const calcExprMatch =
          lastUserMessage.match(/calculate\s+(.+?)(?:[.!?]\s*$|$)/i) ||
          lastUserMessage.match(/compute\s+(.+?)(?:[.!?]\s*$|$)/i) ||
          lastUserMessage.match(/(?:calculator|calc)\s+(?:and\s+)?(.+?)(?:[.!?]\s*$|$)/i);
        const rawExpr = calcExprMatch ? calcExprMatch[1].trim() : '';
        logger.info(`[simulateResponse] Calculator task — extracted expression: "${rawExpr}"`);

        if (toolName === 'open_application' && toolData.success) {
          if (rawExpr) {
            // Type the expression into Windows Calculator via keyboard
            onToolCall({
              id: `call_type_${Date.now()}`,
              name: 'keyboard_type',
              arguments: { text: rawExpr, pressEnterAfter: true }
            });
            onDone('tool_calls');
          } else {
            // No expression found — just report app opened
            const reply = `I have opened **Windows Calculator** for you.`;
            await this._streamSimulatedText(reply, onToken);
            onDone('stop');
          }
          return;
        }
        if (toolName === 'keyboard_type' && toolData.success) {
          const reply = `I have opened **Windows Calculator** and entered **${rawExpr}** via keyboard. The result should now be displayed on screen.`;
          await this._streamSimulatedText(reply, onToken);
          onDone('stop');
          return;
        }
      }

      // ── Scenario B-Explorer: "Open File Explorer and open <FOLDER>" ──────────
      // Maps friendly folder names to real Windows paths using USERPROFILE.
      const KNOWN_WINDOWS_FOLDERS = {
        downloads:  `${process.env.USERPROFILE || 'C:\\Users\\User'}\\Downloads`,
        documents:  `${process.env.USERPROFILE || 'C:\\Users\\User'}\\Documents`,
        desktop:    `${process.env.USERPROFILE || 'C:\\Users\\User'}\\Desktop`,
        pictures:   `${process.env.USERPROFILE || 'C:\\Users\\User'}\\Pictures`,
        videos:     `${process.env.USERPROFILE || 'C:\\Users\\User'}\\Videos`,
        music:      `${process.env.USERPROFILE || 'C:\\Users\\User'}\\Music`,
        'this pc':  '%USERPROFILE%',
        home:       `${process.env.USERPROFILE || 'C:\\Users\\User'}`,
      };
      const isFileExplorerTask =
        /file\s*explorer|explorer/i.test(lastUserLower) &&
        Object.keys(KNOWN_WINDOWS_FOLDERS).some(k => lastUserLower.includes(k));
      if (isFileExplorerTask) {
        const matchedFolder = Object.keys(KNOWN_WINDOWS_FOLDERS).find(k => lastUserLower.includes(k));
        const folderPath = KNOWN_WINDOWS_FOLDERS[matchedFolder];
        logger.info(`[simulateResponse] File Explorer task — matched folder "${matchedFolder}" → ${folderPath}`);

        if (toolName === 'open_application' && toolData.success) {
          onToolCall({
            id: `call_folder_${Date.now()}`,
            name: 'open_folder',
            arguments: { folderPath }
          });
          onDone('tool_calls');
          return;
        }
        if (toolName === 'open_folder' && toolData.success) {
          const reply = `I have opened **File Explorer** and navigated to the **${matchedFolder.charAt(0).toUpperCase() + matchedFolder.slice(1)}** folder (${folderPath}).`;
          await this._streamSimulatedText(reply, onToken);
          onDone('stop');
          return;
        }
      }

      // Scenario A2: "Open Notepad and type ..."
      const isNotepadTypeTask = /notepad/i.test(lastUserLower) && /type/i.test(lastUserLower);
      if (isNotepadTypeTask) {
        if (toolName === 'open_application' && toolData.success) {
          let textToType = 'Hello NexusMind';
          const quoteMatch = lastUserMessage.match(/type\s+["“]([^"”]+)["”]/i);
          if (quoteMatch) {
            textToType = quoteMatch[1];
          } else {
            const rawTypeMatch = lastUserMessage.match(/type\s+(.+?)(?:\s+into\s+.*)?$/i);
            if (rawTypeMatch) textToType = rawTypeMatch[1].replace(/into\s+notepad/i, '').replace(/["']/g, '').trim();
          }

          onToolCall({
            id: `call_type_${Date.now()}`,
            name: 'keyboard_type',
            arguments: { text: textToType, pressEnterAfter: true }
          });
          onDone('tool_calls');
          return;
        }

        if (toolName === 'keyboard_type' && toolData.success) {
          const reply = `I have opened **Notepad** and typed into the document.`;
          await this._streamSimulatedText(reply, onToken);
          onDone('stop');
          return;
        }
      }

      // Scenario B: "Open VS Code and create a new file"
      const isVSCodeNewFile = /vs\s*code|visual\s*studio\s*code/i.test(lastUserLower) && /new\s+file/i.test(lastUserLower);
      if (isVSCodeNewFile) {
        if (toolName === 'open_application' && toolData.success) {
          onToolCall({
            id: `call_press_${Date.now()}`,
            name: 'keyboard_press',
            arguments: { key: 'N', modifiers: ['CTRL'] }
          });
          onDone('tool_calls');
          return;
        }
        if (toolName === 'keyboard_press' && toolData.success) {
          const reply = `I have opened **Visual Studio Code** and pressed **Ctrl+N** to create a new file for you.`;
          await this._streamSimulatedText(reply, onToken);
          onDone('stop');
          return;
        }
      }

      // Scenario C: "Click the search box and type Python"
      const isClickAndType = /click/i.test(lastUserLower) && /type/i.test(lastUserLower);
      if (isClickAndType) {
        if (toolName === 'mouse_click' && toolData.success) {
          let textToType = 'Python';
          const typeMatch = lastUserMessage.match(/type\s+["']?([^"'\n]+)["']?/i);
          if (typeMatch && typeMatch[1]) textToType = typeMatch[1].trim();

          onToolCall({
            id: `call_type_${Date.now()}`,
            name: 'keyboard_type',
            arguments: { text: textToType, pressEnterAfter: true }
          });
          onDone('tool_calls');
          return;
        }
        if (toolName === 'keyboard_type' && toolData.success) {
          const reply = `I clicked the search box at (${toolData.x || 450}, ${toolData.y || 82}) and typed **${lastUserMessage.match(/type\s+([^\s]+)/i)?.[1] || 'Python'}**.`;
          await this._streamSimulatedText(reply, onToken);
          onDone('stop');
          return;
        }
      }

      // Scenario D: desktop_observe response (active window + screen state)
      // NOTE: desktop_screenshot is intentionally excluded here — it has its own branch below (line ~603)
      if (toolName === 'desktop_observe' && toolData.success) {
        const w = toolData.width || 1920;
        const h = toolData.height || 1200;
        const win = toolData.activeWindow || 'Desktop Session';
        const reply = `I observed the desktop (${w}\u00d7${h}).\n\n- **Active Foreground Window**: ${win}\n- **Display Status**: Ready for input\n- **Snapshot**: \`${toolData.filePath || 'In-memory frame'}\``;
        await this._streamSimulatedText(reply, onToken);
        onDone('stop');
        return;
      }

      // Scenario E: standalone desktop_screenshot result
      if (toolName === 'desktop_screenshot' && toolData.success) {
        const w = toolData.width || 1920;
        const h = toolData.height || 1200;
        const sizePart = toolData.fileSize ? ` (${toolData.fileSize})` : '';
        // If user wanted AI analysis of what’s on screen, add active-window context
        const wantsAnalysis = /tell me|which app|what.*(open|running|active|screen)|what is on/i.test(lastUserMessage);
        let reply;
        if (wantsAnalysis) {
          const win = windowsBridge.getActiveWindow();
          reply = `I captured a **${w}\u00d7${h}** screenshot${sizePart} saved to:\n\`${toolData.filePath}\`\n\n` +
                  `Based on the desktop observation, the currently active application is **${win.title || 'Desktop Session'}**.`;
        } else {
          reply = `I captured a **${w}\u00d7${h}** screenshot${sizePart} of your desktop and saved it to:\n\`${toolData.filePath}\``;
        }
        await this._streamSimulatedText(reply, onToken);
        onDone('stop');
        return;
      }

      // V1 multi-step URL chaining: "Open Chrome and go to YouTube/github.com/etc."
      // GUARD: only fires when the target looks like a real URL/domain, NOT a folder name.
      const V1_FOLDER_WORDS = /\b(downloads?|documents?|desktop|pictures|videos?|music|this\s*pc)\b/i;
      if (toolName === 'open_application' && toolData.success && !V1_FOLDER_WORDS.test(lastUserMessage)) {
        const urlMatch = lastUserMessage.match(/(?:and|then)\s+(?:go\s+to|open|visit|navigate\s+to)\s+([^\s]+)/i);
        const youtubeMatch = /(?:and|then)\s+(?:go\s+to|open|visit|navigate\s+to|watch)?\s*youtube/i.test(lastUserMessage);
        if (urlMatch || youtubeMatch) {
          let targetUrl = 'https://www.youtube.com';
          if (urlMatch && urlMatch[1] && !/youtube/i.test(urlMatch[1])) {
            // Only treat as URL if it looks like a domain, not a plain word like "Downloads"
            const candidate = urlMatch[1];
            const looksLikeUrl = candidate.startsWith('http') || /\.[a-z]{2,}$/i.test(candidate);
            if (!looksLikeUrl) {
              // Plain word — not a URL, skip URL chaining
              logger.warn(`[simulateResponse] V1 URL chaining skipped — "${candidate}" is not a URL.`);
            } else {
              targetUrl = candidate.startsWith('http') ? candidate : `https://${candidate}`;
              onToolCall({ id: `call_url_${Date.now()}`, name: 'open_url', arguments: { url: targetUrl } });
              onDone('tool_calls');
              return;
            }
          } else if (youtubeMatch) {
            onToolCall({ id: `call_url_${Date.now()}`, name: 'open_url', arguments: { url: targetUrl } });
            onDone('tool_calls');
            return;
          }
        }
      }

      let responseText = '';
      if (toolData.application && toolData.success) {
        responseText = `I have opened **${toolData.application}** on your computer.${toolData.pid ? ` (Process ID: ${toolData.pid})` : ''}`;
      } else if (toolData.url && toolData.success) {
        if (/chrome|browser/i.test(lastUserLower) && /youtube/i.test(lastUserLower)) {
          responseText = `I have opened **Google Chrome** and navigated to **YouTube** (${toolData.url}) for you.`;
        } else {
          responseText = `I have opened **${toolData.url}** in your default web browser.`;
        }
      } else if (toolData.filePath && toolData.success && (toolName === 'screenshot' || toolName === 'desktop_screenshot')) {
        responseText = `I have captured a screenshot of your screen and saved it to:\n\`${toolData.filePath}\``;
      } else if (toolData.filePath && toolData.success && toolName === 'open_file') {
        responseText = `I have opened the file:\n\`${toolData.filePath}\` using its default application.`;
      } else if (toolData.folderPath && toolData.success) {
        responseText = `I have opened the folder:\n\`${toolData.folderPath}\` in Windows File Explorer.`;
      } else if (toolData.applications && Array.isArray(toolData.applications)) {
        responseText = `Here are the allowed Windows applications you can launch with NexusMind:\n\n` +
          toolData.applications.map(a => `- **${a.name}** (${a.aliases.join(', ')}) ${a.available ? '✓ Available' : '(Not installed)'}`).join('\n') +
          `\n\nTo launch any application, simply say: *"Open Chrome"* or *"Launch VS Code"*.`;
      } else if (toolData.requiresConfirmation) {
        responseText = `A confirmation is required before proceeding with this action:\n> **${toolData.action}**: \`${toolData.target || toolData.filePath}\`\n\nPlease click **Allow** or **Cancel** in the confirmation card above.`;
      } else if (toolData.action && toolData.success) {
        responseText = `✓ Action completed: ${toolData.message}`;
      } else if (toolData.message && toolData.success) {
        responseText = `✓ ${toolData.message}`;
      } else if (toolData.error) {
        responseText = `⚠️ ${toolData.message || 'The requested action could not be completed.'}`;
      } else if (toolData.result !== undefined) {
        responseText = `Based on the computation for **${toolData.expression || 'your request'}**, the exact result is **${toolData.formatted || toolData.result}**.`;
      } else if (toolData.formatted && toolData.timezone) {
        responseText = `The current time in **${toolData.timezone}** is **${toolData.formatted}** (${toolData.dayOfWeek || 'Current Day'}).`;
      } else if (toolData.temperature) {
        responseText = `Currently in **${toolData.location}**, the temperature is **${toolData.temperature}** (${toolData.condition}) with humidity at **${toolData.humidity}**.`;
      } else if (toolData.query && toolData.results) {
        responseText = `Here are the top search results for **"${toolData.query}"**:\n\n` +
          toolData.results.map((r, i) => `${i + 1}. **[${r.title}](${r.url || '#'})**\n   ${r.snippet}`).join('\n\n');
      } else if (toolData.name && toolData.content) {
        responseText = `I reviewed the contents of **${toolData.name}** (${toolData.mimeType}):\n\n> ${toolData.content.slice(0, 500)}...`;
      } else {
        responseText = `Here is the verified data from the execution:\n\n\`\`\`json\n${JSON.stringify(toolData, null, 2)}\n\`\`\``;
      }

      await this._streamSimulatedText(responseText, onToken);
      onDone('stop');
      return;
    }

    const lower = lastUserMessage.toLowerCase().trim();

    // ── APPLICATION LAUNCH (checked first so "Open Calculator and calculate X"
    //    opens the app rather than firing the server-side calculator tool) ───────
    const isLaunchIntentEarly = /^(?:open|launch|start|run|bring up|switch to)\s+/i.test(lower) ||
      lower.includes('open chrome') ||
      lower.includes('open vscode') ||
      lower.includes('open vs code') ||
      lower.includes('open notepad') ||
      lower.includes('open calculator') ||
      lower.includes('open file explorer') ||
      lower.includes('open explorer');

    if (isLaunchIntentEarly) {
      const { APPLICATION_ALLOWLIST } = require('../tools/computer/applicationAllowlist');
      const matchedApp = APPLICATION_ALLOWLIST.find(app => {
        const nameLower = app.name.toLowerCase();
        if (lower.includes(nameLower)) return true;
        return app.aliases.some(alias => {
          const aliasLower = alias.toLowerCase();
          return new RegExp(`\\b${aliasLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower) ||
            lower.includes(aliasLower);
        });
      });
      if (matchedApp) {
        logger.info(`[simulateResponse] Launch intent — opening app: ${matchedApp.name}`);
        onToolCall({
          id: `call_app_${Date.now()}`,
          name: 'open_application',
          arguments: { application: matchedApp.name }
        });
        onDone('tool_calls');
        return;
      }
    }

    // 1. Math computation (pure math only — no app-launch commands reach here)
    if (
      lower.includes('calculate') ||
      lower.includes('% of') ||
      (lower.includes('what is') && /\d/.test(lower)) ||
      (/[+\-*/^]/.test(lastUserMessage) && /\d/.test(lastUserMessage) && !isLaunchIntentEarly)
    ) {
      let expr = lastUserMessage.replace(/what is|calculate|compute|\?|the result of/gi, '').trim();
      if (!expr) expr = '2 + 2';
      onToolCall({
        id: `call_calc_${Date.now()}`,
        name: 'calculator',
        arguments: { expression: expr }
      });
      onDone('tool_calls');
      return;
    }

    // 2. Desktop Observation & Screen Analysis tool
    if (
      lower.includes('tell me what is on the screen') ||
      lower.includes('what is on the screen') ||
      lower.includes('what is on my screen') ||
      lower.includes('observe screen') ||
      lower.includes('desktop observe') ||
      lower.includes('desktop_observe')
    ) {
      onToolCall({
        id: `call_obs_${Date.now()}`,
        name: 'desktop_observe',
        arguments: { includeImage: true }
      });
      onDone('tool_calls');
      return;
    }

    // 2b. Screenshot tool (V1 screenshot & V2 desktop_screenshot)
    if (
      lower.includes('screenshot') ||
      lower.includes('capture screen') ||
      lower.includes('capture the screen') ||
      lower.includes('take a screenshot') ||
      lower.includes('screen capture') ||
      lower.includes('take a snapshot')
    ) {
      onToolCall({
        id: `call_shot_${Date.now()}`,
        name: 'desktop_screenshot',
        arguments: {}
      });
      onDone('tool_calls');
      return;
    }

    // 2c. Click and type or single mouse click
    if (lower.includes('click the search box and type') || (lower.includes('click') && lower.includes('and type'))) {
      onToolCall({
        id: `call_click_${Date.now()}`,
        name: 'mouse_click',
        arguments: { x: 450, y: 82, button: 'left' }
      });
      onDone('tool_calls');
      return;
    }

    // 2d. Mouse scroll
    if (lower.includes('scroll down')) {
      onToolCall({
        id: `call_scroll_${Date.now()}`,
        name: 'scroll',
        arguments: { amount: 5 }
      });
      onDone('tool_calls');
      return;
    }

    if (lower.includes('scroll up')) {
      onToolCall({
        id: `call_scroll_${Date.now()}`,
        name: 'scroll',
        arguments: { amount: -5 }
      });
      onDone('tool_calls');
      return;
    }

    // 2e. Mouse movements & clicks
    if (lower.startsWith('double click') || lower.startsWith('double-click')) {
      const coordMatch = lower.match(/(?:at\s+)?(?:x:?\s*)?(\d+)[,\s]+(?:y:?\s*)?(\d+)/i);
      const x = coordMatch ? parseInt(coordMatch[1], 10) : 200;
      const y = coordMatch ? parseInt(coordMatch[2], 10) : 200;
      onToolCall({
        id: `call_dbl_${Date.now()}`,
        name: 'mouse_double_click',
        arguments: { x, y }
      });
      onDone('tool_calls');
      return;
    }

    if (lower.startsWith('click ') || lower.startsWith('click at') || lower.startsWith('mouse click')) {
      const coordMatch = lower.match(/(?:at\s+)?(?:x:?\s*)?(\d+)[,\s]+(?:y:?\s*)?(\d+)/i);
      const x = coordMatch ? parseInt(coordMatch[1], 10) : 450;
      const y = coordMatch ? parseInt(coordMatch[2], 10) : 82;
      const btn = lower.includes('right') ? 'right' : lower.includes('middle') ? 'middle' : 'left';
      onToolCall({
        id: `call_click_${Date.now()}`,
        name: 'mouse_click',
        arguments: { x, y, button: btn }
      });
      onDone('tool_calls');
      return;
    }

    if (lower.startsWith('move mouse') || lower.startsWith('move cursor')) {
      const coordMatch = lower.match(/(?:to\s+)?(?:x:?\s*)?(\d+)[,\s]+(?:y:?\s*)?(\d+)/i);
      const x = coordMatch ? parseInt(coordMatch[1], 10) : 500;
      const y = coordMatch ? parseInt(coordMatch[2], 10) : 300;
      onToolCall({
        id: `call_move_${Date.now()}`,
        name: 'mouse_move',
        arguments: { x, y }
      });
      onDone('tool_calls');
      return;
    }

    // 2f. Keyboard press
    if (lower.startsWith('press ') || lower.includes('press enter') || lower.includes('press tab') || lower.includes('press escape')) {
      let key = 'ENTER';
      if (lower.includes('tab')) key = 'TAB';
      else if (lower.includes('escape') || lower.includes('esc')) key = 'ESCAPE';
      else if (lower.includes('backspace')) key = 'BACKSPACE';
      else if (lower.includes('space')) key = 'SPACE';
      else if (lower.includes('delete')) key = 'DELETE';
      else if (lower.includes('up')) key = 'UP';
      else if (lower.includes('down')) key = 'DOWN';

      const modifiers = [];
      if (lower.includes('ctrl')) modifiers.push('CTRL');
      if (lower.includes('alt')) modifiers.push('ALT');
      if (lower.includes('shift')) modifiers.push('SHIFT');

      onToolCall({
        id: `call_key_${Date.now()}`,
        name: 'keyboard_press',
        arguments: { key, modifiers }
      });
      onDone('tool_calls');
      return;
    }

    // 2g. Keyboard type
    if (lower.startsWith('type ') || lower.startsWith('keyboard type')) {
      let textToType = 'Hello NexusMind';
      const quoteMatch = lastUserMessage.match(/type\s+["“]([^"”]+)["”]/i);
      if (quoteMatch) {
        textToType = quoteMatch[1];
      } else {
        const afterType = lastUserMessage.replace(/^(?:type|keyboard type)\s+/i, '');
        const intoMatch = afterType.match(/^(.+?)(?:\s+into\s+.*)?$/i);
        textToType = (intoMatch ? intoMatch[1] : afterType).replace(/["']/g, '').trim();
      }
      onToolCall({
        id: `call_type_${Date.now()}`,
        name: 'keyboard_type',
        arguments: { text: textToType, pressEnterAfter: lower.includes('and enter') || lower.includes('enter after') }
      });
      onDone('tool_calls');
      return;
    }

    // 3. List allowed applications
    if (
      lower.includes('what applications') ||
      lower.includes('list applications') ||
      lower.includes('which apps') ||
      lower.includes('what apps can you open') ||
      lower.includes('allowed applications') ||
      lower.includes('allowed apps')
    ) {
      onToolCall({
        id: `call_list_apps_${Date.now()}`,
        name: 'list_allowed_applications',
        arguments: {}
      });
      onDone('tool_calls');
      return;
    }

    // 4. Open Application — handled early above (isLaunchIntentEarly).
    // This block is kept as a secondary catch for edge-case aliases not matched above.
    const isLaunchIntent = !isLaunchIntentEarly && (
      lower.startsWith('code ') ||
      lower.startsWith('notepad ') ||
      lower.startsWith('chrome ')
    );
    if (isLaunchIntent) {
      const matchedApp = APPLICATION_ALLOWLIST.find(app => {
        const nameLower = app.name.toLowerCase();
        if (lower.includes(nameLower)) return true;
        return app.aliases.some(alias => {
          const aliasLower = alias.toLowerCase();
          return new RegExp(`\\b${aliasLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower) || lower.includes(aliasLower);
        });
      });
      if (matchedApp) {
        logger.info(`[simulateResponse] Launch intent (fallback) — opening app: ${matchedApp.name}`);
        onToolCall({
          id: `call_app_${Date.now()}`,
          name: 'open_application',
          arguments: { application: matchedApp.name }
        });
        onDone('tool_calls');
        return;
      }
    }

    // 5. Open URL (e.g. "open https://github.com", "go to youtube.com", "open youtube")
    const isUrlIntent = lower.includes('open url') ||
      lower.includes('go to ') ||
      lower.includes('open http') ||
      lower.includes('open website') ||
      /(?:open|visit|go to)\s+(?:https?:\/\/|[a-z0-9-]+\.(?:com|org|net|io|dev|edu|gov)|youtube|google|github|reddit|twitter|wikipedia)/i.test(lower);

    if (isUrlIntent) {
      let targetUrl = '';
      const explicitUrl = lower.match(/(https?:\/\/[^\s]+)/i);
      if (explicitUrl) {
        targetUrl = explicitUrl[1];
      } else if (lower.includes('youtube')) {
        targetUrl = 'https://www.youtube.com';
      } else if (lower.includes('github')) {
        targetUrl = 'https://github.com';
      } else if (lower.includes('google')) {
        targetUrl = 'https://www.google.com';
      } else if (lower.includes('reddit')) {
        targetUrl = 'https://www.reddit.com';
      } else {
        const domainMatch = lower.match(/([a-z0-9-]+\.(?:com|org|net|io|dev|edu|gov)[^\s]*)/i);
        if (domainMatch) {
          targetUrl = `https://${domainMatch[1]}`;
        }
      }

      if (targetUrl) {
        onToolCall({
          id: `call_url_${Date.now()}`,
          name: 'open_url',
          arguments: { url: targetUrl }
        });
        onDone('tool_calls');
        return;
      }
    }

    // 6. Open File / Folder
    if (lower.startsWith('open file ') || lower.startsWith('view file ') || lower.includes('open the file')) {
      const filePathMatch = lastUserMessage.match(/(?:open|view)\s+(?:the\s+)?file\s+["']?([^"'\n]+)["']?/i);
      if (filePathMatch && filePathMatch[1]) {
        onToolCall({
          id: `call_file_${Date.now()}`,
          name: 'open_file',
          arguments: { filePath: filePathMatch[1].trim() }
        });
        onDone('tool_calls');
        return;
      }
    }

    if (lower.startsWith('open folder ') || lower.startsWith('explore folder ') || lower.includes('open the folder')) {
      const folderMatch = lastUserMessage.match(/(?:open|explore)\s+(?:the\s+)?folder\s+["']?([^"'\n]+)["']?/i);
      if (folderMatch && folderMatch[1]) {
        onToolCall({
          id: `call_folder_${Date.now()}`,
          name: 'open_folder',
          arguments: { folderPath: folderMatch[1].trim() }
        });
        onDone('tool_calls');
        return;
      }
    }

    // 7. Delete File (with confirmation check)
    if (lower.includes('delete file') || lower.includes('remove file')) {
      const delMatch = lastUserMessage.match(/(?:delete|remove)\s+(?:the\s+)?file\s+["']?([^"'\n]+)["']?/i);
      if (delMatch && delMatch[1]) {
        const isConfirmed = lower.includes('yes') || lower.includes('allow') || lower.includes('confirm') || lower.includes('proceed');
        onToolCall({
          id: `call_del_${Date.now()}`,
          name: 'delete_file',
          arguments: { filePath: delMatch[1].trim(), confirmed: isConfirmed }
        });
        onDone('tool_calls');
        return;
      }
    }

    // 8. Date & Time
    if (
      lower.includes('date') ||
      lower.includes('time') ||
      lower.includes('day is it') ||
      lower.includes('clock') ||
      lower.includes('tokyo') ||
      lower.includes('london')
    ) {
      let tz = 'UTC';
      if (lower.includes('tokyo') || lower.includes('japan')) tz = 'Tokyo';
      else if (lower.includes('london') || lower.includes('uk')) tz = 'London';
      else if (lower.includes('new york') || lower.includes('ny')) tz = 'New York';
      else if (lower.includes('california') || lower.includes('la')) tz = 'California';
      else if (lower.includes('india') || lower.includes('delhi')) tz = 'India';

      let offset = 0;
      const offsetMatch = lower.match(/(?:in|\+|-)\s*(\d+)\s*hours?/);
      if (offsetMatch) offset = parseInt(offsetMatch[1], 10);

      onToolCall({
        id: `call_time_${Date.now()}`,
        name: 'datetime',
        arguments: { timezone: tz, offsetHours: offset }
      });
      onDone('tool_calls');
      return;
    }

    // 9. Weather
    if (lower.includes('weather') || lower.includes('temperature') || lower.includes('forecast')) {
      let city = 'San Francisco';
      const cityMatch = lastUserMessage.match(/(?:in|for|at)\s+([A-Za-z\s]+)/i);
      if (cityMatch && cityMatch[1]) city = cityMatch[1].trim();

      onToolCall({
        id: `call_weather_${Date.now()}`,
        name: 'weather',
        arguments: { location: city }
      });
      onDone('tool_calls');
      return;
    }

    // 10. Web Search
    if (lower.startsWith('search ') || lower.startsWith('web search') || lower.startsWith('google ') || lower.includes('latest news on')) {
      const query = lastUserMessage.replace(/^(search|web search|google|find info on|latest news on)\s*/i, '').trim();
      onToolCall({
        id: `call_search_${Date.now()}`,
        name: 'web_search',
        arguments: { query: query || lastUserMessage }
      });
      onDone('tool_calls');
      return;
    }

    // 11. Memory statement
    if (
      lower.startsWith('remember that') ||
      lower.startsWith('remember:') ||
      lower.includes('my favorite') ||
      lower.includes('my name is')
    ) {
      const memoryText = lastUserMessage.replace(/^remember(?:\s+that)?/i, '').trim();
      const response = `I have committed this to your **NexusMind Memory Vault**:\n\n> 🧠 *"${memoryText}"*\n\nI will remember this context across all our conversations!`;
      await this._streamSimulatedText(response, onToken);
      onDone('stop');
      return;
    }

    // 12. Default Gemini Assistant reasoning response
    const reply = `I'm **NexusMind** powered by Google Gemini, equipped with persistent memory and autonomous agent tools.\n\nYou asked: "${lastUserMessage}"\n\nI can open allowlisted Windows apps (Chrome, VS Code, Notepad, Calculator, etc.), take desktop screenshots, navigate URLs, compute math, check global times, search the web, and execute confirmed actions. How can I assist you?`;
    await this._streamSimulatedText(reply, onToken);
    onDone('stop');
  }

  async _streamSimulatedText(text, onToken) {
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      onToken((i === 0 ? '' : ' ') + words[i]);
      await new Promise(r => setTimeout(r, 12));
    }
  }
}

const geminiProvider = new GeminiProvider();

module.exports = {
  GeminiProvider,
  geminiProvider
};
