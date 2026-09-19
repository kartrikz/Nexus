process.env.NODE_ENV = 'test';
process.env.NEXUSMIND_MOCK_DESKTOP = 'true';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  windowsBridge,
  ALLOWLISTED_KEYS,
  ALLOWLISTED_MODIFIERS,
  sanitizeInputText
} = require('../src/ai/tools/computer/windowsBridge');

const {
  checkToolPermission,
  PERMISSION_LEVEL,
  getPermissionLevel
} = require('../src/ai/tools/computer/computerPermissions');

const { desktopScreenshotTool } = require('../src/ai/tools/computer/desktopScreenshot');
const { desktopObserveTool } = require('../src/ai/tools/computer/desktopObserve');
const { mouseMoveTool } = require('../src/ai/tools/computer/mouseMove');
const { mouseClickTool } = require('../src/ai/tools/computer/mouseClick');
const { mouseDoubleClickTool } = require('../src/ai/tools/computer/mouseDoubleClick');
const { keyboardTypeTool } = require('../src/ai/tools/computer/keyboardType');
const { keyboardPressTool } = require('../src/ai/tools/computer/keyboardPress');
const { scrollTool } = require('../src/ai/tools/computer/scroll');
const { toolRegistry } = require('../src/ai/tools/registry');
const { geminiProvider } = require('../src/ai/providers/gemini');
const { claudeProvider } = require('../src/ai/providers/claude');
const { openAIProvider } = require('../src/ai/providers/openai');

