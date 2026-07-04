import { NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { logAction } from "@/lib/action-log";
import { auth } from "@/auth";
import { recalculateAllBalances } from "@/db/migrate";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const opId = parseInt(id, 10);

  const op = db.select().from(operations).where(
    and(eq(operations.id, opId), eq(operations.userId, userId))
  ).get();

  if (!op) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = db.select().from(operationEntries)
    .where(eq(operationEntries.operationId, opId)).all();

  return NextResponse.json({ ...op, entries });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const opId = parseInt(id, 10);

  const existing = db.select().from(operations).where(
    and(eq(operations.id, opId), eq(operations.userId, userId))
  ).get();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const allowedFields = ["description", "category", "date", "status"] as const;
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  if (Object.keys(updates).length > 0) {
    db.update(operations).set(updates).where(eq(operations.id, opId)).run();
  }

  if (body.status === "confirmed" && existing.status !== "confirmed") {
    recalculateAllBalances();
  }

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "update",
    entityType: "operation",
    entityId: opId,
    details: Object.keys(updates).join(", "),
  });

  const updated = db.select().from(operations).where(eq(operations.id, opId)).get();
  const entries = db.select().from(operationEntries)
    .where(eq(operationEntries.operationId, opId)).all();

  return NextResponse.json({ ...updated, entries });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const opId = parseInt(id, 10);

  const existing = db.select().from(operations).where(
    and(eq(operations.id, opId), eq(operations.userId, userId))
  ).get();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.delete(operations).where(eq(operations.id, opId)).run();

  recalculateAllBalances();

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "delete",
    entityType: "operation",
    entityId: opId,
    details: `${existing.description || "operation"}`,
  });

  return NextResponse.json({ success: true });
}
