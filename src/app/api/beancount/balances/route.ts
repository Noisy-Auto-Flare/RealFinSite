import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getBalances } from "@/lib/beancount/fava-api";
import { db } from "@/db";
import { operations, operationEntries, accounts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  ensureFresh();
  const fava = await getBalances();
  if (fava) return NextResponse.json(fava);

  // Fallback: aggregate from SQLite
  const rows = db.select({
    accountId: operationEntries.accountId,
    userId: accounts.userId,
    currency: operationEntries.currency,
    balance: sql<string>`COALESCE(SUM(${operationEntries.amount}), 0)`,
  })
    .from(operationEntries)
    .innerJoin(operations, eq(operationEntries.operationId, operations.id))
    .innerJoin(accounts, eq(operationEntries.accountId, accounts.id))
    .where(eq(operations.status, "confirmed"))
    .groupBy(operationEntries.accountId, operationEntries.currency, accounts.userId)
    .all();

  return NextResponse.json(rows.map(r => ({
    account: `Assets:FinTracker:User${r.userId}:${r.accountId}:${r.currency}`,
    balance: { number: String(r.balance), currency: r.currency },
  })));
}
