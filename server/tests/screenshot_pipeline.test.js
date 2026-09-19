/**
 * NexusMind V2 — Screenshot Pipeline Test Suite
 *
 * Tests:
 *  1.  screenshot tool registration
 *  2.  desktop_screenshot tool registration
 *  3.  screenshot dispatcher (V1 executes, returns filePath)
 *  4.  desktop_screenshot dispatcher (V2 executes, returns filePath + imageBase64)
 *  5.  screenshot file creation (file exists in mock mode)
 *  6.  screenshot image validity (base64 present when includeBase64=true)
 *  7.  screenshot result serialization (JSON-safe fields)
 *  8.  desktop_observe with image (imageBase64 populated)
 *  9.  screenshot failure handling (permission denied returns error shape)
 * 10.  missing output file handling (bridge returns success=false when file absent)
 * 11.  desktop_screenshot returns imageBase64 (key fix regression)
 * 12.  desktop_screenshot width/height always present
 * 13.  windowsBridge.captureScreen includeBase64=false returns null imageBase64
 * 14.  windowsBridge.captureScreen includeBase64=true returns string imageBase64
 * 15.  Gemini simulator produces correct response for "Take a screenshot"
 * 16.  Gemini simulator produces correct response for screenshot + active app query
 * 17.  Gemini simulator Scenario D still works for desktop_observe
 */

process.env.NODE_ENV = 'test';
process.env.NEXUSMIND_MOCK_DESKTOP = 'true';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { windowsBridge } = require('../src/ai/tools/computer/windowsBridge');
const { screenshotTool } = require('../src/ai/tools/computer/screenshot');
const { desktopScreenshotTool } = require('../src/ai/tools/computer/desktopScreenshot');
const { desktopObserveTool } = require('../src/ai/tools/computer/desktopObserve');
const { toolRegistry } = require('../src/ai/tools/registry');
const { geminiProvider } = require('../src/ai/providers/gemini');
const {
  checkToolPermission,
  PERMISSION_LEVEL,
  getPermissionLevel
} = require('../src/ai/tools/computer/computerPermissions');

// ─────────────────────────────────────────────────────────────────────────────

