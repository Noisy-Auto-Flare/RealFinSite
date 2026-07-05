import { db } from "@/db";
import { accountAddresses, accounts, operations, operationEntries } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getScanner, RawBlockchainEvent } from "./interface";
import { recalculateAllBalances } from "@/lib/balances";
import { markDirty } from "@/lib/beancount/dirty-flag";
import { getTokenMetadata } from "@/lib/tokens";

export const NATIVE_CURRENCIES: Record<string, string> = {
  bsc: "BNB",
  avalanche: "AVAX",
  ethereum: "ETH",
  solana: "SOL",
  ton: "TON",
};

export async function runScannerCycle(): Promise<void> {
  const allAddresses = db.select({
    addr: accountAddresses,
    account: accounts,
  })
    .from(accountAddresses)
    .innerJoin(accounts, eq(accountAddresses.accountId, accounts.id))
    .where(eq(accounts.isAutoSync, 1))
    .all();

  if (allAddresses.length === 0) {
    console.log(`[scanner] ${new Date().toISOString()} no addresses to scan (is_auto_sync=1)`);
    return;
  }

  console.log(`[scanner] ${new Date().toISOString()} scanning ${allAddresses.length} address(es)...`);

  for (const row of allAddresses) {
    const scanner = await getScanner(row.addr.network);
    if (!scanner) {
      console.log(`[scanner]   ⚠ unsupported network "${row.addr.network}" for account "${row.account.name}", skipping`);
      continue;
    }

    console.log(`[scanner]   → ${row.addr.network}: ${row.addr.address.slice(0, 12)}... (from block ${row.addr.lastSyncBlock ?? 0})`);

    const events = await scanner.fetchNewTransactions(
      row.addr.address,
      row.addr.lastSyncBlock ?? 0
    );

    if (events.length === 0) {
      console.log(`[scanner]     no new transactions found`);
      continue;
    }

    console.log(`[scanner]     found ${events.length} new transaction(s)`);

    for (const evt of events) {
      await processEvent(evt, row.addr.address, row.addr.network, row.account.id, row.account.userId);
    }

    recalculateAllBalances();
    markDirty();

    const maxBlock = Math.max(...events.map((e) => e.blockNumber), row.addr.lastSyncBlock ?? 0);
    db.update(accountAddresses)
      .set({ lastSyncBlock: maxBlock })
      .where(eq(accountAddresses.id, row.addr.id))
      .run();
  }
}

async function processEvent(
  evt: RawBlockchainEvent,
  ownAddress: string,
  network: string,
  accountId: number,
  userId: number
): Promise<void> {
  const existing = db.select({ id: operations.id, status: operations.status }).from(operations)
    .where(eq(operations.txHash, evt.txHash)).get();
  if (existing) {
    if (existing.status === "draft") {
      db.update(operations).set({ status: "confirmed" }).where(eq(operations.id, existing.id)).run();
    }
    return;
  }

  const nativeSymbol = NATIVE_CURRENCIES[network] || "ETH";
  let currency: string;
  if (evt.tokenSymbol) {
    currency = evt.tokenSymbol;
  } else if (evt.tokenContract) {
    const meta = await getTokenMetadata(network, evt.tokenContract);
    currency = meta?.symbol || "TOKEN";
  } else {
    currency = nativeSymbol;
  }
  const humanAmount = parseFloat(evt.amount) / Math.pow(10, evt.decimals);

  if (humanAmount <= 0) return;

  const isIncoming = evt.toAddress.toLowerCase() === ownAddress.toLowerCase();
  const isOutgoing = evt.fromAddress.toLowerCase() === ownAddress.toLowerCase();

  if (!isIncoming && !isOutgoing) return;

  const amount = isIncoming ? humanAmount : -humanAmount;

  const op = db.insert(operations).values({
    userId,
    description: `${isIncoming ? "Received" : "Sent"} ${currency}`,
    date: new Date(evt.timestamp * 1000).toISOString().split("T")[0],
    source: `scanner_${network}`,
    txHash: evt.txHash,
    fromAddress: evt.fromAddress,
    toAddress: evt.toAddress,
    blockTimestamp: evt.timestamp,
    status: "confirmed",
  }).returning().get();

  db.insert(operationEntries).values({
    operationId: op.id,
    accountId,
    currency,
    amount,
    type: "principal",
    isVerified: 1,
  }).run();
}

export async function syncAddressBalance(
  addressId: number,
  address: string,
  network: string,
  accountId: number
): Promise<{ currency: string; delta: number; correctionAmount: number | null }[] | null> {
  const scanner = await getScanner(network);
  if (!scanner) return null;

  const result = await scanner.fetchAllBalances(address);
  if (!result) return null;

  const corrections: { currency: string; delta: number; correctionAmount: number | null }[] = [];

  for (const be of result.balances) {
    const blockchainBalance = parseFloat(be.balance) / Math.pow(10, be.decimals);

    const existingOps = db.select({
      total: sql<string>`COALESCE(SUM(${operationEntries.amount}), 0)`,
    })
      .from(operationEntries)
      .innerJoin(operations, eq(operationEntries.operationId, operations.id))
      .where(and(
        eq(operationEntries.accountId, accountId),
        eq(operationEntries.currency, be.currency),
        eq(operations.status, "confirmed"),
      ))
      .get();

    const existingSum = parseFloat(existingOps?.total || "0");
    const delta = blockchainBalance - existingSum;

    if (Math.abs(delta) < 0.000001) {
      corrections.push({ currency: be.currency, delta, correctionAmount: null });
      continue;
    }

    const acc = db.select({ userId: accounts.userId }).from(accounts).where(eq(accounts.id, accountId)).get();
    const userId = acc?.userId ?? 0;

    const op = db.insert(operations).values({
      userId,
      description: `Balance sync (${be.currency}) — correction ${delta >= 0 ? "+" : ""}${delta.toFixed(6)}`,
      date: new Date().toISOString().split("T")[0],
      source: "balance_correction",
      status: "confirmed",
    }).returning().get();

    db.insert(operationEntries).values({
      operationId: op.id,
      accountId,
      currency: be.currency,
      amount: delta,
      type: "principal",
      isVerified: 1,
    }).run();

    corrections.push({ currency: be.currency, delta, correctionAmount: delta });
  }

  markDirty();

  // Update lastSyncBlock to the fetched block, never rolling back
  const current = db.select({ lastSyncBlock: accountAddresses.lastSyncBlock })
    .from(accountAddresses)
    .where(eq(accountAddresses.id, addressId))
    .get();

  const newBlock = Math.max(current?.lastSyncBlock ?? 0, result.blockNumber);
  db.update(accountAddresses)
    .set({ lastSyncBlock: newBlock })
    .where(eq(accountAddresses.id, addressId))
    .run();

  return corrections;
}


