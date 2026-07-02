import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, balances, accounts } from "@/db/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const conditions = [eq(transactions.userId, userId)];

  if (accountId) conditions.push(eq(transactions.accountId, parseInt(accountId, 10)));
  if (type) conditions.push(eq(transactions.type, type));
  if (status) conditions.push(eq(transactions.status, status));
  if (dateFrom) conditions.push(gte(transactions.operationDate, dateFrom));
  if (dateTo) conditions.push(lte(transactions.operationDate, dateTo));

  const list = db.select().from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.operationDate))
    .limit(limit)
    .offset(offset)
    .all();

  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    type, accountId, counterpartyAccountId,
    amount, currency,
    amountFrom, currencyFrom, amountTo, currencyTo,
    category, description, operationDate,
  } = body;

  if (!type || !accountId) {
    return NextResponse.json({ error: "type and accountId are required" }, { status: 400 });
  }

  const account = db.select().from(accounts).where(
    and(eq(accounts.id, accountId), eq(accounts.userId, userId))
  ).get();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const finalAmount = amount ?? amountFrom ?? 0;
  const finalCurrency = currency ?? currencyFrom ?? "RUB";
  const opDate = operationDate || new Date().toISOString();

  const tx = db.insert(transactions).values({
    userId,
    accountId,
    counterpartyAccountId: counterpartyAccountId || null,
    type,
    status: "confirmed",
    source: "manual",
    amount: finalAmount,
    currency: finalCurrency,
    amountFrom: amountFrom || null,
    currencyFrom: currencyFrom || null,
    amountTo: amountTo || null,
    currencyTo: currencyTo || null,
    category: category || null,
    description: description || null,
    operationDate: opDate,
  }).returning().get();

  // Update balances
  const effectiveCurrency = finalCurrency;
  const effectiveAmount = finalAmount;

  if (type === "transfer" && !counterpartyAccountId) {
    return NextResponse.json({ error: "Counterparty account is required for transfer" }, { status: 400 });
  }

  if (type === "income") {
    upsertBalance(accountId, effectiveCurrency, effectiveAmount);
  } else if (type === "expense") {
    upsertBalance(accountId, effectiveCurrency, -effectiveAmount);
  } else if (type === "transfer" && counterpartyAccountId) {
    upsertBalance(accountId, effectiveCurrency, -effectiveAmount);
    upsertBalance(counterpartyAccountId, effectiveCurrency, effectiveAmount);
  } else if (type === "exchange") {
    if (amountFrom && currencyFrom) {
      upsertBalance(accountId, currencyFrom, -amountFrom);
    }
    if (amountTo && currencyTo) {
      const targetAccountId = counterpartyAccountId || accountId;
      upsertBalance(targetAccountId, currencyTo, amountTo);
    }
  }

  return NextResponse.json(tx, { status: 201 });
}

function upsertBalance(accountId: number, currency: string, amountDelta: number) {
  const existing = db.select().from(balances).where(
    and(eq(balances.accountId, accountId), eq(balances.currency, currency))
  ).get();

  if (existing) {
    db.update(balances)
      .set({ amount: existing.amount + amountDelta, updatedAt: new Date().toISOString() })
      .where(eq(balances.id, existing.id))
      .run();
  } else {
    db.insert(balances).values({
      accountId,
      currency,
      amount: amountDelta,
    }).run();
  }
}