describe('NexusMind V2: Desktop Automation & GUI Interaction Suite', () => {

  // ── 1. Coordinate Clamping & Windows Bridge Unit Tests ─────────────────────
  test('windowsBridge clamps coordinates within screen boundaries', () => {
    const metrics = windowsBridge.getDisplayMetrics();
    assert.ok(metrics.width > 0);
    assert.ok(metrics.height > 0);

    // Negative coordinates clamp to 0
    const clampedNegative = windowsBridge.clampCoordinates(-50, -100);
    assert.strictEqual(clampedNegative.x, 0);
    assert.strictEqual(clampedNegative.y, 0);

    // Oversized coordinates clamp to screenWidth - 1 and screenHeight - 1
    const clampedOversized = windowsBridge.clampCoordinates(99999, 88888);
    assert.strictEqual(clampedOversized.x, metrics.width - 1);
    assert.strictEqual(clampedOversized.y, metrics.height - 1);

    // Normal coordinates remain unchanged
    const normal = windowsBridge.clampCoordinates(450, 82);
    assert.strictEqual(normal.x, 450);
    assert.strictEqual(normal.y, 82);
  });

  test('windowsBridge key allowlist accepts standard navigation keys and rejects unsafe keys', () => {
    assert.ok(ALLOWLISTED_KEYS.includes('ENTER'));
    assert.ok(ALLOWLISTED_KEYS.includes('TAB'));
    assert.ok(ALLOWLISTED_KEYS.includes('ESCAPE'));
    assert.ok(ALLOWLISTED_KEYS.includes('BACKSPACE'));
    assert.ok(ALLOWLISTED_KEYS.includes('SPACE'));
    assert.ok(ALLOWLISTED_KEYS.includes('DELETE'));

    // Unsafe keys are rejected
    assert.strictEqual(ALLOWLISTED_KEYS.includes('DANGEROUS_KEY'), false);
    assert.strictEqual(ALLOWLISTED_KEYS.includes('EXECUTE'), false);
    assert.strictEqual(ALLOWLISTED_KEYS.includes('RUN'), false);

    assert.ok(ALLOWLISTED_MODIFIERS.includes('CTRL'));
    assert.ok(ALLOWLISTED_MODIFIERS.includes('ALT'));
    assert.ok(ALLOWLISTED_MODIFIERS.includes('SHIFT'));
  });

  // ── 2. Sensitive Text Sanitizer Tests ─────────────────────────────────────
  test('sanitizeInputText permits clean user text and blocks passwords and secrets', () => {
    // Clean user queries
    assert.strictEqual(sanitizeInputText('Python tutorials').safe, true);
    assert.strictEqual(sanitizeInputText('https://www.youtube.com').safe, true);
    assert.strictEqual(sanitizeInputText('Click the button and search').safe, true);

    // Blocked secrets & passwords
    assert.strictEqual(sanitizeInputText('password: SuperSecret123!').safe, false);
    assert.strictEqual(sanitizeInputText('api_key=sk-12345678901234567890123456').safe, false);
    assert.strictEqual(sanitizeInputText('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz').safe, false);
    assert.strictEqual(sanitizeInputText('-----BEGIN RSA PRIVATE KEY-----').safe, false);

    // Blocked shell command injection
    assert.strictEqual(sanitizeInputText('cmd.exe /c calc').safe, false);
    assert.strictEqual(sanitizeInputText('powershell.exe -enc ABCDEF==').safe, false);
    assert.strictEqual(sanitizeInputText('format C: /q').safe, false);
    assert.strictEqual(sanitizeInputText('regedit /s hack.reg').safe, false);
  });

  // ── 3. V2 Tool Permissions & Safety Classification ────────────────────────
  test('permission layer correctly categorizes all V2 desktop tools as SAFE', () => {
    assert.strictEqual(getPermissionLevel('desktop_screenshot'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('desktop_observe'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('mouse_move'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('mouse_click'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('mouse_double_click'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('keyboard_type'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('keyboard_press'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('scroll'), PERMISSION_LEVEL.SAFE);

    const perm = checkToolPermission('mouse_click');
    assert.strictEqual(perm.allowed, true);
    assert.strictEqual(perm.level, PERMISSION_LEVEL.SAFE);
  });

  test('confirmation-required and blocked tools are strictly enforced', () => {
    assert.strictEqual(getPermissionLevel('submit_form'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('send_message'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('financial_transaction'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('download_file'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('upload_file'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);

    assert.strictEqual(getPermissionLevel('arbitrary_process'), PERMISSION_LEVEL.BLOCKED);
    assert.strictEqual(getPermissionLevel('arbitrary_executable'), PERMISSION_LEVEL.BLOCKED);
    assert.strictEqual(getPermissionLevel('execute_command'), PERMISSION_LEVEL.BLOCKED);
    assert.strictEqual(getPermissionLevel('run_shell'), PERMISSION_LEVEL.BLOCKED);
  });

  // ── 4. V2 Tool Execution Unit Tests ───────────────────────────────────────
  test('mouse_move tool executes successfully with valid and clamped coordinates', async () => {
    const res = await mouseMoveTool.execute({ x: 500, y: 300 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.x, 500);
    assert.strictEqual(res.y, 300);

    // Missing coordinates return error
    const errRes = await mouseMoveTool.execute({});
    assert.strictEqual(errRes.error, true);
  });

  test('mouse_click tool supports left, right, and middle buttons', async () => {
    const leftRes = await mouseClickTool.execute({ x: 450, y: 82, button: 'left' });
    assert.strictEqual(leftRes.success, true);
    assert.strictEqual(leftRes.button, 'left');

    const rightRes = await mouseClickTool.execute({ x: 100, y: 200, button: 'right' });
    assert.strictEqual(rightRes.success, true);
    assert.strictEqual(rightRes.button, 'right');

    const middleRes = await mouseClickTool.execute({ x: 100, y: 200, button: 'middle' });
    assert.strictEqual(middleRes.success, true);
    assert.strictEqual(middleRes.button, 'middle');
  });

  test('mouse_double_click tool executes successfully', async () => {
    const res = await mouseDoubleClickTool.execute({ x: 300, y: 150 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.x, 300);
    assert.strictEqual(res.y, 150);
  });

  test('keyboard_type tool accepts valid text and blocks passwords/commands', async () => {
    const valid = await keyboardTypeTool.execute({ text: 'Python tutorials', pressEnterAfter: true });
    assert.strictEqual(valid.success, true);
    assert.strictEqual(valid.characterCount, 16);
    assert.strictEqual(valid.pressEnterAfter, true);

    const blocked = await keyboardTypeTool.execute({ text: 'password: MySuperSecretPass!' });
    assert.strictEqual(blocked.error, true);
    assert.strictEqual(blocked.blocked, true);
  });

  test('keyboard_press tool accepts allowlisted keys and rejects unknown keys', async () => {
    const enterRes = await keyboardPressTool.execute({ key: 'ENTER' });
    assert.strictEqual(enterRes.success, true);
    assert.strictEqual(enterRes.key, 'ENTER');

    const ctrlN = await keyboardPressTool.execute({ key: 'ENTER', modifiers: ['CTRL'] });
    assert.strictEqual(ctrlN.success, true);
    assert.ok(ctrlN.modifiers.includes('CTRL'));

    const invalid = await keyboardPressTool.execute({ key: 'INVALID_SYSTEM_KEY' });
    assert.strictEqual(invalid.error, true);
    assert.ok(invalid.message.includes('not in the allowlisted keys list'));
  });

  test('scroll tool scrolls up and down with positive/negative amounts', async () => {
    const downRes = await scrollTool.execute({ amount: 5 });
    assert.strictEqual(downRes.success, true);
    assert.strictEqual(downRes.direction, 'down');

    const upRes = await scrollTool.execute({ amount: -5 });
    assert.strictEqual(upRes.success, true);
    assert.strictEqual(upRes.direction, 'up');
  });

  test('desktop_screenshot and desktop_observe execute and return visual metadata', async () => {
    const shot = await desktopScreenshotTool.execute({ saveToDisk: true });
    assert.strictEqual(shot.success, true);
    assert.ok(shot.width > 0);
    assert.ok(shot.height > 0);
    assert.ok(shot.filePath);

    const obs = await desktopObserveTool.execute({ includeImage: true });
    assert.strictEqual(obs.success, true);
    assert.ok(obs.width > 0);
    assert.ok(obs.height > 0);
    assert.ok(obs.activeWindow !== undefined);
  });

  // ── 5. Tool Registry Integration Tests ────────────────────────────────────
  test('toolRegistry registers all V2 tools and exports OpenAI function schemas', () => {
    const all = toolRegistry.getAll();
    const names = all.map(t => t.name);

    assert.ok(names.includes('desktop_screenshot'));
    assert.ok(names.includes('desktop_observe'));
    assert.ok(names.includes('mouse_move'));
    assert.ok(names.includes('mouse_click'));
    assert.ok(names.includes('mouse_double_click'));
    assert.ok(names.includes('keyboard_type'));
    assert.ok(names.includes('keyboard_press'));
    assert.ok(names.includes('scroll'));

    const schemas = toolRegistry.getOpenAISchemas();
    const clickSchema = schemas.find(s => s.function.name === 'mouse_click');
    assert.ok(clickSchema);
    assert.strictEqual(clickSchema.type, 'function');
    assert.ok(clickSchema.function.parameters.properties.x);
    assert.ok(clickSchema.function.parameters.properties.y);
  });

  // ── 6. Multimodal Vision Provider Payload Tests ───────────────────────────
  test('Gemini, Claude, and OpenAI serialize multimodal image parts from tools', () => {
    const mockMessages = [
      { role: 'user', content: 'What is on my screen?' },
      {
        role: 'tool',
        name: 'desktop_observe',
        tool_call_id: 'call_obs_123',
        content: JSON.stringify({
          success: true,
          width: 1920,
          height: 1080,
          activeWindow: 'Google Chrome',
          imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        })
      }
    ];

    // 1. Gemini payload
    const geminiPayload = geminiProvider._formatGeminiPayload(mockMessages, [], 0.7, 'gemini-2.5-flash');
    const userTurn = geminiPayload.contents.find(c => c.role === 'user' && c.parts?.some(p => p.inlineData));
    assert.ok(userTurn, 'Gemini payload must contain user turn with inlineData image part');
    const imgPart = userTurn.parts.find(p => p.inlineData);
    assert.strictEqual(imgPart.inlineData.mimeType, 'image/png');
    assert.ok(imgPart.inlineData.data.length > 0);

    // 2. Claude payload
    const claudePayload = claudeProvider._formatClaudePayload(mockMessages, [], 0.7, 'claude-3-5-sonnet-20241022');
    const claudeTurn = claudePayload.messages.find(m => m.role === 'user' && Array.isArray(m.content) && m.content.some(c => c.type === 'image'));
    assert.ok(claudeTurn, 'Claude payload must contain content block with type: image');
    const claudeImg = claudeTurn.content.find(c => c.type === 'image');
    assert.strictEqual(claudeImg.source.type, 'base64');
    assert.strictEqual(claudeImg.source.media_type, 'image/png');

    // 3. OpenAI payload
    const openAIPayload = openAIProvider._formatOpenAIPayload(mockMessages, [], 0.7, 'gpt-4o');
    const openAITurn = openAIPayload.messages.find(m => m.role === 'user' && Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
    assert.ok(openAITurn, 'OpenAI payload must contain user message with image_url');
    const openAIImg = openAITurn.content.find(c => c.type === 'image_url');
    assert.ok(openAIImg.image_url.url.startsWith('data:image/png;base64,'));
  });

  // ── 7. Multi-Step Desktop Interaction Agent Workflow ──────────────────────
  test('Gemini autonomous simulator executes multi-step "Open Chrome and search YouTube" workflow', async () => {
    const userPrompt = 'Open Chrome and search YouTube for Python tutorials.';
    const events = [];

    // Step 1: Initial call
    const turn1Calls = [];
    await geminiProvider.simulateResponse({
      messages: [{ role: 'user', content: userPrompt }],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => turn1Calls.push(tc),
      onDone: (reason) => events.push(reason)
    });

    assert.strictEqual(turn1Calls.length, 1);
    assert.strictEqual(turn1Calls[0].name, 'open_application');
    assert.strictEqual(turn1Calls[0].arguments.application, 'Google Chrome');

    // Step 2: After open_application succeeds, agent observes desktop
    const turn2Calls = [];
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'tool', name: 'open_application', content: JSON.stringify({ success: true, application: 'Google Chrome', pid: 1234 }) }
      ],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => turn2Calls.push(tc),
      onDone: () => {}
    });

    assert.strictEqual(turn2Calls.length, 1);
    assert.strictEqual(turn2Calls[0].name, 'desktop_observe');

    // Step 3: After desktop_observe, agent clicks address/search bar
    const turn3Calls = [];
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'tool', name: 'open_application', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'desktop_observe', content: JSON.stringify({ success: true, width: 1920, height: 1080, activeWindow: 'Google Chrome' }) }
      ],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => turn3Calls.push(tc),
      onDone: () => {}
    });

    assert.strictEqual(turn3Calls.length, 1);
    assert.strictEqual(turn3Calls[0].name, 'mouse_click');
    assert.strictEqual(turn3Calls[0].arguments.x, 450);
    assert.strictEqual(turn3Calls[0].arguments.y, 82);

    // Step 4: After mouse_click, agent types search query
    const turn4Calls = [];
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'tool', name: 'open_application', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'desktop_observe', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'mouse_click', content: JSON.stringify({ success: true, x: 450, y: 82, button: 'left' }) }
      ],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => turn4Calls.push(tc),
      onDone: () => {}
    });

    assert.strictEqual(turn4Calls.length, 1);
    assert.strictEqual(turn4Calls[0].name, 'keyboard_type');
    assert.ok(turn4Calls[0].arguments.text.includes('youtube.com') || turn4Calls[0].arguments.text.includes('Python'));

    // Step 5: After typing, agent verifies via desktop observation
    const turn5Calls = [];
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'tool', name: 'open_application', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'desktop_observe', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'mouse_click', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'keyboard_type', content: JSON.stringify({ success: true }) }
      ],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => turn5Calls.push(tc),
      onDone: () => {}
    });

    assert.strictEqual(turn5Calls.length, 1);
    assert.strictEqual(turn5Calls[0].name, 'desktop_observe');

    // Step 6: After post-action observation, agent gives final verified response
    let finalAnswer = '';
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'tool', name: 'open_application', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'desktop_observe', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'mouse_click', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'keyboard_type', content: JSON.stringify({ success: true }) },
        { role: 'tool', name: 'desktop_observe', content: JSON.stringify({ success: true, width: 1920, height: 1080, activeWindow: 'YouTube - Google Chrome' }) }
      ],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: (tok) => { finalAnswer += tok; },
      onToolCall: () => {},
      onDone: () => {}
    });

    assert.ok(finalAnswer.includes('Google Chrome'));
    assert.ok(finalAnswer.includes('YouTube'));
  });

  test('Gemini simulator handles "Click the search box and type Python"', async () => {
    const prompt = 'Click the search box and type Python';
    const calls = [];
    await geminiProvider.simulateResponse({
      messages: [{ role: 'user', content: prompt }],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => calls.push(tc),
      onDone: () => {}
    });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].name, 'mouse_click');

    const nextCalls = [];
    await geminiProvider.simulateResponse({
      messages: [
        { role: 'user', content: prompt },
        { role: 'tool', name: 'mouse_click', content: JSON.stringify({ success: true, x: 450, y: 82 }) }
      ],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => nextCalls.push(tc),
      onDone: () => {}
    });

    assert.strictEqual(nextCalls.length, 1);
    assert.strictEqual(nextCalls[0].name, 'keyboard_type');
    assert.strictEqual(nextCalls[0].arguments.text, 'Python');
  });

  test('Gemini simulator handles "Scroll down" and "Scroll up"', async () => {
    const downCalls = [];
    await geminiProvider.simulateResponse({
      messages: [{ role: 'user', content: 'Scroll down' }],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => downCalls.push(tc),
      onDone: () => {}
    });
    assert.strictEqual(downCalls.length, 1);
    assert.strictEqual(downCalls[0].name, 'scroll');
    assert.strictEqual(downCalls[0].arguments.amount, 5);

    const upCalls = [];
    await geminiProvider.simulateResponse({
      messages: [{ role: 'user', content: 'Scroll up' }],
      tools: toolRegistry.getOpenAISchemas(),
      onToken: () => {},
      onToolCall: (tc) => upCalls.push(tc),
      onDone: () => {}
    });
    assert.strictEqual(upCalls.length, 1);
    assert.strictEqual(upCalls[0].name, 'scroll');
    assert.strictEqual(upCalls[0].arguments.amount, -5);
  });
});
