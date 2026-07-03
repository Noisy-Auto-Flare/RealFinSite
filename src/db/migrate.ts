import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
const dir = path.dirname(dbPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

function hasColumn(sqlite: Database, table: string, column: string): boolean {
  const cols = sqlite.pragma(`table_info(${table})`) as { name: string }[];
  return cols.some((c) => c.name === column);
}

function addColumn(table: string, column: string, definition: string): void {
  if (hasColumn(sqlite, table, column)) {
    console.log(`  ✔ ${table}.${column} already exists`);
    return;
  }
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  ✓ ${table}.${column} added`);
}

function hasIndex(table: string, name: string): boolean {
  const rows = sqlite.pragma(`index_list(${table})`) as { name: string }[];
  return rows.some((r) => r.name === name);
}

function createIndex(name: string, table: string, columns: string, unique = false): void {
  if (hasIndex(table, name)) {
    console.log(`  ✔ index ${name} already exists`);
    return;
  }
  const u = unique ? "UNIQUE " : "";
  sqlite.exec(`CREATE ${u}INDEX ${name} ON ${table} (${columns})`);
  console.log(`  ✓ index ${name} created`);
}

function tableExists(name: string): boolean {
  const row = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return !!row;
}

function createTable(name: string, definition: string): void {
  if (tableExists(name)) {
    console.log(`  ✔ ${name} already exists`);
    return;
  }
  sqlite.exec(`CREATE TABLE ${name} ${definition}`);
  console.log(`  ✓ ${name} created`);
}

function migrateToMultiLeg(sqlite: Database): void {
  if (!tableExists("transactions")) {
    console.log("  ✔ transactions table does not exist, skipping migration");
    return;
  }

  console.log("  ✓ migrating transactions to operations/entries model...");

  const rows = sqlite.prepare("SELECT * FROM transactions").all() as any[];

  for (const tx of rows) {
    const opResult = sqlite.prepare(`
      INSERT INTO operations (user_id, description, category, date, source, tx_hash, from_address, to_address, block_timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `).run(
      tx.user_id,
      tx.description,
      tx.category,
      tx.operation_date,
      tx.source,
      tx.tx_hash,
      tx.from_address,
      tx.to_address,
      tx.block_timestamp
    );
    const operationId = opResult.lastInsertRowid as number;

    if (tx.type === "income") {
      sqlite.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, tx.currency, tx.amount);
    } else if (tx.type === "expense") {
      sqlite.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, tx.currency, -Math.abs(tx.amount));
    } else if (tx.type === "transfer") {
      sqlite.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, tx.currency, -Math.abs(tx.amount));

      if (tx.counterparty_account_id != null) {
        sqlite.prepare(`
          INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
          VALUES (?, ?, ?, ?, 'principal', 1)
        `).run(operationId, tx.counterparty_account_id, tx.currency, Math.abs(tx.amount));
      }
    } else if (tx.type === "exchange") {
      const amountFrom = tx.amount_from ?? 0;
      const currencyFrom = tx.currency_from ?? tx.currency;
      sqlite.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, currencyFrom, -Math.abs(amountFrom));

      const amountTo = tx.amount_to ?? 0;
      const currencyTo = tx.currency_to ?? tx.currency;
      sqlite.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, currencyTo, Math.abs(amountTo));
    }
  }

  sqlite.exec("DROP TABLE IF EXISTS matched_transactions;");
  sqlite.exec("DROP TABLE IF EXISTS transactions;");
  console.log("  ✓ dropped old tables (matched_transactions, transactions)");
}

function updateBalances(sqlite: Database): void {
  if (hasColumn(sqlite, "balances", "updated_at")) {
    console.log("  ⚠ balances.updated_at column is deprecated and will be removed in a future version");
  }
}

export function recalculateAllBalances(sqlitep?: Database): void {
  const s = sqlitep ?? sqlite;
  s.exec("DELETE FROM balances;");
  s.exec(`
    INSERT INTO balances (account_id, currency, amount)
    SELECT
      oe.account_id,
      oe.currency,
      COALESCE(SUM(oe.amount), 0) as amount
    FROM operation_entries oe
    JOIN operations o ON oe.operation_id = o.id
    WHERE o.status = 'confirmed'
    GROUP BY oe.account_id, oe.currency;
  `);
  console.log("  ✓ balances recalculated from confirmed entries");
}

console.log("Running migrations...\n");

// === transactions table ===
console.log("[transactions]");
addColumn("transactions", "from_address", "TEXT");
addColumn("transactions", "to_address", "TEXT");
addColumn("transactions", "block_timestamp", "INTEGER");

// === balances unique index ===
console.log("\n[balances]");
createIndex("account_currency_unique", "balances", "account_id, currency", true);

// === exchange_rates unique index ===
console.log("\n[exchange_rates]");
createIndex("pair_unique", "exchange_rates", "base_currency, quote_currency", true);

// === api_credentials ===
console.log("\n[api_credentials]");
addColumn("api_credentials", "last_sync_at", "TEXT");
addColumn("api_credentials", "passphrase", "TEXT");

// === action_logs table ===
console.log("\n[action_logs]");
if (!tableExists("action_logs")) {
  sqlite.exec(`CREATE TABLE action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log("  ✓ action_logs table created");
} else {
  console.log("  ✔ action_logs already exists");
}

// === new tables for operations/entries model ===
console.log("\n[operations]");
createTable("operations", `(
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
  )`);

console.log("\n[operation_entries]");
createTable("operation_entries", `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'principal',
    is_verified INTEGER NOT NULL DEFAULT 0
  )`);

console.log("\n[balance_snapshots]");
createTable("balance_snapshots", `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

console.log("\n[multi-leg migration]");
migrateToMultiLeg(sqlite);

console.log("\n[balance updates]");
updateBalances(sqlite);

console.log("\n[recalculate balances]");
recalculateAllBalances(sqlite);

console.log("\nMigrations complete.");
