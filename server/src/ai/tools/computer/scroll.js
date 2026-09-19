/**
 * Computer Control Tool — scroll
 *
 * Scrolls the mouse wheel vertically at the current cursor position.
 */

const { checkToolPermission } = require('./computerPermissions');
const { windowsBridge } = require('./windowsBridge');

const scrollTool = {
  name: 'scroll',
  description:
    'Scroll the mouse wheel vertically at the current mouse position. ' +
    'Positive amount scrolls down (forward); negative amount scrolls up (backward). ' +
    'Amount is the number of scroll clicks (e.g. 5 for small scroll, 15 for large scroll).',
  parameters: {
    type: 'object',
    properties: {
      amount: {
        type: 'integer',
        description: 'Scroll amount: positive integer scrolls down, negative integer scrolls up.'
      }
    },
    required: ['amount']
  },

  execute: async ({ amount }) => {
    const perm = checkToolPermission('scroll');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    if (amount === undefined || isNaN(Number(amount))) {
      return { error: true, message: 'Numerical scroll amount is required.' };
    }

    return windowsBridge.mouseScroll(Number(amount));
  }
};

module.exports = { scrollTool };
