const { memoryService } = require('../../services/memoryService');

const saveMemoryTool = {
  name: 'save_memory',
  description: 'Persistently store an important fact, user preference, instruction, or context into the NexusMind Memory Vault.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The core fact, preference, or detail to remember across sessions.'
      },
      category: {
        type: 'string',
        enum: ['preference', 'fact', 'instruction', 'context'],
        description: 'The memory category.'
      },
      importance: {
        type: 'number',
        description: 'Importance rating between 1 (low) and 5 (critical).'
      }
    },
    required: ['content']
  },
  execute: async ({ content, category = 'fact', importance = 4 }, context = {}) => {
    if (!context.userId) {
      return { error: 'User context is required to save memory.' };
    }
    try {
      const memory = memoryService.createMemory(context.userId, {
        category,
        content,
        importance,
        source: 'agent'
      });
      return {
        success: true,
        message: 'Saved to NexusMind Memory Vault.',
        memory: { id: memory.id, category: memory.category, content: memory.content }
      };
    } catch (err) {
      return { error: err.message };
    }
  }
};

const recallMemoryTool = {
  name: 'recall_memory',
  description: 'Search and retrieve memories stored in the user\'s Memory Vault.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The topic, keyword, or concept to recall from memory.'
      }
    },
    required: ['query']
  },
  execute: async ({ query }, context = {}) => {
    if (!context.userId) {
      return { error: 'User context is required to recall memory.' };
    }
    try {
      const results = memoryService.searchRelevantMemories(context.userId, query, 5);
      return {
        query,
        count: results.length,
        memories: results.map(m => ({
          id: m.id,
          category: m.category,
          content: m.content,
          importance: m.importance
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }
};

module.exports = {
  saveMemoryTool,
  recallMemoryTool
};
