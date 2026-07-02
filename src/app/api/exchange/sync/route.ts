import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { getDecryptedCredentials, syncAccount } from "@/lib/exchanges/bybit";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { accountId } = body;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const account = db.select().from(accounts).where(
    and(eq(accounts.id, accountId), eq(accounts.userId, userId))
  ).get();

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const creds = getDecryptedCredentials(accountId);
  if (!creds) {
    return NextResponse.json({ error: "No API credentials configured for this account" }, { status: 400 });
  }

  try {
    const result = await syncAccount(accountId, userId);
    return NextResponse.json({
      success: true,
      balances: result.balances,
      transactions: result.transactions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
