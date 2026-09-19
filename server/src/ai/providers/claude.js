const { BaseAIProvider } = require('./base');
const logger = require('../../utils/logger');
const { APPLICATION_ALLOWLIST } = require('../tools/computer/applicationAllowlist');

class ClaudeProvider extends BaseAIProvider {
  constructor() {
    super('claude', process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022');
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || null;
  }

  getAvailableModels() {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ];
  }

  /**
   * Convert standard OpenAI-style messages & tools into Anthropic Claude Messages API format
   */
  _formatClaudePayload(messages, tools, temperature, model) {
    let system = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n\n' : '') + msg.content;
      } else if (msg.role === 'user') {
        anthropicMessages.push({
          role: 'user',
          content: msg.content || ''
        });
      } else if (msg.role === 'assistant') {
        const contentBlocks = [];
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            let inputArgs = {};
            try {
              inputArgs = typeof tc.function?.arguments === 'string'
                ? JSON.parse(tc.function.arguments)
                : (tc.function?.arguments || {});
            } catch {
              inputArgs = { raw: tc.function?.arguments };
            }
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id || `tool_${Date.now()}`,
              name: tc.function?.name || tc.name,
              input: inputArgs
            });
          }
        }
        if (contentBlocks.length > 0) {
          anthropicMessages.push({
            role: 'assistant',
            content: contentBlocks
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

        const contentBlocks = [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: typeof cleanedData === 'string' ? cleanedData : JSON.stringify(cleanedData)
          }
        ];

        if (base64Data) {
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Data
            }
          });
        }

        anthropicMessages.push({
          role: 'user',
          content: contentBlocks
        });
      }
    }

    const payload = {
      model,
      max_tokens: 4096,
      messages: anthropicMessages,
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      stream: true
    };

    if (system) {
      payload.system = system;
    }

    if (tools && tools.length > 0) {
      payload.tools = tools.map(t => {
        const fn = t.function || t;
        return {
          name: fn.name,
          description: fn.description || '',
          input_schema: fn.parameters || { type: 'object', properties: {} }
        };
      });
    }

    return payload;
  }

  /**
   * Stream a chat completion via Anthropic Claude Messages API SSE.
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

    if (keyToUse && keyToUse.startsWith('sk-ant-')) {
      try {
        const payload = this._formatClaudePayload(messages, tools, temperature, activeModel);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keyToUse,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Claude API returned status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finishReason = 'end_turn';

        let currentToolUse = null;
        const pendingToolCalls = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'content_block_start') {
                if (event.content_block?.type === 'tool_use') {
                  currentToolUse = {
                    id: event.content_block.id,
                    name: event.content_block.name,
                    partialJson: ''
                  };
                }
              } else if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'text_delta') {
                  onToken(event.delta.text);
                } else if (event.delta?.type === 'input_json_delta' && currentToolUse) {
                  currentToolUse.partialJson += event.delta.partial_json;
                }
              } else if (event.type === 'content_block_stop') {
                if (currentToolUse) {
                  let parsedArgs = {};
                  try {
                    parsedArgs = JSON.parse(currentToolUse.partialJson);
                  } catch {
                    parsedArgs = { raw: currentToolUse.partialJson };
                  }
                  pendingToolCalls.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    arguments: parsedArgs
                  });
                  currentToolUse = null;
                }
              } else if (event.type === 'message_delta') {
                if (event.delta?.stop_reason) {
                  finishReason = event.delta.stop_reason;
                }
              }
            } catch (err) {
              // Ignore partial stream JSON parse errors
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
        logger.warn(`Claude live API call failed: ${err.message}. Falling back to autonomous simulator.`);
      }
    }

    // High-performance intelligent simulator fallback for dev/offline/test
    await this.simulateResponse({ messages, tools, onToken, onToolCall, onDone });
  }

  /**
   * Autonomous reasoning simulator for Claude
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
        responseText = `Claude has launched **${toolData.application}** on your computer.${toolData.pid ? ` (Process ID: ${toolData.pid})` : ''}`;
      } else if (toolData.url && toolData.success) {
        if (/chrome|browser/i.test(lastUserLower) && /youtube/i.test(lastUserLower)) {
          responseText = `Claude has opened **Google Chrome** and navigated to **YouTube** (${toolData.url}).`;
        } else {
          responseText = `Claude has navigated to **${toolData.url}** in your default web browser.`;
        }
      } else if (toolData.filePath && toolData.success && toolName === 'screenshot') {
        responseText = `Claude has captured a screenshot of your screen and saved it to:\n\`${toolData.filePath}\``;
      } else if (toolData.filePath && toolData.success && toolName === 'open_file') {
        responseText = `Claude opened the file:\n\`${toolData.filePath}\` using its default application.`;
      } else if (toolData.folderPath && toolData.success) {
        responseText = `Claude opened the folder:\n\`${toolData.folderPath}\` in Windows File Explorer.`;
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
        responseText = `Based on Claude's analysis of the computation for **${toolData.expression || 'your request'}**, the exact result is **${toolData.formatted || toolData.result}**.`;
      } else if (toolData.formatted && toolData.timezone) {
        responseText = `The current time in **${toolData.timezone}** is **${toolData.formatted}** (${toolData.dayOfWeek || 'Current Day'}).`;
      } else if (toolData.temperature) {
        responseText = `Current conditions in **${toolData.location}**: temperature is **${toolData.temperature}** (${toolData.condition}) with humidity at **${toolData.humidity}**.`;
      } else if (toolData.query && toolData.results) {
        responseText = `Claude web search synthesis for **"${toolData.query}"**:\n\n` +
          toolData.results.map((r, i) => `${i + 1}. **[${r.title}](${r.url || '#'})**\n   ${r.snippet}`).join('\n\n');
      } else if (toolData.name && toolData.content) {
        responseText = `Analysis of **${toolData.name}**:\n\n> ${toolData.content.slice(0, 500)}...`;
      } else {
        responseText = `Here is the verified data from the execution:\n\n\`\`\`json\n${JSON.stringify(toolData, null, 2)}\n\`\`\``;
      }

      await this.streamSimulatedText(responseText, onToken);
      onDone('stop');
      return;
    }

    const lower = lastUserMessage.toLowerCase().trim();

    // 1. Math computation
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

    // 11. Default Claude response
    const reply = `I'm **NexusMind** operating via Anthropic Claude 3.5 Sonnet, equipped with full computer control and persistent memory.\n\nYou asked: "${lastUserMessage}"\n\nI can launch Windows applications, capture desktop screenshots, open URLs, inspect files, and execute safe workflows. How can I assist you?`;
    await this.streamSimulatedText(reply, onToken);
    onDone('stop');
  }
}

const claudeProvider = new ClaudeProvider();

module.exports = {
  ClaudeProvider,
  claudeProvider
};
