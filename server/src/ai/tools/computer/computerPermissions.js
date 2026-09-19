/**
 * Computer Control — Centralized Permission & Safety Layer
 *
 * Every computer-control tool call passes through this layer before execution.
 * Actions are categorized as SAFE, CONFIRMATION_REQUIRED, or BLOCKED.
 */

const path = require('path');

// ── Permission Categories ────────────────────────────────────────────────────

const PERMISSION_LEVEL = {
  SAFE: 'safe',
  CONFIRMATION_REQUIRED: 'confirmation_required',
  BLOCKED: 'blocked'
};

/**
 * Maps tool names to their permission level.
 */
const TOOL_PERMISSIONS = {
  // Built-in AI tools — SAFE
  calculator: PERMISSION_LEVEL.SAFE,
  datetime: PERMISSION_LEVEL.SAFE,
  weather: PERMISSION_LEVEL.SAFE,
  websearch: PERMISSION_LEVEL.SAFE,
  web_search: PERMISSION_LEVEL.SAFE,
  save_memory: PERMISSION_LEVEL.SAFE,
  recall_memory: PERMISSION_LEVEL.SAFE,
  file_reader: PERMISSION_LEVEL.SAFE,
  fileReader: PERMISSION_LEVEL.SAFE,

  // SAFE Computer tools — auto-execute
  open_application: PERMISSION_LEVEL.SAFE,
  open_url: PERMISSION_LEVEL.SAFE,
  open_file: PERMISSION_LEVEL.SAFE,
  open_folder: PERMISSION_LEVEL.SAFE,
  screenshot: PERMISSION_LEVEL.SAFE,
  desktop_screenshot: PERMISSION_LEVEL.SAFE,
  desktop_observe: PERMISSION_LEVEL.SAFE,
  mouse_move: PERMISSION_LEVEL.SAFE,
  mouse_click: PERMISSION_LEVEL.SAFE,
  mouse_double_click: PERMISSION_LEVEL.SAFE,
  keyboard_type: PERMISSION_LEVEL.SAFE,
  keyboard_press: PERMISSION_LEVEL.SAFE,
  scroll: PERMISSION_LEVEL.SAFE,
  list_allowed_applications: PERMISSION_LEVEL.SAFE,

  // CONFIRMATION_REQUIRED — must get explicit user approval
  delete_file: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  move_file: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  rename_file: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  install_application: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  system_settings: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  shutdown: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  restart: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  submit_form: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  send_message: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  download_file: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  upload_file: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,
  financial_transaction: PERMISSION_LEVEL.CONFIRMATION_REQUIRED,

  // BLOCKED — always rejected
  execute_command: PERMISSION_LEVEL.BLOCKED,
  run_shell: PERMISSION_LEVEL.BLOCKED,
  run_powershell: PERMISSION_LEVEL.BLOCKED,
  arbitrary_process: PERMISSION_LEVEL.BLOCKED,
  arbitrary_executable: PERMISSION_LEVEL.BLOCKED,
  cmd: PERMISSION_LEVEL.BLOCKED,
  powershell: PERMISSION_LEVEL.BLOCKED,
  access_credentials: PERMISSION_LEVEL.BLOCKED,
  disable_security: PERMISSION_LEVEL.BLOCKED
};

// ── Sensitive Path Patterns ──────────────────────────────────────────────────
// These patterns block access to secrets, credentials, and security-critical files.

const SENSITIVE_PATH_PATTERNS = [
  // Environment / API secrets
  /\.env($|\..+)/i,
  /\.npmrc/i,
  /\.dockercfg/i,
  /docker[/\\]config\.json/i,
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /private[_-]?key/i,

  // Shell & command history
  /\.bash_history/i,
  /\.zsh_history/i,
  /powershell.*history/i,

  // SSH keys & config
  /id_rsa/i,
  /id_ed25519/i,
  /id_ecdsa/i,
  /id_dsa/i,
  /known_hosts/i,
  /authorized_keys/i,
  /\.ssh[/\\]/i,

  // Windows credential stores & system SAM
  /credential\s*manager/i,
  /windows[/\\]security/i,
  /system32[/\\]config[/\\]sam/i,
  /system32[/\\]config[/\\]system/i,
  /[/\\]config[/\\]sam/i,
  /[/\\]sam$/i,
  /ntds\.dit/i,

  // Browser credential databases & sessions
  /login\s*data/i,
  /cookies$/i,
  /web\s*data/i,
  /chrome[/\\]user\s*data[/\\].*[/\\](login|cookies|web)/i,
  /firefox[/\\]profiles/i,
  /edge[/\\]user\s*data[/\\].*[/\\](login|cookies|web)/i,

  // Password managers & key bundles
  /\.kdbx$/i,
  /\.key$/i,
  /\.pem$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /keepass/i,
  /vault/i,

  // Git credentials
  /\.git-credentials/i,
  /\.gitconfig/i,

  // GPG keys
  /\.gnupg[/\\]/i,

  // Cloud credentials
  /\.aws[/\\]credentials/i,
  /\.azure[/\\]/i,
  /gcloud[/\\]credentials/i
];

