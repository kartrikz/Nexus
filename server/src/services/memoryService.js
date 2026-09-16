const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');

class MemoryService {
  createMemory(userId, { category = 'fact', content, importance = 3, source = 'manual' }) {
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new Error('Memory content cannot be empty.');
    }

    const validCategories = ['preference', 'fact', 'instruction', 'context'];
    const safeCategory = validCategories.includes(category) ? category : 'fact';
    const safeImportance = Math.max(1, Math.min(5, Number(importance) || 3));

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO memories (id, user_id, category, content, importance, source, last_accessed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, safeCategory, content.trim(), safeImportance, source, now, now, now);

    return this.getMemoryById(userId, id);
  }

  getMemoryById(userId, id) {
    const db = getDb();
    return db.prepare('SELECT * FROM memories WHERE id = ? AND user_id = ?').get(id, userId);
  }

  listMemories(userId, { category = null, search = null, limit = 50, offset = 0 } = {}) {
    const db = getDb();
    let query = 'SELECT * FROM memories WHERE user_id = ?';
    const params = [userId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      query += ' AND content LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    query += ' ORDER BY importance DESC, updated_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit) || 50, Number(offset) || 0);

    const memories = db.prepare(query).all(...params);

    const countQuery = 'SELECT COUNT(*) as total FROM memories WHERE user_id = ?' + 
      (category ? ' AND category = ?' : '') + 
      (search && search.trim() ? ' AND content LIKE ?' : '');
    const countParams = [userId];
    if (category) countParams.push(category);
    if (search && search.trim()) countParams.push(`%${search.trim()}%`);

    const total = db.prepare(countQuery).get(...countParams)?.total || 0;

    return { memories, total };
  }

  searchRelevantMemories(userId, queryText, limit = 6) {
    if (!queryText || typeof queryText !== 'string') return [];
    const db = getDb();

    // Extract keywords
    const words = queryText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (words.length === 0) {
      return db.prepare('SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, updated_at DESC LIMIT ?').all(userId, limit);
    }

    const allUserMemories = db.prepare('SELECT * FROM memories WHERE user_id = ?').all(userId);

    // Score memories by keyword match + importance weight
    const scored = allUserMemories.map(m => {
      const lowerContent = m.content.toLowerCase();
      let score = m.importance || 1;
      for (const w of words) {
        if (lowerContent.includes(w)) {
          score += 3;
        }
      }
      return { memory: m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const relevant = scored.slice(0, limit).map(s => s.memory);

    // Update last_accessed_at for top memories
    const now = new Date().toISOString();
    for (const m of relevant) {
      try {
        db.prepare('UPDATE memories SET last_accessed_at = ? WHERE id = ?').run(now, m.id);
      } catch {}
    }

    return relevant;
  }

  updateMemory(userId, memoryId, updates = {}) {
    const db = getDb();
    const existing = this.getMemoryById(userId, memoryId);
    if (!existing) {
      throw new Error('Memory record not found.');
    }

    const newContent = updates.content !== undefined ? updates.content.trim() : existing.content;
    const newCategory = updates.category !== undefined ? updates.category : existing.category;
    const newImportance = updates.importance !== undefined ? Number(updates.importance) : existing.importance;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE memories
      SET content = ?, category = ?, importance = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(newContent, newCategory, newImportance, now, memoryId, userId);

    return this.getMemoryById(userId, memoryId);
  }

  deleteMemory(userId, memoryId) {
    const db = getDb();
    const existing = this.getMemoryById(userId, memoryId);
    if (!existing) {
      throw new Error('Memory record not found.');
    }

    db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(memoryId, userId);
    return { success: true };
  }

  clearMemories(userId) {
    const db = getDb();
    db.prepare('DELETE FROM memories WHERE user_id = ?').run(userId);
    return { success: true };
  }
}

const memoryService = new MemoryService();

module.exports = {
  MemoryService,
  memoryService
};
