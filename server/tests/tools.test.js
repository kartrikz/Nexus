const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { safeEvaluate, calculatorTool } = require('../src/ai/tools/calculator');
const { datetimeTool, resolveTimezone } = require('../src/ai/tools/datetime');
const { toolRegistry } = require('../src/ai/tools/registry');

describe('Phase 2: Tools & Autonomous Registry Unit Tests', () => {
  test('safeEvaluate correctly computes basic arithmetic', () => {
    assert.strictEqual(safeEvaluate('2 + 2'), 4);
    assert.strictEqual(safeEvaluate('10 - 4 * 2'), 2);
    assert.strictEqual(safeEvaluate('(10 - 4) * 2'), 12);
    assert.strictEqual(safeEvaluate('100 / 4'), 25);
  });

  test('safeEvaluate calculates percentages properly', () => {
    // 15% of 340 = 51
    const result = safeEvaluate('15% of 340');
    assert.strictEqual(result, 51);

    const simplePercent = safeEvaluate('50%');
    assert.strictEqual(simplePercent, 0.5);
  });

  test('safeEvaluate computes scientific functions and powers', () => {
    assert.strictEqual(safeEvaluate('sqrt(144)'), 12);
    assert.strictEqual(safeEvaluate('2^3'), 8);
    assert.strictEqual(safeEvaluate('round(4.7)'), 5);
  });

  test('safeEvaluate throws on division by zero or invalid syntax', () => {
    assert.throws(() => safeEvaluate('10 / 0'), /division by zero/i);
    assert.throws(() => safeEvaluate('2 + +'), /unexpected/i);
  });

  test('calculatorTool execution returns formatted output', async () => {
    const res = await calculatorTool.execute({ expression: '25 * 4 + 50' });
    assert.strictEqual(res.result, 150);
    assert.strictEqual(res.formatted, '150');
  });

  test('datetimeTool returns timezone info and handles offsets', async () => {
    const tokyoTime = await datetimeTool.execute({ timezone: 'Tokyo' });
    assert.ok(tokyoTime.formatted);
    assert.strictEqual(tokyoTime.timezone, 'Asia/Tokyo');

    const futureTime = await datetimeTool.execute({ timezone: 'UTC', offsetHours: 6 });
    assert.strictEqual(futureTime.offsetHoursApplied, 6);
  });

  test('ToolRegistry exports OpenAI function schemas and executes tools safely', async () => {
    const schemas = toolRegistry.getOpenAISchemas();
    assert.ok(Array.isArray(schemas));
    const names = schemas.map(s => s.function.name);
    assert.ok(names.includes('calculator'));
    assert.ok(names.includes('datetime'));

    const execResult = await toolRegistry.execute('calculator', { expression: '100 - 35' });
    assert.strictEqual(execResult.result, 65);

    const unknownTool = await toolRegistry.execute('nonexistent_tool', {});
    assert.ok(unknownTool.error);
  });

  // ─── Weather Tool Regression Tests ────────────────────────────────────────

  test('weatherTool: missing location returns error, not fake data', async () => {
    const { weatherTool } = require('../src/ai/tools/weather');
    const result = await weatherTool.execute({});
    assert.strictEqual(result.error, true);
    assert.ok(result.message.toLowerCase().includes('no location'));
    // Must NOT contain fake weather values
    assert.strictEqual(result.temperature, undefined);
    assert.strictEqual(result.condition, undefined);
  });

  test('weatherTool: empty string location returns error', async () => {
    const { weatherTool } = require('../src/ai/tools/weather');
    const result = await weatherTool.execute({ location: '   ' });
    assert.strictEqual(result.error, true);
    assert.ok(result.message.toLowerCase().includes('no location'));
  });

  test('weatherTool: missing API key returns explicit error, NOT fake/simulated data', async () => {
    const { weatherTool } = require('../src/ai/tools/weather');
    // Temporarily ensure no API key
    const originalKey = process.env.OPENWEATHER_API_KEY;
    process.env.OPENWEATHER_API_KEY = '';

    const result = await weatherTool.execute({ location: 'Coimbatore' });
    assert.strictEqual(result.error, true);
    assert.ok(result.message.includes('OPENWEATHER_API_KEY'));
    // CRITICAL: must NOT return fake weather numbers
    assert.strictEqual(result.temperature, undefined);
    assert.strictEqual(result.humidity, undefined);
    assert.strictEqual(result.condition, undefined);

    // Restore
    process.env.OPENWEATHER_API_KEY = originalKey || '';
  });

  test('weatherTool: no San Francisco default — Coimbatore stays Coimbatore', async () => {
    const { weatherTool } = require('../src/ai/tools/weather');
    const originalKey = process.env.OPENWEATHER_API_KEY;
    process.env.OPENWEATHER_API_KEY = '';

    const result = await weatherTool.execute({ location: 'Coimbatore' });
    // Should be an error (no key), NOT a San Francisco fallback
    assert.strictEqual(result.error, true);
    if (result.location) {
      // If somehow a location is returned, it must NOT be San Francisco
      assert.ok(!result.location.toLowerCase().includes('san francisco'));
    }

    process.env.OPENWEATHER_API_KEY = originalKey || '';
  });

  test('weatherTool: no San Francisco default — Chennai stays Chennai', async () => {
    const { weatherTool } = require('../src/ai/tools/weather');
    const originalKey = process.env.OPENWEATHER_API_KEY;
    process.env.OPENWEATHER_API_KEY = '';

    const result = await weatherTool.execute({ location: 'Chennai' });
    assert.strictEqual(result.error, true);
    assert.strictEqual(result.temperature, undefined);

    process.env.OPENWEATHER_API_KEY = originalKey || '';
  });

  test('weatherTool: never returns hardcoded 20°C / Partly Cloudy / 55% fake values', async () => {
    const { weatherTool } = require('../src/ai/tools/weather');
    const originalKey = process.env.OPENWEATHER_API_KEY;
    process.env.OPENWEATHER_API_KEY = '';

    const result = await weatherTool.execute({ location: 'Mumbai' });
    // The old bug returned { temperature: '20°C', condition: 'Partly Cloudy', humidity: '55%' }
    assert.notStrictEqual(result.temperature, '20°C');
    assert.notStrictEqual(result.condition, 'Partly Cloudy');
    assert.notStrictEqual(result.humidity, '55%');

    process.env.OPENWEATHER_API_KEY = originalKey || '';
  });

  test('weatherTool: invalid API key returns error from API, not fake data', async () => {
    const { weatherTool } = require('../src/ai/tools/weather');
    const originalKey = process.env.OPENWEATHER_API_KEY;
    process.env.OPENWEATHER_API_KEY = 'invalid_key_12345';

    const result = await weatherTool.execute({ location: 'London' });
    // Should get an API error (401 Invalid API key), not fake data
    assert.strictEqual(result.error, true);
    assert.ok(result.message);
    assert.strictEqual(result.temperature, undefined);

    process.env.OPENWEATHER_API_KEY = originalKey || '';
  });

  // ─── Existing non-weather tool tests ─────────────────────────────────────

  test('websearchTool returns query results with fallback grounding', async () => {
    const { websearchTool } = require('../src/ai/tools/websearch');
    const result = await websearchTool.execute({ query: 'quantum computing' });
    assert.strictEqual(result.query, 'quantum computing');
    assert.ok(Array.isArray(result.results));
    assert.ok(result.results.length > 0);
  });

  test('ToolRegistry executes tool with alias matching (e.g. websearch vs web_search)', async () => {
    const res = await toolRegistry.execute('web_search', { query: 'test' });
    assert.ok(Array.isArray(res.results));
  });
});

