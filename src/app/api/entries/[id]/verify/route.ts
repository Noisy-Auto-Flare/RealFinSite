import { NextResponse } from "next/server";
import { db } from "@/db";
import { operationEntries, operations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { logAction } from "@/lib/action-log";
import { auth } from "@/auth";
import { recalculateAllBalances } from "@/lib/balances";
import { markDirty } from "@/lib/beancount/dirty-flag";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entryId = parseInt(id, 10);

  const entry = db.select().from(operationEntries)
    .where(eq(operationEntries.id, entryId))
    .get();

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const op = db.select().from(operations)
    .where(and(eq(operations.id, entry.operationId), eq(operations.userId, userId)))
    .get();

  if (!op) return NextResponse.json({ error: "Operation not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { isVerified: 1 };
  if (body.amount !== undefined) updates.amount = body.amount;

  db.update(operationEntries).set(updates).where(eq(operationEntries.id, entryId)).run();

  recalculateAllBalances();
  markDirty();

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "update",
    entityType: "operation_entry",
    entityId: entryId,
    details: `verified fee entry ${entry.currency} ${entry.amount}`,
  });

  const updated = db.select().from(operationEntries).where(eq(operationEntries.id, entryId)).get();

  return NextResponse.json(updated);
}

