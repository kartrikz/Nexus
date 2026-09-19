/**
 * Computer Control Tool — desktop_observe
 *
 * Captures current screen visual state, display metrics, and active foreground window title.
 * Used for GUI understanding, element localization, and Observe-Act-Verify loops.
 */

const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge } = require('./windowsBridge');

const desktopObserveTool = {
  name: 'desktop_observe',
  description:
    'Observe the current state of the Windows desktop. Captures the screen, ' +
    'measures display bounds, detects the active foreground window, and provides ' +
    'visual screen context for vision inspection and verification.',
  parameters: {
    type: 'object',
    properties: {
      includeImage: {
        type: 'boolean',
        description: 'Whether to include base64 visual image data in output. Default is true.'
      }
    }
  },

  execute: async ({ includeImage = true } = {}) => {
    const perm = checkToolPermission('desktop_observe');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    try {
      const capture = windowsBridge.captureScreen({
        saveToDisk: true,
        includeBase64: includeImage !== false
      });

      if (capture.error) {
        return capture;
      }

      const activeWin = windowsBridge.getActiveWindow();

      return {
        success: true,
        width: capture.width,
        height: capture.height,
        activeWindow: activeWin.title,
        filePath: capture.filePath,
        imageBase64: capture.imageBase64 || null,
        timestamp: capture.timestamp,
        message: `Desktop observed (${capture.width}x${capture.height}). Active window: "${activeWin.title}".`
      };
    } catch (err) {
      return {
        error: true,
        message: `Failed to observe desktop: ${err.message}`
      };
    }
  }
};

module.exports = { desktopObserveTool };
