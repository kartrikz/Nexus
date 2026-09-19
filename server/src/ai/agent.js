const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const { toolRegistry } = require('./tools/registry');
const { getProvider, geminiProvider } = require('./providers');
const { buildSystemPrompt } = require('./systemPrompt');
const logger = require('../utils/logger');

const MAX_TOOL_ITERATIONS = 12;

class Agent {
  constructor(provider = null, registry = toolRegistry) {
    this.defaultProvider = provider || geminiProvider;
    this.registry = registry;
  }

  async run({ conversationId, userId, userMessage, onEvent = () => {} }) {
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Fetch user & settings
    const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(userId);
    const settingsRows = db.prepare('SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?').all(userId);
    const customInstructions = settingsRows.find(s => s.setting_key === 'custom_instructions')?.setting_value || '';
    const providerSetting = settingsRows.find(s => s.setting_key === 'ai_provider')?.setting_value;
    const modelSetting = settingsRows.find(s => s.setting_key === 'ai_model')?.setting_value;
    const geminiKeySetting = settingsRows.find(s => s.setting_key === 'gemini_api_key')?.setting_value;
    const openaiKeySetting = settingsRows.find(s => s.setting_key === 'openai_api_key')?.setting_value;
    const claudeKeySetting = settingsRows.find(s => s.setting_key === 'claude_api_key')?.setting_value;

    const activeProvider = providerSetting ? getProvider(providerSetting) : this.defaultProvider;
    let userApiKey = null;
    if (providerSetting === 'openai') {
      userApiKey = openaiKeySetting;
    } else if (providerSetting === 'claude') {
      userApiKey = claudeKeySetting;
    } else {
      userApiKey = geminiKeySetting;
    }

    // 2. Fetch user memories
    const memories = db.prepare('SELECT category, content, importance FROM memories WHERE user_id = ? ORDER BY importance DESC LIMIT 10').all(userId);

    // 3. Save incoming user message to DB
    const userMsgId = uuidv4();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, user_id, role, content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userMsgId, conversationId, userId, 'user', userMessage, 'completed', now);

    // 4. Fetch conversation history
    const historyRows = db.prepare(`
      SELECT role, content, tool_calls, tool_results
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    // 5. Build system prompt
    const systemPrompt = buildSystemPrompt({
      username: user ? user.username : 'User',
      memories,
      customInstructions
    });

    // 6. Build OpenAI message payload
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    for (const row of historyRows) {
      if (row.role === 'user') {
        messages.push({ role: 'user', content: row.content });
      } else if (row.role === 'assistant') {
        const msgObj = { role: 'assistant', content: row.content || '' };
        if (row.tool_calls) {
          try { msgObj.tool_calls = JSON.parse(row.tool_calls); } catch {}
        }
        messages.push(msgObj);
      }
    }

    // Auto-detect and record memory if user explicitly says "remember that..."
    if (/^remember\s+(that\s+)?/i.test(userMessage.trim())) {
      const memoryContent = userMessage.trim().replace(/^remember\s+(that\s+)?/i, '').trim();
      if (memoryContent) {
        try {
          const memId = uuidv4();
          db.prepare(`
            INSERT INTO memories (id, user_id, category, content, importance, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(memId, userId, 'fact', memoryContent, 4, 'chat', now, now);
          logger.info(`Auto-recorded memory for user ${userId}: "${memoryContent}"`);
        } catch (memErr) {
          logger.warn(`Failed to auto-record memory: ${memErr.message}`);
        }
      }
    }

    const tools = this.registry.getOpenAISchemas();
    let iterations = 0;
    let finalAssistantText = '';
    const executedToolCalls = [];
    const executedToolResults = [];

    // Autonomous multi-step tool execution loop
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      let currentTurnText = '';
      const turnToolCalls = [];

      await activeProvider.streamChat({
        messages,
        tools,
        model: modelSetting || null,
        apiKey: userApiKey,
        onToken: (token) => {
          currentTurnText += token;
          onEvent({ type: 'token', token });
        },
        onToolCall: (tc) => {
          turnToolCalls.push(tc);
        },
        onDone: (reason) => {
          // Finish turn
        }
      });

      if (turnToolCalls.length > 0) {
        // Record assistant tool calls in message list
        messages.push({
          role: 'assistant',
          content: currentTurnText || null,
          tool_calls: turnToolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }))
        });

        // Execute each requested tool
        for (const tc of turnToolCalls) {
          onEvent({ type: 'tool_start', tool: tc.name, args: tc.arguments });

          const result = await this.registry.execute(tc.name, tc.arguments, { userId, conversationId });

          executedToolCalls.push({ name: tc.name, args: tc.arguments });
          executedToolResults.push({ name: tc.name, result });

          onEvent({ type: 'tool_end', tool: tc.name, result });

          // Settle delay for desktop input actions to allow window repainting and navigation
          const isDesktopAction = ['mouse_click', 'mouse_double_click', 'keyboard_type', 'keyboard_press'].includes(tc.name);
          if (tc.name === 'open_application') {
            await new Promise(r => setTimeout(r, 700));
          } else if (tc.name === 'keyboard_type' && tc.arguments?.pressEnterAfter) {
            await new Promise(r => setTimeout(r, 600));
          } else if (isDesktopAction) {
            await new Promise(r => setTimeout(r, 150));
          }

          // Append tool execution result for the next iteration
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.name,
            content: JSON.stringify(result)
          });
        }

        // Loop safety: prevent oscillation or repeated identical calls (3 in a row)
        if (executedToolCalls.length >= 3) {
          const last3 = executedToolCalls.slice(-3);
          const isIdentical = last3.every(
            call => call.name === last3[0].name && JSON.stringify(call.args) === JSON.stringify(last3[0].args)
          );
          if (isIdentical) {
            logger.warn(`Loop protection triggered: 3 identical calls to "${last3[0].name}". Breaking iteration loop.`);
            finalAssistantText = `I paused desktop automation because the action "${last3[0].name}" was requested repeatedly without interface state changes. Please review the current window state.`;
            break;
          }
        }

        // Continue next loop iteration to formulate answer based on tool outputs
        continue;
      } else {
        // Normal text response completed
        finalAssistantText = currentTurnText;
        break;
      }
    }

    // 7. Save Assistant Message in SQLite
    const asstMsgId = uuidv4();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, user_id, role, content, tool_calls, tool_results, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      asstMsgId,
      conversationId,
      userId,
      'assistant',
      finalAssistantText,
      executedToolCalls.length > 0 ? JSON.stringify(executedToolCalls) : null,
      executedToolResults.length > 0 ? JSON.stringify(executedToolResults) : null,
      'completed',
      new Date().toISOString()
    );

    // Update conversation timestamp
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), conversationId);

    // 8. Emit final completion event
    onEvent({
      type: 'message',
      messageId: asstMsgId,
      content: finalAssistantText,
      tool_calls: executedToolCalls,
      tool_results: executedToolResults
    });

    onEvent({ type: 'done' });
    return {
      messageId: asstMsgId,
      content: finalAssistantText,
      tool_calls: executedToolCalls
    };
  }
}

const agent = new Agent();

module.exports = {
  Agent,
  agent
};
