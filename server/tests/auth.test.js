const path = require('path');
const fs = require('fs');

// Set env vars BEFORE requiring app or db modules
const TEST_DB = path.join(__dirname, `test_auth_${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { getDb } = require('../src/db/connection');
const { initSchema } = require('../src/db/schema');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('../src/utils/crypto');
const app = require('../src/app');

describe('Phase 1: Database & Authentication Unit & API Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    initSchema();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    // Cleanup db file safely
    try {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    } catch {}
  });

  test('Database tables exist and can insert records', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);

    assert.ok(tableNames.includes('users'), 'users table should exist');
    assert.ok(tableNames.includes('conversations'), 'conversations table should exist');
    assert.ok(tableNames.includes('messages'), 'messages table should exist');
    assert.ok(tableNames.includes('memories'), 'memories table should exist');
  });

  test('Password hashing and verification work securely', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    assert.notStrictEqual(password, hash);
    const valid = await comparePassword(password, hash);
    assert.strictEqual(valid, true);

    const invalid = await comparePassword('WrongPassword', hash);
    assert.strictEqual(invalid, false);
  });

  test('JWT generation and decoding work', () => {
    const payload = { userId: 'u-123', email: 'test@nexus.ai' };
    const token = generateToken(payload);
    assert.ok(typeof token === 'string');

    const decoded = verifyToken(token);
    assert.strictEqual(decoded.userId, 'u-123');
    assert.strictEqual(decoded.email, 'test@nexus.ai');
  });

  test('POST /api/auth/register creates user, default conversation, and returns token', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        username: 'AlexHunter',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.user);
    assert.strictEqual(data.user.email, 'alex@example.com');
    assert.strictEqual(data.user.username, 'AlexHunter');
    assert.ok(data.token);

    // Verify duplicate registration rejection
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        username: 'Alex2',
        password: 'password123'
      })
    });
    assert.strictEqual(dupRes.status, 409);
  });

  test('POST /api/auth/login succeeds with correct password and fails with wrong', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.email, 'alex@example.com');
    assert.ok(data.token);

    const badRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'wrongpassword'
      })
    });
    assert.strictEqual(badRes.status, 401);
  });

  test('GET /api/auth/me returns current user with Bearer token', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123'
      })
    });
    const { token } = await loginRes.json();

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.user.email, 'alex@example.com');
  });

  test('Protected routes reject unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/conversations`);
    assert.strictEqual(res.status, 401);
  });
});
