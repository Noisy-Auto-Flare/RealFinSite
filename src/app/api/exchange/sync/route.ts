import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, apiCredentials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { getDecryptedCredentials as bybitCreds, syncAccount as bybitSync } from "@/lib/exchanges/bybit";
import { getDecryptedCredentials as okxCreds, syncAccount as okxSync } from "@/lib/exchanges/okx";
import { logAction } from "@/lib/action-log";

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

  const cred = db.select().from(apiCredentials)
    .where(eq(apiCredentials.accountId, accountId))
    .get() as { exchange: string } | undefined;

  if (!cred) {
    return NextResponse.json({ error: "No API credentials configured for this account" }, { status: 400 });
  }

  try {
    let result: { balances: number; transactions: number };

    if (cred.exchange === "bybit") {
      const c = bybitCreds(accountId);
      if (!c) throw new Error("Failed to decrypt credentials");
      result = await bybitSync(accountId, userId);
    } else if (cred.exchange === "okx") {
      const c = okxCreds(accountId);
      if (!c) throw new Error("Failed to decrypt credentials");
      if (!c.passphrase) throw new Error("OKX requires a passphrase");
      result = await okxSync(accountId, userId);
    } else {
      return NextResponse.json({ error: `Unsupported exchange: ${cred.exchange}` }, { status: 400 });
    }

    logAction({
      userId,
      username: "sync",
      action: "sync",
      entityType: "account",
      entityId: accountId,
      details: `${cred.exchange}: ${result.balances} balances, ${result.transactions} transactions`,
    });

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
