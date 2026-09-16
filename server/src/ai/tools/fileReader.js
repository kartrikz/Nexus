const { getDb } = require('../../db/connection');

const fileReaderTool = {
  name: 'file_reader',
  description: 'Read the contents and extracted text of files uploaded by the user to answer questions or analyze data.',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'The original name or ID of the file to inspect.'
      }
    },
    required: ['filename']
  },
  execute: async ({ filename }, context = {}) => {
    if (!context.userId) {
      return { error: 'User context is required to read files.' };
    }

    const db = getDb();
    const file = db.prepare(`
      SELECT id, original_name, mime_type, size_bytes, extracted_text, created_at
      FROM files
      WHERE user_id = ? AND (original_name LIKE ? OR id = ?)
      ORDER BY created_at DESC
      LIMIT 1
    `).get(context.userId, `%${filename}%`, filename);

    if (!file) {
      return {
        error: `No file matching "${filename}" was found in your uploaded documents. Please upload the file first.`
      };
    }

    const truncatedText = file.extracted_text
      ? file.extracted_text.slice(0, 15000) + (file.extracted_text.length > 15000 ? '\n...[Content truncated for length]...' : '')
      : 'No text could be extracted from this file.';

    return {
      id: file.id,
      name: file.original_name,
      sizeBytes: file.size_bytes,
      mimeType: file.mime_type,
      content: truncatedText
    };
  }
};

module.exports = { fileReaderTool };