// ── Blocked executable names ─────────────────────────────────────────────────
// These must NEVER be launched by the AI, even if requested.

const BLOCKED_EXECUTABLES = [
  'cmd', 'cmd.exe',
  'powershell', 'powershell.exe',
  'pwsh', 'pwsh.exe',
  'wt', 'wt.exe',               // Windows Terminal
  'bash', 'bash.exe',
  'wsl', 'wsl.exe',
  'regedit', 'regedit.exe',
  'reg', 'reg.exe',
  'net', 'net.exe',
  'netsh', 'netsh.exe',
  'sc', 'sc.exe',               // Service Control
  'schtasks', 'schtasks.exe',   // Task Scheduler
  'runas', 'runas.exe',
  'cipher', 'cipher.exe',
  'format', 'format.exe',
  'diskpart', 'diskpart.exe'
];

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Check the permission level for a given tool name.
 * @param {string} toolName
 * @returns {'safe'|'confirmation_required'|'blocked'}
 */
function getPermissionLevel(toolName) {
  return TOOL_PERMISSIONS[toolName] || PERMISSION_LEVEL.BLOCKED;
}

/**
 * Check whether a tool is allowed to execute automatically.
 * @param {string} toolName
 * @returns {{ allowed: boolean, level: string, requiresConfirmation?: boolean, reason?: string }}
 */
function checkToolPermission(toolName) {
  const level = getPermissionLevel(toolName);

  if (level === PERMISSION_LEVEL.SAFE) {
    return { allowed: true, level };
  }

  if (level === PERMISSION_LEVEL.CONFIRMATION_REQUIRED) {
    return {
      allowed: false,
      level,
      requiresConfirmation: true,
      reason: `Action "${toolName}" requires explicit user confirmation before execution.`
    };
  }

  return {
    allowed: false,
    level,
    reason: `Action "${toolName}" is blocked for security reasons. NexusMind does not support arbitrary command execution or credential access.`
  };
}

/**
 * Check whether a file/folder path touches a sensitive location.
 * Resolves canonical path to prevent path traversal bypasses.
 * @param {string} filePath
 * @returns {{ safe: boolean, reason?: string }}
 */
function checkPathSafety(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { safe: false, reason: 'No file path provided.' };
  }

  // Canonicalize path to prevent traversal attacks (e.g. dir/../../.env)
  let resolvedPath;
  try {
    resolvedPath = path.resolve(filePath.trim());
  } catch {
    resolvedPath = filePath.trim();
  }

  const normalizedOriginal = filePath.replace(/\\/g, '/');
  const normalizedResolved = resolvedPath.replace(/\\/g, '/');

  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(normalizedOriginal) || pattern.test(normalizedResolved)) {
      return {
        safe: false,
        reason: `Access to "${filePath}" is blocked because it matches a protected path pattern. NexusMind cannot access credentials, secrets, or security-critical files.`
      };
    }
  }

  return { safe: true };
}

/**
 * Check whether an executable name is blocked.
 * @param {string} execName
 * @returns {boolean}
 */
function isBlockedExecutable(execName) {
  if (!execName) return true;
  const lower = execName.toLowerCase().trim();
  return BLOCKED_EXECUTABLES.includes(lower);
}

module.exports = {
  PERMISSION_LEVEL,
  TOOL_PERMISSIONS,
  SENSITIVE_PATH_PATTERNS,
  BLOCKED_EXECUTABLES,
  getPermissionLevel,
  checkToolPermission,
  checkPathSafety,
  isBlockedExecutable
};
