const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { memoryService } = require('../services/memoryService');
const logger = require('../utils/logger');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/memories
 * List user memories with optional search and category filters
 */
router.get('/', (req, res, next) => {
  try {
    const { category, search, limit, offset } = req.query;
    const result = memoryService.listMemories(req.user.id, { category, search, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/memories
 * Create a new persistent memory entry
 */
router.post('/', (req, res, next) => {
  try {
    const { content, category, importance } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Memory content is required.' });
    }

    const memory = memoryService.createMemory(req.user.id, {
      content: content.trim(),
      category: category || 'fact',
      importance: importance ? Number(importance) : 3,
      source: 'manual'
    });

    res.status(201).json({ memory });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/memories/:id
 * Retrieve a single memory by ID
 */
router.get('/:id', (req, res, next) => {
  try {
    const memory = memoryService.getMemoryById(req.user.id, req.params.id);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found.' });
    }
    res.json({ memory });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/memories/:id
 * Update an existing memory
 */
router.patch('/:id', (req, res, next) => {
  try {
    const { content, category, importance } = req.body;
    const updated = memoryService.updateMemory(req.user.id, req.params.id, {
      content,
      category,
      importance
    });
    res.json({ memory: updated });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * DELETE /api/memories/:id
 * Delete a memory
 */
router.delete('/:id', (req, res, next) => {
  try {
    memoryService.deleteMemory(req.user.id, req.params.id);
    res.json({ success: true, message: 'Memory removed from Memory Vault.' });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * DELETE /api/memories
 * Clear all memories for user
 */
router.delete('/', (req, res, next) => {
  try {
    memoryService.clearMemories(req.user.id);
    res.json({ success: true, message: 'All memories cleared.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
