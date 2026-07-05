import { NextResponse } from "next/server";
import { db } from "@/db";
import { accountAddresses, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";
import { syncAddressBalance } from "@/lib/scanners/runner";
import { recalculateAllBalances } from "@/lib/balances";
import { markDirty } from "@/lib/beancount/dirty-flag";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = db.select({
    addr: accountAddresses,
    account: accounts,
  })
    .from(accountAddresses)
    .innerJoin(accounts, eq(accountAddresses.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .all();

  const results: {
    accountId: number;
    accountName: string;
    address: string;
    network: string;
    corrections: { currency: string; delta: number; correctionAmount: number | null }[];
  }[] = [];

  for (const row of rows) {
    const syncResults = await syncAddressBalance(
      row.addr.id,
      row.addr.address,
      row.addr.network,
      row.account.id
    );

    results.push({
      accountId: row.account.id,
      accountName: row.account.name,
      address: row.addr.address,
      network: row.addr.network,
      corrections: syncResults ?? [],
    });
  }

  recalculateAllBalances();
  markDirty();

  return NextResponse.json({ success: true, results });
}

