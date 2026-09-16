const { BaseAIProvider } = require('./base');
const { geminiProvider, GeminiProvider } = require('./gemini');
const { claudeProvider, ClaudeProvider } = require('./claude');
const { openAIProvider, OpenAIProvider } = require('./openai');
const logger = require('../../utils/logger');

const providers = {
  gemini: geminiProvider,
  claude: claudeProvider,
  openai: openAIProvider
};

/**
 * Get AI provider instance by name.
 * Defaults to 'gemini' as instructed.
 *
 * @param {string|null} name - 'gemini' | 'claude' | 'openai'
 * @returns {BaseAIProvider}
 */
function getProvider(name = null) {
  const providerKey = (name || process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const provider = providers[providerKey];
  if (!provider) {
    logger.warn(`Unknown AI provider "${providerKey}", falling back to Gemini.`);
    return geminiProvider;
  }
  return provider;
}

/**
 * List metadata for all registered providers and their models
 */
function getAvailableProviders() {
  return Object.keys(providers).map(key => ({
    id: key,
    name: key === 'gemini' ? 'Google Gemini' : key === 'claude' ? 'Anthropic Claude' : 'OpenAI',
    defaultModel: providers[key].getDefaultModel(),
    availableModels: providers[key].getAvailableModels()
  }));
}

module.exports = {
  BaseAIProvider,
  getProvider,
  getAvailableProviders,
  geminiProvider,
  claudeProvider,
  openAIProvider,
  GeminiProvider,
  ClaudeProvider,
  OpenAIProvider
};
