const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'nexusmind.db');

let dbInstance = null;

function getDb(customPath = null) {
  if (customPath) {
    const db = new DatabaseSync(customPath);
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
  }

  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }

  return dbInstance;
}

module.exports = {
  getDb,
  DB_PATH
};
