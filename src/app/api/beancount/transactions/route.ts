import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getTransactions } from "@/lib/beancount/fava-api";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  ensureFresh();
  const fava = await getTransactions();
  if (fava) return NextResponse.json(fava);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const rows = db.select()
    .from(operations)
    .where(eq(operations.status, "confirmed"))
    .orderBy(desc(operations.date))
    .limit(limit)
    .all();

  const result = rows.map(op => {
    const entries = db.select()
      .from(operationEntries)
      .where(eq(operationEntries.operationId, op.id))
      .all();
    return {
      date: op.date,
      payee: op.category || "Unknown",
      narration: op.description || "",
      postings: entries.map(e => ({
        account: `Assets:FinTracker:User${op.userId}:${e.accountId}:${e.currency}`,
        units: { number: String(e.amount), currency: e.currency },
      })),
    };
  });

  return NextResponse.json(result);
}
