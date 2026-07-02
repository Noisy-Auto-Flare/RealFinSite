import { NextResponse } from "next/server";
import { db } from "@/db";
import { balances, accounts, transactions } from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
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

  // Period income/expense (always returned in original + converted)
  const conditions = [eq(transactions.userId, userId)];
  if (periodStart) conditions.push(gte(transactions.operationDate, periodStart));
  if (periodEnd) conditions.push(lte(transactions.operationDate, periodEnd));

  const periodTx = db.select().from(transactions)
    .where(and(...conditions))
    .all();

  let income = 0;
  let incomeConverted = 0;
  let expense = 0;
  let expenseConverted = 0;

  for (const tx of periodTx) {
    const absAmount = Math.abs(tx.amount);
    if (tx.type === "income") {
      income += absAmount;
      const conv = convertAmount(absAmount, tx.currency, baseCurrency);
      if (conv) incomeConverted += conv.converted;
    } else if (tx.type === "expense") {
      expense += absAmount;
      const conv = convertAmount(absAmount, tx.currency, baseCurrency);
      if (conv) expenseConverted += conv.converted;
    }
  }

  return NextResponse.json({
    totalCapital,
    totalCapitalConverted,
    baseCurrency,
    balances: convertedBalances,
    income,
    incomeConverted,
    expense,
    expenseConverted,
    periodTransactionCount: periodTx.length,
  });
}
