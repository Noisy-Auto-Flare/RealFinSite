import { NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries, accounts } from "@/db/schema";
import { eq, and, desc, gte, lte, like, sql, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { logAction } from "@/lib/action-log";
import { auth } from "@/auth";
import { recalculateAllBalances } from "@/db/migrate";

function detectImplicitFees(entries: { accountId: number; currency: string; amount: number; type: string }[]) {
  const principalSum: Record<string, number> = {};
  for (const e of entries) {
    if (e.type === "principal") {
      const key = `${e.accountId}:${e.currency}`;
      principalSum[key] = (principalSum[key] || 0) + e.amount;
    }
  }
  const fees: typeof entries = [];
  for (const e of entries) {
    if (e.type !== "principal") continue;
    const key = `${e.accountId}:${e.currency}`;
    if (Math.abs(principalSum[key]) < 1e-9) continue;
    if (principalSum[key] > 0) {
      if (e.amount < 0) {
        fees.push({ ...e, type: "fee" });
      }
    } else {
      if (e.amount > 0) {
        fees.push({ ...e, type: "fee" });
      }
    }
  }
  return fees;
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { description, category, date, entries, status } = body;

  if (!date || !entries || !Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "date and entries are required" }, { status: 400 });
  }

  for (const e of entries) {
    if (!e.accountId || !e.currency || e.amount === undefined) {
      return NextResponse.json({ error: "Each entry needs accountId, currency, amount" }, { status: 400 });
    }
    const account = db.select().from(accounts).where(
      and(eq(accounts.id, e.accountId), eq(accounts.userId, userId))
    ).get();
    if (!account) {
      return NextResponse.json({ error: `Account ${e.accountId} not found` }, { status: 404 });
    }
  }

  const op = db.insert(operations).values({
    userId,
    description: description || null,
    category: category || null,
    date,
    source: "manual",
    status: status || "draft",
  }).returning().get();

  // Detect fees FIRST
  const feeCandidates = detectImplicitFees(entries);

  // Build final entry list, splitting outflows where fees exist
  const feeMap = new Map<string, number>();
  for (const f of feeCandidates) {
    feeMap.set(`${f.accountId}:${f.currency}`, f.amount);
  }

  const finalEntries: any[] = [];
  for (const entry of entries) {
    const key = `${entry.accountId}:${entry.currency}`;
    const feeAmount = feeMap.get(key);
    if (feeAmount && feeAmount !== 0 && entry.amount < 0) {
      finalEntries.push({
        accountId: entry.accountId,
        currency: entry.currency,
        amount: entry.amount - feeAmount,
        type: "principal",
        isVerified: 1,
      });
      finalEntries.push({
        accountId: entry.accountId,
        currency: entry.currency,
        amount: feeAmount,
        type: "fee",
        isVerified: 0,
      });
      feeMap.delete(key);
    } else {
      finalEntries.push({
        accountId: entry.accountId,
        currency: entry.currency,
        amount: entry.amount,
        type: entry.type || "principal",
        isVerified: entry.isVerified ?? 1,
      });
    }
  }

  // Insert ALL entries
  for (const entry of finalEntries) {
    db.insert(operationEntries).values({
      operationId: op.id,
      accountId: entry.accountId,
      currency: entry.currency,
      amount: entry.amount,
      type: entry.type,
      isVerified: entry.isVerified,
    }).run();
  }

  if (status === "confirmed") {
    recalculateAllBalances();
  }

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "create",
    entityType: "operation",
    entityId: op.id,
    details: `${category || "uncategorized"} operation with ${entryRows.length} entries`,
  });

  const created = db.select().from(operations).where(eq(operations.id, op.id)).get();
  const createdEntries = db.select().from(operationEntries)
    .where(eq(operationEntries.operationId, op.id)).all();

  return NextResponse.json({ ...created, entries: createdEntries }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const searchQ = searchParams.get("search");

  const conditions = [eq(operations.userId, userId)];
  if (dateFrom) conditions.push(gte(operations.date, dateFrom));
  if (dateTo) conditions.push(lte(operations.date, dateTo));
  if (category) conditions.push(eq(operations.category, category));
  if (status) conditions.push(eq(operations.status, status));
  if (searchQ) conditions.push(like(operations.description, `%${searchQ}%`));

  const offset = (page - 1) * limit;
  const total = db.select({ count: sql<number>`count(*)` }).from(operations)
    .where(and(...conditions)).get()?.count || 0;

  const list = db.select().from(operations)
    .where(and(...conditions))
    .orderBy(desc(operations.date))
    .limit(limit)
    .offset(offset)
    .all();

  const opIds = list.map((o) => o.id);
  const allEntries = opIds.length > 0
    ? db.select().from(operationEntries)
        .where(inArray(operationEntries.operationId, opIds)).all()
    : [];
  const entriesByOpId: Record<number, typeof allEntries> = {};
  for (const e of allEntries) {
    if (!entriesByOpId[e.operationId]) entriesByOpId[e.operationId] = [];
    entriesByOpId[e.operationId].push(e);
  }

  const result = list.map((o) => ({
    ...o,
    entries: entriesByOpId[o.id] || [],
  }));

  return NextResponse.json({ operations: result, total, page, limit });
}
