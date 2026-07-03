import crypto from "crypto";
import { db } from "@/db";
import { apiCredentials, operations, operationEntries, balances } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

const BASE_URL = "https://api.bybit.com";

interface BybitBalance {
  coin: string;
  walletBalance: string;
  totalEquity: string;
}

interface BybitTxLog {
  txId: string;
  type: string;
  coin: string;
  amount: string;
  fee: string;
  walletBalance: string;
  execTime: string;
  txStatus: string;
}

function signRequest(apiKey: string, secret: string, timestamp: string, body: string): string {
  const payload = `${timestamp}${apiKey}${5000}${body}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function bybitFetch<T>(
  apiKey: string,
  secret: string,
  method: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const timestamp = Date.now().toString();
  let queryString = "";
  let body = "";

  if (params && Object.keys(params).length > 0) {
    const sorted = Object.keys(params).sort();
    queryString = sorted.map((k) => `${k}=${params[k]}`).join("&");
    body = queryString;
  }

  const url = `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;
  const signature = signRequest(apiKey, secret, timestamp, body);

  const headers: Record<string, string> = {
    "X-BAPI-API-KEY": apiKey,
    "X-BAPI-TIMESTAMP": timestamp,
    "X-BAPI-SIGN": signature,
    "X-BAPI-RECV-WINDOW": "5000",
  };

  const res = await fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bybit API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.retCode !== 0) {
    throw new Error(`Bybit API error: ${data.retMsg} (code ${data.retCode})`);
  }

  return data.result as T;
}

interface WalletBalanceResult {
  list: {
    totalEquity: string;
    coin: { coin: string; walletBalance: string; equity: string }[];
  }[];
}

export async function fetchBalances(apiKey: string, secret: string): Promise<BybitBalance[]> {
  const result = await bybitFetch<WalletBalanceResult>(
    apiKey, secret, "GET",
    "/v5/account/wallet-balance",
    { accountType: "UNIFIED" }
  );
  const coins = result.list?.[0]?.coin || [];
  return coins.map((c) => ({
    coin: c.coin,
    walletBalance: c.walletBalance,
    totalEquity: c.equity,
  }));
}

interface TxLogResult {
  rows: BybitTxLog[];
}

export async function fetchTransactionLog(
  apiKey: string,
  secret: string,
  startTime?: number
): Promise<BybitTxLog[]> {
  const params: Record<string, string> = {};
  if (startTime) params.startTime = String(startTime);
  const result = await bybitFetch<TxLogResult>(
    apiKey, secret, "GET",
    "/v5/asset/transaction-log",
    Object.keys(params).length > 0 ? params : undefined
  );
  return result.rows || [];
}

interface CredentialRow {
  id: number;
  accountId: number;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  lastSyncAt: string | null;
}

function getCredentials(accountId: number): CredentialRow | null {
  const row = db.select().from(apiCredentials)
    .where(eq(apiCredentials.accountId, accountId))
    .get() as CredentialRow | null;
  return row;
}

export function getDecryptedCredentials(accountId: number): { apiKey: string; apiSecret: string } | null {
  const creds = getCredentials(accountId);
  if (!creds) return null;
  try {
    return {
      apiKey: creds.apiKey,
      apiSecret: decrypt(creds.apiSecret),
    };
  } catch {
    return null;
  }
}

export function getCredentialsMeta(accountId: number): { id: number; exchange: string; lastSyncAt: string | null } | null {
  const creds = getCredentials(accountId);
  if (!creds) return null;
  return { id: creds.id, exchange: creds.exchange, lastSyncAt: creds.lastSyncAt };
}

export async function syncAccount(accountId: number, userId: number): Promise<{ balances: number; operations: number }> {
  const creds = getDecryptedCredentials(accountId);
  if (!creds) throw new Error("No credentials found for this account");

  let balanceCount = 0;
  let opCount = 0;

  // 1. Sync balances
  const bybitBalances = await fetchBalances(creds.apiKey, creds.apiSecret);
  for (const b of bybitBalances) {
    const amount = parseFloat(b.walletBalance);
    if (amount <= 0) continue;

    const existing = db.select().from(balances)
      .where(and(eq(balances.accountId, accountId), eq(balances.currency, b.coin)))
      .get();

    if (existing) {
      db.update(balances)
        .set({ amount })
        .where(eq(balances.id, existing.id))
        .run();
    } else {
      db.insert(balances).values({ accountId, currency: b.coin, amount }).run();
    }
    balanceCount++;
  }

  // 2. Sync transaction log (last 7 days)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const logs = await fetchTransactionLog(creds.apiKey, creds.apiSecret, sevenDaysAgo);

  for (const log of logs) {
    const existing = db.select({ id: operations.id }).from(operations)
      .where(eq(operations.txHash, log.txId)).get();
    if (existing) continue;
    if (log.txStatus !== "Complete") continue;

    const rawAmount = parseFloat(log.amount);
    if (rawAmount <= 0) continue;

    const isDeposit = log.type === "DEPOSIT";
    const amount = isDeposit ? rawAmount : -rawAmount;

    const isFee = log.type === "COMMISSION" || log.type === "FUNDING_FEE";

    const op = db.insert(operations).values({
      userId,
      description: `Bybit ${log.type}`,
      date: new Date(parseInt(log.execTime)).toISOString().split("T")[0],
      source: "api_bybit",
      txHash: log.txId,
      status: "confirmed",
    }).returning().get();

    db.insert(operationEntries).values({
      operationId: op.id,
      accountId,
      currency: log.coin,
      amount,
      type: isFee ? "fee" : "principal",
      isVerified: 1,
    }).run();

    if (log.fee && parseFloat(log.fee) > 0) {
      db.insert(operationEntries).values({
        operationId: op.id,
        accountId,
        currency: log.coin,
        amount: -Math.abs(parseFloat(log.fee)),
        type: "fee",
        isVerified: 1,
      }).run();
    }

    opCount++;
  }

  // 3. Update last sync time
  db.update(apiCredentials)
    .set({ lastSyncAt: new Date().toISOString() })
    .where(eq(apiCredentials.accountId, accountId))
    .run();

  return { balances: balanceCount, operations: opCount };
}
