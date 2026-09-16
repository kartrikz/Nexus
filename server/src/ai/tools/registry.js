const { calculatorTool } = require('./calculator');
const { datetimeTool } = require('./datetime');
const { weatherTool } = require('./weather');
const { websearchTool } = require('./websearch');
const { saveMemoryTool, recallMemoryTool } = require('./memory');
const { fileReaderTool } = require('./fileReader');

// Computer Control Tools
const { openApplicationTool } = require('./computer/openApplication');
const { openUrlTool } = require('./computer/openUrl');
const { openFileTool, openFolderTool } = require('./computer/openFileFolder');
const { screenshotTool } = require('./computer/screenshot');
const { listAllowedApplicationsTool } = require('./computer/listApplications');
const { deleteFileTool, moveFileTool, renameFileTool } = require('./computer/confirmationActions');
const { checkToolPermission, PERMISSION_LEVEL } = require('./computer/computerPermissions');

class ToolRegistry {
  constructor() {
    this.tools = new Map();

    // Register default built-in tools
    this.register(calculatorTool);
    this.register(datetimeTool);
    this.register(weatherTool);
    this.register(websearchTool);
    this.register(saveMemoryTool);
    this.register(recallMemoryTool);
    this.register(fileReaderTool);

    // Register computer control tools
    this.register(openApplicationTool);
    this.register(openUrlTool);
    this.register(openFileTool);
    this.register(openFolderTool);
    this.register(screenshotTool);
    this.register(listAllowedApplicationsTool);

    // Register confirmation-required computer control tools
    this.register(deleteFileTool);
    this.register(moveFileTool);
    this.register(renameFileTool);
  }

  register(tool) {
    if (!tool.name || typeof tool.execute !== 'function') {
      throw new Error(`Invalid tool registration: missing name or execute function.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name) {
    if (this.tools.has(name)) return this.tools.get(name);
    // Support underscore / hyphen / casing variations
    const normalized = name.replace(/[-_]/g, '').toLowerCase();
    for (const [k, v] of this.tools.entries()) {
      if (k.replace(/[-_]/g, '').toLowerCase() === normalized) {
        return v;
      }
    }
    return undefined;
  }

  getAll() {
    return Array.from(this.tools.values());
  }

  /**
   * Return array of tool schemas formatted for OpenAI tool calling API:
   * [ { type: 'function', function: { name, description, parameters } } ]
   */
  getOpenAISchemas() {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} }
      }
    }));
  }

  /**
   * Execute tool with safety bounds and timeout
   */
  async execute(name, args = {}, context = {}) {
    // Check permission level first — block arbitrary commands/shells
    const perm = checkToolPermission(name);
    if (perm.level === PERMISSION_LEVEL.BLOCKED) {
      return {
        error: true,
        blocked: true,
        message: perm.reason || `Tool "${name}" is blocked for security reasons.`
      };
    }

    const tool = this.get(name);
    if (!tool) {
      return { error: true, message: `Tool "${name}" is not registered in NexusMind.` };
    }

    try {
      // Execute with max 10 second timeout
      const result = await Promise.race([
        tool.execute(args, context),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool ${name} timed out`)), 10000))
      ]);
      return result;
    } catch (err) {
      return { error: true, message: `Execution error in ${name}: ${err.message}` };
    }
  }
}

const toolRegistry = new ToolRegistry();

module.exports = {
  ToolRegistry,
  toolRegistry
};
