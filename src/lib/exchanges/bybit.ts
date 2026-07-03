import crypto from "crypto";
import { db } from "@/db";
import { apiCredentials, balances } from "@/db/schema";
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

const TX_TYPE_MAP: Record<string, string> = {
  DEPOSIT: "income",
  WITHDRAW: "expense",
  REALISED_PNL: "income",
  COMMISSION: "expense",
  FUNDING_FEE: "expense",
  TRANSFER_IN: "transfer",
  TRANSFER_OUT: "transfer",
  SWAP_IN: "exchange",
  SWAP_OUT: "exchange",
};

export function mapTxType(bybitType: string): string {
  return TX_TYPE_MAP[bybitType] || "income";
}

export async function syncAccount(accountId: number, userId: number): Promise<{ balances: number; transactions: number }> {
  const creds = getDecryptedCredentials(accountId);
  if (!creds) throw new Error("No credentials found for this account");

  let balanceCount = 0;
  let txCount = 0;

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
        .set({ amount, updatedAt: new Date().toISOString() })
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
    const existing = db.select().from(transactions)
      .where(eq(transactions.externalId, log.txId))
      .get();

    if (existing) continue;
    if (log.txStatus !== "Complete") continue;

    const txType = mapTxType(log.type);
    const amount = parseFloat(log.amount);
    if (amount <= 0) continue;

    db.insert(transactions).values({
      userId,
      accountId,
      type: txType,
      status: "confirmed",
      source: "api_bybit",
      amount,
      currency: log.coin,
      externalId: log.txId,
      operationDate: new Date(parseInt(log.execTime)).toISOString(),
      description: `Bybit ${log.type}`,
    }).run();
    txCount++;
  }

  // 3. Update last sync time
  db.update(apiCredentials)
    .set({ lastSyncAt: new Date().toISOString() })
    .where(eq(apiCredentials.accountId, accountId))
    .run();

  return { balances: balanceCount, transactions: txCount };
}
