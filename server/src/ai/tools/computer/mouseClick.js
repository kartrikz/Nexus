/**
 * Computer Control Tool — mouse_click
 *
 * Clicks the mouse at target desktop pixel coordinates (x, y) with left, right, or middle button.
 */

const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge } = require('./windowsBridge');

const mouseClickTool = {
  name: 'mouse_click',
  description:
    'Click the mouse at specified (x, y) pixel coordinates on the Windows screen. ' +
    'Supports "left" (default), "right" (context menu), and "middle" buttons. ' +
    'Coordinates are automatically clamped to valid screen bounds. Safe action.',
  parameters: {
    type: 'object',
    properties: {
      x: {
        type: 'integer',
        description: 'Target X pixel coordinate'
      },
      y: {
        type: 'integer',
        description: 'Target Y pixel coordinate'
      },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        description: 'Mouse button to click: "left", "right", or "middle". Defaults to "left".'
      }
    },
    required: ['x', 'y']
  },

  execute: async ({ x, y, button = 'left' }) => {
    const perm = checkToolPermission('mouse_click');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (x === undefined || y === undefined || isNaN(Number(x)) || isNaN(Number(y))) {
      return { error: true, message: 'Valid numerical x and y coordinates are required.' };
    }

    return windowsBridge.mouseClick(Number(x), Number(y), button);
  }
};

module.exports = { mouseClickTool };
