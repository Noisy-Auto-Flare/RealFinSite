import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, balances, accountAddresses, apiCredentials } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { logAction } from "@/lib/action-log";
import { auth } from "@/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  const accountIds = list.map((a) => a.id);

  const allBalances = accountIds.length > 0
    ? db.select().from(balances).where(inArray(balances.accountId, accountIds)).all()
    : [];
  const allAddresses = accountIds.length > 0
    ? db.select().from(accountAddresses).where(inArray(accountAddresses.accountId, accountIds)).all()
    : [];
  const allCredentials = accountIds.length > 0
    ? db.select().from(apiCredentials).where(inArray(apiCredentials.accountId, accountIds)).all()
    : [];

  const result = list.map((acc) => {
    const accBalances = allBalances.filter((b) => b.accountId === acc.id);
    const accAddresses = allAddresses.filter((a) => a.accountId === acc.id);
    const creds = allCredentials.find((c) => c.accountId === acc.id);
    return { ...acc, balances: accBalances, addresses: accAddresses, credentials: creds || null };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const { name, type, currency, addresses, initialBalances, exchange, apiKey, apiSecret, apiPassphrase } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  const multiCurrency = type === "cex_exchange" || type === "crypto_wallet";
  const defaultCurrency = multiCurrency ? "USDT" : (currency || "RUB");

  const isAutoSync = body.connectionType === "auto";

  const account = db.insert(accounts).values({
    userId,
    name,
    type,
    currency: defaultCurrency,
    isActive: 1,
    isAutoSync: isAutoSync ? 1 : (type === "crypto_wallet" ? 1 : 0),
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

  if (apiKey && apiSecret && exchange) {
    const encryptedSecret = encrypt(apiSecret);
    const encryptedPassphrase = apiPassphrase ? encrypt(apiPassphrase) : null;
    db.insert(apiCredentials).values({
      accountId: account.id,
      exchange,
      apiKey,
      apiSecret: encryptedSecret,
      passphrase: encryptedPassphrase,
    }).run();
  }

  if (initialBalances && Array.isArray(initialBalances)) {
    for (const bal of initialBalances) {
      db.insert(balances).values({
        accountId: account.id,
        currency: bal.currency,
        amount: bal.amount || 0,
      }).run();
    }
  } else if (!multiCurrency) {
    db.insert(balances).values({
      accountId: account.id,
      currency: defaultCurrency,
      amount: 0,
    }).run();
  }

  const session = await auth();
  logAction({
    userId,
    username: session?.user?.username || "unknown",
    action: "create",
    entityType: "account",
    entityId: account.id,
    details: `${type} "${name}"`,
  });

  return NextResponse.json(account, { status: 201 });
}

