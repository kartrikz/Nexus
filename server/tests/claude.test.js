const test = require('node:test');
const assert = require('node:assert/strict');
const { claudeProvider, ClaudeProvider } = require('../src/ai/providers/claude');
const { getProvider, getAvailableProviders } = require('../src/ai/providers');

test('Phase 2.2: Anthropic Claude Provider & Interface Architecture', async (t) => {
  await t.test('Claude provider instantiates with default model and available models list', () => {
    assert.ok(claudeProvider instanceof ClaudeProvider);
    assert.equal(claudeProvider.getName(), 'claude');
    assert.ok(claudeProvider.getDefaultModel().includes('claude-3'));
    
    const available = claudeProvider.getAvailableModels();
    assert.ok(available.includes('claude-3-5-sonnet-20241022'));
    assert.ok(available.includes('claude-3-5-haiku-20241022'));
  });

  await t.test('getProvider factory returns Claude provider when requested', () => {
    const provider = getProvider('claude');
    assert.equal(provider.getName(), 'claude');
    assert.equal(provider, claudeProvider);
  });

  await t.test('getAvailableProviders returns metadata for Gemini, Claude, and OpenAI', () => {
    const list = getAvailableProviders();
    const ids = list.map(p => p.id);
    assert.ok(ids.includes('gemini'));
    assert.ok(ids.includes('claude'));
    assert.ok(ids.includes('openai'));
  });

  await t.test('Claude formats messages, system prompt, and tools according to Anthropic schema', () => {
    const messages = [
      { role: 'system', content: 'You are an AI assistant.' },
      { role: 'user', content: 'What is 5 + 5?' }
    ];
    const tools = [
      {
        type: 'function',
        function: {
          name: 'calculator',
          description: 'Evaluate mathematical expressions',
          parameters: {
            type: 'object',
            properties: {
              expression: { type: 'string' }
            },
            required: ['expression']
          }
        }
      }
    ];

    const payload = claudeProvider._formatClaudePayload(messages, tools, 0.5, 'claude-3-5-sonnet-20241022');
    assert.equal(payload.model, 'claude-3-5-sonnet-20241022');
    assert.equal(payload.system, 'You are an AI assistant.');
    assert.equal(payload.messages.length, 1);
    assert.equal(payload.messages[0].role, 'user');
    assert.equal(payload.messages[0].content, 'What is 5 + 5?');
    assert.equal(payload.tools.length, 1);
    assert.equal(payload.tools[0].name, 'calculator');
    assert.ok(payload.tools[0].input_schema);
  });

  await t.test('Claude simulator streams response and dispatches tool calls properly', async () => {
    const messages = [{ role: 'user', content: 'calculate 45 * 2' }];
    const tokens = [];
    const toolCalls = [];
    let finishReason = null;

    await claudeProvider.streamChat({
      messages,
      tools: [],
      onToken: (t) => tokens.push(t),
      onToolCall: (tc) => toolCalls.push(tc),
      onDone: (reason) => { finishReason = reason; }
    });

    assert.equal(finishReason, 'tool_calls');
    assert.equal(toolCalls.length, 1);
    assert.equal(toolCalls[0].name, 'calculator');
    assert.ok(toolCalls[0].arguments.expression.includes('45 * 2'));
  });
});
