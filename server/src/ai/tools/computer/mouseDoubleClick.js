/**
 * Computer Control Tool — mouse_double_click
 *
 * Performs a double-click at target (x, y) coordinates.
 */

const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge } = require('./windowsBridge');

const mouseDoubleClickTool = {
  name: 'mouse_double_click',
  description:
    'Double-click the primary (left) mouse button at (x, y) coordinates on the Windows screen. ' +
    'Used to open icons, select words, or activate items. Safe action.',
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
      }
    },
    required: ['x', 'y']
  },

  execute: async ({ x, y }) => {
    const perm = checkToolPermission('mouse_double_click');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (x === undefined || y === undefined || isNaN(Number(x)) || isNaN(Number(y))) {
      return { error: true, message: 'Valid numerical x and y coordinates are required.' };
    }

    return windowsBridge.mouseDoubleClick(Number(x), Number(y));
  }
};

module.exports = { mouseDoubleClickTool };
