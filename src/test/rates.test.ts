import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/db/schema";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  sqlite.exec(`
    CREATE TABLE exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_currency TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      source TEXT DEFAULT 'coingecko',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return { db, sqlite };
}

function insertRate(db: ReturnType<typeof drizzle>, base: string, quote: string, rate: number) {
  db.insert(schema.exchangeRates).values({
    baseCurrency: base,
    quoteCurrency: quote,
    rate,
    source: "coingecko",
  }).run();
}

function getRate(db: ReturnType<typeof drizzle>, base: string, quote: string): number | null {
  if (base === quote) return 1;
  const { eq, and } = require("drizzle-orm");
  const direct = db.select().from(schema.exchangeRates).where(
    and(eq(schema.exchangeRates.baseCurrency, base), eq(schema.exchangeRates.quoteCurrency, quote))
  ).get();
  if (direct) return direct.rate;

  const { eq: eq2, and: and2 } = require("drizzle-orm");
  const baseToUsd = db.select().from(schema.exchangeRates).where(
    and2(eq2(schema.exchangeRates.baseCurrency, base), eq2(schema.exchangeRates.quoteCurrency, "USD"))
  ).get();
  const usdToQuote = db.select().from(schema.exchangeRates).where(
    and2(eq2(schema.exchangeRates.baseCurrency, "USD"), eq2(schema.exchangeRates.quoteCurrency, quote))
  ).get();

  if (baseToUsd && usdToQuote) return baseToUsd.rate * usdToQuote.rate;

  const reverse = db.select().from(schema.exchangeRates).where(
    and2(eq2(schema.exchangeRates.baseCurrency, quote), eq2(schema.exchangeRates.quoteCurrency, base))
  ).get();
  if (reverse) return 1 / reverse.rate;

  return null;
}

describe("Exchange Rates", () => {
  it("should return direct rate", () => {
    const { db } = createTestDb();
    insertRate(db, "USD", "RUB", 88.5);
    expect(getRate(db, "USD", "RUB")).toBeCloseTo(88.5);
  });

  it("should return 1 for same currency", () => {
    const { db } = createTestDb();
    expect(getRate(db, "RUB", "RUB")).toBe(1);
  });

  it("should convert via USD bridge", () => {
    const { db } = createTestDb();
    insertRate(db, "SOL", "USD", 140.5);
    insertRate(db, "USD", "RUB", 88.5);
    const rate = getRate(db, "SOL", "RUB");
    expect(rate).not.toBeNull();
    expect(rate).toBeCloseTo(140.5 * 88.5, 1);
  });

  it("should return inverse rate", () => {
    const { db } = createTestDb();
    insertRate(db, "USD", "RUB", 88.5);
    const rate = getRate(db, "RUB", "USD");
    expect(rate).not.toBeNull();
    expect(rate).toBeCloseTo(1 / 88.5, 5);
  });

  it("should return null for unknown pair", () => {
    const { db } = createTestDb();
    expect(getRate(db, "XYZ", "ABC")).toBeNull();
  });

  it("should convert amounts correctly", () => {
    const { db } = createTestDb();
    insertRate(db, "USD", "RUB", 88.5);
    const rate = getRate(db, "USD", "RUB");
    expect(rate).not.toBeNull();
    const converted = 100 * rate!;
    expect(converted).toBeCloseTo(8850, 0);
  });
});
