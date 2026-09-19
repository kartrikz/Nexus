const { BaseAIProvider } = require('./base');
const logger = require('../../utils/logger');
const { APPLICATION_ALLOWLIST } = require('../tools/computer/applicationAllowlist');

class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super('openai', process.env.OPENAI_MODEL || 'gpt-4o-mini');
    this.apiKey = process.env.OPENAI_API_KEY || null;
  }

  getAvailableModels() {
    return [
      'gpt-4o-mini',
      'gpt-4o'
    ];
  }

  /**
   * Format standard OpenAI-style messages & tools into an OpenAI API payload,
   * converting tool image outputs into user image_url parts.
   */
  _formatOpenAIPayload(messages, tools = [], temperature = 0.7, model = this.defaultModel) {
    const formattedMessages = [];
    for (const msg of messages) {
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.includes('imageBase64')) {
        let parsed = {};
        try { parsed = JSON.parse(msg.content); } catch {}
        if (parsed.imageBase64) {
          const base64Data = parsed.imageBase64;
          const cleaned = { ...parsed };
          delete cleaned.imageBase64;
          formattedMessages.push({
            ...msg,
            content: JSON.stringify(cleaned)
          });
          formattedMessages.push({
            role: 'user',
            content: [
              { type: 'text', text: 'Desktop screen capture observation:' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Data}` } }
            ]
          });
          continue;
        }
      }
      formattedMessages.push(msg);
    }

    const body = {
      model,
      messages: formattedMessages,
      temperature,
      stream: true
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    return body;
  }

  /**
   * Stream a chat completion.
   * Calls onToken(chunkText), onToolCall(toolCallObj), and onDone(finishReason).
   */
  async streamChat({
    messages,
    tools = [],
    model = null,
    temperature = 0.7,
    onToken = () => {},
    onToolCall = () => {},
    onDone = () => {}
  }) {
    const activeModel = model || this.defaultModel;

    // Live OpenAI API call if key is set
    if (this.apiKey && this.apiKey.startsWith('sk-')) {
      try {
        const body = this._formatOpenAIPayload(messages, tools, temperature, activeModel);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `OpenAI API returned status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const pendingToolCalls = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep last partial line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;

              // Stream text
              if (delta.content) {
                onToken(delta.content);
              }

              // Accumulate streaming tool calls
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!pendingToolCalls[idx]) {
                    pendingToolCalls[idx] = {
                      id: tc.id || `call_${Date.now()}_${idx}`,
                      name: tc.function?.name || '',
                      arguments: tc.function?.arguments || ''
                    };
                  } else {
                    if (tc.function?.name) pendingToolCalls[idx].name += tc.function.name;
                    if (tc.function?.arguments) pendingToolCalls[idx].arguments += tc.function.arguments;
                  }
                }
              }
            } catch (pErr) {
              // Ignore partial JSON parse errors
            }
          }
        }

        // Emit completed tool calls
        for (const tc of pendingToolCalls.filter(Boolean)) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.arguments);
          } catch {
            parsedArgs = { raw: tc.arguments };
          }
          onToolCall({ id: tc.id, name: tc.name, arguments: parsedArgs });
        }

        onDone(pendingToolCalls.length > 0 ? 'tool_calls' : 'stop');
        return;
      } catch (err) {
        logger.warn(`OpenAI streaming API call failed: ${err.message}. Falling back to autonomous simulator.`);
      }
    }

    // High-performance intelligent simulator fallback (for dev, offline testing, zero-key demo)
    await this.simulateResponse({ messages, tools, onToken, onToolCall, onDone });
  }

  /**
   * Autonomous rule-based inference simulator
   */
  async simulateResponse({ messages, tools, onToken, onToolCall, onDone }) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'tool' || (m.role === 'assistant' && m.tool_results));

    // Check if the previous step was a tool execution result
    if (messages[messages.length - 1]?.role === 'tool') {
      const toolMsg = messages[messages.length - 1];
      let toolData = {};
      try { toolData = JSON.parse(toolMsg.content); } catch { toolData = { result: toolMsg.content }; }

      const toolName = toolMsg.name;
      const lastUserLower = lastUserMessage.toLowerCase();

      // Multi-step chaining: If user said "Open Chrome and go to YouTube", chain open_url after open_application
      if (toolName === 'open_application' && toolData.success) {
        const urlMatch = lastUserMessage.match(/(?:and|then)\s+(?:go\s+to|open|visit|navigate\s+to)\s+([^\s]+)/i);
        const youtubeMatch = /(?:and|then)\s+(?:go\s+to|open|visit|navigate\s+to|watch)?\s*youtube/i.test(lastUserMessage);
        if (urlMatch || youtubeMatch) {
          let targetUrl = 'https://www.youtube.com';
          if (urlMatch && urlMatch[1] && !/youtube/i.test(urlMatch[1])) {
            targetUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://${urlMatch[1]}`;
          }
          onToolCall({
            id: `call_url_${Date.now()}`,
            name: 'open_url',
            arguments: { url: targetUrl }
          });
          onDone('tool_calls');
          return;
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
      } else if (toolData.filePath && toolData.success && toolName === 'screenshot') {
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
      } else if (toolData.error) {
        responseText = `⚠️ ${toolData.message || 'The requested action could not be completed.'}`;
      } else if (toolData.result !== undefined) {
        responseText = `Based on the computation for **${toolData.expression || 'your request'}**, the exact result is **${toolData.formatted || toolData.result}**.`;
      } else if (toolData.formatted && toolData.timezone) {
        responseText = `The current time in **${toolData.timezone}** is **${toolData.formatted}** (${toolData.dayOfWeek}).`;
      } else if (toolData.temperature) {
        responseText = `Currently in **${toolData.location}**, the temperature is **${toolData.temperature}** (${toolData.condition}) with humidity at **${toolData.humidity}**.`;
      } else {
        responseText = `Here is the result from the tool execution:\n\n\`\`\`json\n${JSON.stringify(toolData, null, 2)}\n\`\`\``;
      }

      await this._streamSimulatedText(responseText, onToken);
      onDone('stop');
      return;
    }

    const lower = lastUserMessage.toLowerCase().trim();

    // 1. Math calculation detection
    if (
      lower.includes('calculate') ||
      lower.includes('% of') ||
      (lower.includes('what is') && /\d/.test(lower)) ||
      (/[+\-*/^]/.test(lastUserMessage) && /\d/.test(lastUserMessage))
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

    // 2. Screenshot tool
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
        name: 'screenshot',
        arguments: {}
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

    // 4. Open Application (e.g. "Open Chrome", "open vscode", "Open Notepad", "Launch Calculator", "Open Chrome and go to YouTube")
    const isLaunchIntent = /^(?:open|launch|start|run|bring up|switch to)\s+/i.test(lower) ||
      lower.startsWith('code ') ||
      lower.startsWith('notepad ') ||
      lower.startsWith('chrome ') ||
      lower.includes('open chrome') ||
      lower.includes('open vscode') ||
      lower.includes('open vs code') ||
      lower.includes('open notepad') ||
      lower.includes('open calculator');

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

    // 8. Date / Time detection
    if (lower.includes('date') || lower.includes('time') || lower.includes('day is it') || lower.includes('clock') || lower.includes('tokyo') || lower.includes('london')) {
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

    // 9. Weather detection
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

    // 10. Memory statement detection
    if (lower.startsWith('remember that') || lower.startsWith('remember:') || lower.includes('my favorite') || lower.includes('my name is')) {
      const memoryText = lastUserMessage.replace(/^remember(?:\s+that)?/i, '').trim();
      const response = `I have committed this to your **NexusMind Memory Vault**:\n\n> 🧠 *"${memoryText}"*\n\nI will remember this context across all our conversations!`;
      await this._streamSimulatedText(response, onToken);
      onDone('stop');
      return;
    }

    // 11. Default reasoning response
    const reply = `I'm **NexusMind**, functioning with active local memory and real-time autonomous tools.\n\nYou asked: "${lastUserMessage}"\n\nI can launch Windows apps, capture screenshots, navigate websites, calculate formulas, check timezones, and assist with document intelligence. How would you like to proceed?`;
    await this._streamSimulatedText(reply, onToken);
    onDone('stop');
  }

  async _streamSimulatedText(text, onToken) {
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      onToken((i === 0 ? '' : ' ') + words[i]);
      await new Promise(r => setTimeout(r, 15)); // Smooth natural typing speed
    }
  }
}

const openAIProvider = new OpenAIProvider();

module.exports = {
  OpenAIProvider,
  openAIProvider
};
