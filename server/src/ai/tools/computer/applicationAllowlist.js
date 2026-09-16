/**
 * Computer Control — Windows Application Allowlist
 *
 * Defines which applications NexusMind is allowed to launch.
 * Uses dynamic path resolution — never hardcodes usernames.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// ── Dynamic base paths (no hardcoded usernames) ──────────────────────────────

const HOME = os.homedir();
const PROGRAM_FILES = process.env.ProgramFiles || 'C:\\Program Files';
const PROGRAM_FILES_X86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const LOCAL_APPDATA = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
const SYSTEM32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
const WINDOWS_DIR = process.env.SystemRoot || 'C:\\Windows';

// ── Application Definitions ──────────────────────────────────────────────────
// Each entry: { name, aliases, candidates[] }
// candidates are checked in order — first existing path wins.

const APPLICATION_ALLOWLIST = [
  {
    name: 'Google Chrome',
    aliases: ['chrome', 'google chrome', 'google-chrome'],
    candidates: [
      path.join(PROGRAM_FILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(PROGRAM_FILES_X86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(LOCAL_APPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
    ]
  },
  {
    name: 'Visual Studio Code',
    aliases: ['vscode', 'vs code', 'visual studio code', 'code'],
    candidates: [
      path.join(LOCAL_APPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe'),
      path.join(PROGRAM_FILES, 'Microsoft VS Code', 'Code.exe'),
      path.join(PROGRAM_FILES_X86, 'Microsoft VS Code', 'Code.exe')
    ]
  },
  {
    name: 'Notepad',
    aliases: ['notepad', 'text editor'],
    candidates: [
      path.join(SYSTEM32, 'notepad.exe'),
      path.join(WINDOWS_DIR, 'notepad.exe')
    ]
  },
  {
    name: 'Calculator',
    aliases: ['calculator', 'calc'],
    candidates: [
      path.join(SYSTEM32, 'calc.exe')
    ],
    // UWP apps need special launch via start
    uwpFallback: 'calculator:'
  },
  {
    name: 'File Explorer',
    aliases: ['file explorer', 'explorer', 'windows explorer', 'files'],
    candidates: [
      path.join(WINDOWS_DIR, 'explorer.exe')
    ]
  },
  {
    name: 'Task Manager',
    aliases: ['task manager', 'taskmgr', 'taskmanager'],
    candidates: [
      path.join(SYSTEM32, 'Taskmgr.exe')
    ]
  },
  {
    name: 'Paint',
    aliases: ['paint', 'mspaint', 'ms paint'],
    candidates: [
      path.join(SYSTEM32, 'mspaint.exe')
    ]
  },
  {
    name: 'WordPad',
    aliases: ['wordpad', 'word pad'],
    candidates: [
      path.join(PROGRAM_FILES, 'Windows NT', 'Accessories', 'wordpad.exe'),
      path.join(PROGRAM_FILES_X86, 'Windows NT', 'Accessories', 'wordpad.exe')
    ]
  },
  {
    name: 'Snipping Tool',
    aliases: ['snipping tool', 'snippingtool', 'snip', 'screen capture'],
    candidates: [
      path.join(SYSTEM32, 'SnippingTool.exe')
    ],
    uwpFallback: 'ms-screenclip:'
  },
  {
    name: 'Microsoft Edge',
    aliases: ['edge', 'microsoft edge', 'msedge'],
    candidates: [
      path.join(PROGRAM_FILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(PROGRAM_FILES_X86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ]
  }
];

// ── Resolution Functions ─────────────────────────────────────────────────────

/**
 * Find an application entry by name or alias (case-insensitive).
 * @param {string} query - user-supplied name like "Chrome" or "vs code"
 * @returns {object|null} matching application entry or null
 */
function findApplication(query) {
  if (!query || typeof query !== 'string') return null;

  const q = query.toLowerCase().trim();

  for (const app of APPLICATION_ALLOWLIST) {
    if (app.name.toLowerCase() === q) return app;
    if (app.aliases.some(alias => alias === q)) return app;
  }

  // Partial match fallback (e.g. "note" → "Notepad")
  for (const app of APPLICATION_ALLOWLIST) {
    if (app.name.toLowerCase().includes(q)) return app;
    if (app.aliases.some(alias => alias.includes(q))) return app;
  }

  return null;
}

/**
 * Resolve the executable path for an application entry.
 * Checks candidate paths in order; returns the first that exists on disk.
 * @param {object} app - application entry from the allowlist
 * @returns {{ resolved: boolean, execPath?: string, uwpUri?: string, reason?: string }}
 */
function resolveExecutablePath(app) {
  if (!app) {
    return { resolved: false, reason: 'Application not found in allowlist.' };
  }

  // Check each candidate path
  for (const candidate of app.candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return { resolved: true, execPath: candidate };
      }
    } catch {
      // Permission error or invalid path — skip
    }
  }

  // Try finding via `where` command (PATH-based resolution)
  try {
    const firstAlias = app.aliases[0];
    const result = execSync(`where ${firstAlias} 2>nul`, {
      encoding: 'utf8',
      timeout: 3000
    }).trim();
    if (result) {
      const firstLine = result.split('\n')[0].trim();
      if (fs.existsSync(firstLine)) {
        return { resolved: true, execPath: firstLine };
      }
    }
  } catch {
    // `where` failed — that's fine
  }

  // UWP fallback (e.g. Calculator, Snipping Tool)
  if (app.uwpFallback) {
    return { resolved: true, uwpUri: app.uwpFallback };
  }

  return {
    resolved: false,
    reason: `Could not find "${app.name}" on this system. It may not be installed.`
  };
}

/**
 * Get a summary list of all allowed applications (for the list_allowed_applications tool).
 * @returns {Array<{ name: string, aliases: string[], available: boolean }>}
 */
function getAllowedApplicationsSummary() {
  return APPLICATION_ALLOWLIST.map(app => {
    const resolution = resolveExecutablePath(app);
    return {
      name: app.name,
      aliases: app.aliases,
      available: resolution.resolved
    };
  });
}

module.exports = {
  APPLICATION_ALLOWLIST,
  findApplication,
  resolveExecutablePath,
  getAllowedApplicationsSummary
};
