/**
 * Computer Control Tool — open_url
 *
 * Opens a validated HTTP/HTTPS URL in the user's default browser.
 * Blocks dangerous URL schemes (file://, javascript:, data:).
 */

const { spawn } = require('child_process');
const { checkToolPermission } = require('./computerPermissions');

// Allowed URL schemes
const ALLOWED_SCHEMES = ['http:', 'https:'];

// Blocked URL schemes
const BLOCKED_SCHEMES = ['file:', 'javascript:', 'data:', 'vbscript:', 'ftp:'];

/**
 * Validate a URL string for safety.
 * @param {string} urlStr
 * @returns {{ valid: boolean, url?: URL, reason?: string }}
 */
function validateUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) {
    return { valid: false, reason: 'No URL provided.' };
  }

  let cleaned = urlStr.trim();

  // Auto-prepend https:// if no scheme is present
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }

  let parsed;
  try {
    parsed = new URL(cleaned);
  } catch {
    return { valid: false, reason: `"${urlStr}" is not a valid URL.` };
  }

  // Check blocked schemes
  const scheme = parsed.protocol.toLowerCase();
  if (BLOCKED_SCHEMES.includes(scheme)) {
    return {
      valid: false,
      reason: `URL scheme "${scheme}" is blocked for security reasons. Only HTTP and HTTPS URLs are allowed.`
    };
  }

  // Check allowed schemes
  if (!ALLOWED_SCHEMES.includes(scheme)) {
    return {
      valid: false,
      reason: `URL scheme "${scheme}" is not supported. Only HTTP and HTTPS URLs are allowed.`
    };
  }

  return { valid: true, url: parsed };
}

const openUrlTool = {
  name: 'open_url',
  description:
    'Open a URL in the user\'s default web browser. ' +
    'Only HTTP and HTTPS URLs are allowed. ' +
    'Example: open_url("https://youtube.com")',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to open, e.g. "https://youtube.com", "https://github.com"'
      }
    },
    required: ['url']
  },

  execute: async ({ url }) => {
    // ── Permission check ───────────────────────────────────────────
    const perm = checkToolPermission('open_url');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    // ── Validate URL ───────────────────────────────────────────────
    const validation = validateUrl(url);
    if (!validation.valid) {
      return { error: true, message: validation.reason };
    }

    const safeUrl = validation.url.href;

    // ── Open in default browser via Windows 'start' ────────────────
    try {
      return await new Promise((resolve) => {
        const child = spawn('cmd.exe', ['/c', 'start', '', safeUrl], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });

        let settled = false;
        child.on('error', (err) => {
          if (!settled) {
            settled = true;
            resolve({
              error: true,
              message: `Failed to open URL: ${err.message}`
            });
          }
        });

        setTimeout(() => {
          if (!settled) {
            settled = true;
            child.unref();
            resolve({
              success: true,
              url: safeUrl,
              message: `Opened ${safeUrl} in the default browser.`
            });
          }
        }, 100);
      });
    } catch (err) {
      return {
        error: true,
        message: `Failed to open URL: ${err.message}`
      };
    }
  }
};

module.exports = { openUrlTool, validateUrl };
