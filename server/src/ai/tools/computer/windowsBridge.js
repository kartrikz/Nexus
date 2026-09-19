/**
 * Windows Desktop Automation Bridge
 *
 * Provides safe, DPI-aware primitives for:
 * - Screen bounds detection
 * - Screenshot capture (in-memory base64 & disk PNG)
 * - Mouse cursor movement, clicking, double-clicking, and scrolling
 * - Keyboard character typing & navigation key presses
 * - Active window title detection
 *
 * Implements strict coordinate clamping, keystroke allowlists, and sensitive text scrubbing.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const logger = require('../../../utils/logger');

// ── Allowlisted Keyboard Keys ───────────────────────────────────────────────
const ALLOWLISTED_KEYS = [
  'ENTER',
  'TAB',
  'ESCAPE',
  'BACKSPACE',
  'SPACE',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
  'DELETE',
  'HOME',
  'END',
  'PAGEUP',
  'PAGEDOWN',
  'F5',
  'INSERT'
];

const ALLOWLISTED_MODIFIERS = ['CTRL', 'ALT', 'SHIFT', 'WIN'];

// ── Sensitive Text / Secret Filter ──────────────────────────────────────────
const SENSITIVE_TEXT_PATTERNS = [
  /password\s*[:=]\s*['"]?[^\s'"]+/i,
  /api[_-]?key\s*[:=]\s*['"]?[^\s'"]+/i,
  /secret[_-]?key\s*[:=]\s*['"]?[^\s'"]+/i,
  /bearer\s+[a-zA-Z0-9._-]{20,}/i,
  /-----BEGIN\s+([A-Z0-9_-]+\s+)*KEY-----/i,
  /sk-[a-zA-Z0-9]{20,}/i,
  /AIza[0-9A-Za-z-_]{35}/i,
  /(?:cmd(?:\.exe)?|powershell(?:\.exe)?)\s+(?:\/c|-c|-enc|-command)/i,
  /\b(?:format|diskpart|cipher|netsh|regedit|del\s+\/[sfq]|rmdir\s+\/s)\b/i
];

/**
 * Sanitizes ordinary text before keyboard typing to prevent credential entry or shell injection.
 * @param {string} text
 * @returns {{ safe: boolean, reason?: string }}
 */
function sanitizeInputText(text) {
  if (typeof text !== 'string') {
    return { safe: false, reason: 'Input text must be a valid string.' };
  }

  for (const pattern of SENSITIVE_TEXT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: 'Text contains sensitive credential patterns or prohibited shell commands and was blocked.'
      };
    }
  }

  return { safe: true };
}



class WindowsDesktopBridge {
  constructor() {
    this._cachedMetrics = null;
    this._isWindows = process.platform === 'win32';
    // Internal state for testing & headless verification
    this._mockState = {
      cursorX: 0,
      cursorY: 0,
      lastAction: null,
      lastTypedText: null,
      lastPressedKey: null,
      scrollOffset: 0,
      displayWidth: 1920,
      displayHeight: 1080
    };
  }

  isMockMode() {
    return (
      process.env.NEXUSMIND_MOCK_DESKTOP === 'true' ||
      !this._isWindows ||
      process.env.NODE_ENV === 'test'
    );
  }

  _executeHelperAction(action, arg1 = '', arg2 = '', arg3 = '', timeoutMs = 12000) {
    const helperPath = path.join(__dirname, 'desktopHelper.ps1');
    const cmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${helperPath}" -Action "${action}" -Arg1 "${arg1}" -Arg2 "${arg2}" -Arg3 "${arg3}"`;
    return execSync(cmd, {
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true
    }).trim();
  }

  /**
   * Returns primary display resolution in physical pixels.
   */
  getDisplayMetrics() {
    if (this.isMockMode()) {
      return {
        width: this._mockState.displayWidth,
        height: this._mockState.displayHeight,
        scaleFactor: 1.0
      };
    }

    try {
      const out = this._executeHelperAction('metrics');
      const [w, h] = out.split(',').map(n => parseInt(n.trim(), 10));
      if (w > 0 && h > 0) {
        this._cachedMetrics = { width: w, height: h, scaleFactor: 1.0 };
        return this._cachedMetrics;
      }
    } catch (err) {
      logger.warn(`Failed to retrieve display metrics: ${err.message}`);
    }

    return this._cachedMetrics || { width: 1920, height: 1080, scaleFactor: 1.0 };
  }

