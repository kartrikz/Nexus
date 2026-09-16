const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, `test_agent_${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test_agent_secret';
process.env.NODE_ENV = 'test';

const { getDb } = require('../src/db/connection');
const { initSchema } = require('../src/db/schema');
const { agent } = require('../src/ai/agent');
const { v4: uuidv4 } = require('uuid');

describe('Phase 2: Agent Loop Integration Tests', () => {
  let userId;
  let convId;

  before(() => {
    initSchema();
    const db = getDb();
    userId = uuidv4();
    convId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, 'testagent@nexus.ai', 'AgentTester', 'hash', now, now);

    db.prepare(`
      INSERT INTO conversations (id, user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(convId, userId, 'Agent Integration Test', now, now);
  });

  after(() => {
    try {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    } catch {}
  });

  test('Agent responds to user question, executes calculator tool, and saves both messages', async () => {
    const db = getDb();
    const emittedEvents = [];

    const result = await agent.run({
      conversationId: convId,
      userId,
      userMessage: 'Calculate 15% of 340',
      onEvent: (ev) => {
        emittedEvents.push(ev);
      }
    });

    assert.ok(result.messageId, 'Should return assistant message ID');
    assert.ok(result.content.includes('51'), 'Should contain calculated result 51');

    // Check emitted events
    const toolStart = emittedEvents.find(e => e.type === 'tool_start');
    assert.ok(toolStart, 'Should emit tool_start event');
    assert.strictEqual(toolStart.tool, 'calculator');

    const toolEnd = emittedEvents.find(e => e.type === 'tool_end');
    assert.ok(toolEnd, 'Should emit tool_end event');
    assert.strictEqual(toolEnd.result.result, 51);

    const tokens = emittedEvents.filter(e => e.type === 'token');
    assert.ok(tokens.length > 0, 'Should stream text tokens');

    // Verify messages saved in DB
    const savedMessages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(convId);
    assert.strictEqual(savedMessages.length, 2);
    assert.strictEqual(savedMessages[0].role, 'user');
    assert.strictEqual(savedMessages[0].content, 'Calculate 15% of 340');
    assert.strictEqual(savedMessages[1].role, 'assistant');
    assert.ok(savedMessages[1].content.includes('51'));
    assert.ok(savedMessages[1].tool_calls);
  });

  test('Agent answers general questions with streaming and identity context', async () => {
    const emittedEvents = [];
    const result = await agent.run({
      conversationId: convId,
      userId,
      userMessage: 'Who are you and what can you do?',
      onEvent: (ev) => emittedEvents.push(ev)
    });

    assert.ok(result.content.includes('NexusMind'));
    const tokens = emittedEvents.filter(e => e.type === 'token');
    assert.ok(tokens.length > 0);
  });
});
