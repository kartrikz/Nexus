/**
 * Computer Control Tool — keyboard_type
 *
 * Types ordinary text into the currently active/focused window.
 * Text is validated and sanitized against credentials and command injection patterns.
 */

const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge } = require('./windowsBridge');

const keyboardTypeTool = {
  name: 'keyboard_type',
  description:
    'Type ordinary text into the currently active and focused input field or application window. ' +
    'Sensitive text (passwords, private keys, API credentials) and system command strings are ' +
    'strictly blocked by the safety layer.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text string to type into the focused element.'
      },
      pressEnterAfter: {
        type: 'boolean',
        description: 'Whether to simulate pressing the ENTER key after typing the text. Default is false.'
      }
    },
    required: ['text']
  },

  execute: async ({ text, pressEnterAfter = false }) => {
    const perm = checkToolPermission('keyboard_type');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (text === undefined || text === null || typeof text !== 'string') {
      return { error: true, message: 'Valid text string is required.' };
    }

    return windowsBridge.keyboardType(text, Boolean(pressEnterAfter));
  }
};

module.exports = { keyboardTypeTool };
