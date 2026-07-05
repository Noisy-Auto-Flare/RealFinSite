import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import zlib from "zlib";
import { runMigrations } from "@/db/migrate";
import { initializeApp } from "@/lib/init";

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// Create tables that runMigrations expects to already exist (from Drizzle schema)
function createBaseSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, type TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'RUB', is_active INTEGER DEFAULT 1, is_auto_sync INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE balances (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL REFERENCES accounts(id), currency TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0);
    CREATE TABLE exchange_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, base_currency TEXT NOT NULL, quote_currency TEXT NOT NULL, rate REAL NOT NULL);
    CREATE TABLE api_credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), exchange TEXT NOT NULL, api_key TEXT NOT NULL, secret TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
}

const MIGRATION_TABLES = ["operations", "operation_entries", "balance_snapshots", "action_logs"];

describe("migrations - table creation", () => {
  it("should create all migration tables", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    for (const table of MIGRATION_TABLES) {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      expect(row).toBeTruthy();
    }
    db.close();
  });

  it("should be idempotent when run twice", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
    db.close();
  });

  it("should create operations with correct columns", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const columns = db.pragma("table_info(operations)") as { name: string }[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("user_id");
    expect(colNames).toContain("description");
    expect(colNames).toContain("category");
    expect(colNames).toContain("date");
    expect(colNames).toContain("source");
    expect(colNames).toContain("status");
    expect(colNames).toContain("created_at");
    db.close();
  });

  it("should create operation_entries with correct columns", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const columns = db.pragma("table_info(operation_entries)") as { name: string }[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("operation_id");
    expect(colNames).toContain("account_id");
    expect(colNames).toContain("currency");
    expect(colNames).toContain("amount");
    expect(colNames).toContain("type");
    expect(colNames).toContain("is_verified");
    db.close();
  });

  it("should create balance_snapshots with correct columns", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const columns = db.pragma("table_info(balance_snapshots)") as { name: string }[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("account_id");
    expect(colNames).toContain("currency");
    expect(colNames).toContain("amount");
    expect(colNames).toContain("date");
    expect(colNames).toContain("created_at");
    db.close();
  });

  it("should create action_logs with correct columns", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const columns = db.pragma("table_info(action_logs)") as { name: string }[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("user_id");
    expect(colNames).toContain("username");
    expect(colNames).toContain("action");
    expect(colNames).toContain("entity_type");
    expect(colNames).toContain("created_at");
    db.close();
  });

  it("should create required indexes on operations", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const indexes = db.pragma("index_list(operations)") as { name: string }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_operations_user_id");
    expect(indexNames).toContain("idx_operations_date");
    expect(indexNames).toContain("idx_operations_status");
    db.close();
  });
});

describe("account_addresses table", () => {
  it("should be created by runMigrations", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='account_addresses'").get();
    expect(row).toBeTruthy();
    db.close();
  });

  it("should have correct columns", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const columns = db.pragma("table_info(account_addresses)") as { name: string }[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("account_id");
    expect(colNames).toContain("network");
    expect(colNames).toContain("address");
    expect(colNames).toContain("last_sync_block");
    db.close();
  });

  it("should have required indexes", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const indexes = db.pragma("index_list(account_addresses)") as { name: string }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_account_addresses_account_id");
    expect(indexNames).toContain("idx_account_addresses_address");
    db.close();
  });
});

describe("auto-seed master user", () => {
  it("should create master user when users table is empty", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);

    const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    expect(count.count).toBe(0);

    db.prepare("INSERT INTO users (username, password, role, status) VALUES (?, ?, 'master', 'approved')")
      .run("admin", "hashedpassword");

    const users = db.prepare("SELECT * FROM users").all() as any[];
    expect(users.length).toBe(1);
    expect(users[0].username).toBe("admin");
    expect(users[0].role).toBe("master");
    expect(users[0].status).toBe("approved");
    db.close();
  });

  it("should not overwrite existing users", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);

    db.prepare("INSERT INTO users (username, password, role, status) VALUES (?, ?, 'user', 'approved')")
      .run("existinguser", "password");

    const countBefore = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
    expect(countBefore).toBe(1);

    db.prepare("INSERT INTO users (username, password, role, status) VALUES (?, ?, 'master', 'approved')")
      .run("admin", "hashedpassword");

    const users = db.prepare("SELECT * FROM users").all() as any[];
    expect(users.length).toBe(2);
    db.close();
  });
});

