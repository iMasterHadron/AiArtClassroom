/**
 * 数据库管理 - 使用 better-sqlite3
 * 在 Electron 环境中需要使用 @electron/rebuild 编译原生模块
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/sk.db');

let db: Database.Database;

export function getDB(): Database.Database {
  if (!db) {
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

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (group_id) REFERENCES groups(id)
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
  // 重新插入默认 8 组
  d.exec('DELETE FROM groups');
  const insert = d.prepare('INSERT INTO groups (id, name) VALUES (?, ?)');
  for (let i = 1; i <= 8; i++) {
    insert.run(i, `第${i}组`);
  }
}
