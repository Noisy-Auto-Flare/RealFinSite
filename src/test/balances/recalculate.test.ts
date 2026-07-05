import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, seedTestData } from "../setup";
import { recalculateAllBalances, recalculateAccountBalances } from "@/lib/balances";
import { balances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

let sqlite: Database.Database;
let drizzleDb: ReturnType<typeof drizzle<typeof schema>>;
let seed: { userId: number; accountId: number };

describe("recalculate", () => {
  beforeAll(() => {
    const ctx = createTestDb();
    sqlite = ctx.sqlite;
    drizzleDb = ctx.db;
    seed = seedTestData(sqlite);
  });

  it("should create zero balance row after recalculation", () => {
    recalculateAllBalances(sqlite);
    const rows = drizzleDb.select().from(balances).where(eq(balances.accountId, seed.accountId)).all();
    expect(rows.length).toBeGreaterThan(0);
  });

  it("should update balance after confirmed operation inserted", () => {
    const opId = sqlite.prepare(
      "INSERT INTO operations (user_id, date, source, status) VALUES (?, ?, ?, 'confirmed')"
    ).run(seed.userId, "2026-01-01", "manual").lastInsertRowid;

    sqlite.prepare(
      "INSERT INTO operation_entries (operation_id, account_id, currency, amount, type) VALUES (?, ?, ?, ?, 'principal')"
    ).run(opId, seed.accountId, "RUB", 500);

    recalculateAllBalances(sqlite);
    const row = drizzleDb.select().from(balances).where(
      eq(balances.accountId, seed.accountId)
    ).get();
    expect(row!.amount).toBe(500);
  });
});
