import DatabaseClass from "better-sqlite3";
import type { Database } from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
const dir = path.dirname(dbPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new DatabaseClass(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

function hasColumn(s: Database, table: string, column: string): boolean {
  try {
    const cols = s.pragma(`table_info(${table})`) as { name: string }[];
    return cols.some((c) => c.name === column);
  } catch {
    return false;
  }
}

function addColumn(s: Database, table: string, column: string, definition: string): void {
  if (!tableExists(s, table)) {
    console.log(`  ✔ ${table} does not exist, skipping`);
    return;
  }
  if (hasColumn(s, table, column)) {
    console.log(`  ✔ ${table}.${column} already exists`);
    return;
  }
  s.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  ✓ ${table}.${column} added`);
}

function hasIndex(s: Database, table: string, name: string): boolean {
  try {
    const rows = s.pragma(`index_list(${table})`) as { name: string }[];
    return rows.some((r) => r.name === name);
  } catch {
    return false;
  }
}

function createIndex(s: Database, name: string, table: string, columns: string, unique = false): void {
  if (!tableExists(s, table)) {
    console.log(`  ✔ ${table} does not exist, skipping index ${name}`);
    return;
  }
  if (hasIndex(s, table, name)) {
    console.log(`  ✔ index ${name} already exists`);
    return;
  }
  const u = unique ? "UNIQUE " : "";
  s.exec(`CREATE ${u}INDEX ${name} ON ${table} (${columns})`);
  console.log(`  ✓ index ${name} created`);
}

function tableExists(s: Database, name: string): boolean {
  const row = s.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return !!row;
}

function createTable(s: Database, name: string, definition: string): void {
  if (tableExists(s, name)) {
    console.log(`  ✔ ${name} already exists`);
    return;
  }
  s.exec(`CREATE TABLE ${name} ${definition}`);
  console.log(`  ✓ ${name} created`);
}

function migrateToMultiLeg(s: Database): void {
  if (!tableExists(s, "transactions")) {
    console.log("  ✔ transactions table does not exist, skipping migration");
    return;
  }

  console.log("  ✓ migrating transactions to operations/entries model...");

  const rows = s.prepare("SELECT * FROM transactions").all() as any[];

  for (const tx of rows) {
    const opResult = s.prepare(`
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
      s.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, tx.currency, tx.amount);
    } else if (tx.type === "expense") {
      s.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, tx.currency, -Math.abs(tx.amount));
    } else if (tx.type === "transfer") {
      s.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, tx.currency, -Math.abs(tx.amount));

      if (tx.counterparty_account_id != null) {
        s.prepare(`
          INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
          VALUES (?, ?, ?, ?, 'principal', 1)
        `).run(operationId, tx.counterparty_account_id, tx.currency, Math.abs(tx.amount));
      }
    } else if (tx.type === "exchange") {
      const amountFrom = tx.amount_from ?? 0;
      const currencyFrom = tx.currency_from ?? tx.currency;
      s.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, currencyFrom, -Math.abs(amountFrom));

      const amountTo = tx.amount_to ?? 0;
      const currencyTo = tx.currency_to ?? tx.currency;
      s.prepare(`
        INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified)
        VALUES (?, ?, ?, ?, 'principal', 1)
      `).run(operationId, tx.account_id, currencyTo, Math.abs(amountTo));
    }
  }

  s.exec("DROP TABLE IF EXISTS matched_transactions;");
  s.exec("DROP TABLE IF EXISTS transactions;");
  console.log("  ✓ dropped old tables (matched_transactions, transactions)");
}

function updateBalances(sqlite: Database): void {
  if (hasColumn(sqlite, "balances", "updated_at")) {
    console.log("  ⚠ balances.updated_at column is deprecated and will be removed in a future version");
  }
}

