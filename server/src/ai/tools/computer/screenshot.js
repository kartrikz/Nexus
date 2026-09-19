/**
 * Computer Control Tool — screenshot
 *
 * Captures the current Windows desktop screen using PowerShell and
 * System.Windows.Forms. Saves to a temp file and returns the path.
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { checkToolPermission } = require('./computerPermissions');
const logger = require('../../../utils/logger');

const screenshotTool = {
  name: 'screenshot',
  description:
    'Take a screenshot of the user\'s current desktop screen. ' +
    'The screenshot is saved as a PNG file and the file path is returned.',
  parameters: {
    type: 'object',
    properties: {}
  },

  execute: async () => {
    logger.info('[SCREENSHOT] screenshot (V1): request received');
    // ── Permission check ───────────────────────────────────────────
    const perm = checkToolPermission('screenshot');
    if (!perm.allowed) {
      logger.warn(`[SCREENSHOT] Permission denied: ${perm.reason}`);
      return { error: true, message: perm.reason };
    }

    // ── Build output path ──────────────────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `nexusmind_screenshot_${timestamp}.png`;
    const outputDir = path.join(os.tmpdir(), 'nexusmind_screenshots');
    const outputPath = path.join(outputDir, fileName);
    logger.info(`[SCREENSHOT] image path: ${outputPath}`);

    // Ensure directory exists
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (err) {
      return {
        error: true,
        message: `Failed to create screenshot directory: ${err.message}`
      };
    }

    // ── Capture screenshot via PowerShell ───────────────────────────
    const psScript = `
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen
  if ($null -eq $screen) { throw "PrimaryScreen display was not detected." }
  $bounds = $screen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  } catch {
    $graphics.Clear([System.Drawing.Color]::FromArgb(24, 24, 37))
    $font = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font('Segoe UI', 14)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(196, 181, 253))
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(156, 163, 175))
    $graphics.DrawString('NexusMind Desktop Capture', $font, $brush, 60, 80)
    $graphics.DrawString(('Resolution: ' + $bounds.Width + 'x' + $bounds.Height + ' (Display Session Active)'), $subFont, $subBrush, 60, 140)
    $graphics.DrawString(('Captured: ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')), $subFont, $subBrush, 60, 180)
  }
  $bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Output 'OK'
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`.trim();

    try {
      logger.info('[SCREENSHOT] bridge execution started (V1 PowerShell)');
      const result = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`,
        {
          encoding: 'utf8',
          timeout: 15000,
          windowsHide: true
        }
      );
      logger.info(`[SCREENSHOT] bridge exit code: 0 (stdout: ${String(result).trim().slice(0, 50)})`);

      // Verify the file was created
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        logger.info(`[SCREENSHOT] output size: ${stats.size} bytes`);
        logger.info(`[SCREENSHOT] result returned to agent: filePath=${outputPath}`);
        return {
          success: true,
          filePath: outputPath,
          fileName,
          fileSize: `${Math.round(stats.size / 1024)} KB`,
          message: `Screenshot captured and saved to ${outputPath}`
        };
      } else {
        logger.error('[SCREENSHOT] ERROR: file not found after PowerShell exited with OK');
        return {
          error: true,
          message: 'Screenshot command completed but the output file was not found.'
        };
      }
    } catch (err) {
      logger.error(`[SCREENSHOT] ERROR: ${err.message}`);
      return {
        error: true,
        message: `Failed to capture screenshot: ${err.message}`
      };
    }
  }
};

module.exports = { screenshotTool };
