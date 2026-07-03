import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, balances, accountAddresses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { logAction } from "@/lib/action-log";
import { auth } from "@/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const accountId = parseInt(id, 10);

  const account = db.select().from(accounts).where(
    and(eq(accounts.id, accountId), eq(accounts.userId, userId))
  ).get();

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const accBalances = db.select().from(balances).where(eq(balances.accountId, accountId)).all();
  const accAddresses = db.select().from(accountAddresses).where(eq(accountAddresses.accountId, accountId)).all();

  return NextResponse.json({ ...account, balances: accBalances, addresses: accAddresses });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const accountId = parseInt(id, 10);
  const body = await request.json();

  const existing = db.select().from(accounts).where(
    and(eq(accounts.id, accountId), eq(accounts.userId, userId))
  ).get();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name;
  if (body.currency) updates.currency = body.currency;
  if (body.isActive !== undefined) updates.isActive = body.isActive ? 1 : 0;
  if (body.isAutoSync !== undefined) updates.isAutoSync = body.isAutoSync ? 1 : 0;

  if (Object.keys(updates).length > 0) {
    db.update(accounts).set(updates).where(eq(accounts.id, accountId)).run();
  }

  if (body.balances && Array.isArray(body.balances)) {
    for (const bal of body.balances) {
      const existingBal = db.select().from(balances).where(
        and(eq(balances.accountId, accountId), eq(balances.currency, bal.currency))
      ).get();

      if (existingBal) {
        db.update(balances).set({ amount: bal.amount }).where(eq(balances.id, existingBal.id)).run();
      } else {
        db.insert(balances).values({ accountId, currency: bal.currency, amount: bal.amount }).run();
      }
    }
  }

  if (body.addresses && Array.isArray(body.addresses)) {
    db.delete(accountAddresses).where(eq(accountAddresses.accountId, accountId)).run();
    for (const addr of body.addresses) {
      db.insert(accountAddresses).values({ accountId, network: addr.network, address: addr.address }).run();
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const accountId = parseInt(id, 10);

  const existing = db.select().from(accounts).where(
    and(eq(accounts.id, accountId), eq(accounts.userId, userId))
  ).get();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.delete(accounts).where(eq(accounts.id, accountId)).run();

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "delete",
    entityType: "account",
    entityId: accountId,
    details: `${existing.type} "${existing.name}"`,
  });

  return NextResponse.json({ success: true });
}