export function recalculateAllBalances(sqlitep?: Database): void {
  const s = sqlitep ?? sqlite;
  if (!tableExists(s, "balances")) {
    console.log("  ✔ balances table does not exist, skipping recalculation");
    return;
  }
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
  s.exec(`
    INSERT OR IGNORE INTO balances (account_id, currency, amount)
    SELECT a.id, a.currency, 0 FROM accounts a;
  `);
  console.log("  ✓ balances recalculated from confirmed entries");
}

export function runMigrations(sqlitep?: Database): void {
  const s = sqlitep ?? sqlite;

  // auto-backup before migration
  try {
    const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
    if (fs.existsSync(dbPath)) {
      const backupDir = path.join(path.dirname(dbPath), "backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(dbPath, path.join(backupDir, `pre-migration-${stamp}.db`));
      console.log(`  ✔ backup created: pre-migration-${stamp}.db`);
    }
  } catch (e) {
    console.log("  ⚠ backup failed, continuing: ", e);
  }

  console.log("Running migrations...\n");

  // Ensure base Drizzle schema tables exist (for fresh deployments)
  console.log("[base schema]");
  createTable(s, "users", `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  createTable(s, "accounts", `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RUB',
    is_active INTEGER DEFAULT 1,
    is_auto_sync INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  createTable(s, "balances", `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0
  )`);
  createTable(s, "exchange_rates", `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    base_currency TEXT NOT NULL,
    quote_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    source TEXT DEFAULT 'coingecko',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  createTable(s, "api_credentials", `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    passphrase TEXT,
    last_sync_at TEXT
  )`);

  console.log("\n[transactions]");
  addColumn(s, "transactions", "from_address", "TEXT");
  addColumn(s, "transactions", "to_address", "TEXT");
  addColumn(s, "transactions", "block_timestamp", "INTEGER");

  console.log("\n[balances]");
  createIndex(s, "account_currency_unique", "balances", "account_id, currency", true);

  console.log("\n[exchange_rates]");
  addColumn(s, "exchange_rates", "source", "TEXT DEFAULT 'coingecko'");
  addColumn(s, "exchange_rates", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");
  createIndex(s, "pair_unique", "exchange_rates", "base_currency, quote_currency", true);

  console.log("\n[api_credentials]");
  addColumn(s, "api_credentials", "last_sync_at", "TEXT");
  addColumn(s, "api_credentials", "passphrase", "TEXT");

  console.log("\n[action_logs]");
  if (!tableExists(s, "action_logs")) {
    s.exec(`CREATE TABLE action_logs (
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

  console.log("\n[operations]");
  createTable(s, "operations", `(
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
  createTable(s, "operation_entries", `(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'principal',
      is_verified INTEGER NOT NULL DEFAULT 0
    )`);

  console.log("\n[balance_snapshots]");
  createTable(s, "balance_snapshots", `(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

  console.log("\n[account_addresses]");
  createTable(s, "account_addresses", `(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      network TEXT NOT NULL,
      address TEXT NOT NULL,
      last_sync_block INTEGER DEFAULT 0
    )`);

  console.log("\n[multi-leg migration]");
  migrateToMultiLeg(s);

  console.log("\n[balance updates]");
  updateBalances(s);

  console.log("\n[recalculate balances]");
  recalculateAllBalances(s);

  console.log("\n[indexes]");
  const indexDefs = [
    ["idx_operations_user_id", "operations", "user_id"],
    ["idx_operations_date", "operations", "date"],
    ["idx_operations_status", "operations", "status"],
    ["idx_operation_entries_operation_id", "operation_entries", "operation_id"],
    ["idx_operation_entries_account_id", "operation_entries", "account_id"],
    ["idx_balance_snapshots_date", "balance_snapshots", "date"],
    ["idx_action_logs_user", "action_logs", "user_id"],
    ["idx_action_logs_created", "action_logs", "created_at"],
    ["idx_account_addresses_account_id", "account_addresses", "account_id"],
    ["idx_account_addresses_address", "account_addresses", "address"],
  ];
  for (const [name, table, column] of indexDefs) {
    createIndex(s, name, table, column);
  }

  console.log("\nMigrations complete.");
}
