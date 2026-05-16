import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/sk.db');

let db: Database.Database;

export function getDB(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDB(): void {
  const d = getDB();

  d.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      class_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE INDEX IF NOT EXISTS idx_images_prompt_id ON images(prompt_id);

    CREATE TABLE IF NOT EXISTS archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_id INTEGER,
      class_name TEXT,
      archive_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS archived_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      archive_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      group_name TEXT,
      prompt TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (archive_id) REFERENCES archives(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 插入默认 8 组
  const existing = d.prepare('SELECT COUNT(*) as cnt FROM groups').get() as any;
  if (existing.cnt === 0) {
    const insert = d.prepare('INSERT INTO groups (id, name) VALUES (?, ?)');
    for (let i = 1; i <= 8; i++) {
      insert.run(i, `第${i}组`);
    }
  }

  console.log(`📦 Database initialized at ${DB_PATH}`);
}

export function clearAllData(): void {
  const d = getDB();
  d.exec('DELETE FROM archived_images');
  d.exec('DELETE FROM archives');
  d.exec('DELETE FROM images');
  d.exec('DELETE FROM students');
  d.exec('DELETE FROM classes');
  d.exec('DELETE FROM groups');
  // 重新插入默认8组
  const insert = d.prepare('INSERT INTO groups (id, name) VALUES (?, ?)');
  for (let i = 1; i <= 8; i++) {
    insert.run(i, `第${i}组`);
  }
}
