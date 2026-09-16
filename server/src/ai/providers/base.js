const logger = require('../../utils/logger');

/**
 * Base abstract class for all AI Providers in NexusMind.
 * Enforces a consistent, provider-agnostic interface across Gemini, Claude, OpenAI, etc.
 */
class BaseAIProvider {
  constructor(name, defaultModel) {
    if (new.target === BaseAIProvider) {
      throw new TypeError('Cannot construct BaseAIProvider instances directly. Subclass must implement abstract methods.');
    }
    this.name = name;
    this.defaultModel = defaultModel;
  }

  /**
   * Provider identifier (e.g., 'gemini', 'claude', 'openai')
   */
  getName() {
    return this.name;
  }

  /**
   * Default model for this provider
   */
  getDefaultModel() {
    return this.defaultModel;
  }

  /**
   * Array of supported model identifiers
   */
  getAvailableModels() {
    return [this.defaultModel];
  }

  /**
   * Core streaming chat method.
   * Must be implemented by subclasses.
   *
   * @param {Object} params
   * @param {Array} params.messages - Standardized messages [{ role: 'system'|'user'|'assistant'|'tool', content, tool_calls }]
   * @param {Array} params.tools - Standardized tool definitions [{ type: 'function', function: { name, description, parameters } }]
   * @param {string} [params.model] - Target model override
   * @param {number} [params.temperature] - Generation temperature (0.0 - 1.0)
   * @param {string} [params.apiKey] - Optional user-provided API key override
   * @param {Function} params.onToken - Callback for streaming text chunks: (token: string) => void
   * @param {Function} params.onToolCall - Callback when model requests tool: (call: { id, name, arguments }) => void
   * @param {Function} params.onDone - Callback when stream completes: (reason: string) => void
   */
  async streamChat({
    messages,
    tools = [],
    model = null,
    temperature = 0.7,
    apiKey = null,
    onToken = () => {},
    onToolCall = () => {},
    onDone = () => {}
  }) {
    throw new Error(`streamChat() must be implemented by provider "${this.name}".`);
  }

  /**
   * Shared simulated streaming helper for testing, offline demo, or zero-key environments
   */
  async streamSimulatedText(text, onToken, delayMs = 12) {
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      onToken((i === 0 ? '' : ' ') + words[i]);
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
}

module.exports = {
  BaseAIProvider
};
