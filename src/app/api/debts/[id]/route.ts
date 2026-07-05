import { NextResponse } from "next/server";
import { db } from "@/db";
import { debts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const debtId = parseInt(id, 10);

  const existing = db.select().from(debts)
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId))).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  const allowed = ["personName", "description", "amount", "currency", "status", "settledAt"];
  for (const f of allowed) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  if (Object.keys(updates).length > 0) {
    db.update(debts).set(updates).where(eq(debts.id, debtId)).run();
  }

  const updated = db.select().from(debts).where(eq(debts.id, debtId)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const debtId = parseInt(id, 10);

  db.delete(debts).where(and(eq(debts.id, debtId), eq(debts.userId, userId))).run();
  return NextResponse.json({ success: true });
}
