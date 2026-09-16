const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, `test_settings_${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test_settings_secret';
process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { initSchema } = require('../src/db/schema');
const app = require('../src/app');

let server;
let baseUrl;
let authToken;

describe('Phase 3.2: Settings API Tests', () => {
  before(async () => {
    initSchema();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `settings_user_${Date.now()}@example.com`,
        username: 'SettingsUser',
        password: 'Password123!'
      })
    });
    const data = await res.json();
    authToken = data.token;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('POST /api/settings saves user settings and GET /api/settings retrieves them', async () => {
    const postRes = await fetch(`${baseUrl}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        key: 'ai_provider',
        value: 'gemini'
      })
    });
    assert.strictEqual(postRes.status, 200);

    const postTheme = await fetch(`${baseUrl}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        key: 'theme',
        value: 'cyberpunk'
      })
    });
    assert.strictEqual(postTheme.status, 200);

    const getRes = await fetch(`${baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(getRes.status, 200);
    const data = await getRes.json();
    assert.strictEqual(data.settings.ai_provider, 'gemini');
    assert.strictEqual(data.settings.theme, 'cyberpunk');
  });
});
