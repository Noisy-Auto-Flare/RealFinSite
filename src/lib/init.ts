import Database from "better-sqlite3";
import { startBackgroundJobs } from "@/lib/scanners/scheduler";
import path from "path";
import fs from "fs";

let initialized = false;

function runMigrations(): void {
  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    description TEXT,
    category TEXT,
    date TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    tx_hash TEXT,
    from_address TEXT,
    to_address TEXT,
    block_timestamp INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS operation_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'principal',
    is_verified INTEGER NOT NULL DEFAULT 0
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS balance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlite.close();
}

export function initializeApp(): void {
  if (initialized) return;
  initialized = true;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  runMigrations();
  startBackgroundJobs();
}
