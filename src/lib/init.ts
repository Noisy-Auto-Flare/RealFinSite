import Database from "better-sqlite3";
import { ensureDbExists, runPendingMigrations } from "@/db/init";
import { startBackgroundJobs } from "@/lib/scanners/scheduler";
import bcrypt from "bcryptjs";

const INIT_KEY = "__fintracker_initialized";

function autoSeedMasterUser(sqlite: Database.Database): void {
  const masterUsername = process.env.MASTER_USERNAME || "admin";
  const masterPassword = process.env.MASTER_PASSWORD;
  if (!masterPassword) return;

  const existing = sqlite.prepare(
    "SELECT id, password FROM users WHERE username = ? AND role = 'master'"
  ).get(masterUsername) as { id: number; password: string } | undefined;

  const hashed = bcrypt.hashSync(masterPassword, 10);

  if (existing) {
    if (bcrypt.compareSync(masterPassword, existing.password)) return;
    sqlite.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, existing.id);
    console.log(`  ✓ master user '${masterUsername}' password updated`);
  } else {
    sqlite.prepare(
      "INSERT INTO users (username, password, role, status) VALUES (?, ?, 'master', 'approved')"
    ).run(masterUsername, hashed);
    console.log(`  ✓ master user '${masterUsername}' created`);
  }
}

export function initializeApp(): void {
  if ((globalThis as any)[INIT_KEY]) return;
  (globalThis as any)[INIT_KEY] = true;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  ensureDbExists();
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  runPendingMigrations(sqlite);
  autoSeedMasterUser(sqlite);

  sqlite.close();
  startBackgroundJobs();
}
