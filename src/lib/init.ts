import Database from "better-sqlite3";
import { runMigrations } from "@/db/migrate";
import { startBackgroundJobs } from "@/lib/scanners/scheduler";

let initialized = false;

export function initializeApp(): void {
  if (initialized) return;
  initialized = true;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  runMigrations(sqlite);

  sqlite.close();
  startBackgroundJobs();
}
