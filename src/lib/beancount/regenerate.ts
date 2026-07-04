import type { Database } from "better-sqlite3";
import path from "path";
import fs from "fs";
import { clearDirty, getDirtySqlite } from "./dirty-flag";
import { operationToBeancount, OperationRow, EntryRow } from "./generate";
import { getUniqueCategories, openDirective, commodityDirective, accountPath, feesPath, incomePath, expensePath } from "./accounts";

function getLedgerPath(): string {
  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "ledger.beancount");
}

export function regenerate(sqlite?: Database): void {
  const s = sqlite ?? getDirtySqlite();

  const ledgerPath = getLedgerPath();
  const lines: string[] = [];

  // Header
  lines.push('option "title" "FinTracker Ledger"');
  lines.push('option "operating_currency" "RUB"');
  lines.push("");

  // Get all unique currencies from confirmed operations and accounts
  const currencies = s.prepare(`
    SELECT DISTINCT currency FROM (
      SELECT oe.currency FROM operation_entries oe
      JOIN operations o ON oe.operation_id = o.id
      WHERE o.status = 'confirmed'
      UNION
      SELECT currency FROM accounts
    ) ORDER BY currency
  `).all() as { currency: string }[];

  for (const c of currencies) {
    lines.push(commodityDirective(c.currency));
  }
  lines.push("");

  // Open directives for all accounts + currencies that have activity
  const accountCurrencyPairs = s.prepare(`
    SELECT DISTINCT oe.account_id, oe.currency, o.user_id,
      MIN(o.date) as first_date
    FROM operation_entries oe
    JOIN operations o ON oe.operation_id = o.id
    WHERE o.status = 'confirmed'
    GROUP BY oe.account_id, oe.currency
    ORDER BY first_date
  `).all() as { account_id: number; currency: string; user_id: number; first_date: string }[];

  const seenAccounts = new Set<string>();
  for (const ac of accountCurrencyPairs) {
    const acc = accountPath(ac.account_id, ac.user_id, ac.currency);
    const key = `${ac.account_id}:${ac.currency}`;
    if (!seenAccounts.has(key)) {
      seenAccounts.add(key);
      const openDate = ac.first_date || "2024-01-01";
      lines.push(openDirective(acc, openDate));
    }
  }

  // Open directives for Income/Expense categories and Fees
  const categories = getUniqueCategories(s);
  const seenIncomeExpense = new Set<string>();
  for (const cat of categories) {
    const inc = incomePath(cat.category);
    if (!seenIncomeExpense.has(inc)) {
      seenIncomeExpense.add(inc);
      lines.push(openDirective(inc, "2024-01-01"));
    }
    const exp = expensePath(cat.category);
    if (!seenIncomeExpense.has(exp)) {
      seenIncomeExpense.add(exp);
      lines.push(openDirective(exp, "2024-01-01"));
    }
  }
  lines.push(openDirective(feesPath(), "2024-01-01"));
  lines.push("");

  // Transactions: all confirmed operations sorted by date
  const ops = s.prepare(`
    SELECT id, user_id as userId, description, category, date
    FROM operations
    WHERE status = 'confirmed'
    ORDER BY date, id
  `).all() as OperationRow[];

  for (const op of ops) {
    const entries = s.prepare(`
      SELECT account_id as accountId, currency, amount, type
      FROM operation_entries
      WHERE operation_id = ?
      ORDER BY id
    `).all(op.id) as EntryRow[];

    lines.push(operationToBeancount(op, entries));
  }

  // Write atomically
  const tmpPath = ledgerPath + ".tmp";
  fs.writeFileSync(tmpPath, lines.join("\n"), "utf-8");
  fs.renameSync(tmpPath, ledgerPath);

  clearDirty(s);
}