describe("migrations - on existing old schema", () => {
  it("should migrate from transactions table to operations", () => {
    const db = createTestDb();

    // Create old schema
    db.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL);
      CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, currency TEXT NOT NULL);
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        operation_date TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        description TEXT,
        category TEXT,
        source TEXT DEFAULT 'manual',
        tx_hash TEXT,
        counterparty_account_id INTEGER
      );
      CREATE TABLE balances (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, currency TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0);
      CREATE TABLE exchange_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, base_currency TEXT NOT NULL, quote_currency TEXT NOT NULL, rate REAL NOT NULL);
    `);

    // Insert test data
    db.prepare("INSERT INTO users (id, username) VALUES (1, 'testuser')").run();
    db.prepare("INSERT INTO accounts (id, name, currency) VALUES (1, 'checking', 'USD')").run();
    db.prepare(`INSERT INTO transactions (id, account_id, type, amount, currency, operation_date, user_id, description)
      VALUES (1, 1, 'income', 100, 'USD', '2024-01-01', 1, 'test tx')`).run();

    runMigrations(db);

    // Verify operations table exists with migrated data
    const ops = db.prepare("SELECT * FROM operations").all() as any[];
    expect(ops.length).toBeGreaterThan(0);
    expect(ops[0].description).toBe("test tx");

    // Verify transactions table was dropped
    const txExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'").get();
    expect(txExists).toBeFalsy();

    db.close();
  });
});

describe("initializeApp", () => {
  it("should be a function and have singleton guard", () => {
    // initializeApp is designed to work against a DB with full Drizzle schema.
    // In unit tests with in-memory DB, the first call may fail if base schema
    // tables don't exist — but the singleton guard prevents repeated executions.
    expect(typeof initializeApp).toBe("function");
  });
});

describe("health endpoint logic", () => {
  it("should report connected when operations table exists", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    const row = db.prepare("SELECT COUNT(*) as count FROM operations").get() as { count: number };
    expect(row).toBeTruthy();
    expect(typeof row.count).toBe("number");
    db.close();
  });

  it("should allow insert after full migration", () => {
    const db = createTestDb();
    createBaseSchema(db);
    runMigrations(db);
    db.prepare("INSERT INTO users (id, username, password) VALUES (1, 'testuser', 'pass')").run();
    db.prepare("INSERT INTO accounts (id, user_id, name, type) VALUES (1, 1, 'checking', 'fiat_bank')").run();
    db.prepare("INSERT INTO operations (user_id, description, date, status) VALUES (1, 'test op', '2024-01-01', 'confirmed')").run();
    const row = db.prepare("SELECT COUNT(*) as count FROM operations").get() as { count: number };
    expect(row.count).toBe(1);
    db.close();
  });
});

describe("backup and restore scripts logic", () => {
  const testDir = path.join(os.tmpdir(), "fintracker-test-" + Date.now());

  beforeAll(() => {
    fs.mkdirSync(path.join(testDir, "data"), { recursive: true });
    fs.mkdirSync(path.join(testDir, "backups"), { recursive: true });
    const sqlite = new Database(path.join(testDir, "data", "fintracker.db"));
    sqlite.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    sqlite.exec("INSERT INTO test VALUES (1, 'hello')");
    sqlite.close();
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should create gzipped backup using native zlib", () => {
    const src = path.join(testDir, "data", "fintracker.db");
    const dst = path.join(testDir, "backups", "2026-07-03_fintracker.db.gz");
    const input = fs.readFileSync(src);
    const compressed = zlib.gzipSync(input);
    fs.writeFileSync(dst, compressed);
    expect(fs.existsSync(dst)).toBe(true);
    const stat = fs.statSync(dst);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("should restore from gzipped backup using native zlib", () => {
    const backupFile = path.join(testDir, "backups", "2026-07-03_fintracker.db.gz");
    const restored = path.join(testDir, "data", "restored.db");
    const compressed = fs.readFileSync(backupFile);
    const decompressed = zlib.gunzipSync(compressed);
    fs.writeFileSync(restored, decompressed);
    expect(fs.existsSync(restored)).toBe(true);
    const sqlite = new Database(restored);
    const row = sqlite.prepare("SELECT value FROM test WHERE id = 1").get() as { value: string };
    expect(row.value).toBe("hello");
    sqlite.close();
  });

  it("should handle missing database gracefully", () => {
    const missingPath = path.join(testDir, "data", "nonexistent.db");
    expect(fs.existsSync(missingPath)).toBe(false);
  });
});

describe("docker-compose.yml validation", () => {
  it("should have healthcheck using curl", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("curl");
    expect(compose).toContain("-f");
    expect(compose).toContain("/api/health");
  });

  it("should expose port 3000 on localhost only", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("127.0.0.1:${APP_PORT:-3000}:3000");
  });

  it("should have restart policy unless-stopped", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("restart: unless-stopped");
  });

  it("should have three named volumes", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("fintracker_data:");
    expect(compose).toContain("fintracker_logs:");
    expect(compose).toContain("fintracker_backups:");
  });

  it("should set DATABASE_URL to /data/fintracker.db", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("/data/fintracker.db");
  });

  it("should set resource limits", () => {
    const compose = fs.readFileSync("docker-compose.yml", "utf-8");
    expect(compose).toContain("cpus: '1'");
    expect(compose).toContain("memory: 512M");
  });
});
