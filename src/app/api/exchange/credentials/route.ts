import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, apiCredentials } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userAccounts = db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) return NextResponse.json([]);

  const creds = db.select({
    id: apiCredentials.id,
    accountId: apiCredentials.accountId,
    exchange: apiCredentials.exchange,
    lastSyncAt: apiCredentials.lastSyncAt,
  }).from(apiCredentials)
    .where(inArray(apiCredentials.accountId, accountIds))
    .all();

  return NextResponse.json(creds);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { accountId, exchange, apiKey, apiSecret } = body;

  if (!accountId || !exchange || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "accountId, exchange, apiKey, apiSecret are required" }, { status: 400 });
  }

  const account = db.select().from(accounts).where(
    and(eq(accounts.id, accountId), eq(accounts.userId, userId))
  ).get();

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const existing = db.select().from(apiCredentials).where(eq(apiCredentials.accountId, accountId)).get();
  if (existing) {
    return NextResponse.json({ error: "Credentials already exist for this account" }, { status: 409 });
  }

  const encryptedSecret = encrypt(apiSecret);

  const cred = db.insert(apiCredentials).values({
    accountId,
    exchange,
    apiKey,
    apiSecret: encryptedSecret,
  }).returning().get();

  return NextResponse.json({
    id: cred.id,
    accountId: cred.accountId,
    exchange: cred.exchange,
    lastSyncAt: cred.lastSyncAt,
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const cred = db.select().from(apiCredentials).where(eq(apiCredentials.id, id)).get();
  if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const account = db.select().from(accounts).where(
    and(eq(accounts.id, cred.accountId), eq(accounts.userId, userId))
  ).get();

  if (!account) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  db.delete(apiCredentials).where(eq(apiCredentials.id, id)).run();

  return NextResponse.json({ success: true });
}
