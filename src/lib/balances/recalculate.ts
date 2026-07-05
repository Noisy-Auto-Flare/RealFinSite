import Database from "better-sqlite3";

function tableExists(s: Database.Database, name: string): boolean {
  const row = s.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return !!row;
}

export function recalculateAllBalances(sqlitep?: Database.Database): void {
  const s = sqlitep ?? getDefaultDb();
  if (!tableExists(s, "balances")) {
    console.log("  ✔ balances table does not exist, skipping recalculation");
    return;
  }
  s.exec("BEGIN");
  try {
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
    s.exec("COMMIT");
  } catch (e) {
    s.exec("ROLLBACK");
    throw e;
  }
}

export function recalculateAccountBalances(
  accountId: number,
  sqlitep?: Database.Database
): void {
  const s = sqlitep ?? getDefaultDb();
  if (!tableExists(s, "balances")) return;

  s.exec("BEGIN");
  try {
    s.prepare("DELETE FROM balances WHERE account_id = ?").run(accountId);
    s.prepare(`
      INSERT INTO balances (account_id, currency, amount)
      SELECT
        oe.account_id,
        oe.currency,
        COALESCE(SUM(oe.amount), 0) as amount
      FROM operation_entries oe
      JOIN operations o ON oe.operation_id = o.id
      WHERE o.status = 'confirmed' AND oe.account_id = ?
      GROUP BY oe.account_id, oe.currency;
    `).run(accountId);
    s.prepare(`
      INSERT OR IGNORE INTO balances (account_id, currency, amount)
      SELECT id, currency, 0 FROM accounts WHERE id = ?;
    `).run(accountId);
    s.exec("COMMIT");
  } catch (e) {
    s.exec("ROLLBACK");
    throw e;
  }
}

function getDefaultDb(): Database.Database {
  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  return new Database(dbPath);
}
