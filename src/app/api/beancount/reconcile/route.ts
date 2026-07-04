import { NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ensureFresh } from "../ensure-fresh";

export async function GET() {
  ensureFresh();

  // Get SQLite balances (confirmed operations)
  const sqliteBalances = db.select({
    accountId: operationEntries.accountId,
    currency: operationEntries.currency,
    amount: sql<string>`COALESCE(SUM(${operationEntries.amount}), 0)`,
  })
    .from(operationEntries)
    .innerJoin(operations, eq(operationEntries.operationId, operations.id))
    .where(eq(operations.status, "confirmed"))
    .groupBy(operationEntries.accountId, operationEntries.currency)
    .all();

  // Compare with Beancount via Fava
  const { getBalances } = await import("@/lib/beancount/fava-api");
  const beancountBalances = await getBalances();

  return NextResponse.json({
    sqlite: sqliteBalances,
    beancount: beancountBalances,
    reconciled: beancountBalances !== null,
  });
}
