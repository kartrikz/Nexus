const { test, describe } = require('node:test');
const assert = require('node:assert');
const { GeminiProvider, geminiProvider } = require('../src/ai/providers/gemini');
const { getProvider } = require('../src/ai/providers');

describe('Phase 2.1: Gemini Provider & Architecture Tests', () => {
  test('Gemini provider instantiates with default model and supports custom model', () => {
    assert.strictEqual(geminiProvider.defaultModel, 'gemini-2.5-flash');
    const custom = new GeminiProvider();
    assert.ok(custom);
  });

  test('getProvider factory returns Gemini by default and supports OpenAI', () => {
    const defaultProv = getProvider();
    assert.ok(defaultProv instanceof GeminiProvider);

    const explicitGemini = getProvider('gemini');
    assert.ok(explicitGemini instanceof GeminiProvider);

    const openai = getProvider('openai');
    assert.ok(openai);
  });

  test('Gemini formats messages, tools, and system instructions correctly', () => {
    const provider = new GeminiProvider();
    const messages = [
      { role: 'system', content: 'You are NexusMind.' },
      { role: 'user', content: 'Calculate 15 * 8' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_1',
          function: { name: 'calculator', arguments: JSON.stringify({ expression: '15 * 8' }) }
        }]
      },
      { role: 'tool', name: 'calculator', content: JSON.stringify({ result: 120 }) }
    ];

    const tools = [
      {
        function: {
          name: 'calculator',
          description: 'Safe math evaluator',
          parameters: {
            type: 'object',
            properties: { expression: { type: 'string' } },
            required: ['expression']
          }
        }
      }
    ];

    const payload = provider._formatGeminiPayload(messages, tools, 0.5, 'gemini-2.5-flash');
    assert.strictEqual(payload.systemInstruction.parts[0].text, 'You are NexusMind.');
    assert.ok(Array.isArray(payload.contents));
    assert.strictEqual(payload.contents[0].role, 'user');
    assert.strictEqual(payload.contents[0].parts[0].text, 'Calculate 15 * 8');
    assert.strictEqual(payload.contents[1].role, 'model');
    assert.strictEqual(payload.contents[1].parts[0].functionCall.name, 'calculator');
    assert.strictEqual(payload.tools[0].functionDeclarations[0].name, 'calculator');
  });

  test('Gemini simulator streams response and triggers tool calls correctly in zero-key environment', async () => {
    const provider = new GeminiProvider();
    let tokens = '';
    let toolCallReceived = null;
    let doneStatus = null;

    await provider.streamChat({
      messages: [{ role: 'user', content: 'What is 50 * 4?' }],
      onToken: (tok) => { tokens += tok; },
      onToolCall: (tc) => { toolCallReceived = tc; },
      onDone: (reason) => { doneStatus = reason; }
    });

    assert.ok(toolCallReceived, 'Should detect math and trigger calculator tool call');
    assert.strictEqual(toolCallReceived.name, 'calculator');
    assert.strictEqual(doneStatus, 'tool_calls');
  });
});
