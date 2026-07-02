import { NextResponse } from "next/server";
import { db } from "@/db";
import { matchedTransactions, transactions, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { confirmMatch, rejectMatch } from "@/lib/scanners/matcher";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "suggested";

  const matches = db.select().from(matchedTransactions)
    .where(eq(matchedTransactions.status, status))
    .all();

  const enriched = matches.map((match) => {
    const txA = db.select().from(transactions).where(eq(transactions.id, match.transactionAId)).get();
    const txB = db.select().from(transactions).where(eq(transactions.id, match.transactionBId)).get();

    const txAAccount = txA ? db.select().from(accounts).where(eq(accounts.id, txA.accountId)).get() : null;
    const txBAccount = txB ? db.select().from(accounts).where(eq(accounts.id, txB.accountId)).get() : null;

    return {
      id: match.id,
      matchType: match.matchType,
      status: match.status,
      createdAt: match.createdAt,
      transactionA: txA ? { ...txA, accountName: txAAccount?.name || "Unknown" } : null,
      transactionB: txB ? { ...txB, accountName: txBAccount?.name || "Unknown" } : null,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { matchId, action } = body;

  if (!matchId || !action) {
    return NextResponse.json({ error: "matchId and action are required" }, { status: 400 });
  }

  const match = db.select().from(matchedTransactions).where(eq(matchedTransactions.id, matchId)).get();
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (action === "confirm") {
    confirmMatch(matchId);
  } else if (action === "reject") {
    rejectMatch(matchId);
  } else {
    return NextResponse.json({ error: "Action must be 'confirm' or 'reject'" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
