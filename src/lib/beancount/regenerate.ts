import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { clearDirty } from "./dirty-flag";
import { operationToBeancount, OperationRow, EntryRow } from "./generate";
import { getUniqueCategories, openDirective, commodityDirective, accountPath, feesPath, incomePath, expensePath } from "./accounts";

function getLedgerPath(): string {
  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "ledger.beancount");
}

export function regenerate(): void {
  const ledgerPath = getLedgerPath();
  const lines: string[] = [];

  lines.push('option "title" "FinTracker Ledger"');
  lines.push('option "operating_currency" "RUB"');
  lines.push("");

  const currencies = db.select({
    currency: sql<string>`DISTINCT currency`,
  })
    .from(sql`(
      SELECT oe.currency FROM operation_entries oe
      JOIN operations o ON oe.operation_id = o.id
      WHERE o.status = 'confirmed'
      UNION
      SELECT currency FROM accounts
    )`)
    .orderBy(sql`currency`)
    .all() as { currency: string }[];

  for (const c of currencies) {
    lines.push(commodityDirective(c.currency));
  }
  lines.push("");

  const accountCurrencyPairs = db.select({
    accountId: operationEntries.accountId,
    currency: operationEntries.currency,
    userId: operations.userId,
    firstDate: sql<string>`MIN(${operations.date})`,
  })
    .from(operationEntries)
    .innerJoin(operations, eq(operationEntries.operationId, operations.id))
    .where(eq(operations.status, "confirmed"))
    .groupBy(operationEntries.accountId, operationEntries.currency)
    .orderBy(sql`MIN(${operations.date})`)
    .all() as { accountId: number; currency: string; userId: number; firstDate: string }[];

  const seenAccounts = new Set<string>();
  for (const ac of accountCurrencyPairs) {
    const acc = accountPath(ac.accountId, ac.userId, ac.currency);
    const key = `${ac.accountId}:${ac.currency}`;
    if (!seenAccounts.has(key)) {
      seenAccounts.add(key);
      const openDate = ac.firstDate || "2024-01-01";
      lines.push(openDirective(acc, openDate));
    }
  }

  const categories = getUniqueCategories();
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

  const ops = db.select({
    id: operations.id,
    userId: operations.userId,
    description: operations.description,
    category: operations.category,
    date: operations.date,
  })
    .from(operations)
    .where(eq(operations.status, "confirmed"))
    .orderBy(operations.date, operations.id)
    .all() as OperationRow[];

  for (const op of ops) {
    const entries = db.select({
      accountId: operationEntries.accountId,
      currency: operationEntries.currency,
      amount: operationEntries.amount,
      type: operationEntries.type,
    })
      .from(operationEntries)
      .where(eq(operationEntries.operationId, op.id))
      .orderBy(operationEntries.id)
      .all() as EntryRow[];

    lines.push(operationToBeancount(op, entries));
  }

  const tmpPath = ledgerPath + ".tmp";
  fs.writeFileSync(tmpPath, lines.join("\n"), "utf-8");
  fs.renameSync(tmpPath, ledgerPath);

  clearDirty();
}
