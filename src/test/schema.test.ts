import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/db/schema";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

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
      amount REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE operations (
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
    );
    CREATE TABLE operation_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'principal',
      is_verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE balance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

  it("should create an operation", () => {
    const { db } = createTestDb();
    const user = db.insert(schema.users).values({
      username: "testuser",
      password: "hash",
      role: "user",
      status: "approved",
    }).returning().get();

    const op = db.insert(schema.operations).values({
      userId: user.id,
      description: "Test operation",
      category: "income",
      date: new Date().toISOString(),
      source: "manual",
      status: "draft",
    }).returning().get();

    expect(op.description).toBe("Test operation");
    expect(op.category).toBe("income");
    expect(op.status).toBe("draft");
  });

  it("should create an operation entry", () => {
    const { db } = createTestDb();
    const user = db.insert(schema.users).values({
      username: "testuser",
      password: "hash",
      role: "user",
      status: "approved",
    }).returning().get();

    const account = db.insert(schema.accounts).values({
      userId: user.id,
      name: "Wallet",
      type: "fiat_bank",
    }).returning().get();

    const op = db.insert(schema.operations).values({
      userId: user.id,
      description: "Test",
      date: new Date().toISOString(),
    }).returning().get();

    const entry = db.insert(schema.operationEntries).values({
      operationId: op.id,
      accountId: account.id,
      currency: "RUB",
      amount: 1000,
    }).returning().get();

    expect(entry.operationId).toBe(op.id);
    expect(entry.accountId).toBe(account.id);
    expect(entry.amount).toBe(1000);
    expect(entry.type).toBe("principal");
    expect(entry.isVerified).toBe(0);
  });

  it("should enforce foreign key on operation entries", () => {
    expect(() => {
      const { db } = createTestDb();
      db.insert(schema.operationEntries).values({
        operationId: 999,
        accountId: 1,
        currency: "RUB",
        amount: 100,
      }).run();
    }).toThrow();
  });

  it("should create a balance snapshot", () => {
    const { db } = createTestDb();
    const user = db.insert(schema.users).values({
      username: "testuser",
      password: "hash",
      role: "user",
      status: "approved",
    }).returning().get();

    const account = db.insert(schema.accounts).values({
      userId: user.id,
      name: "Wallet",
      type: "fiat_bank",
    }).returning().get();

    const snapshot = db.insert(schema.balanceSnapshots).values({
      accountId: account.id,
      currency: "RUB",
      amount: 5000,
      date: new Date().toISOString(),
      comment: "monthly snapshot",
    }).returning().get();

    expect(snapshot.accountId).toBe(account.id);
    expect(snapshot.amount).toBe(5000);
    expect(snapshot.comment).toBe("monthly snapshot");
  });
});
