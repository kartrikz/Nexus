/**
 * Computer Control Tool — open_application
 *
 * Opens an allowlisted Windows application by name.
 * Uses the application allowlist for safe path resolution.
 */

const { spawn } = require('child_process');
const { checkToolPermission, isBlockedExecutable } = require('./computerPermissions');
const { findApplication, resolveExecutablePath } = require('./applicationAllowlist');

const openApplicationTool = {
  name: 'open_application',
  description:
    'Open a safe, allowlisted application on the user\'s Windows computer. ' +
    'Supported apps include: Google Chrome, VS Code, Notepad, Calculator, File Explorer, ' +
    'Task Manager, Paint, WordPad, Snipping Tool, Microsoft Edge. ' +
    'Use list_allowed_applications to see all available apps.',
  parameters: {
    type: 'object',
    properties: {
      application: {
        type: 'string',
        description: 'The name of the application to open, e.g. "Chrome", "VS Code", "Notepad", "Calculator"'
      }
    },
    required: ['application']
  },

  execute: async ({ application }) => {
    // ── Permission check ───────────────────────────────────────────
    const perm = checkToolPermission('open_application');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (!application || !application.trim()) {
      return {
        error: true,
        message: 'No application name provided. Please specify which application to open.'
      };
    }

    const appName = application.trim();

    // ── Block dangerous executables ────────────────────────────────
    if (isBlockedExecutable(appName)) {
      return {
        error: true,
        message: `"${appName}" is blocked for security reasons. NexusMind cannot open command-line shells or system-level executables.`
      };
    }

    // ── Look up in allowlist ───────────────────────────────────────
    const app = findApplication(appName);
    if (!app) {
      return {
        error: true,
        message:
          `"${appName}" is not in the allowed applications list. ` +
          'Use the list_allowed_applications tool to see available apps.'
      };
    }

    // ── Resolve executable path ────────────────────────────────────
    const resolution = resolveExecutablePath(app);
    if (!resolution.resolved) {
      return {
        error: true,
        message: resolution.reason || `Could not find "${app.name}" on this system.`
      };
    }

    // ── Launch the application ─────────────────────────────────────
    try {
      return await new Promise((resolve) => {
        let child;
        if (resolution.uwpUri) {
          // UWP apps (Calculator, Snipping Tool) use start with URI
          child = spawn('cmd.exe', ['/c', 'start', '', resolution.uwpUri], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          });
        } else {
          // Regular .exe launch
          const execArgs = Array.isArray(resolution.defaultArgs) ? resolution.defaultArgs : [];
          child = spawn(resolution.execPath, execArgs, {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
          });
        }

        let settled = false;

        child.on('error', (err) => {
          if (!settled) {
            settled = true;
            resolve({
              error: true,
              message: `Failed to open ${app.name}: ${err.message}`
            });
          }
        });

        // Give process a brief moment to catch immediate spawn failures
        setTimeout(() => {
          if (!settled) {
            settled = true;
            if (!child.pid) {
              resolve({
                error: true,
                message: `Failed to launch ${app.name}: no valid process ID obtained.`
              });
              return;
            }
            child.unref();
            resolve({
              success: true,
              application: app.name,
              pid: child.pid,
              message: `${app.name} has been opened successfully.`
            });
          }
        }, 120);
      });
    } catch (err) {
      return {
        error: true,
        message: `Failed to open ${app.name}: ${err.message}`
      };
    }
  }
};

module.exports = { openApplicationTool };
