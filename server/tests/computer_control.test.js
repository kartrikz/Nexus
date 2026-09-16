const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  checkToolPermission,
  checkPathSafety,
  isBlockedExecutable,
  PERMISSION_LEVEL,
  getPermissionLevel
} = require('../src/ai/tools/computer/computerPermissions');

const {
  APPLICATION_ALLOWLIST,
  findApplication,
  resolveExecutablePath,
  getAllowedApplicationsSummary
} = require('../src/ai/tools/computer/applicationAllowlist');

const { openApplicationTool } = require('../src/ai/tools/computer/openApplication');
const { openUrlTool, validateUrl } = require('../src/ai/tools/computer/openUrl');
const { openFileTool, openFolderTool } = require('../src/ai/tools/computer/openFileFolder');
const { listAllowedApplicationsTool } = require('../src/ai/tools/computer/listApplications');
const { deleteFileTool, moveFileTool, renameFileTool } = require('../src/ai/tools/computer/confirmationActions');
const { toolRegistry } = require('../src/ai/tools/registry');

describe('Computer Control — Safety, Permissions & Tool Execution Suite', () => {

  // ── 1. Allowed Application ───────────────────────────────────────────────
  test('allowed application lookup finds standard apps by name and aliases', () => {
    const chrome = findApplication('Google Chrome');
    assert.ok(chrome);
    assert.strictEqual(chrome.name, 'Google Chrome');

    const chromeAlias = findApplication('chrome');
    assert.ok(chromeAlias);
    assert.strictEqual(chromeAlias.name, 'Google Chrome');

    const vscode = findApplication('vs code');
    assert.ok(vscode);
    assert.strictEqual(vscode.name, 'Visual Studio Code');

    const notepad = findApplication('notepad');
    assert.ok(notepad);
    assert.strictEqual(notepad.name, 'Notepad');

    const calc = findApplication('Calculator');
    assert.ok(calc);
    assert.strictEqual(calc.name, 'Calculator');

    const explorer = findApplication('File Explorer');
    assert.ok(explorer);
    assert.strictEqual(explorer.name, 'File Explorer');
  });

  test('application resolution does not use hardcoded usernames', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/ai/tools/computer/applicationAllowlist.js'),
      'utf8'
    );
    // Must NOT contain hardcoded usernames
    assert.ok(!source.includes('C:\\\\Users\\\\ASUS') && !source.includes('C:\\Users\\ASUS'));
    assert.ok(!source.includes('C:\\\\Users\\\\John') && !source.includes('C:\\Users\\John'));
    assert.ok(!source.includes('C:\\\\Users\\\\Admin') && !source.includes('C:\\Users\\Admin'));

    // Must dynamically resolve via environment variables & os.homedir()
    assert.ok(source.includes('os.homedir()'));
    assert.ok(source.includes('process.env.LOCALAPPDATA'));
    assert.ok(source.includes('process.env.ProgramFiles'));
  });

  // ── 2. Unknown Application Rejection ─────────────────────────────────────
  test('unknown application is rejected gracefully', async () => {
    const unknown = findApplication('malicious_hack_tool_1234');
    assert.strictEqual(unknown, null);

    const result = await openApplicationTool.execute({ application: 'malicious_hack_tool_1234' });
    assert.strictEqual(result.error, true);
    assert.ok(result.message.toLowerCase().includes('not in the allowed applications'));
  });

  // ── 3. URL Validation ────────────────────────────────────────────────────
  test('URL validation accepts standard HTTP and HTTPS URLs', () => {
    const validHttps = validateUrl('https://youtube.com');
    assert.strictEqual(validHttps.valid, true);
    assert.strictEqual(validHttps.url.protocol, 'https:');

    const validHttp = validateUrl('http://example.com/test');
    assert.strictEqual(validHttp.valid, true);
    assert.strictEqual(validHttp.url.protocol, 'http:');

    // Auto-prepends https:// when no protocol is supplied
    const autoPrepend = validateUrl('github.com');
    assert.strictEqual(autoPrepend.valid, true);
    assert.strictEqual(autoPrepend.url.href, 'https://github.com/');
  });

  test('URL validation blocks dangerous schemes (file://, javascript:, data:)', () => {
    const fileUrl = validateUrl('file:///C:/Windows/System32/cmd.exe');
    assert.strictEqual(fileUrl.valid, false);
    assert.ok(fileUrl.reason.toLowerCase().includes('blocked'));

    const jsUrl = validateUrl('javascript:alert(document.cookie)');
    assert.strictEqual(jsUrl.valid, false);
    assert.ok(jsUrl.reason.toLowerCase().includes('blocked'));

    const dataUrl = validateUrl('data:text/html,<script>alert(1)</script>');
    assert.strictEqual(dataUrl.valid, false);
    assert.ok(dataUrl.reason.toLowerCase().includes('blocked'));

    const ftpUrl = validateUrl('ftp://ftp.example.com');
    assert.strictEqual(ftpUrl.valid, false);
  });

  // ── 4. Protected File Rejection ──────────────────────────────────────────
  test('protected file paths (.env, SSH keys, credentials, SAM) are strictly blocked', () => {
    assert.strictEqual(checkPathSafety('.env').safe, false);
    assert.strictEqual(checkPathSafety('C:\\projects\\app\\.env').safe, false);
    assert.strictEqual(checkPathSafety('.env.local').safe, false);
    assert.strictEqual(checkPathSafety('.env.production').safe, false);

    assert.strictEqual(checkPathSafety('C:\\Users\\User\\.ssh\\id_rsa').safe, false);
    assert.strictEqual(checkPathSafety('C:\\Users\\User\\.ssh\\id_ed25519').safe, false);
    assert.strictEqual(checkPathSafety('C:\\Users\\User\\.ssh\\known_hosts').safe, false);

    assert.strictEqual(checkPathSafety('C:\\Windows\\System32\\config\\SAM').safe, false);
    assert.strictEqual(checkPathSafety('C:\\Windows\\System32\\config\\SYSTEM').safe, false);

    assert.strictEqual(checkPathSafety('C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Login Data').safe, false);
    assert.strictEqual(checkPathSafety('C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cookies').safe, false);
    assert.strictEqual(checkPathSafety('C:\\Users\\User\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Login Data').safe, false);

    assert.strictEqual(checkPathSafety('C:\\Users\\User\\.aws\\credentials').safe, false);
    assert.strictEqual(checkPathSafety('C:\\Users\\User\\.npmrc').safe, false);
    assert.strictEqual(checkPathSafety('C:\\Users\\User\\.git-credentials').safe, false);
  });

  test('openFileTool rejects access to sensitive paths', async () => {
    const result = await openFileTool.execute({ filePath: '.env' });
    assert.strictEqual(result.error, true);
    assert.ok(result.message.toLowerCase().includes('blocked'));
  });

  // ── 5. Permission Handling ───────────────────────────────────────────────
  test('permission layer correctly categorizes SAFE, CONFIRMATION_REQUIRED, and BLOCKED', () => {
    // SAFE
    assert.strictEqual(getPermissionLevel('open_application'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('open_url'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('open_file'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('open_folder'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('screenshot'), PERMISSION_LEVEL.SAFE);
    assert.strictEqual(getPermissionLevel('list_allowed_applications'), PERMISSION_LEVEL.SAFE);

    const safePerm = checkToolPermission('open_application');
    assert.strictEqual(safePerm.allowed, true);
    assert.strictEqual(safePerm.level, PERMISSION_LEVEL.SAFE);

    // CONFIRMATION_REQUIRED
    assert.strictEqual(getPermissionLevel('delete_file'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('move_file'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('rename_file'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('shutdown'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);
    assert.strictEqual(getPermissionLevel('restart'), PERMISSION_LEVEL.CONFIRMATION_REQUIRED);

    const confirmPerm = checkToolPermission('delete_file');
    assert.strictEqual(confirmPerm.allowed, false);
    assert.strictEqual(confirmPerm.requiresConfirmation, true);
    assert.strictEqual(confirmPerm.level, PERMISSION_LEVEL.CONFIRMATION_REQUIRED);

    // BLOCKED
    assert.strictEqual(getPermissionLevel('execute_command'), PERMISSION_LEVEL.BLOCKED);
    assert.strictEqual(getPermissionLevel('run_shell'), PERMISSION_LEVEL.BLOCKED);
    assert.strictEqual(getPermissionLevel('run_powershell'), PERMISSION_LEVEL.BLOCKED);
    assert.strictEqual(getPermissionLevel('cmd'), PERMISSION_LEVEL.BLOCKED);
    assert.strictEqual(getPermissionLevel('powershell'), PERMISSION_LEVEL.BLOCKED);

    const blockedPerm = checkToolPermission('execute_command');
    assert.strictEqual(blockedPerm.allowed, false);
    assert.strictEqual(blockedPerm.level, PERMISSION_LEVEL.BLOCKED);
  });

  // ── 6. Blocked Arbitrary Command Execution ───────────────────────────────
  test('arbitrary command execution and system shells are blocked', async () => {
    assert.strictEqual(isBlockedExecutable('cmd'), true);
    assert.strictEqual(isBlockedExecutable('cmd.exe'), true);
    assert.strictEqual(isBlockedExecutable('powershell'), true);
    assert.strictEqual(isBlockedExecutable('pwsh.exe'), true);
    assert.strictEqual(isBlockedExecutable('bash'), true);
    assert.strictEqual(isBlockedExecutable('wsl.exe'), true);
    assert.strictEqual(isBlockedExecutable('regedit.exe'), true);

    // openApplicationTool rejects blocked shell executables
    const cmdResult = await openApplicationTool.execute({ application: 'cmd' });
    assert.strictEqual(cmdResult.error, true);
    assert.ok(cmdResult.message.toLowerCase().includes('blocked for security'));

    const psResult = await openApplicationTool.execute({ application: 'powershell' });
    assert.strictEqual(psResult.error, true);
    assert.ok(psResult.message.toLowerCase().includes('blocked for security'));

    // ToolRegistry blocks execution of execute_command
    const regResult = await toolRegistry.execute('execute_command', { command: 'whoami' });
    assert.strictEqual(regResult.error, true);
    assert.strictEqual(regResult.blocked, true);
  });

  // ── 7. Successful Tool Execution ─────────────────────────────────────────
  test('list_allowed_applications tool returns summary of available apps', async () => {
    const result = await listAllowedApplicationsTool.execute();
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.applications));
    assert.ok(result.totalApps >= 5);
    const names = result.applications.map(a => a.name);
    assert.ok(names.includes('Google Chrome'));
    assert.ok(names.includes('Notepad'));
    assert.ok(names.includes('Calculator'));
  });

  test('confirmation tool (delete_file) requires confirmation, then executes when confirmed', async () => {
    // Create a temporary scratch file for safe testing
    const tempFile = path.join(os.tmpdir(), `nexusmind_test_${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'NexusMind test file', 'utf8');

    // 1. Without confirmation
    const unconfirmed = await deleteFileTool.execute({ filePath: tempFile, confirmed: false });
    assert.strictEqual(unconfirmed.requiresConfirmation, true);
    assert.strictEqual(unconfirmed.action, 'delete_file');
    assert.ok(fs.existsSync(tempFile), 'File must NOT be deleted without confirmation');

    // 2. With confirmation
    const confirmed = await deleteFileTool.execute({ filePath: tempFile, confirmed: true });
    assert.strictEqual(confirmed.success, true);
    assert.strictEqual(confirmed.action, 'delete_file');
    assert.ok(!fs.existsSync(tempFile), 'File MUST be deleted once confirmed');
  });

  // ── 8. Failed Tool Execution ─────────────────────────────────────────────
  test('failed tool execution returns explicit error details without crashing', async () => {
    // Missing arguments
    const emptyApp = await openApplicationTool.execute({});
    assert.strictEqual(emptyApp.error, true);
    assert.ok(emptyApp.message.includes('No application name provided'));

    const emptyUrl = await openUrlTool.execute({});
    assert.strictEqual(emptyUrl.error, true);
    assert.ok(emptyUrl.message.includes('No URL provided'));

    // Non-existent file
    const fakeFile = await openFileTool.execute({ filePath: 'C:\\nexusmind_non_existent_file_987654.xyz' });
    assert.strictEqual(fakeFile.error, true);
    assert.ok(fakeFile.message.toLowerCase().includes('not found'));

    // Non-existent folder
    const fakeFolder = await openFolderTool.execute({ folderPath: 'C:\\nexusmind_non_existent_folder_987654' });
    assert.strictEqual(fakeFolder.error, true);
    assert.ok(fakeFolder.message.toLowerCase().includes('not found'));
  });

  // ── 9. Permission Bypass Attempts ────────────────────────────────────────
  test('permission bypass attempts (traversal, mixed case, protocol tricks) are blocked', () => {
    // Path traversal targeting .env
    assert.strictEqual(checkPathSafety('some_dir/../../.env').safe, false);
    assert.strictEqual(checkPathSafety('C:\\safe\\..\\..\\.env').safe, false);

    // Case variation
    assert.strictEqual(checkPathSafety('C:\\PROJ\\.ENV').safe, false);
    assert.strictEqual(checkPathSafety('C:\\PROJ\\APP\\.ENV.LOCAL').safe, false);
    assert.strictEqual(isBlockedExecutable('CmD.eXe'), true);
    assert.strictEqual(isBlockedExecutable('PoWeRsHeLl.EXE'), true);

    // Mixed separator traversal targeting SAM
    assert.strictEqual(
      checkPathSafety('C:/Windows/System32/..\\config\\SAM').safe,
      false
    );

    // Scheme case variation
    const mixedCaseJs = validateUrl('JaVaScRiPt:alert(1)');
    assert.strictEqual(mixedCaseJs.valid, false);

    const mixedCaseFile = validateUrl('FiLe:///C:/passwords.txt');
    assert.strictEqual(mixedCaseFile.valid, false);
  });
});
