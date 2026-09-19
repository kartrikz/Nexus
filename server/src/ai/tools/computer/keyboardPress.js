/**
 * Computer Control Tool — keyboard_press
 *
 * Presses a single navigation or action key in the active window.
 * Only allowlisted keys are permitted.
 */

const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge, ALLOWLISTED_KEYS, ALLOWLISTED_MODIFIERS } = require('./windowsBridge');

const keyboardPressTool = {
  name: 'keyboard_press',
  description:
    'Simulate pressing a specific navigation or action key on the keyboard. ' +
    'Allowed keys: ENTER, TAB, ESCAPE, BACKSPACE, SPACE, UP, DOWN, LEFT, RIGHT, DELETE, ' +
    'HOME, END, PAGEUP, PAGEDOWN, F5. Optional modifiers: CTRL, ALT, SHIFT. ' +
    'Safe action with no arbitrary command execution.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        enum: ALLOWLISTED_KEYS,
        description: `Key name to press. Must be one of: ${ALLOWLISTED_KEYS.join(', ')}`
      },
      modifiers: {
        type: 'array',
        items: {
          type: 'string',
          enum: ALLOWLISTED_MODIFIERS
        },
        description: 'Optional modifier keys to hold while pressing the key (e.g. ["CTRL"])'
      }
    },
    required: ['key']
  },

  execute: async ({ key, modifiers = [] }) => {
    const perm = checkToolPermission('keyboard_press');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (!key) {
      return { error: true, message: 'Key name is required.' };
    }

    return windowsBridge.keyboardPress(key, modifiers);
  }
};

module.exports = { keyboardPressTool };
