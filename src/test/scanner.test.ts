import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

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

  return db;
}

describe("Matcher helpers", () => {
  it("isAmountClose should detect close amounts", async () => {
    const { isAmountClose } = await import("@/lib/scanners/matcher");
    expect(isAmountClose(100, 100.5)).toBe(true);
    expect(isAmountClose(100, 101)).toBe(true);
    expect(isAmountClose(100, 102)).toBe(false);
    expect(isAmountClose(0, 100)).toBe(false);
  });

  it("isTimeClose should detect close timestamps", async () => {
    const { isTimeClose } = await import("@/lib/scanners/matcher");
    expect(isTimeClose(1000, 1100)).toBe(true);
    expect(isTimeClose(1000, 1300)).toBe(true);
    expect(isTimeClose(1000, 1500)).toBe(false);
  });
});

describe("Matcher integration", () => {
  it("should create match for same-sender same-receiver transactions", async () => {
    const { runMatcher, confirmMatch, createMatch } = await import("@/lib/scanners/matcher");
    const db = createTestDb();

    const user = db.insert(schema.users).values({
      username: "test", password: "hash", role: "user", status: "approved",
    }).returning().get();

    const acc1 = db.insert(schema.accounts).values({
      userId: user.id, name: "Wallet A", type: "crypto_wallet",
    }).returning().get();

    const acc2 = db.insert(schema.accounts).values({
      userId: user.id, name: "Wallet B", type: "crypto_wallet",
    }).returning().get();

    const ts = Math.floor(Date.now() / 1000);
    const tx1 = db.insert(schema.transactions).values({
      userId: user.id, accountId: acc1.id,
      type: "expense", status: "confirmed", source: "scanner_bsc",
      amount: 1.5, currency: "BNB",
      fromAddress: "0xaaa", toAddress: "0xbbb",
      blockTimestamp: ts, operationDate: new Date().toISOString(),
    }).returning().get();

    const tx2 = db.insert(schema.transactions).values({
      userId: user.id, accountId: acc2.id,
      type: "income", status: "confirmed", source: "scanner_bsc",
      amount: 1.5, currency: "BNB",
      fromAddress: "0xaaa", toAddress: "0xbbb",
      blockTimestamp: ts + 60, operationDate: new Date().toISOString(),
    }).returning().get();

    await runMatcher(db);

    const matches = db.select().from(schema.matchedTransactions).all();
    expect(matches.length).toBe(1);
    expect(matches[0].matchType).toBe("auto_suggested");
    expect(matches[0].status).toBe("suggested");

    confirmMatch(matches[0].id, db);

    const updatedTx1 = db.select().from(schema.transactions)
      .where(eq(schema.transactions.id, tx1.id))
      .get();
    expect(updatedTx1.status).toBe("confirmed");
    expect(updatedTx1.counterpartyAccountId).toBe(acc2.id);

    const updatedTx2 = db.select().from(schema.transactions)
      .where(eq(schema.transactions.id, tx2.id))
      .get();
    expect(updatedTx2.counterpartyAccountId).toBe(acc1.id);
  });

  it("should not create duplicate matches", async () => {
    const { runMatcher } = await import("@/lib/scanners/matcher");
    const db = createTestDb();

    const user = db.insert(schema.users).values({
      username: "test2", password: "hash", role: "user", status: "approved",
    }).returning().get();

    const acc = db.insert(schema.accounts).values({
      userId: user.id, name: "Wallet", type: "crypto_wallet",
    }).returning().get();

    const ts = Math.floor(Date.now() / 1000);
    db.insert(schema.transactions).values({
      userId: user.id, accountId: acc.id,
      type: "expense", status: "confirmed", source: "scanner_bsc",
      amount: 1.0, currency: "BNB",
      fromAddress: "0xaaa", toAddress: "0xbbb",
      blockTimestamp: ts, operationDate: new Date().toISOString(),
    }).run();

    db.insert(schema.transactions).values({
      userId: user.id, accountId: acc.id,
      type: "income", status: "confirmed", source: "scanner_bsc",
      amount: 1.0, currency: "BNB",
      fromAddress: "0xaaa", toAddress: "0xbbb",
      blockTimestamp: ts + 30, operationDate: new Date().toISOString(),
    }).run();

    await runMatcher(db);
    expect(db.select().from(schema.matchedTransactions).all().length).toBe(1);

    await runMatcher(db);
    expect(db.select().from(schema.matchedTransactions).all().length).toBe(1);
  });

  it("should reject match and revert transaction status", async () => {
    const { runMatcher, rejectMatch } = await import("@/lib/scanners/matcher");
    const db = createTestDb();

    const user = db.insert(schema.users).values({
      username: "test3", password: "hash", role: "user", status: "approved",
    }).returning().get();

    const acc = db.insert(schema.accounts).values({
      userId: user.id, name: "Wallet", type: "crypto_wallet",
    }).returning().get();

    const ts = Math.floor(Date.now() / 1000);
    db.insert(schema.transactions).values({
      userId: user.id, accountId: acc.id,
      type: "expense", status: "confirmed", source: "scanner_bsc",
      amount: 2.0, currency: "BNB",
      fromAddress: "0xaaa", toAddress: "0xbbb",
      blockTimestamp: ts, operationDate: new Date().toISOString(),
    }).run();

    db.insert(schema.transactions).values({
      userId: user.id, accountId: acc.id,
      type: "income", status: "confirmed", source: "scanner_bsc",
      amount: 2.0, currency: "BNB",
      fromAddress: "0xaaa", toAddress: "0xbbb",
      blockTimestamp: ts + 30, operationDate: new Date().toISOString(),
    }).run();

    await runMatcher(db);
    const match = db.select().from(schema.matchedTransactions).all()[0];

    rejectMatch(match.id, db);

    const rejected = db.select().from(schema.matchedTransactions)
      .where(eq(schema.matchedTransactions.id, match.id))
      .get();
    expect(rejected.status).toBe("rejected");

    const tx = db.select().from(schema.transactions)
      .where(eq(schema.transactions.id, match.transactionAId))
      .get();
    expect(tx.status).toBe("confirmed");
  });
});
