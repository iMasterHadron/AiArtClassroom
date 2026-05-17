/**
 * 数据库兼容层 - 用 sql.js 模拟 better-sqlite3 的同步 API
 * 无需原生编译，纯 JavaScript，完美兼容 Electron
 */
import initSqlJs, { SqlJsStatic, Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/sk.db');

let SQL: SqlJsStatic;
let db: SqlJsDatabase;

async function initDbInternal(): Promise<void> {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
}

// 延迟初始化：首次调用 getDB 时初始化
let initPromise: Promise<void> | null = null;

function ensureInit(): void {
  if (!db) {
    if (!initPromise) {
      initPromise = initDbInternal();
    }
    // 同步等待（仅在同步上下文中可用）
    throw new Error('Database not initialized. Call await initDBAsync() first.');
  }
}

export async function initDBAsync(): Promise<void> {
  await initDbInternal();
  await createTables();
}

// 同步初始化（兼容旧代码）
export function initDB(): void {
  // sql.js 初始化是异步的，但为了兼容旧代码
  // 主动初始化会在 app startup 时完成
  ensureInit();
}

// ❗️重要：在 Electron main.js 中需要先 await initDBAsync()
export function getDB(): SqlJsDatabase {
  if (!db) {
    throw new Error('sql.js not initialized. Did you forget to await initDBAsync()?');
  }
  return db;
}

async function createTables(): Promise<void> {
  const d = getDB();

  d.run(`
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
  const result = queryAll('SELECT COUNT(*) as cnt FROM groups');
  if (result[0].cnt === 0) {
    for (let i = 1; i <= 8; i++) {
      d.run('INSERT INTO groups (id, name) VALUES (?, ?)', [i, `第${i}组`]);
    }
  }

  saveDB();
  console.log(`📦 Database initialized at ${DB_PATH}`);
}

/**
 * 保存数据库到文件
 */
export function saveDB(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * 查询 - 返回对象数组（类似 better-sqlite3 的 .all()）
 */
export function queryAll(sql: string, params: any[] = []): any[] {
  const d = getDB();
  const stmt = d.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * 查询单条（类似 better-sqlite3 的 .get()）
 */
export function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

/**
 * 执行 SQL（类似 better-sqlite3 的 .run()）
 * 返回 { lastInsertRowid, changes }
 */
export function execute(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  const d = getDB();
  if (params.length > 0) {
    d.run(sql, params);
  } else {
    d.run(sql);
  }
  // sql.js 在 prepare 模式下才能获取 lastInsertRowid
  const result = queryOne('SELECT last_insert_rowid() as id, changes() as ch');
  saveDB();
  return {
    lastInsertRowid: result?.id || 0,
    changes: result?.ch || 0,
  };
}

/**
 * 清空所有数据
 */
export function clearAllData(): void {
  const d = getDB();
  d.run('DELETE FROM archived_images');
  d.run('DELETE FROM archives');
  d.run('DELETE FROM images');
  d.run('DELETE FROM students');
  d.run('DELETE FROM groups');
  for (let i = 1; i <= 8; i++) {
    d.run('INSERT INTO groups (id, name) VALUES (?, ?)', [i, `第${i}组`]);
  }
  saveDB();
}
