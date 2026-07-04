import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getBalances } from "@/lib/beancount/fava-api";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  ensureFresh();
  const fava = await getBalances();
  if (fava) return NextResponse.json(fava);

  // Fallback: aggregate from SQLite
  const rows = db.select({
    accountId: operationEntries.accountId,
    currency: operationEntries.currency,
    balance: sql<string>`COALESCE(SUM(${operationEntries.amount}), 0)`,
  })
    .from(operationEntries)
    .innerJoin(operations, eq(operationEntries.operationId, operations.id))
    .where(eq(operations.status, "confirmed"))
    .groupBy(operationEntries.accountId, operationEntries.currency)
    .all();

  return NextResponse.json(rows.map(r => ({
    account: `Assets:FinTracker:User?:${r.accountId}:${r.currency}`,
    balance: { number: String(r.balance), currency: r.currency },
  })));
}
