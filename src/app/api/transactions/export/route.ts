import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, accounts } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const txs = db.select({
    id: transactions.id,
    type: transactions.type,
    status: transactions.status,
    source: transactions.source,
    amount: transactions.amount,
    currency: transactions.currency,
    amountFrom: transactions.amountFrom,
    currencyFrom: transactions.currencyFrom,
    amountTo: transactions.amountTo,
    currencyTo: transactions.currencyTo,
    category: transactions.category,
    description: transactions.description,
    operationDate: transactions.operationDate,
  }).from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.operationDate))
    .all();

  const header = "ID,Type,Status,Source,Amount,Currency,AmountFrom,CurrencyFrom,AmountTo,CurrencyTo,Category,Description,Date";
  const rows = txs.map((tx) =>
    [
      tx.id,
      tx.type,
      tx.status,
      tx.source,
      tx.amount,
      tx.currency,
      tx.amountFrom ?? "",
      tx.currencyFrom ?? "",
      tx.amountTo ?? "",
      tx.currencyTo ?? "",
      tx.category ?? "",
      `"${(tx.description ?? "").replace(/"/g, '""')}"`,
      tx.operationDate,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
