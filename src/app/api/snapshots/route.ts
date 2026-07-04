import { NextResponse } from "next/server";
import { db } from "@/db";
import { balanceSnapshots, balances, accounts } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const { accountId, currency, amount, date, comment } = body;

  if (!accountId || !currency || amount === undefined || !date) {
    return NextResponse.json({ error: "accountId, currency, amount, date are required" }, { status: 400 });
  }

  const account = db.select().from(accounts).where(
    and(eq(accounts.id, accountId), eq(accounts.userId, userId))
  ).get();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const created = db.insert(balanceSnapshots).values({
    accountId,
    currency,
    amount,
    date,
    comment: comment || null,
  }).returning().get();

  return NextResponse.json(created, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ? Number(searchParams.get("accountId")) : undefined;

  const userAccounts = db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) return NextResponse.json({ snapshots: [] });

  const conditions = [inArray(balanceSnapshots.accountId, accountIds)];
  if (accountId) conditions.push(eq(balanceSnapshots.accountId, accountId));

  const rows = db.select({
    id: balanceSnapshots.id,
    accountId: balanceSnapshots.accountId,
    currency: balanceSnapshots.currency,
    amount: balanceSnapshots.amount,
    date: balanceSnapshots.date,
    comment: balanceSnapshots.comment,
    createdAt: balanceSnapshots.createdAt,
    computedAmount: balances.amount,
  })
    .from(balanceSnapshots)
    .leftJoin(balances, and(
      eq(balances.accountId, balanceSnapshots.accountId),
      eq(balances.currency, balanceSnapshots.currency),
    ))
    .where(and(...conditions))
    .orderBy(balanceSnapshots.date)
    .all();

  const snapshots = rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    currency: r.currency,
    amount: r.amount,
    date: r.date,
    comment: r.comment,
    createdAt: r.createdAt,
    computedAmount: r.computedAmount ?? 0,
    difference: r.amount - (r.computedAmount ?? 0),
  }));

  return NextResponse.json({ snapshots });
}
