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

export async function runScannerCycle(): Promise<{ eventsFound: number; addressesScanned: number }> {
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
    return { eventsFound: 0, addressesScanned: 0 };
  }

  console.log(`[scanner] ${new Date().toISOString()} scanning ${allAddresses.length} address(es)...`);

  let eventsFound = 0;

  for (const row of allAddresses) {
    const scanner = await getScanner(row.addr.network);
    if (!scanner) {
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

    // Deduplicate by (txHash, accountId) before counting/processing
    // Allows same txHash for different accounts (e.g. transfer between own wallets)
    const newEvents: RawBlockchainEvent[] = [];
    for (const evt of events) {
      const existingEntry = db.select({ id: operationEntries.id }).from(operationEntries)
        .innerJoin(operations, eq(operations.id, operationEntries.operationId))
        .where(and(
          eq(operations.txHash, evt.txHash),
          eq(operationEntries.accountId, row.account.id)
        ))
        .get();
      if (!existingEntry) newEvents.push(evt);
    }

    if (newEvents.length === 0) {
      console.log(`[scanner]     0 new (${events.length} known — skipped)`);
      continue;
    }

    console.log(`[scanner]     found ${newEvents.length} new transaction(s) (${events.length - newEvents.length} known — skipped)`);
    eventsFound += newEvents.length;

    for (const evt of newEvents) {
      await processEvent(evt, row.addr.address, row.addr.network, row.account.id, row.account.userId);
    }

    recalculateAllBalances();
    markDirty();

    const maxBlock = Math.max(...newEvents.map((e) => e.blockNumber || 0));
    if (maxBlock > (row.addr.lastSyncBlock ?? 0)) {
      const newLastSyncBlock = maxBlock + 1;
      console.log(`[scanner]     maxBlock: ${maxBlock} → newLastSyncBlock: ${newLastSyncBlock} (was: ${row.addr.lastSyncBlock})`);
      db.update(accountAddresses)
        .set({ lastSyncBlock: newLastSyncBlock })
        .where(eq(accountAddresses.id, row.addr.id))
        .run();
    } else {
      console.log(`[scanner]     all events within known range (maxBlock: ${maxBlock} ≤ lastSyncBlock: ${row.addr.lastSyncBlock})`);
    }
  }

  return { eventsFound, addressesScanned: allAddresses.length };
}

async function processEvent(
  evt: RawBlockchainEvent,
  ownAddress: string,
  network: string,
  accountId: number,
  userId: number
): Promise<void> {
  // Dedup by (txHash, accountId) — same txHash allowed for different accounts (own-wallet transfers)
  const existingOp = db.select({ opId: operations.id, status: operations.status }).from(operationEntries)
    .innerJoin(operations, eq(operations.id, operationEntries.operationId))
    .where(and(
      eq(operations.txHash, evt.txHash),
      eq(operationEntries.accountId, accountId)
    ))
    .get();
  if (existingOp) {
    if (existingOp.status === "draft") {
      db.update(operations).set({ status: "confirmed" })
        .where(eq(operations.id, existingOp.opId)).run();
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

  const ownAddr = ownAddress.toLowerCase();
  let isIncoming = evt.toAddress.toLowerCase() === ownAddr;
  let isOutgoing = evt.fromAddress.toLowerCase() === ownAddr;

  // TON Jetton: from/to are jetton wallet addresses, not user address
  // jettonWalletAddress is the user's jetton wallet for this token
  if (!isIncoming && !isOutgoing && evt.jettonWalletAddress) {
    const jAddr = evt.jettonWalletAddress.toLowerCase();
    // If user's jetton wallet is the source → outgoing, else incoming
    if (jAddr === evt.fromAddress.toLowerCase()) {
      isOutgoing = true;
    } else {
      isIncoming = true;
    }
  }

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

  // Attach network fee as a separate entry (outgoing only — user pays the fee)
  if (evt.fee && isOutgoing) {
    const feeAmount = parseFloat(evt.fee.amount) / Math.pow(10, evt.fee.decimals);
    if (feeAmount > 0) {
      db.insert(operationEntries).values({
        operationId: op.id,
        accountId,
        currency: evt.fee.currency || currency,
        amount: -feeAmount,
        type: "fee",
        isVerified: 0,
      }).run();
    }
  }
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

  const sourceTag = `balance_sync:${addressId}`;
  const corrections: { currency: string; delta: number; correctionAmount: number | null }[] = [];

  // Remove this address's previous tagged corrections
  const oldOps = db.select({ id: operations.id }).from(operations)
    .where(and(eq(operations.source, sourceTag), eq(operations.status, "confirmed"))).all();
  for (const oldOp of oldOps) {
    db.delete(operationEntries).where(eq(operationEntries.operationId, oldOp.id)).run();
    db.delete(operations).where(eq(operations.id, oldOp.id)).run();
  }

  const acc = db.select({ userId: accounts.userId }).from(accounts).where(eq(accounts.id, accountId)).get();
  const userId = acc?.userId ?? 0;

  for (const be of result.balances) {
    const currency = be.currency;
    const blockchainBalance = parseFloat(be.balance) / Math.pow(10, be.decimals);

    if (blockchainBalance <= 0.000001) {
      corrections.push({ currency, delta: 0, correctionAmount: null });
      continue;
    }

    const op = db.insert(operations).values({
      userId,
      description: `Balance sync (${currency})`,
      date: new Date().toISOString().split("T")[0],
      source: sourceTag,
      status: "confirmed",
    }).returning().get();

    db.insert(operationEntries).values({
      operationId: op.id,
      accountId,
      currency,
      amount: blockchainBalance,
      type: "principal",
      isVerified: 1,
    }).run();

    corrections.push({ currency, delta: blockchainBalance, correctionAmount: blockchainBalance });
  }

  markDirty();

  // Update lastSyncBlock to the fetched block, never rolling back
  const current = db.select({ lastSyncBlock: accountAddresses.lastSyncBlock })
    .from(accountAddresses)
    .where(eq(accountAddresses.id, addressId))
    .get();

  const newBlock = Math.max(current?.lastSyncBlock ?? 0, result.blockNumber || 0);
  db.update(accountAddresses)
    .set({ lastSyncBlock: newBlock })
    .where(eq(accountAddresses.id, addressId))
    .run();

  return corrections;
}


