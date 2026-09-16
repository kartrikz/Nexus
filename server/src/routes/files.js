const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { fileService } = require('../services/fileService');
const logger = require('../utils/logger');

const router = express.Router();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration with sanitized filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.pdf', '.docx', '.txt', '.md', '.json', '.csv', '.js', '.py', '.html', '.css'].includes(ext)
      ? ext
      : '.bin';
    cb(null, `${uuidv4()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow text, documents, code, and structured data
    cb(null, true);
  }
});

router.use(requireAuth);

/**
 * POST /api/files/upload
 * Upload and extract text from document (PDF, DOCX, TXT, MD, CSV, JSON, code)
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const { conversationId } = req.body;
    const fileRecord = await fileService.processUpload(req.user.id, req.file, conversationId || null);

    res.status(201).json({
      message: 'File processed and indexed successfully.',
      file: fileRecord
    });
  } catch (err) {
    logger.error(`File upload error: ${err.message}`);
    next(err);
  }
});

/**
 * GET /api/files
 * List files for the current user (optionally filtered by conversation)
 */
router.get('/', (req, res, next) => {
  try {
    const { conversationId } = req.query;
    const files = fileService.listFiles(req.user.id, conversationId || null);
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/files/:id
 * Retrieve specific file metadata and extracted content
 */
router.get('/:id', (req, res, next) => {
  try {
    const file = fileService.getFileById(req.user.id, req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }
    res.json({ file });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/files/:id
 * Delete a file and clean up disk storage
 */
router.delete('/:id', (req, res, next) => {
  try {
    fileService.deleteFile(req.user.id, req.params.id);
    res.json({ success: true, message: 'File deleted.' });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
