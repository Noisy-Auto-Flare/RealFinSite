import { NextResponse } from "next/server";
import { db } from "@/db";
import { operationGroups, operations, operationEntries, accounts } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id, 10);

  const group = db.select().from(operationGroups)
    .where(and(eq(operationGroups.id, groupId), eq(operationGroups.userId, userId)))
    .get();

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ops = db.select().from(operations)
    .where(and(eq(operations.groupId, groupId), eq(operations.userId, userId)))
    .orderBy(operations.date)
    .all();

  const opIds = ops.map((o) => o.id);
  const allEntries = opIds.length > 0
    ? db.select({
        id: operationEntries.id,
        operationId: operationEntries.operationId,
        accountId: operationEntries.accountId,
        currency: operationEntries.currency,
        amount: operationEntries.amount,
        type: operationEntries.type,
        isVerified: operationEntries.isVerified,
        accountName: accounts.name,
      }).from(operationEntries)
        .innerJoin(accounts, eq(accounts.id, operationEntries.accountId))
        .where(inArray(operationEntries.operationId, opIds)).all()
    : [];

  const entriesByOpId: Record<number, typeof allEntries> = {};
  for (const e of allEntries) {
    if (!entriesByOpId[e.operationId]) entriesByOpId[e.operationId] = [];
    entriesByOpId[e.operationId].push(e);
  }

  return NextResponse.json({
    ...group,
    operations: ops.map((o) => ({ ...o, entries: entriesByOpId[o.id] || [] })),
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id, 10);

  // Unlink operations from the group, don't delete them
  db.update(operations).set({ groupId: null })
    .where(and(eq(operations.groupId, groupId), eq(operations.userId, userId)))
    .run();

  db.delete(operationGroups)
    .where(and(eq(operationGroups.id, groupId), eq(operationGroups.userId, userId)))
    .run();

  return NextResponse.json({ success: true });
}
