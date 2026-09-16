/**
 * Computer Control Tools — Confirmation Required Actions
 *
 * Implements operations that require explicit user approval:
 * - delete_file
 * - move_file
 * - rename_file
 * - shutdown / restart
 *
 * When invoked without explicit `confirmed: true`, returns a structured
 * confirmation request for the frontend UI.
 */

const fs = require('fs');
const path = require('path');
const { checkToolPermission, checkPathSafety } = require('./computerPermissions');

// ── delete_file ──────────────────────────────────────────────────────────────

const deleteFileTool = {
  name: 'delete_file',
  description:
    'Delete a file on the user\'s Windows computer. ' +
    'REQUIRES EXPLICIT USER CONFIRMATION. NexusMind will never delete a file without user approval. ' +
    'Protected and sensitive files (.env, system files, keys) are strictly blocked.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'The absolute path to the file to delete'
      },
      confirmed: {
        type: 'boolean',
        description: 'Set to true ONLY if the user has explicitly confirmed this deletion.'
      }
    },
    required: ['filePath']
  },

  execute: async ({ filePath, confirmed = false }) => {
    // ── Permission check ───────────────────────────────────────────
    const perm = checkToolPermission('delete_file');
    if (!perm.allowed && !perm.requiresConfirmation) {
      return { error: true, message: perm.reason };
    }

    if (!filePath || !filePath.trim()) {
      return { error: true, message: 'No file path provided.' };
    }

    const resolved = path.resolve(filePath.trim());

    // ── Path safety check (blocks sensitive files unconditionally) ─
    const safety = checkPathSafety(resolved);
    if (!safety.safe) {
      return { error: true, message: safety.reason };
    }

    // ── If not confirmed, return confirmation prompt ───────────────
    if (!confirmed) {
      return {
        requiresConfirmation: true,
        action: 'delete_file',
        target: resolved,
        message: `⚠️ Confirmation required\nNexusMind wants to delete:\n${resolved}`
      };
    }

    // ── Execute deletion once confirmed ────────────────────────────
    try {
      if (!fs.existsSync(resolved)) {
        return { error: true, message: `File not found: "${resolved}".` };
      }

      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        return { error: true, message: `"${resolved}" is not a file. NexusMind will not delete directories.` };
      }

      fs.unlinkSync(resolved);

      return {
        success: true,
        action: 'delete_file',
        target: resolved,
        message: `✓ Successfully deleted "${path.basename(resolved)}".`
      };
    } catch (err) {
      return {
        error: true,
        message: `Failed to delete "${resolved}": ${err.message}`
      };
    }
  }
};

// ── move_file ────────────────────────────────────────────────────────────────

const moveFileTool = {
  name: 'move_file',
  description:
    'Move a file from source to destination path on the user\'s Windows computer. ' +
    'REQUIRES EXPLICIT USER CONFIRMATION. Access to sensitive paths is blocked.',
  parameters: {
    type: 'object',
    properties: {
      sourcePath: {
        type: 'string',
        description: 'The absolute path to the source file'
      },
      destinationPath: {
        type: 'string',
        description: 'The absolute destination path'
      },
      confirmed: {
        type: 'boolean',
        description: 'Set to true ONLY if the user has explicitly confirmed this operation.'
      }
    },
    required: ['sourcePath', 'destinationPath']
  },

  execute: async ({ sourcePath, destinationPath, confirmed = false }) => {
    const perm = checkToolPermission('move_file');
    if (!perm.allowed && !perm.requiresConfirmation) {
      return { error: true, message: perm.reason };
    }

    if (!sourcePath || !destinationPath) {
      return { error: true, message: 'Both sourcePath and destinationPath are required.' };
    }

    const resolvedSource = path.resolve(sourcePath.trim());
    const resolvedDest = path.resolve(destinationPath.trim());

    // Safety checks on both paths
    const sourceSafety = checkPathSafety(resolvedSource);
    if (!sourceSafety.safe) return { error: true, message: sourceSafety.reason };

    const destSafety = checkPathSafety(resolvedDest);
    if (!destSafety.safe) return { error: true, message: destSafety.reason };

    if (!confirmed) {
      return {
        requiresConfirmation: true,
        action: 'move_file',
        target: resolvedSource,
        destination: resolvedDest,
        message: `⚠️ Confirmation required\nNexusMind wants to move:\n${resolvedSource} → ${resolvedDest}`
      };
    }

    try {
      if (!fs.existsSync(resolvedSource)) {
        return { error: true, message: `Source file not found: "${resolvedSource}".` };
      }

      fs.renameSync(resolvedSource, resolvedDest);

      return {
        success: true,
        action: 'move_file',
        source: resolvedSource,
        destination: resolvedDest,
        message: `✓ Successfully moved "${path.basename(resolvedSource)}" to "${resolvedDest}".`
      };
    } catch (err) {
      return {
        error: true,
        message: `Failed to move file: ${err.message}`
      };
    }
  }
};

// ── rename_file ──────────────────────────────────────────────────────────────

const renameFileTool = {
  name: 'rename_file',
  description:
    'Rename a file on the user\'s Windows computer. ' +
    'REQUIRES EXPLICIT USER CONFIRMATION. Access to sensitive paths is blocked.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'The absolute path to the file to rename'
      },
      newFileName: {
        type: 'string',
        description: 'The new filename (without directory path)'
      },
      confirmed: {
        type: 'boolean',
        description: 'Set to true ONLY if the user has explicitly confirmed this rename.'
      }
    },
    required: ['filePath', 'newFileName']
  },

  execute: async ({ filePath, newFileName, confirmed = false }) => {
    const perm = checkToolPermission('rename_file');
    if (!perm.allowed && !perm.requiresConfirmation) {
      return { error: true, message: perm.reason };
    }

    if (!filePath || !newFileName) {
      return { error: true, message: 'Both filePath and newFileName are required.' };
    }

    const resolved = path.resolve(filePath.trim());
    const newResolved = path.join(path.dirname(resolved), path.basename(newFileName.trim()));

    const safety = checkPathSafety(resolved);
    if (!safety.safe) return { error: true, message: safety.reason };

    const newSafety = checkPathSafety(newResolved);
    if (!newSafety.safe) return { error: true, message: newSafety.reason };

    if (!confirmed) {
      return {
        requiresConfirmation: true,
        action: 'rename_file',
        target: resolved,
        newFileName: path.basename(newFileName),
        message: `⚠️ Confirmation required\nNexusMind wants to rename:\n${resolved} → ${path.basename(newFileName)}`
      };
    }

    try {
      if (!fs.existsSync(resolved)) {
        return { error: true, message: `File not found: "${resolved}".` };
      }

      fs.renameSync(resolved, newResolved);

      return {
        success: true,
        action: 'rename_file',
        target: newResolved,
        message: `✓ Successfully renamed to "${path.basename(newResolved)}".`
      };
    } catch (err) {
      return {
        error: true,
        message: `Failed to rename file: ${err.message}`
      };
    }
  }
};

module.exports = {
  deleteFileTool,
  moveFileTool,
  renameFileTool
};
