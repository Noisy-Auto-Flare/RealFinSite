import { NextResponse } from "next/server";
import { db } from "@/db";
import { balances, accounts } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userAccounts = db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) return NextResponse.json({ balances: [] });

  const allBalances = db.select().from(balances)
    .where(inArray(balances.accountId, accountIds))
    .all();

  const result = allBalances.map((b) => {
    const account = userAccounts.find((a) => a.id === b.accountId);
    return {
      accountId: b.accountId,
      accountName: account?.name || "",
      currency: b.currency,
      amount: b.amount,
    };
  });

  return NextResponse.json({ balances: result });
}

