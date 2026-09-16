/**
 * Computer Control Tool — list_allowed_applications
 *
 * Returns the list of applications NexusMind is permitted to open,
 * along with their availability status on the current system.
 */

const { checkToolPermission } = require('./computerPermissions');
const { getAllowedApplicationsSummary } = require('./applicationAllowlist');

const listAllowedApplicationsTool = {
  name: 'list_allowed_applications',
  description:
    'List all applications that NexusMind is allowed to open on the user\'s Windows computer. ' +
    'Returns each app name, its aliases, and whether it is available on this system.',
  parameters: {
    type: 'object',
    properties: {}
  },

  execute: async () => {
    // ── Permission check ───────────────────────────────────────────
    const perm = checkToolPermission('list_allowed_applications');
    if (!perm.allowed) {
      return { error: true, message: perm.reason };
    }

    const apps = getAllowedApplicationsSummary();

    return {
      success: true,
      totalApps: apps.length,
      applications: apps,
      message: `NexusMind can open ${apps.filter(a => a.available).length} of ${apps.length} allowlisted applications on this system.`
    };
  }
};

module.exports = { listAllowedApplicationsTool };
