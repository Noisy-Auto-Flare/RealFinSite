import Database from "better-sqlite3";
import { runMigrations } from "@/db/migrate";
import { startBackgroundJobs } from "@/lib/scanners/scheduler";
import bcrypt from "bcryptjs";

const INIT_KEY = "__fintracker_initialized";

function autoSeedMasterUser(sqlite: Database.Database): void {
  const userCount = sqlite.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count > 0) return;

  const masterUsername = process.env.MASTER_USERNAME || "admin";
  const masterPassword = process.env.MASTER_PASSWORD;
  if (!masterPassword) {
    console.log("  ⚠ MASTER_PASSWORD not set, skipping master user creation");
    return;
  }

  const hashedPassword = bcrypt.hashSync(masterPassword, 10);
  sqlite.prepare(
    "INSERT INTO users (username, password, role, status) VALUES (?, ?, 'master', 'approved')"
  ).run(masterUsername, hashedPassword);
  console.log(`  ✓ master user '${masterUsername}' created`);
}

export function initializeApp(): void {
  if ((globalThis as any)[INIT_KEY]) return;
  (globalThis as any)[INIT_KEY] = true;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  runMigrations(sqlite);
  autoSeedMasterUser(sqlite);

  sqlite.close();
  startBackgroundJobs();
}
