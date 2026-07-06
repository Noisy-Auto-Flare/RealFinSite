import { NextResponse } from "next/server";
import { db } from "@/db";
import { debts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = db.select().from(debts)
    .where(eq(debts.userId, userId))
    .orderBy(desc(debts.createdAt))
    .all();

  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.personName || body.amount === undefined) {
    return NextResponse.json({ error: "personName and amount are required" }, { status: 400 });
  }

  const created = db.insert(debts).values({
    userId,
    personName: body.personName,
    description: body.description || null,
    amount: typeof body.amount === "string" ? parseFloat(body.amount.replace(",", ".")) : body.amount,
    currency: body.currency || "RUB",
    status: "active",
  }).returning().get();

  return NextResponse.json(created, { status: 201 });
}
