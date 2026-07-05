import { NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries, accounts, tags, operationTags } from "@/db/schema";
import { eq, and, desc, gte, lte, like, sql, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import { auth } from "@/auth";
import { recalculateAllBalances } from "@/lib/balances";
import { markDirty } from "@/lib/beancount/dirty-flag";
import { detectImplicitFees } from "@/lib/operations";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const { description, date, entries, status, groupId, debtId, customRate, customRateLabel, tags: tagNames } = body;

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
    groupId: groupId || null,
    customRate: customRate || null,
    customRateLabel: customRateLabel || null,
    debtId: debtId || null,
    date,
    source: "manual",
    status: status || "draft",
  }).returning().get();

  // Detect fee deficits per (account, currency)
  const feeDeficits = new Map<string, number>();
  const fee = detectImplicitFees(entries);
  if (fee) {
    feeDeficits.set(`${fee.accountId}:${fee.currency}`, fee.amount);
  }

  const finalEntries: any[] = [];
  const splitKeys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.accountId}:${entry.currency}`;
    const deficit = feeDeficits.get(key);
    if (deficit !== undefined && !splitKeys.has(key) && Math.sign(entry.amount) === Math.sign(deficit)) {
      splitKeys.add(key);
      finalEntries.push({
        accountId: entry.accountId,
        currency: entry.currency,
        amount: entry.amount - deficit,
        type: "principal",
        isVerified: 1,
      });
      finalEntries.push({
        accountId: entry.accountId,
        currency: entry.currency,
        amount: deficit,
        type: "fee",
        isVerified: 0,
      });
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

  if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
    for (const name of tagNames) {
      const tag = db.select().from(tags).where(eq(tags.name, name)).get();
      if (tag) {
        db.insert(operationTags).values({ operationId: op.id, tagId: tag.id }).run();
      }
    }
  }

  if (status === "confirmed") {
    recalculateAllBalances();
    markDirty();
  }

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "create",
    entityType: "operation",
    entityId: op.id,
    details: `operation with ${finalEntries.length} entries${tagNames?.length ? `, tags: ${tagNames.join(", ")}` : ""}`,
  });

  const created = db.select().from(operations).where(eq(operations.id, op.id)).get();
  const createdEntries = db.select().from(operationEntries)
    .where(eq(operationEntries.operationId, op.id)).all();

  const createdTags = db.select({ name: tags.name }).from(operationTags)
    .innerJoin(tags, eq(tags.id, operationTags.tagId))
    .where(eq(operationTags.operationId, op.id)).all();

  const unverifiedFees = createdEntries.filter((e) => !e.isVerified);

  return NextResponse.json({
    operation: { ...created, entries: createdEntries, tags: createdTags.map(t => t.name) },
    unverifiedFees: unverifiedFees.length > 0 ? unverifiedFees : undefined,
  }, { status: 201 });
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const status = searchParams.get("status");
  const searchQ = searchParams.get("search");

  const conditions = [eq(operations.userId, userId)];
  if (dateFrom) conditions.push(gte(operations.date, dateFrom));
  if (dateTo) conditions.push(lte(operations.date, dateTo));
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

  const allTags = opIds.length > 0
    ? db.select({
        operationId: operationTags.operationId,
        name: tags.name,
      }).from(operationTags)
        .innerJoin(tags, eq(tags.id, operationTags.tagId))
        .where(inArray(operationTags.operationId, opIds)).all()
    : [];
  const tagsByOpId: Record<number, string[]> = {};
  for (const t of allTags) {
    if (!tagsByOpId[t.operationId]) tagsByOpId[t.operationId] = [];
    tagsByOpId[t.operationId].push(t.name);
  }

  const result = list.map((o) => ({
    ...o,
    entries: entriesByOpId[o.id] || [],
    tags: tagsByOpId[o.id] || [],
  }));

  return NextResponse.json({ operations: result, total, page, limit });
}

