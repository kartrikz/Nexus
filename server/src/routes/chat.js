const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// List all conversations for authenticated user
router.get('/conversations', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*, 
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(req.user.id);

    res.json({ conversations: rows });
  } catch (err) {
    next(err);
  }
});

// Create new conversation
router.post('/conversations', requireAuth, (req, res, next) => {
  try {
    const { title, model, system_prompt } = req.body;
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO conversations (id, user_id, title, model, system_prompt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      title?.trim() || 'New Conversation',
      model || 'gpt-4o-mini',
      system_prompt || null,
      now,
      now
    );

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    res.status(201).json({ conversation: conv });
  } catch (err) {
    next(err);
  }
});

// Get conversation details and message history
router.get('/conversations/:id', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(req.params.id);

    // Parse JSON fields
    const parsedMessages = messages.map(m => ({
      ...m,
      tool_calls: m.tool_calls ? JSON.parse(m.tool_calls) : null,
      tool_results: m.tool_results ? JSON.parse(m.tool_results) : null
    }));

    res.json({ conversation: conv, messages: parsedMessages });
  } catch (err) {
    next(err);
  }
});

// Rename / update conversation
router.patch('/conversations/:id', requireAuth, (req, res, next) => {
  try {
    const { title, is_pinned, model, system_prompt } = req.body;
    const db = getDb();
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const now = new Date().toISOString();
    const newTitle = title !== undefined ? title.trim() : conv.title;
    const newPinned = is_pinned !== undefined ? (is_pinned ? 1 : 0) : conv.is_pinned;
    const newModel = model !== undefined ? model : conv.model;
    const newSystemPrompt = system_prompt !== undefined ? system_prompt : conv.system_prompt;

    db.prepare(`
      UPDATE conversations 
      SET title = ?, is_pinned = ?, model = ?, system_prompt = ?, updated_at = ?
      WHERE id = ?
    `).run(newTitle, newPinned, newModel, newSystemPrompt, now, req.params.id);

    const updated = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    res.json({ conversation: updated });
  } catch (err) {
    next(err);
  }
});

// Delete conversation
router.delete('/conversations/:id', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    next(err);
  }
});

// Send a message and stream the AI agent response via SSE
const { agent } = require('../ai/agent');

router.post('/conversations/:id/messages', requireAuth, chatLimiter, async (req, res, next) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  const db = getDb();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found.' });
  }

  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let isAborted = false;
  req.on('close', () => {
    isAborted = true;
  });

  try {
    await agent.run({
      conversationId: req.params.id,
      userId: req.user.id,
      userMessage: content.trim(),
      onEvent: (event) => {
        if (!isAborted && !res.writableEnded) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      }
    });

    if (!isAborted && !res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
