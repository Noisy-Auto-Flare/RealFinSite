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

function hasColumn(table: string, column: string): boolean {
  const cols = sqlite.pragma(`table_info(${table})`) as { name: string }[];
  return cols.some((c) => c.name === column);
}

function addColumn(table: string, column: string, definition: string): void {
  if (hasColumn(table, column)) {
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
if (!hasIndex("action_logs", "sqlite_autoindex_action_logs_1")) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS action_logs (
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

console.log("\nMigrations complete.");
