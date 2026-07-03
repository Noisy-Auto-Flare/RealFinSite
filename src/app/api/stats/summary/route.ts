import { NextResponse } from "next/server";
import { db } from "@/db";
import { balances, accounts, operations, operationEntries } from "@/db/schema";
import { eq, and, gte, lte, inArray, sql, lt } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { convertAmount } from "@/lib/rates/coingecko";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const baseCurrency = (searchParams.get("base_currency") || "RUB").toUpperCase();
  const periodStart = searchParams.get("period_start");
  const periodEnd = searchParams.get("period_end");

  const userAccounts = db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  const accountIds = userAccounts.map((a) => a.id);
  if (accountIds.length === 0) {
    return NextResponse.json({
      totalCapital: 0,
      totalCapitalConverted: 0,
      baseCurrency,
      balances: [],
      income: 0,
      incomeConverted: 0,
      expense: 0,
      expenseConverted: 0,
      periodTransactionCount: 0,
    });
  }

  const allBalances = db.select().from(balances)
    .where(inArray(balances.accountId, accountIds))
    .all();

  let totalCapitalConverted = 0;
  const convertedBalances = allBalances.map((b) => {
    const account = userAccounts.find((a) => a.id === b.accountId);
    const conversion = convertAmount(Math.abs(b.amount), b.currency, baseCurrency);
    const amountInBase = conversion?.converted ?? null;
    if (amountInBase !== null) {
      totalCapitalConverted += amountInBase;
    }
    return {
      accountId: b.accountId,
      accountName: account?.name || "",
      currency: b.currency,
      amount: b.amount,
      amountInBase,
    };
  });

  const totalCapital = allBalances.reduce((sum, b) => sum + Math.abs(b.amount), 0);

  const incomeByCurrency = db.select({
    total: sql`COALESCE(SUM(${operationEntries.amount}), 0)`,
    currency: operationEntries.currency,
  }).from(operationEntries)
    .innerJoin(operations, eq(operations.id, operationEntries.operationId))
    .where(
      and(
        eq(operations.userId, userId),
        eq(operations.status, "confirmed"),
        gte(operationEntries.amount, 0),
        periodStart ? gte(operations.date, periodStart) : undefined,
        periodEnd ? lte(operations.date, periodEnd) : undefined,
      )
    )
    .groupBy(operationEntries.currency)
    .all();

  const expenseByCurrency = db.select({
    total: sql`COALESCE(SUM(${operationEntries.amount}), 0)`,
    currency: operationEntries.currency,
  }).from(operationEntries)
    .innerJoin(operations, eq(operations.id, operationEntries.operationId))
    .where(
      and(
        eq(operations.userId, userId),
        eq(operations.status, "confirmed"),
        lt(operationEntries.amount, 0),
        periodStart ? gte(operations.date, periodStart) : undefined,
        periodEnd ? lte(operations.date, periodEnd) : undefined,
      )
    )
    .groupBy(operationEntries.currency)
    .all();

  let income = 0;
  let incomeConverted = 0;
  let expense = 0;
  let expenseConverted = 0;

  for (const row of incomeByCurrency) {
    income += Math.abs(Number(row.total));
    const conv = convertAmount(Math.abs(Number(row.total)), row.currency, baseCurrency);
    if (conv) incomeConverted += conv.converted;
  }
  for (const row of expenseByCurrency) {
    expense += Math.abs(Number(row.total));
    const conv = convertAmount(Math.abs(Number(row.total)), row.currency, baseCurrency);
    if (conv) expenseConverted += conv.converted;
  }

  const periodTxCount = db.select({ count: sql`COUNT(*)` }).from(operations)
    .where(
      and(
        eq(operations.userId, userId),
        eq(operations.status, "confirmed"),
        periodStart ? gte(operations.date, periodStart) : undefined,
        periodEnd ? lte(operations.date, periodEnd) : undefined,
      )
    )
    .get();

  return NextResponse.json({
    totalCapital,
    totalCapitalConverted,
    baseCurrency,
    balances: convertedBalances,
    income,
    incomeConverted,
    expense,
    expenseConverted,
    periodTransactionCount: Number(periodTxCount?.count ?? 0),
  });
}
