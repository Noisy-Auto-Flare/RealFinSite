import { NextResponse } from "next/server";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { logAction } from "@/lib/action-log";
import { auth } from "@/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const txId = parseInt(id, 10);
  const body = await request.json();

  const existing = db.select().from(transactions).where(
    and(eq(transactions.id, txId), eq(transactions.userId, userId))
  ).get();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedFields = ["category", "description", "status"];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  if (Object.keys(updates).length > 0) {
    db.update(transactions).set(updates).where(eq(transactions.id, txId)).run();
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const txId = parseInt(id, 10);

  const existing = db.select().from(transactions).where(
    and(eq(transactions.id, txId), eq(transactions.userId, userId))
  ).get();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.delete(transactions).where(eq(transactions.id, txId)).run();

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "delete",
    entityType: "transaction",
    entityId: txId,
    details: `${existing.type} ${existing.amount} ${existing.currency}`,
  });

  return NextResponse.json({ success: true });
}
