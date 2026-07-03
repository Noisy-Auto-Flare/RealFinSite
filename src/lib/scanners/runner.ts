import { db } from "@/db";
import { accountAddresses, accounts, operations, operationEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getScanner, RawBlockchainEvent } from "./interface";

const NATIVE_SYMBOLS: Record<string, string> = {
  bsc: "BNB",
  avalanche: "AVAX",
  ethereum: "ETH",
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

  for (const row of allAddresses) {
    const scanner = await getScanner(row.addr.network);
    if (!scanner) continue;

    const events = await scanner.fetchNewTransactions(
      row.addr.address,
      row.addr.lastSyncBlock ?? 0
    );

    if (events.length === 0) continue;

    for (const evt of events) {
      await processEvent(evt, row.addr.address, row.addr.network, row.account.id, row.account.userId);
    }

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
  const existing = db.select({ id: operations.id }).from(operations)
    .where(eq(operations.txHash, evt.txHash)).get();
  if (existing) return;

  const nativeSymbol = NATIVE_SYMBOLS[network] || "ETH";
  const currency = evt.tokenSymbol || (evt.tokenContract ? "TOKEN" : nativeSymbol);
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
    status: "draft",
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


