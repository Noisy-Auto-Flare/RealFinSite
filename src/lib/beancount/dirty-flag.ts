import DatabaseClass from "better-sqlite3";
import type { Database } from "better-sqlite3";
import path from "path";

function getDbPath(): string {
  return process.env.DATABASE_URL || "./data/fintracker.db";
}

let _dirtyDb: Database | null = null;

export function getDirtySqlite(): Database {
  if (!_dirtyDb) {
    const dbPath = getDbPath();
    const dir = path.dirname(dbPath);
    const fs = require("fs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _dirtyDb = new DatabaseClass(dbPath);
    _dirtyDb.pragma("journal_mode = WAL");
    _dirtyDb.pragma("foreign_keys = ON");
  }
  return _dirtyDb;
}

export function markDirty(sqlite?: Database): void {
  const s = sqlite ?? getDirtySqlite();
  s.exec("INSERT OR IGNORE INTO beancount_dirty (id, is_dirty) VALUES (1, 1)");
  s.prepare("UPDATE beancount_dirty SET is_dirty = 1, updated_at = ? WHERE id = 1")
    .run(new Date().toISOString());
}

export function isDirty(sqlite?: Database): boolean {
  const s = sqlite ?? getDirtySqlite();
  try {
    s.exec("INSERT OR IGNORE INTO beancount_dirty (id, is_dirty) VALUES (1, 0)");
    const row = s.prepare("SELECT is_dirty FROM beancount_dirty WHERE id = 1").get() as { is_dirty: number } | undefined;
    return row?.is_dirty === 1;
  } catch {
    return false;
  }
}

export function clearDirty(sqlite?: Database): void {
  const s = sqlite ?? getDirtySqlite();
  s.prepare("UPDATE beancount_dirty SET is_dirty = 0, updated_at = ? WHERE id = 1")
    .run(new Date().toISOString());
}
