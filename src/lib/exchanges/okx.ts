import crypto from "crypto";
import { db } from "@/db";
import { apiCredentials, operations, operationEntries, balances } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

const BASE_URL = "https://www.okx.com";

interface OkxBalanceDetail {
  ccy: string;
  bal: string;
  eq: string;
}

type OkxBalanceResult = {
  details: OkxBalanceDetail[];
}[];

interface OkxDeposit {
  txId: string;
  ccy: string;
  amt: string;
  ts: string;
  state: string;
}

interface OkxWithdrawal {
  txId: string;
  ccy: string;
  amt: string;
  ts: string;
  state: string;
}

interface OkxBill {
  billId: string;
  ccy: string;
  bal: string;
  balChg: string;
  ts: string;
  type: string;
  subType: string;
}

function sign(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secret: string
): string {
  const payload = timestamp + method + requestPath + body;
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

async function okxFetch<T>(
  apiKey: string,
  secret: string,
  passphrase: string,
  method: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
  let queryString = "";
  let body = "";

  if (method === "GET" && params && Object.keys(params).length > 0) {
    queryString = "?" + Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  } else if (method === "POST" && params) {
    body = JSON.stringify(params);
  }

  const requestPath = endpoint + queryString;
  const signature = sign(timestamp, method, requestPath, body, secret);

  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
  };

  const url = `${BASE_URL}${requestPath}`;

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OKX API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.code !== "0") {
    throw new Error(`OKX API error: ${data.msg} (code ${data.code})`);
  }

  return data.data as T;
}

interface CredentialRow {
  id: number;
  accountId: number;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase: string | null;
  lastSyncAt: string | null;
}

function getCredentials(accountId: number): CredentialRow | null {
  const row = db.select().from(apiCredentials)
    .where(eq(apiCredentials.accountId, accountId))
    .get() as CredentialRow | null;
  return row;
}

export function getDecryptedCredentials(accountId: number): { apiKey: string; apiSecret: string; passphrase?: string } | null {
  const creds = getCredentials(accountId);
  if (!creds) return null;
  try {
    return {
      apiKey: creds.apiKey,
      apiSecret: decrypt(creds.apiSecret),
      passphrase: creds.passphrase ? decrypt(creds.passphrase) : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchBalances(apiKey: string, secret: string, passphrase: string) {
  const result = await okxFetch<OkxBalanceResult>(
    apiKey, secret, passphrase, "GET",
    "/api/v5/account/balance"
  );
  const details = result[0]?.details || [];
  return details.map((d) => ({
    coin: d.ccy,
    walletBalance: d.bal,
    totalEquity: d.eq,
  }));
}

export async function fetchDeposits(
  apiKey: string, secret: string, passphrase: string, startTime?: number
) {
  const params: Record<string, string> = {};
  if (startTime) params.before = String(Math.floor(startTime));
  try {
    const result = await okxFetch<OkxDeposit[]>(
      apiKey, secret, passphrase, "GET",
      "/api/v5/asset/deposit-history",
      Object.keys(params).length > 0 ? params : undefined
    );
    return result || [];
  } catch {
    return [];
  }
}

export async function fetchWithdrawals(
  apiKey: string, secret: string, passphrase: string, startTime?: number
) {
  const params: Record<string, string> = {};
  if (startTime) params.before = String(Math.floor(startTime));
  try {
    const result = await okxFetch<OkxWithdrawal[]>(
      apiKey, secret, passphrase, "GET",
      "/api/v5/asset/withdrawal-history",
      Object.keys(params).length > 0 ? params : undefined
    );
    return result || [];
  } catch {
    return [];
  }
}

export async function fetchBills(
  apiKey: string, secret: string, passphrase: string, startTime?: number
) {
  const params: Record<string, string> = { type: "2" };
  if (startTime) params.before = String(Math.floor(startTime));
  try {
    const result = await okxFetch<OkxBill[]>(
      apiKey, secret, passphrase, "GET",
      "/api/v5/account/bills",
      params
    );
    return result || [];
  } catch {
    return [];
  }
}

export async function syncAccount(accountId: number, userId: number): Promise<{ balances: number; operations: number }> {
  const creds = getDecryptedCredentials(accountId);
  if (!creds) throw new Error("No credentials found for this account");
  if (!creds.passphrase) throw new Error("OKX requires a passphrase");

  let balanceCount = 0;
  let opCount = 0;

  // 1. Sync balances
  const okxBalances = await fetchBalances(creds.apiKey, creds.apiSecret, creds.passphrase);
  for (const b of okxBalances) {
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

  // 2. Sync deposits + withdrawals
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const deposits = await fetchDeposits(creds.apiKey, creds.apiSecret, creds.passphrase, sevenDaysAgo);
  for (const d of deposits) {
    if (d.state !== "2") continue;
    const existing = db.select({ id: operations.id }).from(operations)
      .where(eq(operations.txHash, d.txId)).get();
    if (existing) continue;

    const amount = parseFloat(d.amt);
    if (amount <= 0) continue;

    const op = db.insert(operations).values({
      userId,
      description: "OKX Deposit",
      date: new Date(parseInt(d.ts)).toISOString().split("T")[0],
      source: "api_okx",
      txHash: d.txId,
      status: "confirmed",
    }).returning().get();

    db.insert(operationEntries).values({
      operationId: op.id,
      accountId,
      currency: d.ccy,
      amount: Math.abs(amount),
      type: "principal",
      isVerified: 1,
    }).run();

    opCount++;
  }

  const withdrawals = await fetchWithdrawals(creds.apiKey, creds.apiSecret, creds.passphrase, sevenDaysAgo);
  for (const w of withdrawals) {
    if (w.state !== "3") continue;
    const existing = db.select({ id: operations.id }).from(operations)
      .where(eq(operations.txHash, w.txId)).get();
    if (existing) continue;

    const amount = parseFloat(w.amt);
    if (amount <= 0) continue;

    const op = db.insert(operations).values({
      userId,
      description: "OKX Withdrawal",
      date: new Date(parseInt(w.ts)).toISOString().split("T")[0],
      source: "api_okx",
      txHash: w.txId,
      status: "confirmed",
    }).returning().get();

    db.insert(operationEntries).values({
      operationId: op.id,
      accountId,
      currency: w.ccy,
      amount: -Math.abs(amount),
      type: "principal",
      isVerified: 1,
    }).run();

    opCount++;
  }

  // 3. Update last sync time
  db.update(apiCredentials)
    .set({ lastSyncAt: new Date().toISOString() })
    .where(eq(apiCredentials.accountId, accountId))
    .run();

  return { balances: balanceCount, operations: opCount };
}
