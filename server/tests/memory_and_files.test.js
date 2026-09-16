const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { getDb } = require('../src/db/connection');

let server;
let baseUrl;
let authToken;
let userId;

describe('Phase 3: Memory Vault & File Management Integration Tests', () => {
  before(async () => {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // Register a test user
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `tester_${Date.now()}@example.com`,
        username: 'TestUser',
        password: 'Password123!'
      })
    });

    const data = await res.json();
    authToken = data.token;
    userId = data.user.id;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('POST /api/memories creates a new memory', async () => {
    const res = await fetch(`${baseUrl}/api/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        content: 'User prefers dark mode and concise responses.',
        category: 'preference',
        importance: 5
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.memory);
    assert.strictEqual(data.memory.category, 'preference');
    assert.strictEqual(data.memory.importance, 5);
  });

  test('GET /api/memories lists and filters memories', async () => {
    const res = await fetch(`${baseUrl}/api/memories?category=preference`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.memories));
    assert.ok(data.memories.length >= 1);
    assert.strictEqual(data.memories[0].category, 'preference');
  });

  test('PATCH /api/memories/:id updates a memory', async () => {
    // Get list first
    const listRes = await fetch(`${baseUrl}/api/memories`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const listData = await listRes.json();
    const memId = listData.memories[0].id;

    const patchRes = await fetch(`${baseUrl}/api/memories/${memId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        content: 'User prefers dark cyberpunk mode.',
        importance: 4
      })
    });

    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.strictEqual(patchData.memory.content, 'User prefers dark cyberpunk mode.');
    assert.strictEqual(patchData.memory.importance, 4);
  });

  test('POST /api/files/upload handles multipart file upload and text extraction', async () => {
    const testContent = 'NexusMind is an advanced autonomous personal assistant with multimodal capabilities.';
    const boundary = '----WebKitFormBoundaryNexusTest' + Date.now();

    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="nexus_doc.txt"',
      'Content-Type: text/plain',
      '',
      testContent,
      `--${boundary}--`
    ].join('\r\n');

    const res = await fetch(`${baseUrl}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${authToken}`
      },
      body
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.file);
    assert.strictEqual(data.file.original_name, 'nexus_doc.txt');
    assert.ok(data.file.extracted_text.includes('multimodal capabilities'));
  });

  test('GET /api/files lists uploaded files', async () => {
    const res = await fetch(`${baseUrl}/api/files`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.files));
    assert.ok(data.files.length >= 1);
  });

  test('DELETE /api/memories/:id and DELETE /api/files/:id remove items', async () => {
    const mRes = await fetch(`${baseUrl}/api/memories`, { headers: { Authorization: `Bearer ${authToken}` } });
    const mData = await mRes.json();
    const memId = mData.memories[0].id;

    const delMRes = await fetch(`${baseUrl}/api/memories/${memId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(delMRes.status, 200);

    const fRes = await fetch(`${baseUrl}/api/files`, { headers: { Authorization: `Bearer ${authToken}` } });
    const fData = await fRes.json();
    const fileId = fData.files[0].id;

    const delFRes = await fetch(`${baseUrl}/api/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(delFRes.status, 200);
  });
});
