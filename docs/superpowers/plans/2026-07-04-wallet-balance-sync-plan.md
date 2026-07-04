# Wallet Balance Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual "Sync balances" button that fetches current native token balances from blockchain APIs and creates correction operations for gaps.

**Architecture:** Each scanner gets a `fetchNativeBalance()` method. A sync endpoint iterates wallet addresses, computes gap vs blockchain balance, creates correction ops, and recalculates. A button on the accounts page triggers it.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, Better-SQLite3

## Global Constraints

- All blockchain API calls use `AbortSignal.timeout(15000)`
- BigInt values are serialized as strings to cross JSON boundaries
- On per-address error, log and continue to the next address (never fail the whole batch)
- `lastSyncBlock` is never rolled back: use `max(existing, fetched)` when updating

---

### Task 1: Add `fetchNativeBalance` to IScanner + EVM implementation

**Files:**
- Modify: `src/lib/scanners/interface.ts`
- Modify: `src/lib/scanners/evm.ts`

**Interfaces:**
- Consumes: `getNetworkApiKey(network)` from `./api-keys`
- Produces: `IScanner.fetchNativeBalance(address) → Promise<{ balance: string; decimals: number; blockNumber: number } | null>`

- [ ] **Step 1: Add `fetchNativeBalance` to IScanner**

Edit `src/lib/scanners/interface.ts` — add the method to the interface:

```typescript
export interface NativeBalanceResult {
  balance: string;
  decimals: number;
  blockNumber: number;
}

export interface IScanner {
  network: string;
  fetchNewTransactions(
    address: string,
    fromBlock: number
  ): Promise<RawBlockchainEvent[]>;
  fetchNativeBalance(address: string): Promise<NativeBalanceResult | null>;
}
```

- [ ] **Step 2: Implement `fetchNativeBalance` in EVM scanner**

Edit `src/lib/scanners/evm.ts` — add after the existing `fetchNewTransactions`:

