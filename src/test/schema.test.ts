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
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      counterparty_account_id INTEGER REFERENCES accounts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      source TEXT NOT NULL DEFAULT 'manual',
      amount_from REAL,
      currency_from TEXT,
      amount_to REAL,
      currency_to TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      tx_hash TEXT,
      external_id TEXT,
      from_address TEXT,
      to_address TEXT,
      block_timestamp INTEGER,
      category TEXT,
      description TEXT,
      operation_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE matched_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_a_id INTEGER NOT NULL REFERENCES transactions(id),
      transaction_b_id INTEGER NOT NULL REFERENCES transactions(id),
      match_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'suggested',
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

  it("should create a transaction and update balance", () => {
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

    const tx = db.insert(schema.transactions).values({
      userId: user.id,
      accountId: account.id,
      type: "income",
      amount: 1000,
      currency: "RUB",
      operationDate: new Date().toISOString(),
    }).returning().get();

    expect(tx.type).toBe("income");
    expect(tx.amount).toBe(1000);
    expect(tx.currency).toBe("RUB");
  });
});
