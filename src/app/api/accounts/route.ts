import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, balances, accountAddresses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = db.select().from(accounts).where(eq(accounts.userId, userId)).all();

  const result = list.map((acc) => {
    const accBalances = db.select().from(balances).where(eq(balances.accountId, acc.id)).all();
    const accAddresses = db.select().from(accountAddresses).where(eq(accountAddresses.accountId, acc.id)).all();
    return { ...acc, balances: accBalances, addresses: accAddresses };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, type, currency, addresses, initialBalances } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  const account = db.insert(accounts).values({
    userId,
    name,
    type,
    currency: currency || "RUB",
    isActive: 1,
    isAutoSync: type === "crypto_wallet" ? 1 : 0,
  }).returning().get();

  if (addresses && Array.isArray(addresses)) {
    for (const addr of addresses) {
      db.insert(accountAddresses).values({
        accountId: account.id,
        network: addr.network,
        address: addr.address,
      }).run();
    }
  }

  if (initialBalances && Array.isArray(initialBalances)) {
    for (const bal of initialBalances) {
      db.insert(balances).values({
        accountId: account.id,
        currency: bal.currency,
        amount: bal.amount || 0,
      }).run();
    }
  } else {
    db.insert(balances).values({
      accountId: account.id,
      currency: currency || "RUB",
      amount: 0,
    }).run();
  }

  return NextResponse.json(account, { status: 201 });
}
