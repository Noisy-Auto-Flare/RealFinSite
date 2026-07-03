import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/db/schema";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  // Create tables
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'RUB',
      is_active INTEGER DEFAULT 1,
      is_auto_sync INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE account_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      network TEXT NOT NULL,
      address TEXT NOT NULL,
      last_sync_block INTEGER DEFAULT 0
    );
    CREATE TABLE balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return { db, sqlite };
}

describe("Schema", () => {
  it("should create a user", () => {
    const { db } = createTestDb();
    const user = db.insert(schema.users).values({
      username: "testuser",
      password: "hash",
      role: "user",
      status: "pending",
    }).returning().get();

    expect(user.username).toBe("testuser");
    expect(user.status).toBe("pending");
  });

  it("should create an account for a user", () => {
    const { db } = createTestDb();
    const user = db.insert(schema.users).values({
      username: "testuser",
      password: "hash",
      role: "user",
      status: "approved",
    }).returning().get();

    const account = db.insert(schema.accounts).values({
      userId: user.id,
      name: "Test Account",
      type: "fiat_bank",
      currency: "RUB",
    }).returning().get();

    expect(account.name).toBe("Test Account");
    expect(account.currency).toBe("RUB");
  });

  it("should enforce foreign key on account_addresses", () => {
    expect(() => {
      const { db } = createTestDb();
      db.insert(schema.accountAddresses).values({
        accountId: 999,
        network: "solana",
        address: "test",
      }).run();
    }).toThrow();
  });

});
