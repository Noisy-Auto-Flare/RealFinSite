import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";

function createOldDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      operation_date TEXT NOT NULL
    );
    CREATE TABLE balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_currency TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      rate REAL NOT NULL
    );
  `);

  return sqlite;
}

function runMigrationOn(sqlite: Database.Database) {
  const pragmas = (table: string) =>
    sqlite.pragma(`table_info(${table})`) as { name: string }[];

  function addColumn(table: string, column: string, definition: string) {
    const cols = pragmas(table);
    if (cols.some((c) => c.name === column)) return false;
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
  }

  function createIndex(name: string, table: string, columns: string, unique = false) {
    const idxList = sqlite.pragma(`index_list(${table})`) as { name: string }[];
    if (idxList.some((r) => r.name === name)) return false;
    const u = unique ? "UNIQUE " : "";
    sqlite.exec(`CREATE ${u}INDEX ${name} ON ${table} (${columns})`);
    return true;
  }

  let changes = 0;

  if (addColumn("transactions", "from_address", "TEXT")) changes++;
  if (addColumn("transactions", "to_address", "TEXT")) changes++;
  if (addColumn("transactions", "block_timestamp", "INTEGER")) changes++;
  if (createIndex("account_currency_unique", "balances", "account_id, currency", true)) changes++;
  if (createIndex("pair_unique", "exchange_rates", "base_currency, quote_currency", true)) changes++;

  return changes;
}

describe("Migration", () => {
  it("should add missing columns", () => {
    const sqlite = createOldDb();
    const changes = runMigrationOn(sqlite);

    expect(changes).toBe(5);

    const cols = sqlite.pragma("table_info(transactions)") as { name: string }[];
    expect(cols.find((c) => c.name === "from_address")).toBeTruthy();
    expect(cols.find((c) => c.name === "to_address")).toBeTruthy();
    expect(cols.find((c) => c.name === "block_timestamp")).toBeTruthy();
  });

  it("should be idempotent (run twice safely)", () => {
    const sqlite = createOldDb();
    const first = runMigrationOn(sqlite);
    const second = runMigrationOn(sqlite);

    expect(first).toBe(5);
    expect(second).toBe(0);

    const cols = sqlite.pragma("table_info(transactions)") as { name: string }[];
    expect(cols.find((c) => c.name === "from_address")).toBeTruthy();
  });

  it("should create unique indexes", () => {
    const sqlite = createOldDb();
    runMigrationOn(sqlite);

    const balIdx = sqlite.pragma("index_list(balances)") as { name: string }[];
    expect(balIdx.find((i) => i.name === "account_currency_unique")).toBeTruthy();

    const rateIdx = sqlite.pragma("index_list(exchange_rates)") as { name: string }[];
    expect(rateIdx.find((i) => i.name === "pair_unique")).toBeTruthy();
  });

  it("should not fail on already-migrated database", () => {
    const sqlite = createOldDb();
    runMigrationOn(sqlite);
    // Running the same DDL statements again would throw without guards
    expect(() => runMigrationOn(sqlite)).not.toThrow();
  });
});
