const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const logger = require('../utils/logger');

class FileService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async extractText(filePath, mimeType, originalName) {
    const ext = path.extname(originalName).toLowerCase();

    try {
      if (ext === '.pdf' || mimeType === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text || '';
      }

      if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '';
      }

      // Default text extraction for plaintext, markdown, csv, json, code
      const content = fs.readFileSync(filePath, 'utf8');
      return content;
    } catch (err) {
      logger.warn(`Failed text extraction for ${originalName}: ${err.message}`);
      return `[Text extraction notice: ${err.message}]`;
    }
  }

  async processUpload(userId, file, conversationId = null) {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    const extractedText = await this.extractText(file.path, file.mimetype, file.originalname);
    const summary = extractedText ? extractedText.slice(0, 200).trim() + '...' : null;

    db.prepare(`
      INSERT INTO files (id, user_id, conversation_id, filename, original_name, mime_type, size_bytes, extracted_text, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      conversationId,
      file.filename,
      file.originalname,
      file.mimetype,
      file.size,
      extractedText,
      summary,
      now
    );

    return this.getFileById(userId, id);
  }

  listFiles(userId, conversationId = null) {
    const db = getDb();
    let query = 'SELECT id, conversation_id, filename, original_name, mime_type, size_bytes, summary, created_at FROM files WHERE user_id = ?';
    const params = [userId];

    if (conversationId) {
      query += ' AND conversation_id = ?';
      params.push(conversationId);
    }

    query += ' ORDER BY created_at DESC';
    return db.prepare(query).all(...params);
  }

  getFileById(userId, id) {
    const db = getDb();
    return db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(id, userId);
  }

  deleteFile(userId, id) {
    const db = getDb();
    const file = this.getFileById(userId, id);
    if (!file) {
      throw new Error('File record not found.');
    }

    // Remove file on disk if exists
    const fullPath = path.join(this.uploadDir, file.filename);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) { logger.warn(`Could not delete file ${fullPath}: ${e.message}`); }
    }

    db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(id, userId);
    return { success: true };
  }
}

const fileService = new FileService();

module.exports = {
  FileService,
  fileService
};
