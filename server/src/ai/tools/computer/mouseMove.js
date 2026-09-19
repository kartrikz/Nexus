/**
 * Computer Control Tool — mouse_move
 *
 * Safely moves the cursor to target desktop pixel coordinates (x, y).
 */

const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge } = require('./windowsBridge');

const mouseMoveTool = {
  name: 'mouse_move',
  description:
    'Move the mouse cursor smoothly to target (x, y) coordinates on the primary Windows screen. ' +
    'Coordinates are automatically clamped to valid screen bounds. Safe action with no side effects.',
  parameters: {
    type: 'object',
    properties: {
      x: {
        type: 'integer',
        description: 'Target X coordinate (horizontal pixel offset from left, starting at 0)'
      },
      y: {
        type: 'integer',
        description: 'Target Y coordinate (vertical pixel offset from top, starting at 0)'
      }
    },
    required: ['x', 'y']
  },

  execute: async ({ x, y }) => {
    const perm = checkToolPermission('mouse_move');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (x === undefined || y === undefined || isNaN(Number(x)) || isNaN(Number(y))) {
      return { error: true, message: 'Valid numerical x and y coordinates are required.' };
    }

    return windowsBridge.mouseMove(Number(x), Number(y));
  }
};

module.exports = { mouseMoveTool };
