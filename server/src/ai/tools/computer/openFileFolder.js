/**
 * Computer Control Tools — open_file & open_folder
 *
 * Opens files with their default Windows application, or folders in Explorer.
 * All paths pass through the safety layer to block sensitive locations.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { checkToolPermission, checkPathSafety } = require('./computerPermissions');

// ── open_file ────────────────────────────────────────────────────────────────

const openFileTool = {
  name: 'open_file',
  description:
    'Open a local file on the user\'s Windows computer using the default application for that file type. ' +
    'Provide the full file path. Access to sensitive files (.env, SSH keys, credentials) is blocked.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'The absolute path to the file to open, e.g. "C:\\Users\\User\\Documents\\report.pdf"'
      }
    },
    required: ['filePath']
  },

  execute: async ({ filePath }) => {
    // ── Permission check ───────────────────────────────────────────
    const perm = checkToolPermission('open_file');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (!filePath || !filePath.trim()) {
      return { error: true, message: 'No file path provided. Please specify the full path to the file.' };
    }

    const resolved = path.resolve(filePath.trim());

    // ── Path safety check ──────────────────────────────────────────
    const safety = checkPathSafety(resolved);
    if (!safety.safe) {
      return { error: true, message: safety.reason };
    }

    // ── Check file exists ──────────────────────────────────────────
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        return {
          error: true,
          message: `"${resolved}" is not a file. Use open_folder for directories.`
        };
      }
    } catch {
      return {
        error: true,
        message: `File not found: "${resolved}". Please check the path and try again.`
      };
    }

    // ── Open with default application ──────────────────────────────
    try {
      const child = spawn('cmd.exe', ['/c', 'start', '', resolved], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();

      return {
        success: true,
        filePath: resolved,
        message: `Opened "${path.basename(resolved)}" with its default application.`
      };
    } catch (err) {
      return {
        error: true,
        message: `Failed to open file: ${err.message}`
      };
    }
  }
};

// ── open_folder ──────────────────────────────────────────────────────────────

const openFolderTool = {
  name: 'open_folder',
  description:
    'Open a local folder in Windows File Explorer. ' +
    'Provide the full folder path. Access to sensitive directories is blocked.',
  parameters: {
    type: 'object',
    properties: {
      folderPath: {
        type: 'string',
        description: 'The absolute path to the folder to open, e.g. "C:\\Users\\User\\Documents"'
      }
    },
    required: ['folderPath']
  },

  execute: async ({ folderPath }) => {
    // ── Permission check ───────────────────────────────────────────
    const perm = checkToolPermission('open_folder');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (!folderPath || !folderPath.trim()) {
      return { error: true, message: 'No folder path provided. Please specify the full folder path.' };
    }

    const resolved = path.resolve(folderPath.trim());

    // ── Path safety check ──────────────────────────────────────────
    const safety = checkPathSafety(resolved);
    if (!safety.safe) {
      return { error: true, message: safety.reason };
    }

    // ── Check folder exists ────────────────────────────────────────
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return {
          error: true,
          message: `"${resolved}" is not a folder. Use open_file for files.`
        };
      }
    } catch {
      return {
        error: true,
        message: `Folder not found: "${resolved}". Please check the path and try again.`
      };
    }

    // ── Open in Explorer ───────────────────────────────────────────
    try {
      const child = spawn('explorer.exe', [resolved], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });
      child.unref();

      return {
        success: true,
        folderPath: resolved,
        message: `Opened folder "${path.basename(resolved)}" in File Explorer.`
      };
    } catch (err) {
      return {
        error: true,
        message: `Failed to open folder: ${err.message}`
      };
    }
  }
};

module.exports = { openFileTool, openFolderTool };
