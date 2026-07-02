import { db as globalDb } from "@/db";
import { transactions, matchedTransactions } from "@/db/schema";
import { eq, and, like } from "drizzle-orm";

const TIME_WINDOW_SECONDS = 300;
const AMOUNT_TOLERANCE = 0.01;

export function isAmountClose(aAmt: number, bAmt: number): boolean {
  if (aAmt === 0 || bAmt === 0) return false;
  const diff = Math.abs(aAmt - bAmt);
  return diff / Math.max(aAmt, bAmt) <= AMOUNT_TOLERANCE;
}

export function isTimeClose(aTs: number, bTs: number): boolean {
  return Math.abs(aTs - bTs) <= TIME_WINDOW_SECONDS;
}

export function createMatch(
  a: typeof transactions.$inferSelect,
  b: typeof transactions.$inferSelect,
  matchType: string,
  db = globalDb
): void {
  const existing = db.select().from(matchedTransactions)
    .where(
      and(
        eq(matchedTransactions.transactionAId, a.id),
        eq(matchedTransactions.transactionBId, b.id)
      )
    )
    .get();

  if (existing) return;

  const reversed = db.select().from(matchedTransactions)
    .where(
      and(
        eq(matchedTransactions.transactionAId, b.id),
        eq(matchedTransactions.transactionBId, a.id)
      )
    )
    .get();

  if (reversed) return;

  db.insert(matchedTransactions).values({
    transactionAId: a.id,
    transactionBId: b.id,
    matchType,
    status: "suggested",
  }).run();

  db.update(transactions)
    .set({ status: "matched_candidate" })
    .where(eq(transactions.id, a.id))
    .run();

  db.update(transactions)
    .set({ status: "matched_candidate" })
    .where(eq(transactions.id, b.id))
    .run();
}

export function confirmMatch(matchId: number, db = globalDb): void {
  const match = db.select().from(matchedTransactions)
    .where(eq(matchedTransactions.id, matchId))
    .get();

  if (!match) return;

  const txA = db.select().from(transactions)
    .where(eq(transactions.id, match.transactionAId))
    .get();

  const txB = db.select().from(transactions)
    .where(eq(transactions.id, match.transactionBId))
    .get();

  if (!txA || !txB) return;

  db.update(matchedTransactions)
    .set({ status: "confirmed" })
    .where(eq(matchedTransactions.id, matchId))
    .run();

  db.update(transactions)
    .set({ status: "confirmed" })
    .where(eq(transactions.id, txA.id))
    .run();

  db.update(transactions)
    .set({ status: "confirmed" })
    .where(eq(transactions.id, txB.id))
    .run();

  if (match.matchType === "auto_suggested") {
    db.update(transactions)
      .set({ counterpartyAccountId: txB.accountId })
      .where(eq(transactions.id, txA.id))
      .run();

    db.update(transactions)
      .set({ counterpartyAccountId: txA.accountId })
      .where(eq(transactions.id, txB.id))
      .run();
  }
}

export function rejectMatch(matchId: number, db = globalDb): void {
  const match = db.select().from(matchedTransactions)
    .where(eq(matchedTransactions.id, matchId))
    .get();

  if (!match) return;

  db.update(matchedTransactions)
    .set({ status: "rejected" })
    .where(eq(matchedTransactions.id, matchId))
    .run();

  const remainingA = db.select().from(matchedTransactions)
    .where(
      and(
        eq(matchedTransactions.transactionAId, match.transactionAId),
        eq(matchedTransactions.status, "suggested")
      )
    )
    .all();

  if (remainingA.length === 0) {
    db.update(transactions)
      .set({ status: "confirmed" })
      .where(eq(transactions.id, match.transactionAId))
      .run();
  }

  const remainingB = db.select().from(matchedTransactions)
    .where(
      and(
        eq(matchedTransactions.transactionBId, match.transactionBId),
        eq(matchedTransactions.status, "suggested")
      )
    )
    .all();

  if (remainingB.length === 0) {
    db.update(transactions)
      .set({ status: "confirmed" })
      .where(eq(transactions.id, match.transactionBId))
      .run();
  }
}

export async function runMatcher(db = globalDb): Promise<void> {
  const scannerTxs = db.select().from(transactions)
    .where(
      and(
        like(transactions.source, "scanner_%"),
        eq(transactions.status, "confirmed")
      )
    )
    .all();

  const pending = db.select().from(transactions)
    .where(
      and(
        like(transactions.source, "scanner_%"),
        eq(transactions.status, "matched_candidate")
      )
    )
    .all();

  const allScannerTxs = [...scannerTxs, ...pending];

  for (let i = 0; i < allScannerTxs.length; i++) {
    const a = allScannerTxs[i];

    for (let j = i + 1; j < allScannerTxs.length; j++) {
      const b = allScannerTxs[j];

      if (!a.fromAddress || !a.toAddress || !b.fromAddress || !b.toAddress) continue;
      if (!a.blockTimestamp || !b.blockTimestamp) continue;

      const sameSender = a.fromAddress === b.fromAddress;
      const sameReceiver = a.toAddress === b.toAddress;

      if (
        sameSender && sameReceiver &&
        a.currency === b.currency &&
        isAmountClose(a.amount, b.amount) &&
        isTimeClose(a.blockTimestamp, b.blockTimestamp)
      ) {
        createMatch(a, b, "auto_suggested", db);
      }

      if (
        a.toAddress === b.fromAddress && a.fromAddress === b.toAddress &&
        isTimeClose(a.blockTimestamp, b.blockTimestamp)
      ) {
        createMatch(a, b, "exchange_pair", db);
      }
    }
  }
}