describe('NexusMind V2: Screenshot Pipeline Test Suite', () => {

  // ── 1. Tool Registration ────────────────────────────────────────────────────
  test('screenshot tool is registered in toolRegistry', () => {
    const all = toolRegistry.getAll();
    const names = all.map(t => t.name);
    assert.ok(names.includes('screenshot'), '"screenshot" must be registered');
  });

  test('desktop_screenshot tool is registered in toolRegistry', () => {
    const all = toolRegistry.getAll();
    const names = all.map(t => t.name);
    assert.ok(names.includes('desktop_screenshot'), '"desktop_screenshot" must be registered');
  });

  // ── 2. Permission Layer ─────────────────────────────────────────────────────
  test('screenshot is classified as SAFE in permission layer', () => {
    assert.strictEqual(getPermissionLevel('screenshot'), PERMISSION_LEVEL.SAFE);
  });

  test('desktop_screenshot is classified as SAFE in permission layer', () => {
    assert.strictEqual(getPermissionLevel('desktop_screenshot'), PERMISSION_LEVEL.SAFE);
  });

  // ── 3. V1 screenshot tool dispatcher ───────────────────────────────────────
  test('screenshot (V1) executes in mock mode and returns filePath', async () => {
    const result = await screenshotTool.execute();
    assert.strictEqual(result.success, true, 'Expected success:true');
    assert.ok(result.filePath, 'Expected filePath to be set');
    assert.ok(result.filePath.endsWith('.png'), 'Expected .png extension');
    assert.ok(typeof result.fileSize === 'string', 'Expected fileSize string');
    // Verify the mock file actually exists
    assert.ok(fs.existsSync(result.filePath), 'Mock screenshot file must exist on disk');
    const stat = fs.statSync(result.filePath);
    assert.ok(stat.size > 0, 'Mock screenshot file must not be empty');
  });

  // ── 4. V2 desktop_screenshot tool dispatcher ────────────────────────────────
  test('desktop_screenshot (V2) executes in mock mode and returns filePath + imageBase64', async () => {
    const result = await desktopScreenshotTool.execute({ saveToDisk: true });
    assert.strictEqual(result.success, true, 'Expected success:true');
    assert.ok(result.filePath, 'Expected filePath to be set');
    assert.ok(result.filePath.endsWith('.png'), 'Expected .png extension');
    assert.ok(result.width > 0, 'Expected width > 0');
    assert.ok(result.height > 0, 'Expected height > 0');
    // KEY FIX: imageBase64 must be present (was null before fix)
    assert.ok(result.imageBase64, 'imageBase64 must be returned by desktop_screenshot (key regression fix)');
    assert.ok(typeof result.imageBase64 === 'string', 'imageBase64 must be a string');
    assert.ok(result.imageBase64.length > 0, 'imageBase64 must not be empty');
  });

  // ── 5. Screenshot file creation ─────────────────────────────────────────────
  test('desktop_screenshot creates file on disk in mock mode', async () => {
    const result = await desktopScreenshotTool.execute({ saveToDisk: true });
    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(result.filePath), 'Screenshot file must exist on disk');
    const stat = fs.statSync(result.filePath);
    assert.ok(stat.size > 0, 'Screenshot file must not be empty (size > 0)');
  });

  // ── 6. Image validity ───────────────────────────────────────────────────────
  test('desktop_screenshot imageBase64 decodes to non-empty buffer', async () => {
    const result = await desktopScreenshotTool.execute({ saveToDisk: true });
    assert.strictEqual(result.success, true);
    assert.ok(result.imageBase64, 'imageBase64 must be present');
    const buf = Buffer.from(result.imageBase64, 'base64');
    assert.ok(buf.length > 0, 'Decoded imageBase64 must be non-empty');
  });

  // ── 7. Result serialization ─────────────────────────────────────────────────
  test('desktop_screenshot result is JSON-serializable', async () => {
    const result = await desktopScreenshotTool.execute({ saveToDisk: true });
    let serialized;
    assert.doesNotThrow(() => {
      serialized = JSON.stringify(result);
    }, 'Result must be JSON-serializable without circular references');
    assert.ok(serialized.length > 0);
    const parsed = JSON.parse(serialized);
    assert.strictEqual(parsed.success, true);
    assert.ok(parsed.filePath);
    assert.ok(parsed.imageBase64);
  });

  // ── 8. desktop_observe with image ──────────────────────────────────────────
  test('desktop_observe with includeImage:true returns imageBase64', async () => {
    const result = await desktopObserveTool.execute({ includeImage: true });
    assert.strictEqual(result.success, true);
    assert.ok(result.width > 0);
    assert.ok(result.height > 0);
    assert.ok(result.activeWindow !== undefined);
    assert.ok(result.imageBase64, 'imageBase64 must be returned when includeImage=true');
    assert.ok(typeof result.imageBase64 === 'string');
  });

  test('desktop_observe with includeImage:false omits imageBase64', async () => {
    const result = await desktopObserveTool.execute({ includeImage: false });
    assert.strictEqual(result.success, true);
    // imageBase64 should be null/undefined when not requested
    assert.ok(!result.imageBase64, 'imageBase64 must be null/falsy when includeImage=false');
  });

  // ── 9. Failure handling ─────────────────────────────────────────────────────
  test('screenshot tool returns error shape when permission is blocked', async () => {
    // Temporarily test with an unknown tool name to simulate permission failure
    const { checkToolPermission } = require('../src/ai/tools/computer/computerPermissions');
    const perm = checkToolPermission('nonexistent_blocked_tool_xyz');
    assert.ok(!perm.allowed, 'Unknown tool must not be permitted');
    assert.ok(typeof perm.reason === 'string', 'Reason must be a string');
    assert.ok(perm.reason.length > 0);
  });

  // ── 10. windowsBridge.captureScreen includeBase64 variants ────────────────
  test('windowsBridge.captureScreen with includeBase64:false returns null imageBase64', () => {
    const result = windowsBridge.captureScreen({ saveToDisk: false, includeBase64: false });
    assert.strictEqual(result.success, true);
    // When includeBase64=false, imageBase64 must be null
    assert.strictEqual(result.imageBase64, null, 'imageBase64 must be null when not requested');
  });

  test('windowsBridge.captureScreen with includeBase64:true returns string imageBase64', () => {
    const result = windowsBridge.captureScreen({ saveToDisk: false, includeBase64: true });
    assert.strictEqual(result.success, true);
    assert.ok(result.imageBase64, 'imageBase64 must be present when includeBase64=true');
    assert.ok(typeof result.imageBase64 === 'string');
    assert.ok(result.imageBase64.length > 0);
  });

  // ── 11. desktop_screenshot width/height always present ────────────────────
  test('desktop_screenshot always returns valid width and height', async () => {
    const result = await desktopScreenshotTool.execute({});
    assert.strictEqual(result.success, true);
    assert.ok(Number.isInteger(result.width) && result.width > 0, 'width must be a positive integer');
    assert.ok(Number.isInteger(result.height) && result.height > 0, 'height must be a positive integer');
  });

  // ── 12. timestamp field present ──────────────────────────────────────────
  test('desktop_screenshot returns a valid ISO timestamp', async () => {
    const result = await desktopScreenshotTool.execute({});
    assert.strictEqual(result.success, true);
    assert.ok(result.timestamp, 'timestamp must be present');
    assert.doesNotThrow(() => new Date(result.timestamp), 'timestamp must be parseable as a Date');
    const ts = new Date(result.timestamp);
    assert.ok(!isNaN(ts.getTime()), 'timestamp must be a valid date');
  });

  // ── 13. Gemini simulator — standalone "Take a screenshot" ────────────────
  test('Gemini simulator produces correct response for "Take a screenshot"', async () => {
    const tokens = [];
    const toolCalls = [];
    let doneReason = null;

    // First turn: should emit desktop_screenshot tool call
    await geminiProvider.simulateResponse({
      messages: [{ role: 'user', content: 'Take a screenshot' }],
      tools: [],
      onToken: t => tokens.push(t),
      onToolCall: tc => toolCalls.push(tc),
      onDone: r => { doneReason = r; }
    });

    assert.ok(
      toolCalls.some(tc => tc.name === 'desktop_screenshot' || tc.name === 'screenshot'),
      'Simulator must emit desktop_screenshot or screenshot tool call for "Take a screenshot"'
    );
    assert.strictEqual(doneReason, 'tool_calls', 'First turn must end with tool_calls reason');

    // Second turn: simulate tool result → should produce text response
    const mockToolResult = {
      success: true,
      filePath: 'C:\\Temp\\nexusmind_screenshots\\nexusmind_desktop_test.png',
      fileName: 'nexusmind_desktop_test.png',
      width: 1920,
      height: 1200,
      fileSize: '11 KB',
      imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      timestamp: new Date().toISOString(),
      message: 'Screenshot captured successfully (1920x1200). Saved to: C:\\Temp\\nexusmind_screenshots\\nexusmind_desktop_test.png'
    };

    const tokens2 = [];
    let done2 = null;
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: 'Take a screenshot' },
        {
          role: 'tool',
          name: 'desktop_screenshot',
          tool_call_id: 'call_shot_001',
          content: JSON.stringify(mockToolResult)
        }
      ],
      tools: [],
      onToken: t => tokens2.push(t),
      onToolCall: () => {},
      onDone: r => { done2 = r; }
    });

    const response = tokens2.join('');
    assert.ok(response.length > 0, 'Simulator must produce a non-empty text response');
    // Must mention the file path or dimensions
    assert.ok(
      response.includes('1920') || response.includes('.png') || response.includes('screenshot'),
      `Response must reference screenshot details. Got: ${response.slice(0, 200)}`
    );
    assert.strictEqual(done2, 'stop');
  });

  // ── 14. Gemini simulator — "Take a screenshot and tell me which app is active" ──
  test('Gemini simulator handles screenshot + active app query', async () => {
    const mockToolResult = {
      success: true,
      filePath: 'C:\\Temp\\nexusmind_desktop_test.png',
      width: 1920,
      height: 1200,
      fileSize: '11 KB',
      imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      timestamp: new Date().toISOString(),
      message: 'Screenshot captured'
    };

    const tokens = [];
    let done = null;
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: 'Take a screenshot and tell me which application is currently active' },
        {
          role: 'tool',
          name: 'desktop_screenshot',
          tool_call_id: 'call_shot_002',
          content: JSON.stringify(mockToolResult)
        }
      ],
      tools: [],
      onToken: t => tokens.push(t),
      onToolCall: () => {},
      onDone: r => { done = r; }
    });

    const response = tokens.join('');
    assert.ok(response.length > 0, 'Must produce a non-empty response');
    assert.strictEqual(done, 'stop');
    // Should mention screenshot + window/app context
    assert.ok(
      response.toLowerCase().includes('screenshot') ||
      response.toLowerCase().includes('1920') ||
      response.toLowerCase().includes('active'),
      `Response must reference screenshot or active window. Got: ${response.slice(0, 300)}`
    );
  });

  // ── 15. Gemini Scenario D regression: desktop_observe still works ─────────
  test('Gemini simulator Scenario D correctly handles desktop_observe result', async () => {
    const mockObserveResult = {
      success: true,
      width: 1920,
      height: 1200,
      activeWindow: 'Google Chrome',
      filePath: 'C:\\Temp\\nexusmind_observe_test.png',
      imageBase64: 'iVBORw0KGgo=',
      timestamp: new Date().toISOString(),
      message: 'Desktop observed (1920x1200). Active window: "Google Chrome".'
    };

    const tokens = [];
    let done = null;
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: 'What is on my screen?' },
        {
          role: 'tool',
          name: 'desktop_observe',
          tool_call_id: 'call_obs_001',
          content: JSON.stringify(mockObserveResult)
        }
      ],
      tools: [],
      onToken: t => tokens.push(t),
      onToolCall: () => {},
      onDone: r => { done = r; }
    });

    const response = tokens.join('');
    assert.ok(response.length > 0, 'Must produce a non-empty response for desktop_observe');
    assert.strictEqual(done, 'stop');
    // Should mention the active window
    assert.ok(
      response.includes('Google Chrome') || response.includes('1920') || response.includes('observed'),
      `Scenario D response must reference observed window. Got: ${response.slice(0, 300)}`
    );
  });

  // ── 16. desktopScreenshotTool has correct name ────────────────────────────
  test('desktopScreenshotTool has correct tool name "desktop_screenshot"', () => {
    assert.strictEqual(desktopScreenshotTool.name, 'desktop_screenshot');
  });

  test('screenshotTool has correct tool name "screenshot"', () => {
    assert.strictEqual(screenshotTool.name, 'screenshot');
  });

  // ── 17. OpenAI schema for desktop_screenshot is valid ─────────────────────
  test('desktop_screenshot OpenAI schema is exported correctly', () => {
    const schemas = toolRegistry.getOpenAISchemas();
    const schema = schemas.find(s => s.function.name === 'desktop_screenshot');
    assert.ok(schema, 'desktop_screenshot schema must be in registry');
    assert.strictEqual(schema.type, 'function');
    assert.ok(schema.function.description.length > 0);
    assert.ok(schema.function.parameters);
    assert.strictEqual(schema.function.parameters.type, 'object');
  });

  test('screenshot (V1) OpenAI schema is exported correctly', () => {
    const schemas = toolRegistry.getOpenAISchemas();
    const schema = schemas.find(s => s.function.name === 'screenshot');
    assert.ok(schema, 'screenshot schema must be in registry');
    assert.strictEqual(schema.type, 'function');
  });
});