```typescript
async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
  const cfg = API_URLS[this.network];
  if (!cfg) return null;

  const apiKey = process.env[cfg.keyEnv] || getNetworkApiKey(this.network);

  try {
    const balanceRes = await fetch(
      `${cfg.url}?module=account&action=balance&address=${address}&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!balanceRes.ok) return null;
    const balanceData: { status: string; result: string } = await balanceRes.json();
    if (balanceData.status !== "1") return null;

    const blockRes = await fetch(
      `${cfg.url}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!blockRes.ok) return null;
    const blockData: { result: string } = await blockRes.json();

    return {
      balance: balanceData.result,
      decimals: 18,
      blockNumber: parseInt(blockData.result, 16),
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Add `NativeBalanceResult` import**

Add to the import from `./interface`:
```typescript
import { IScanner, RawBlockchainEvent, NativeBalanceResult } from "./interface";
```

---

### Task 2: Solana `fetchNativeBalance` implementation

**Files:**
- Modify: `src/lib/scanners/solana.ts`

**Consumes:** `NativeBalanceResult` from `./interface`, `getNetworkApiKey`

- [ ] **Step 1: Add `fetchNativeBalance` method**

Add after `fetchNewTransactions`:

```typescript
async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
  const apiKey = process.env.HELIUS_API_KEY || getNetworkApiKey("solana");
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data: { result: { context: { slot: number }; value: number } } = await res.json();
    if (!data.result) return null;

    return {
      balance: String(data.result.value),
      decimals: 9,
      blockNumber: data.result.context.slot,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Update import**

```typescript
import { IScanner, RawBlockchainEvent, NativeBalanceResult } from "./interface";
```

---

### Task 3: TON `fetchNativeBalance` implementation

**Files:**
- Modify: `src/lib/scanners/ton.ts`

**Consumes:** `NativeBalanceResult` from `./interface`, `getNetworkApiKey`

- [ ] **Step 1: Add `fetchNativeBalance` method**

Add after `fetchNewTransactions`:

```typescript
async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
  const apiKey = process.env.TONCENTER_API_KEY || getNetworkApiKey("ton");
  const baseUrl = apiKey
    ? `https://toncenter.com/api/v2`
    : `https://testnet.toncenter.com/api/v2`;

  try {
    const url = `${baseUrl}/getAddressInformation?address=${address}${apiKey ? `&api_key=${apiKey}` : ""}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const data: { ok: boolean; result: { balance: string; block_id: { seqno: number }; last_transaction_id: { lt: string } } } = await res.json();
    if (!data.ok || !data.result) return null;

    return {
      balance: data.result.balance,
      decimals: 9,
      blockNumber: data.result.block_id.seqno,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Update import**

```typescript
import { IScanner, RawBlockchainEvent, NativeBalanceResult } from "./interface";
```

---

### Task 4: Sync helper and shared constants in runner

**Files:**
- Modify: `src/lib/scanners/runner.ts`
- Consumes: `NATIVE_CURRENCIES` mapping, `IScanner.fetchNativeBalance()`, `db`, `recalculateAllBalances()`

- [ ] **Step 1: Expand and export NATIVE_CURRENCIES**

Edit `src/lib/scanners/runner.ts`. Replace the existing `NATIVE_SYMBOLS` with an exported `NATIVE_CURRENCIES`:

Change:
```typescript
const NATIVE_SYMBOLS: Record<string, string> = {
  bsc: "BNB",
  avalanche: "AVAX",
  ethereum: "ETH",
};
```

To:
```typescript
export const NATIVE_CURRENCIES: Record<string, string> = {
  bsc: "BNB",
  avalanche: "AVAX",
  ethereum: "ETH",
  solana: "SOL",
  ton: "TON",
};
```

Update the reference in `processEvent` from `NATIVE_SYMBOLS[network]` to `NATIVE_CURRENCIES[network]`.

- [ ] **Step 2: Add `syncAddressBalance()` function**

Add at the end of `runner.ts` (before the closing):

```typescript
export async function syncAddressBalance(
  addressId: number,
  address: string,
  network: string,
  accountId: number
): Promise<{ delta: number; correctionAmount: number | null } | null> {
  const scanner = await getScanner(network);
  if (!scanner) return null;

  const nativeCurrency = NATIVE_CURRENCIES[network];
  if (!nativeCurrency) return null;

  const result = await scanner.fetchNativeBalance(address);
  if (!result) return null;

  const blockchainBalance = parseFloat(result.balance) / Math.pow(10, result.decimals);

  const existingOps = db.select({
    total: sql<string>`COALESCE(SUM(oe.amount), 0)`,
  })
    .from(operationEntries)
    .where(and(
      eq(operationEntries.accountId, accountId),
      eq(operationEntries.currency, nativeCurrency),
    ))
    .get();

  const existingSum = parseFloat(existingOps?.total || "0");
  const delta = blockchainBalance - existingSum;

  // Update lastSyncBlock to the fetched block, never rolling back
  const current = db.select({ lastSyncBlock: accountAddresses.lastSyncBlock })
    .from(accountAddresses)
    .where(eq(accountAddresses.id, addressId))
    .get();

  const newBlock = Math.max(current?.lastSyncBlock ?? 0, result.blockNumber);
  db.update(accountAddresses)
    .set({ lastSyncBlock: newBlock })
    .where(eq(accountAddresses.id, addressId))
    .run();

  if (Math.abs(delta) < 0.000001) {
    return { delta, correctionAmount: null };
  }

  const acc = db.select({ userId: accounts.userId }).from(accounts).where(eq(accounts.id, accountId)).get();
  const userId = acc?.userId ?? 0;

  const op = db.insert(operations).values({
    userId,
    description: `Balance sync (${nativeCurrency}) — correction ${delta >= 0 ? "+" : ""}${delta.toFixed(6)}`,
    date: new Date().toISOString().split("T")[0],
    source: "balance_correction",
    status: "confirmed",
  }).returning().get();

  db.insert(operationEntries).values({
    operationId: op.id,
    accountId,
    currency: nativeCurrency,
    amount: delta,
    type: "principal",
    isVerified: 1,
  }).run();

  return { delta, correctionAmount: delta };
}
```

Also add the required imports at the top:
```typescript
import { eq, and, sql } from "drizzle-orm";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors

---

### Task 5: API route `POST /api/accounts/sync-balances`

**Files:**
- Create: `src/app/api/accounts/sync-balances/route.ts`

**Consumes:** `syncAddressBalance()` from `runner.ts`, `getScanner()`, `db`, `recalculateAllBalances()`, `accountAddresses`, `accounts` from schema

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accountAddresses, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";
import { syncAddressBalance } from "@/lib/scanners/runner";
import { recalculateAllBalances } from "@/db/migrate";
import { getScanner } from "@/lib/scanners/interface";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = db.select({
    addr: accountAddresses,
    account: accounts,
  })
    .from(accountAddresses)
    .innerJoin(accounts, eq(accountAddresses.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .all();

  const results: {
    accountId: number;
    accountName: string;
    address: string;
    network: string;
    delta: number | null;
    correctionAmount: number | null;
  }[] = [];

  for (const row of rows) {
    const scanner = await getScanner(row.addr.network);
    if (!scanner) continue;

    const syncResult = await syncAddressBalance(
      row.addr.id,
      row.addr.address,
      row.addr.network,
      row.account.id
    );

    results.push({
      accountId: row.account.id,
      accountName: row.account.name,
      address: row.addr.address,
      network: row.addr.network,
      delta: syncResult?.delta ?? null,
      correctionAmount: syncResult?.correctionAmount ?? null,
    });
  }

  recalculateAllBalances();

  return NextResponse.json({ success: true, results });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors

---

### Task 6: Sync button on `/accounts` page

**Files:**
- Modify: `src/app/(dashboard)/accounts/page.tsx`

- [ ] **Step 1: Add the button and state**

Add state variables after the existing `loading` state:
```typescript
const [syncing, setSyncing] = useState(false);
const [syncMsg, setSyncMsg] = useState<string | null>(null);
```

Add a click handler before the return:
```typescript
async function handleSync() {
  setSyncing(true);
  setSyncMsg(null);
  try {
    const res = await fetch("/api/accounts/sync-balances", { method: "POST" });
    const data = await res.json();
    const corrections = data.results?.filter((r: any) => r.correctionAmount != null) || [];
    setSyncMsg(`Synced ${data.results?.length || 0} wallets, ${corrections.length} corrected`);
    // re-fetch accounts
    const accRes = await fetch("/api/accounts");
    const accData = await accRes.json();
    setAccounts(accData);
  } catch {
    setSyncMsg("Sync failed");
  } finally {
    setSyncing(false);
  }
}
```

Add the button next to the "+" link in the header div:
```typescript
<div className="flex justify-between items-center gap-2 flex-wrap">
  <h1 className="text-xl md:text-2xl font-bold truncate min-w-0">Счета</h1>
  <div className="flex items-center gap-2 shrink-0">
    <button
      onClick={handleSync}
      disabled={syncing}
      className="btn btn-ghost text-sm"
    >
      {syncing ? "Syncing..." : "Sync balances"}
    </button>
    <Link href="/accounts/new" className="btn btn-primary text-sm md:text-base shrink-0">
      + Добавить счёт
    </Link>
  </div>
</div>
```

Add the sync message display near the top of the page (after the header div):
```typescript
{syncMsg && (
  <div className="text-sm text-[var(--accent)]">{syncMsg}</div>
)}
```

- [ ] **Step 2: Build check**

Run: `npm run typecheck`
Expected: no errors
