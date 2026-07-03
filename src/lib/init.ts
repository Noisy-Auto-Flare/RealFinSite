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

  sqlite.close();
}

export function initializeApp(): void {
  if (initialized) return;
  initialized = true;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  runMigrations();
  startBackgroundJobs();
}
