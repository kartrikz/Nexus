/**
 * Computer Control Tool — desktop_screenshot
 *
 * Captures a full screenshot of the primary Windows display with DPI awareness.
 * Returns the saved file path, resolution, timestamp, and base64 image data.
 */

const path = require('path');
const fs = require('fs');
const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge } = require('./windowsBridge');
const logger = require('../../../utils/logger');

const desktopScreenshotTool = {
  name: 'desktop_screenshot',
  description:
    'Take a high-resolution screenshot of the user\'s primary Windows desktop. ' +
    'Returns the saved image file path, display resolution, capture timestamp, and base64-encoded ' +
    'image data so the AI can visually inspect the current screen state. ' +
    'Safe action with no destructive side effects.',
  parameters: {
    type: 'object',
    properties: {
      saveToDisk: {
        type: 'boolean',
        description: 'Whether to save the image to temporary storage. Default is true.'
      }
    }
  },

  execute: async ({ saveToDisk = true } = {}) => {
    logger.info('[SCREENSHOT] desktop_screenshot: request received');

    const perm = checkToolPermission('desktop_screenshot');
    if (!perm.allowed) {
      logger.warn(`[SCREENSHOT] Permission denied: ${perm.reason}`);
      return { error: true, message: perm.reason };
    }

    try {
      logger.info('[SCREENSHOT] bridge execution started');
      // includeBase64: true so the AI can see the actual screen content
      const result = windowsBridge.captureScreen({
        saveToDisk: saveToDisk !== false,
        includeBase64: true
      });

      logger.info(`[SCREENSHOT] bridge exit code: success=${result.success}, error=${result.error}`);

      if (result.error) {
        logger.error(`[SCREENSHOT] ERROR: ${result.message}`);
        return result;
      }

      // Validate file if saved to disk
      let fileSize = null;
      if (result.filePath) {
        try {
          const stat = fs.statSync(result.filePath);
          fileSize = stat.size;
          logger.info(`[SCREENSHOT] image path: ${result.filePath}`);
          logger.info(`[SCREENSHOT] output size: ${fileSize} bytes`);
          logger.info(`[SCREENSHOT] image dimensions: ${result.width}x${result.height}`);
        } catch (statErr) {
          logger.warn(`[SCREENSHOT] Could not stat output file: ${statErr.message}`);
        }
      }

      const response = {
        success: true,
        filePath: result.filePath,
        fileName: result.fileName,
        width: result.width,
        height: result.height,
        fileSize: fileSize ? `${Math.round(fileSize / 1024)} KB` : null,
        imageBase64: result.imageBase64 || null,
        timestamp: result.timestamp,
        message: `Screenshot captured successfully (${result.width}x${result.height}). Saved to: ${result.filePath}`
      };

      logger.info(`[SCREENSHOT] result returned to agent: ${result.width}x${result.height}, base64=${result.imageBase64 ? result.imageBase64.length + ' chars' : 'null'}`);
      return response;
    } catch (err) {
      logger.error(`[SCREENSHOT] ERROR: ${err.message}`);
      return {
        error: true,
        message: `Failed to capture screenshot: ${err.message}`
      };
    }
  }
};

module.exports = { desktopScreenshotTool };