  /**
   * Captures screen and returns file path, dimensions, and optional base64.
   */
  captureScreen({ saveToDisk = true, includeBase64 = false } = {}) {
    const metrics = this.getDisplayMetrics();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `nexusmind_desktop_${timestamp}.png`;
    const outputDir = path.join(os.tmpdir(), 'nexusmind_screenshots');
    const outputPath = path.join(outputDir, fileName);

    if (this.isMockMode()) {
      if (saveToDisk) {
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outputPath, Buffer.from('MOCK_SCREENSHOT_PNG_DATA'));
      }
      return {
        success: true,
        filePath: saveToDisk ? outputPath : null,
        fileName: saveToDisk ? fileName : null,
        width: metrics.width,
        height: metrics.height,
        imageBase64: includeBase64 ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' : null,
        timestamp: new Date().toISOString()
      };
    }

    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      this._executeHelperAction('capture', outputPath);

      let imageBase64 = null;
      if (includeBase64 && fs.existsSync(outputPath)) {
        imageBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });
      }

      return {
        success: true,
        filePath: outputPath,
        fileName,
        width: metrics.width,
        height: metrics.height,
        imageBase64,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      logger.error(`Capture screen failed: ${err.message}`);
      return {
        error: true,
        message: `Screen capture failed: ${err.message}`
      };
    }
  }

  /**
   * Clamp coordinates safely within primary display bounds.
   */
  clampCoordinates(x, y) {
    const metrics = this.getDisplayMetrics();
    const targetX = Math.max(0, Math.min(Math.round(Number(x) || 0), metrics.width - 1));
    const targetY = Math.max(0, Math.min(Math.round(Number(y) || 0), metrics.height - 1));
    return { x: targetX, y: targetY, width: metrics.width, height: metrics.height };
  }

  mouseMove(x, y) {
    const { x: cx, y: cy } = this.clampCoordinates(x, y);

    if (this.isMockMode()) {
      this._mockState.cursorX = cx;
      this._mockState.cursorY = cy;
      this._mockState.lastAction = 'move';
      return { success: true, x: cx, y: cy, message: `Mouse moved to (${cx}, ${cy}).` };
    }

    try {
      this._executeHelperAction('move', cx, cy);
      return { success: true, x: cx, y: cy, message: `Mouse moved to (${cx}, ${cy}).` };
    } catch (err) {
      return { error: true, message: `Failed to move mouse: ${err.message}` };
    }
  }

  mouseClick(x, y, button = 'left') {
    const validButton = ['left', 'right', 'middle'].includes(button) ? button : 'left';
    const { x: cx, y: cy } = this.clampCoordinates(x, y);

    if (this.isMockMode()) {
      this._mockState.cursorX = cx;
      this._mockState.cursorY = cy;
      this._mockState.lastAction = `click_${validButton}`;
      return {
        success: true,
        x: cx,
        y: cy,
        button: validButton,
        message: `Clicked ${validButton} mouse button at (${cx}, ${cy}).`
      };
    }

    try {
      this._executeHelperAction('click', cx, cy, validButton);
      return {
        success: true,
        x: cx,
        y: cy,
        button: validButton,
        message: `Clicked ${validButton} mouse button at (${cx}, ${cy}).`
      };
    } catch (err) {
      return { error: true, message: `Failed to click mouse: ${err.message}` };
    }
  }

  mouseDoubleClick(x, y) {
    const { x: cx, y: cy } = this.clampCoordinates(x, y);

    if (this.isMockMode()) {
      this._mockState.cursorX = cx;
      this._mockState.cursorY = cy;
      this._mockState.lastAction = 'double_click';
      return {
        success: true,
        x: cx,
        y: cy,
        message: `Double-clicked at (${cx}, ${cy}).`
      };
    }

    try {
      this._executeHelperAction('doubleclick', cx, cy);
      return {
        success: true,
        x: cx,
        y: cy,
        message: `Double-clicked at (${cx}, ${cy}).`
      };
    } catch (err) {
      return { error: true, message: `Failed to double-click: ${err.message}` };
    }
  }

  mouseScroll(amount) {
    const scrollAmount = Math.max(-50, Math.min(50, parseInt(amount, 10) || 0));
    const direction = scrollAmount >= 0 ? 'down' : 'up';

    if (this.isMockMode()) {
      this._mockState.scrollOffset += scrollAmount;
      this._mockState.lastAction = 'scroll';
      return {
        success: true,
        amount: scrollAmount,
        direction,
        message: `Scrolled ${direction} by ${Math.abs(scrollAmount)} clicks.`
      };
    }

    try {
      this._executeHelperAction('scroll', scrollAmount);
      return {
        success: true,
        amount: scrollAmount,
        direction,
        message: `Scrolled ${direction} by ${Math.abs(scrollAmount)} clicks.`
      };
    } catch (err) {
      return { error: true, message: `Failed to scroll: ${err.message}` };
    }
  }

  keyboardType(text, pressEnterAfter = false) {
    const safety = sanitizeInputText(text);
    if (!safety.safe) {
      return { error: true, blocked: true, message: safety.reason };
    }

    if (this.isMockMode()) {
      this._mockState.lastTypedText = text;
      this._mockState.lastAction = 'type';
      return {
        success: true,
        characterCount: text.length,
        pressEnterAfter: Boolean(pressEnterAfter),
        message: `Typed ${text.length} characters into focused window.`
      };
    }

    try {
      const base64Text = Buffer.from(text, 'utf8').toString('base64');
      const enterFlag = pressEnterAfter ? '1' : '0';
      this._executeHelperAction('type', base64Text, enterFlag);

      return {
        success: true,
        characterCount: text.length,
        pressEnterAfter: Boolean(pressEnterAfter),
        message: `Typed ${text.length} characters into focused window.`
      };
    } catch (err) {
      return { error: true, message: `Failed to type text: ${err.message}` };
    }
  }

  keyboardPress(key, modifiers = []) {
    const upperKey = String(key || '').trim().toUpperCase();
    if (!ALLOWLISTED_KEYS.includes(upperKey)) {
      return {
        error: true,
        message: `Key "${key}" is not in the allowlisted keys list (${ALLOWLISTED_KEYS.join(', ')}).`
      };
    }

    const safeModifiers = Array.isArray(modifiers)
      ? modifiers
          .map(m => String(m).trim().toUpperCase())
          .filter(m => ALLOWLISTED_MODIFIERS.includes(m))
      : [];

    if (this.isMockMode()) {
      this._mockState.lastPressedKey = upperKey;
      this._mockState.lastAction = 'press_key';
      return {
        success: true,
        key: upperKey,
        modifiers: safeModifiers,
        message: `Pressed key [${[...safeModifiers, upperKey].join('+')}].`
      };
    }

    try {
      this._executeHelperAction('press', upperKey, safeModifiers.join(','));

      return {
        success: true,
        key: upperKey,
        modifiers: safeModifiers,
        message: `Pressed key [${[...safeModifiers, upperKey].join('+')}].`
      };
    } catch (err) {
      return { error: true, message: `Failed to press key: ${err.message}` };
    }
  }

  getActiveWindow() {
    if (this.isMockMode()) {
      return { title: 'Desktop / Chrome Active', available: true };
    }

    try {
      const title = this._executeHelperAction('activewindow');
      return { title: title || 'Unknown Window', available: true };
    } catch {
      return { title: 'Unknown Window', available: false };
    }
  }
}

const windowsBridge = new WindowsDesktopBridge();

module.exports = {
  WindowsDesktopBridge,
  windowsBridge,
  ALLOWLISTED_KEYS,
  ALLOWLISTED_MODIFIERS,
  sanitizeInputText
};
