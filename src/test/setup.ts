import { beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { runMigrations } from "@/db/migrate";

let sqlite: Database.Database;

export function createTestDb() {
  sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  runMigrations(sqlite);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export function seedTestData(sqlite: Database.Database) {
  const userId = sqlite.prepare(
    "INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)"
  ).run("testuser", "hash", "user", "approved").lastInsertRowid;

  const accountId = sqlite.prepare(
    "INSERT INTO accounts (user_id, name, type, currency) VALUES (?, ?, ?, ?)"
  ).run(userId, "Test Wallet", "crypto_wallet", "RUB").lastInsertRowid;

  return { userId: Number(userId), accountId: Number(accountId) };
}

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-123456789012345678901234567890";
  process.env.MASTER_USERNAME = "testadmin";
  process.env.MASTER_PASSWORD = "testpass123";
});

afterAll(() => {
  if (sqlite) sqlite.close();
});
