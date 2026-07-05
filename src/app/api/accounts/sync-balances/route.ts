import { NextResponse } from "next/server";
import { db } from "@/db";
import { accountAddresses, accounts, operations, operationEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

  // Clean up legacy untagged balance corrections (migration to per-address tagging)
  const legacyOps = db.select({ id: operations.id }).from(operations)
    .where(and(eq(operations.source, "balance_correction"), eq(operations.status, "confirmed"))).all();
  for (const op of legacyOps) {
    db.delete(operationEntries).where(eq(operationEntries.operationId, op.id)).run();
    db.delete(operations).where(eq(operations.id, op.id)).run();
  }

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

