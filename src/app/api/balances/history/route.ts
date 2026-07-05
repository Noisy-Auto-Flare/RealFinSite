import { NextResponse } from "next/server";
import { db } from "@/db";
import { balanceSnapshots, balances, accounts } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ? Number(searchParams.get("accountId")) : undefined;
  const currency = searchParams.get("currency");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

  const userAccounts = db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) return NextResponse.json([]);

  const conditions = [inArray(balanceSnapshots.accountId, accountIds)];
  if (accountId) conditions.push(eq(balanceSnapshots.accountId, accountId));
  if (currency) conditions.push(eq(balanceSnapshots.currency, currency));

  const rows = db.select({
    date: balanceSnapshots.date,
    accountId: balanceSnapshots.accountId,
    currency: balanceSnapshots.currency,
    amount: balanceSnapshots.amount,
    computedAmount: balances.amount,
  })
    .from(balanceSnapshots)
    .leftJoin(balances, and(
      eq(balances.accountId, balanceSnapshots.accountId),
      eq(balances.currency, balanceSnapshots.currency),
    ))
    .where(and(...conditions))
    .orderBy(desc(balanceSnapshots.date))
    .limit(limit)
    .all();

  const result = rows.map((r) => ({
    date: r.date,
    accountId: r.accountId,
    currency: r.currency,
    amount: r.amount,
    computedAmount: r.computedAmount ?? 0,
    difference: r.amount - (r.computedAmount ?? 0),
  }));

  return NextResponse.json(result);
}

