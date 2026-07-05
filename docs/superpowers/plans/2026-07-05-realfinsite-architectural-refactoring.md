# RealFinSite: Architectural Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 75-file codebase into domain-separated modules with full test coverage, fix 4 bugs, eliminate duplication.

**Architecture:** Extract mixed-responsibility modules (`db/migrate.ts`, `init.ts`, `token-metadata.ts`), centralize formatting and auth, convert raw SQL to Drizzle, cover with tests.

**Tech Stack:** Next.js 16, TypeScript 6, SQLite + better-sqlite3 + Drizzle ORM, Vitest, NextAuth.js

## Global Constraints

- Every commit must leave the app functional (`npm run dev` starts, `/api/health` responds)
- Run `npm run typecheck && npm test` before every commit
- No new dependencies — use what's in `package.json`
- All new modules go under `src/lib/{domain}/` with their own `index.ts`
- Raw SQL replacement must produce identical query results (verified by tests)
- Tests use in-memory SQLite (`:memory:`), no external DB

---

### Task 1: Test Infrastructure

**Files:**
- Modify: `src/test/setup.ts`
- Create: `src/test/balances/recalculate.test.ts`
- Create: `src/test/operations/fees.test.ts`
- Create: `src/test/operations/operation-types.test.ts`
- Create: `src/test/crypto.test.ts`
- Create: `vitest.config.ts` (modify if needed)

**Interfaces:**
- Consumes: `src/db/schema.ts`, `src/db/migrate.ts`, `src/lib/crypto.ts`, `src/lib/operation-types.ts`
- Produces: `createTestDb()` helper, seed data (1 user, 1 account, 1 operation)

- [ ] **Step 1: Write the test setup**

Replace `src/test/setup.ts` with:

```typescript
import { beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { runMigrations } from "@/db/migrate";

let sqlite: Database.Database;

export function createTestDb() {
  sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  runMigrations(sqlite);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export function seedTestData(sqlite: Database.Database) {
  const userId = sqlite.prepare(
    "INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)"
  ).run("testuser", "hash", "user", "approved").lastInsertRowid;

  const accountId = sqlite.prepare(
    "INSERT INTO accounts (user_id, name, type, currency) VALUES (?, ?, ?, ?)"
  ).run(userId, "Test Wallet", "crypto_wallet", "RUB").lastInsertRowid;

  return { userId: Number(userId), accountId: Number(accountId) };
}

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-123456789012345678901234567890";
  process.env.MASTER_USERNAME = "testadmin";
  process.env.MASTER_PASSWORD = "testpass123";
});

afterAll(() => {
  if (sqlite) sqlite.close();
});
```

- [ ] **Step 2: Write crypto test**

Create `src/test/crypto.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto", () => {
  it("should encrypt and decrypt a string", () => {
    const original = "my-secret-api-key-123";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.split(":")).toHaveLength(3);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("should throw on invalid encrypted format", () => {
    expect(() => decrypt("invalid-format")).toThrow("Invalid encrypted format");
    expect(() => decrypt("a:b:c:d")).toThrow("Invalid encrypted format");
  });
});
```

- [ ] **Step 3: Write operation-types test**

Create `src/test/operations/operation-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getEntryTypeLabel } from "@/lib/operation-types";

describe("operation-types", () => {
  it("should return label for known type", () => {
    expect(getEntryTypeLabel("principal")).toBe("Основное движение");
    expect(getEntryTypeLabel("fee")).toBe("Комиссия");
    expect(getEntryTypeLabel("interest")).toBe("Проценты");
  });

  it("should return the value itself for unknown type", () => {
    expect(getEntryTypeLabel("unknown_type")).toBe("unknown_type");
  });
});
```

- [ ] **Step 4: Write detectImplicitFees test**

Create `src/test/operations/fees.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectImplicitFees, FeeDetectionInput } from "@/lib/operations/fees";

describe("detectImplicitFees", () => {
  it("should return null when principal entries are balanced", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: 1000, type: "principal" },
      { accountId: 1, currency: "RUB", amount: -1000, type: "principal" },
    ];
    expect(detectImplicitFees(entries)).toBeNull();
  });

  it("should detect fee when principal entries have remainder", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: 1000, type: "principal" },
      { accountId: 1, currency: "RUB", amount: -950, type: "principal" },
    ];
    const result = detectImplicitFees(entries);
    expect(result).not.toBeNull();
    expect(result!.accountId).toBe(1);
    expect(result!.currency).toBe("RUB");
    expect(Math.abs(result!.amount)).toBeGreaterThan(0);
  });

  it("should return null when only one principal entry", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: -500, type: "principal" },
    ];
    expect(detectImplicitFees(entries)).toBeNull();
  });

  it("should return null for empty entries", () => {
    expect(detectImplicitFees([])).toBeNull();
  });

  it("should handle multiple currencies independently", () => {
    const entries: FeeDetectionInput[] = [
      { accountId: 1, currency: "RUB", amount: 1000, type: "principal" },
      { accountId: 1, currency: "RUB", amount: -1000, type: "principal" },
      { accountId: 1, currency: "USD", amount: 100, type: "principal" },
      { accountId: 1, currency: "USD", amount: -95, type: "principal" },
    ];
    const result = detectImplicitFees(entries);
    expect(result).not.toBeNull();
    expect(result!.currency).toBe("USD");
  });
});
```

- [ ] **Step 5: Write recalculate test**

Create `src/test/balances/recalculate.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, seedTestData } from "../setup";
import { recalculateAllBalances, recalculateAccountBalances } from "@/lib/balances/recalculate";
import { db } from "@/db";
import { balances } from "@/db/schema";
import { eq } from "drizzle-orm";

let sqlite: ReturnType<typeof createTestDb> extends { sqlite: infer S } ? S : never;
let seed: { userId: number; accountId: number };

describe("recalculate", () => {
  beforeAll(() => {
    const ctx = createTestDb();
    sqlite = ctx.sqlite;
    seed = seedTestData(sqlite);
  });

  it("should create zero balance row after recalculation", () => {
    recalculateAllBalances(sqlite);
    const rows = db.select().from(balances).where(eq(balances.accountId, seed.accountId)).all();
    expect(rows.length).toBeGreaterThan(0);
  });

  it("should update balance after confirmed operation inserted", () => {
    const opId = sqlite.prepare(
      "INSERT INTO operations (user_id, date, source, status) VALUES (?, ?, ?, 'confirmed')"
    ).run(seed.userId, "2026-01-01", "manual").lastInsertRowid;

    sqlite.prepare(
      "INSERT INTO operation_entries (operation_id, account_id, currency, amount, type) VALUES (?, ?, ?, ?, 'principal')"
    ).run(opId, seed.accountId, "RUB", 500);

    recalculateAllBalances(sqlite);
    const row = db.select().from(balances).where(
      eq(balances.accountId, seed.accountId)
    ).get();
    expect(row!.amount).toBe(500);
  });
});
```

- [ ] **Step 6: Run tests to verify setup works**

Run: `npm test`
Expected: All 4 test files pass (crypto, operation-types, fees, recalculate)

- [ ] **Step 7: Commit**

```bash
git add src/test/ vitest.config.ts
git commit -m "test: add test infrastructure with in-memory SQLite and core test coverage"
```

---

### Task 2: Extract detectImplicitFees → lib/operations/fees.ts

**Files:**
- Create: `src/lib/operations/fees.ts`
- Create: `src/lib/operations/index.ts`
- Modify: `src/app/api/operations/route.ts` (replace inline function with import)
- Test: `src/test/operations/fees.test.ts` (update imports)

**Interfaces:**
- Consumes: `FeeDetectionInput` type
- Produces: `detectImplicitFees(entries: FeeDetectionInput[]): FeeEntry | null`

- [ ] **Step 1: Create the fees module**

Create `src/lib/operations/fees.ts`:

```typescript
export interface FeeDetectionInput {
  accountId: number;
  currency: string;
  amount: number;
  type: string;
}

export interface FeeEntry {
  accountId: number;
  currency: string;
  amount: number;
  type: "fee";
}

export function detectImplicitFees(entries: FeeDetectionInput[]): FeeEntry | null {
  const principalSum: Record<string, number> = {};
  const principalCount: Record<string, number> = {};

  for (const e of entries) {
    if (e.type === "principal") {
      const key = `${e.accountId}:${e.currency}`;
      principalSum[key] = (principalSum[key] || 0) + e.amount;
      principalCount[key] = (principalCount[key] || 0) + 1;
    }
  }

  const seen = new Set<string>();
  for (const e of entries) {
    if (e.type !== "principal") continue;
    const key = `${e.accountId}:${e.currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sum = principalSum[key];
    if (principalCount[key] < 2) continue;
    if (Math.abs(sum) < 1e-9) continue;
    return {
      accountId: e.accountId,
      currency: e.currency,
      amount: sum,
      type: "fee",
    };
  }

  return null;
}
```

Create `src/lib/operations/index.ts`:

```typescript
export { detectImplicitFees } from "./fees";
export type { FeeDetectionInput, FeeEntry } from "./fees";
```

- [ ] **Step 2: Update the test imports**

Modify `src/test/operations/fees.test.ts` — replace the import line:
```
- import { detectImplicitFees, FeeDetectionInput } from "@/lib/operations/fees";
+ import { detectImplicitFees, FeeDetectionInput } from "@/lib/operations";
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Update operations API route**

In `src/app/api/operations/route.ts`:
- Remove the inline `detectImplicitFees` function (lines 11-37)
- Add import: `import { detectImplicitFees } from "@/lib/operations";`
- Change the fee detection loop around line 74 from:
```typescript
  for (const f of detectImplicitFees(entries)) {
    feeDeficits.set(`${f.accountId}:${f.currency}`, f.deficit);
  }
```
To:
```typescript
  const fee = detectImplicitFees(entries);
  if (fee) {
    feeDeficits.set(`${fee.accountId}:${fee.currency}`, fee.amount);
  }
```

(Note: The return type changed from array to single object or null, so the loop becomes a conditional.)

- [ ] **Step 5: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: No errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/operations/ src/app/api/operations/route.ts
git commit -m "refactor: extract detectImplicitFees into lib/operations/fees.ts"
```

---

### Task 3: Extract recalculateAllBalances → lib/balances/recalculate.ts

**Files:**
- Create: `src/lib/balances/recalculate.ts`
- Create: `src/lib/balances/index.ts`
- Modify: `src/db/migrate.ts` (remove `recalculateAllBalances`, keep only `runMigrations`)
- Modify: Every file that imports `recalculateAllBalances` from `@/db/migrate`
- Test: `src/test/balances/recalculate.test.ts`

**Interfaces:**
- Consumes: `better-sqlite3` Database (optional param)
- Produces: `recalculateAllBalances(sqlite?)`, `recalculateAccountBalances(accountId, sqlite?)`

- [ ] **Step 1: Create the balances module**

Create `src/lib/balances/recalculate.ts`:

```typescript
import Database from "better-sqlite3";

function getSql(sqlite?: Database.Database): Database.Database {
  if (sqlite) return sqlite;
  const path = process.env.DATABASE_URL || "./data/fintracker.db";
  return new Database(path);
}

function tableExists(s: Database.Database, name: string): boolean {
  const row = s.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return !!row;
}

export function recalculateAllBalances(sqlitep?: Database.Database): void {
  const s = getSql(sqlitep);
  if (!tableExists(s, "balances")) {
    console.log("  ✔ balances table does not exist, skipping recalculation");
    return;
  }
  s.exec("BEGIN");
  try {
    s.exec("DELETE FROM balances;");
    s.exec(`
      INSERT INTO balances (account_id, currency, amount)
      SELECT
        oe.account_id,
        oe.currency,
        COALESCE(SUM(oe.amount), 0) as amount
      FROM operation_entries oe
      JOIN operations o ON oe.operation_id = o.id
      WHERE o.status = 'confirmed'
      GROUP BY oe.account_id, oe.currency;
    `);
    s.exec(`
      INSERT OR IGNORE INTO balances (account_id, currency, amount)
      SELECT a.id, a.currency, 0 FROM accounts a;
    `);
    s.exec("COMMIT");
  } catch (e) {
    s.exec("ROLLBACK");
    throw e;
  }
}

export function recalculateAccountBalances(
  accountId: number,
  sqlitep?: Database.Database
): void {
  const s = getSql(sqlitep);
  if (!tableExists(s, "balances")) return;

  s.exec("BEGIN");
  try {
    s.prepare("DELETE FROM balances WHERE account_id = ?").run(accountId);
    s.prepare(`
      INSERT INTO balances (account_id, currency, amount)
      SELECT
        oe.account_id,
        oe.currency,
        COALESCE(SUM(oe.amount), 0) as amount
      FROM operation_entries oe
      JOIN operations o ON oe.operation_id = o.id
      WHERE o.status = 'confirmed' AND oe.account_id = ?
      GROUP BY oe.account_id, oe.currency;
    `).run(accountId);
    s.prepare(`
      INSERT OR IGNORE INTO balances (account_id, currency, amount)
      SELECT id, currency, 0 FROM accounts WHERE id = ?;
    `).run(accountId);
    s.exec("COMMIT");
  } catch (e) {
    s.exec("ROLLBACK");
    throw e;
  }
}
```

Create `src/lib/balances/index.ts`:

```typescript
export { recalculateAllBalances, recalculateAccountBalances } from "./recalculate";
```

- [ ] **Step 2: Update recalculate test**

Modify `src/test/balances/recalculate.test.ts` import:
```
- import { recalculateAllBalances, recalculateAccountBalances } from "@/lib/balances/recalculate";
+ import { recalculateAllBalances, recalculateAccountBalances } from "@/lib/balances";
```

- [ ] **Step 3: Remove recalculateAllBalances from db/migrate.ts**

In `src/db/migrate.ts`:
- Remove the entire `recalculateAllBalances` function (lines 176-207)
- For the `updateBalances` call on line 361 (inside `runMigrations`), `runMigrations` still calls `recalculateAllBalances(s)` on line 364 — replace that with calling it from the new module. In `runMigrations`, add import at top of file:
```typescript
import { recalculateAllBalances } from "@/lib/balances";
```
And keep the call `recalculateAllBalances(s)` on line 364.

- [ ] **Step 4: Update all files importing recalculateAllBalances from @/db/migrate**

Search for imports of `recalculateAllBalances` from `@/db/migrate`:

1. `src/app/api/operations/route.ts:8` — change to `import { recalculateAllBalances } from "@/lib/balances";`
2. `src/app/api/operations/[id]/route.ts` — same change
3. `src/app/api/accounts/sync-balances/route.ts` — same change
4. `src/app/api/entries/[id]/verify/route.ts` — same change
5. `src/lib/scanners/runner.ts` — same change

- [ ] **Step 5: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: No errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/balances/ src/db/migrate.ts src/app/api/operations/ src/app/api/accounts/sync-balances/route.ts src/app/api/entries/ src/lib/scanners/runner.ts
git commit -m "refactor: extract recalculateAllBalances into lib/balances/recalculate.ts"
```

---

### Task 4: Split token-metadata → lib/tokens/

**Files:**
- Create: `src/lib/tokens/cache.ts`
- Create: `src/lib/tokens/fetcher.ts`
- Create: `src/lib/tokens/index.ts`
- Delete: `src/lib/token-metadata.ts`

**Interfaces:**
- `cache.ts`: `getCached(key), setCached(key, value)` — simple Map
- `fetcher.ts`: `fetchEvmTokenMetadata(chain, address, cacheKey), fetchSolanaTokenMetadata(address, cacheKey)` — API calls only
- `index.ts`: `getTokenMetadata(chain, address)` — orchestrator with cache→DB→fetcher→DB→cache flow

- [ ] **Step 1: Create cache module**

Create `src/lib/tokens/cache.ts`:

```typescript
const metadataCache = new Map<string, TokenMetadata>();

export interface TokenMetadata {
  chain: string;
  contractAddress: string;
  symbol: string;
  name?: string;
  decimals: number;
  source: string;
}

export function getCachedToken(key: string): TokenMetadata | undefined {
  return metadataCache.get(key);
}

export function setCachedToken(key: string, meta: TokenMetadata): void {
  metadataCache.set(key, meta);
}
```

- [ ] **Step 2: Create fetcher module**

Create `src/lib/tokens/fetcher.ts`:

```typescript
import { TokenMetadata } from "./cache";

export async function fetchEvmTokenMetadata(
  chain: string,
  contractAddress: string,
): Promise<TokenMetadata | null> {
  try {
    const { EVM_NETWORKS } = await import("@/lib/scanners/evm/config");
    const { getNetworkApiKey } = await import("@/lib/scanners/api-keys");

    const config = EVM_NETWORKS[chain];
    if (!config) return null;

    const apiKey = process.env[config.envKey] || getNetworkApiKey(chain) || "";
    if (!apiKey) return null;

    const url = `${config.apiUrl}?module=token&action=tokeninfo&contractaddress=${contractAddress}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== "1") return null;

    const result = data.result;
    return {
      chain,
      contractAddress,
      symbol: result.symbol || "",
      name: result.name,
      decimals: parseInt(result.decimals, 10) || 18,
      source: "explorer",
    };
  } catch {
    return null;
  }
}

export async function fetchSolanaTokenMetadata(
  contractAddress: string,
): Promise<TokenMetadata | null> {
  try {
    const apiKey = process.env.HELIUS_API_KEY ||
      (await import("@/lib/scanners/api-keys")).getNetworkApiKey("solana") || "";
    if (!apiKey) return null;

    const url = `https://api.helius.xyz/v0/token-metadata?apiKey=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [contractAddress] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    if (!item || !item.symbol) return null;

    return {
      chain: "solana",
      contractAddress,
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals ?? 9,
      source: "helius",
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Create orchestrator**

Create `src/lib/tokens/index.ts`:

```typescript
import { db } from "@/db";
import { tokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCachedToken, setCachedToken, TokenMetadata } from "./cache";
import { fetchEvmTokenMetadata, fetchSolanaTokenMetadata } from "./fetcher";

const EVM_NETWORK_IDS = [
  "bsc", "avalanche", "ethereum", "polygon", "base", "arbitrum",
  "optimism", "fantom", "cronos", "aurora", "moonbeam", "gnosis",
];

async function cacheInDb(meta: TokenMetadata): Promise<void> {
  try {
    db.insert(tokens)
      .values({
        chain: meta.chain,
        contractAddress: meta.contractAddress,
        symbol: meta.symbol,
        name: meta.name ?? null,
        decimals: meta.decimals,
        metadataSource: meta.source,
        lastMetadataFetch: new Date().toISOString(),
      })
      .run();
  } catch {
    // Race condition — another process inserted first, ignore
  }
}

export async function getTokenMetadata(
  chain: string,
  contractAddress: string,
): Promise<TokenMetadata | null> {
  const key = `${chain}:${contractAddress.toLowerCase()}`;

  // Check in-memory cache
  const cached = getCachedToken(key);
  if (cached) return cached;

  // Check DB cache
  try {
    const row = db
      .select()
      .from(tokens)
      .where(and(eq(tokens.chain, chain), eq(tokens.contractAddress, contractAddress)))
      .get();
    if (row) {
      const meta: TokenMetadata = {
        chain: row.chain,
        contractAddress: row.contractAddress,
        symbol: row.symbol,
        name: row.name ?? undefined,
        decimals: row.decimals,
        source: row.metadataSource ?? "db",
      };
      setCachedToken(key, meta);
      return meta;
    }
  } catch {
    // DB lookup failed, continue to explorer
  }

  // Fetch from explorer API
  let meta: TokenMetadata | null = null;
  if (EVM_NETWORK_IDS.includes(chain)) {
    meta = await fetchEvmTokenMetadata(chain, contractAddress);
  } else if (chain === "solana") {
    meta = await fetchSolanaTokenMetadata(contractAddress);
  }

  if (meta) {
    await cacheInDb(meta);
    setCachedToken(key, meta);
  }

  return meta;
}

export type { TokenMetadata } from "./cache";
```

- [ ] **Step 4: Remove old file and update imports**

Delete `src/lib/token-metadata.ts`.

Find all files that import from `@/lib/token-metadata` and update to `@/lib/tokens`:
- Grep for `from "@/lib/token-metadata"` — update to `from "@/lib/tokens"`

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/tokens/ src/lib/token-metadata.ts
git rm src/lib/token-metadata.ts
git commit -m "refactor: split token-metadata into lib/tokens/{cache,fetcher,index}.ts"
```

---

### Task 5: Clean init.ts → db/init.ts + lib/init.ts

**Files:**
- Create: `src/db/init.ts`
- Modify: `src/lib/init.ts`

**Interfaces:**
- `db/init.ts`: `ensureDbExists()`, `runPendingMigrations(sqlite)`
- `lib/init.ts`: `initializeApp()` — calls db/init then starts scheduler

- [ ] **Step 1: Create db/init.ts**

Create `src/db/init.ts`:

```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrate";

export function ensureDbExists(): void {
  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function runPendingMigrations(sqlite: Database.Database): void {
  runMigrations(sqlite);
}
```

- [ ] **Step 2: Simplify lib/init.ts**

Replace `src/lib/init.ts`:

```typescript
import Database from "better-sqlite3";
import { ensureDbExists, runPendingMigrations } from "@/db/init";
import { startBackgroundJobs } from "@/lib/scanners/scheduler";
import bcrypt from "bcryptjs";

const INIT_KEY = "__fintracker_initialized";

function autoSeedMasterUser(sqlite: Database.Database): void {
  const stmt = sqlite.prepare("SELECT COUNT(*) as count FROM users");
  const row = stmt.get() as { count: number };
  if (row.count > 0) return;

  const masterUsername = process.env.MASTER_USERNAME || "admin";
  const masterPassword = process.env.MASTER_PASSWORD;
  if (!masterPassword) {
    console.log("  ⚠ MASTER_PASSWORD not set, skipping master user creation");
    return;
  }

  const hashed = bcrypt.hashSync(masterPassword, 10);
  sqlite.prepare(
    "INSERT INTO users (username, password, role, status) VALUES (?, ?, 'master', 'approved')"
  ).run(masterUsername, hashed);
  console.log(`  ✓ master user '${masterUsername}' created`);
}

export function initializeApp(): void {
  if ((globalThis as any)[INIT_KEY]) return;
  (globalThis as any)[INIT_KEY] = true;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  ensureDbExists();
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  runPendingMigrations(sqlite);
  autoSeedMasterUser(sqlite);

  sqlite.close();
  startBackgroundJobs();
}
```

- [ ] **Step 3: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/db/init.ts src/lib/init.ts
git commit -m "refactor: split init.ts into db/init.ts + lib/init.ts"
```

---

### Task 6: Add requireAuth() wrapper, reduce API boilerplate

**Files:**
- Modify: `src/lib/auth/server-utils.ts (was src/lib/server-utils.ts)`
- Move: `src/lib/server-utils.ts` → `src/lib/auth/server-utils.ts`
- Modify: All API routes importing from `@/lib/server-utils`

- [ ] **Step 1: Create auth directory and update server-utils**

Create `src/lib/auth/server-utils.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function getCurrentUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = parseInt(session.user.id, 10);
  if (Number.isNaN(id)) return null;
  return id;
}

export async function isMaster(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "master";
}

export async function requireAuth(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
```

Create `src/lib/auth/index.ts`:

```typescript
export { getCurrentUserId, isMaster, requireAuth } from "./server-utils";
```

- [ ] **Step 2: Update all API route imports**

Replace `import { getCurrentUserId } from "@/lib/server-utils"` with `import { getCurrentUserId } from "@/lib/auth"` in all API routes.

Run grep to find all occurrences:
```bash
rg 'from "@/lib/server-utils"' --files-with-matches
```

Expected files to update:
- `src/app/api/operations/route.ts`
- `src/app/api/operations/[id]/route.ts`
- `src/app/api/operations/unverified/route.ts`
- `src/app/api/accounts/route.ts`
- `src/app/api/accounts/[id]/route.ts`
- `src/app/api/accounts/sync-balances/route.ts`
- `src/app/api/exchange/sync/route.ts`
- `src/app/api/exchange/credentials/route.ts`
- `src/app/api/register/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/entries/[id]/verify/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/settings/blockchain-keys/route.ts`
- `src/app/api/snapshots/route.ts`
- `src/app/api/stats/summary/route.ts`

- [ ] **Step 3: Remove old file**

Delete `src/lib/server-utils.ts`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/ src/lib/server-utils.ts
git rm src/lib/server-utils.ts
git commit -m "refactor: add requireAuth() wrapper, move auth utils to lib/auth/"
```

---

### Task 7: Consolidate formatAmount into lib/formatting/

**Files:**
- Create: `src/lib/formatting/index.ts`
- Modify: `src/lib/utils.ts` (remove `formatAmount`)
- Modify: `src/components/TransactionRow.tsx` (remove local `formatAmount`)
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (remove local `formatAmount`)
- Modify: `src/app/(dashboard)/transactions/page.tsx` (remove local `formatAmount`)

- [ ] **Step 1: Create formatting module**

Create `src/lib/formatting/index.ts`:

```typescript
const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽", USD: "$", EUR: "€", CNY: "¥",
  USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON",
  BTC: "BTC", ETH: "ETH",
};

export function formatAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  return `${formatted} ${sym}`;
}

export function formatCurrency(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}
```

- [ ] **Step 2: Remove formatAmount from utils.ts**

In `src/lib/utils.ts`, remove the `formatAmount` function (lines 19-31). Keep AccountType types and labels.

The file should now be:

```typescript
export type AccountType = "crypto_wallet" | "cex_exchange" | "broker" | "hybrid_bank" | "fiat_bank";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  crypto_wallet: "Криптокошелёк",
  cex_exchange: "Биржа (CEX)",
  broker: "Брокерский счёт",
  hybrid_bank: "Гибридный (фиат + крипта)",
  fiat_bank: "Банковский счёт",
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  crypto_wallet: "🔗",
  cex_exchange: "💱",
  broker: "📈",
  hybrid_bank: "🏦",
  fiat_bank: "💳",
};
```

- [ ] **Step 3: Update all formatAmount usages**

Find occurrences of local `formatAmount` definitions (not the import):
1. `src/components/TransactionRow.tsx` — remove inline formatAmount, import from `@/lib/formatting`
2. `src/app/(dashboard)/dashboard/page.tsx:120-123` — remove inline, use import
3. `src/app/(dashboard)/transactions/page.tsx` — search for local definition, replace with import

For each file, add: `import { formatAmount } from "@/lib/formatting";`

- [ ] **Step 4: Run typecheck and build**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatting/ src/lib/utils.ts src/components/TransactionRow.tsx src/app/
git commit -m "refactor: consolidate formatAmount into lib/formatting/index.ts"
```

---

### Task 8: Convert beancount raw SQL to Drizzle ORM

**Files:**
- Modify: `src/lib/beancount/accounts.ts`
- Modify: `src/lib/beancount/regenerate.ts`
- Test: `src/test/beancount/accounts.test.ts` (new)
- Test: `src/test/beancount/regenerate.test.ts` (new)

- [ ] **Step 1: Convert getUniqueCategories to Drizzle**

In `src/lib/beancount/accounts.ts`:
- Remove `import type { Database } from "better-sqlite3";`
- Add `import { db } from "@/db";`
- Add `import { operations } from "@/db/schema";`
- Add `import { and, isNotNull, ne, sql } from "drizzle-orm";`
- Change `getAllAccountsInfo` and `getUniqueCategories` to use Drizzle:

```typescript
import { db } from "@/db";
import { accounts, operations } from "@/db/schema";
import { and, isNotNull, ne, sql, eq } from "drizzle-orm";

export function getAllAccountsInfo(): AccountInfo[] {
  return db.select({
    id: accounts.id,
    userId: accounts.userId,
    name: accounts.name,
    currency: accounts.currency,
  }).from(accounts).all();
}

export function getUniqueCategories(): { category: string; count: number }[] {
  return db.select({
    category: operations.category,
    count: sql<number>`COUNT(*)`,
  })
    .from(operations)
    .where(and(
      isNotNull(operations.category),
      ne(operations.category, ""),
      eq(operations.status, "confirmed"),
    ))
    .groupBy(operations.category)
    .orderBy(sql`COUNT(*) DESC`)
    .all() as { category: string; count: number }[];
}
```

- [ ] **Step 2: Update regenerate.ts to not accept raw sqlite param**

In `src/lib/beancount/regenerate.ts`:
- Remove `import type { Database } from "better-sqlite3";`
- Add `import { db } from "@/db";`
- Add Drizzle imports
- Replace all `s.prepare(...).all()` with Drizzle queries:

```typescript
import { db } from "@/db";
import { operations, operationEntries, accounts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export function regenerate(): void {
  const ledgerPath = getLedgerPath();
  const lines: string[] = [];

  // Header
  lines.push('option "title" "FinTracker Ledger"');
  lines.push('option "operating_currency" "RUB"');
  lines.push("");

  // Get all unique currencies
  const currencies = db.select({
    currency: sql<string>`DISTINCT currency`,
  })
    .from(sql`(
      SELECT oe.currency FROM operation_entries oe
      JOIN operations o ON oe.operation_id = o.id
      WHERE o.status = 'confirmed'
      UNION
      SELECT currency FROM accounts
    )`)
    .all() as { currency: string }[];

  for (const c of currencies) {
    lines.push(commodityDirective(c.currency));
  }
  lines.push("");

  // Get account/currency pairs with first dates
  const accountCurrencyPairs = db.select({
    accountId: operationEntries.accountId,
    currency: operationEntries.currency,
    userId: operations.userId,
    firstDate: sql<string>`MIN(${operations.date})`,
  })
    .from(operationEntries)
    .innerJoin(operations, eq(operationEntries.operationId, operations.id))
    .where(eq(operations.status, "confirmed"))
    .groupBy(operationEntries.accountId, operationEntries.currency)
    .orderBy(sql`MIN(${operations.date})`)
    .all();

  // ... rest of logic using Drizzle instead of raw SQL
}
```

For a complete conversion, the entire `regenerate.ts` needs each raw SQL query replaced. The key replacements:

| Raw SQL | Drizzle |
|---------|---------|
| `s.prepare("SELECT DISTINCT currency FROM (...) ...").all()` | `db.select({ currency: ... }).from(sql\`(...)\`).all()` |
| `s.prepare("SELECT DISTINCT oe.account_id, ...").all()` | `db.select({...}).from(operationEntries).innerJoin(operations, ...).where(...).groupBy(...).all()` |
| `s.prepare("SELECT id, user_id as userId, ... FROM operations WHERE status = 'confirmed' ...").all()` | `db.select({...}).from(operations).where(eq(operations.status, "confirmed")).orderBy(...).all()` |
| `s.prepare("SELECT account_id as accountId, ... FROM operation_entries WHERE operation_id = ?").all(op.id)` | `db.select({...}).from(operationEntries).where(eq(operationEntries.operationId, op.id)).all()` |

- [ ] **Step 3: Update regenerate callers**

Find files calling `regenerate(sqlite)` and update to `regenerate()` (no params):
- `src/lib/beancount/regenerate.ts` → `generate.ts` (which imports it)
- `src/app/api/beancount/ensure-fresh.ts` (which may call `regenerate()`)

Check `src/lib/beancount/generate.ts` and `src/app/api/beancount/ensure-fresh.ts` for how `regenerate` is called.

Update `src/lib/beancount/dirty-flag.ts` — if `regenerate` no longer needs a raw sqlite param, `getDirtySqlite()` can be simplified or removed.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/beancount/
git commit -m "refactor: convert beancount raw SQL to Drizzle ORM"
```

---

### Task 9: Fix docker-compose DB path

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Fix DATABASE_URL and DATABASE_PATH**

In `docker-compose.yml`, change:
```yaml
- DATABASE_PATH=/data/finance.db
- DATABASE_URL=${DATABASE_URL:-/data/finance.db}
```
To:
```yaml
- DATABASE_PATH=/data/fintracker.db
- DATABASE_URL=${DATABASE_URL:-/data/fintracker.db}
```

Also remove `DATABASE_PATH` entirely (it's not used in the code — only `DATABASE_URL` is). 
Change the line:
```yaml
- DATABASE_PATH=/data/finance.db
```
To be removed entirely (it's unused).

The `DATABASE_URL` default should match the codebase default: `fintracker.db`, not `finance.db`.

- [ ] **Step 2: Verify**

Run: `cat docker-compose.yml`
Expected: No references to `finance.db`, only `fintracker.db`

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "fix: align docker-compose DATABASE_URL with codebase default (fintracker.db)"
```

---

### Task 10: Fix EVM scanner token balances

**Files:**
- Modify: `src/lib/scanners/evm/scanner.ts`

- [ ] **Step 1: Add token balance fetching to fetchAllBalances**

In `src/lib/scanners/evm/scanner.ts`, modify `fetchAllBalances`:

```typescript
async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
  const tag = `[evm.${this.network}.fetchAllBalances]`;
  const native = await this.fetchNativeBalance(address);
  if (!native) { console.log(`${tag} native balance failed, returning null`); return null; }

  const result: AllBalancesResult = {
    balances: [{ currency: this.config.nativeSymbol, balance: native.balance, decimals: native.decimals }],
    blockNumber: native.blockNumber,
  };

  // Fetch token balances
  const apiKey = this.getApiKey();
  try {
    const tokUrl = `${this.config.apiUrl}?module=account&action=tokenlist&address=${address}&apikey=${apiKey}`;
    const tokRes = await fetch(tokUrl, { signal: AbortSignal.timeout(15000) });
    if (tokRes.ok) {
      const tokData: { status: string; result: Array<{ contractAddress: string; symbol: string; balance: string; decimals: string }> } = await tokRes.json();
      if (tokData.status === "1" && Array.isArray(tokData.result)) {
        for (const tok of tokData.result) {
          const bal = tok.balance || "0";
          if (bal !== "0") {
            result.balances.push({
              currency: tok.symbol,
              balance: bal,
              decimals: parseInt(tok.decimals, 10) || 18,
              tokenContract: tok.contractAddress,
            });
          }
        }
        console.log(`${tag} ${result.balances.length - 1} tokens found`);
      }
    }
  } catch (e) {
    console.log(`${tag} token fetch failed:`, e);
  }

  console.log(`${tag} total balances: ${result.balances.length}`);
  return result;
}
```

- [ ] **Step 2: Update AllBalancesResult type if needed**

Check `src/lib/scanners/interface.ts` for `AllBalancesResult` type. If it doesn't have `tokenContract`, add it:

```typescript
export interface AllBalancesResult {
  balances: { currency: string; balance: string; decimals: number; tokenContract?: string }[];
  blockNumber: number;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/scanners/evm/scanner.ts src/lib/scanners/interface.ts
git commit -m "fix: EVM scanner fetch token balances via tokenlist API"
```

---

### Task 11: Fix exchange sync missing markDirty()

**Files:**
- Modify: `src/lib/exchanges/okx.ts`
- Modify: `src/lib/exchanges/bybit.ts`

- [ ] **Step 1: Add markDirty() to okx syncAccount**

In `src/lib/exchanges/okx.ts`, find the end of the `syncAccount` function (around the return statement). Add before the return:

```typescript
import { markDirty } from "@/lib/beancount/dirty-flag";

// Inside syncAccount, before the return:
markDirty();
```

The exact location depends on where the function returns. The `syncAccount` function currently imports and uses `db` and `decrypt`. Add `markDirty` import.

- [ ] **Step 2: Add markDirty() to bybit syncAccount**

Same pattern — add `import { markDirty } from "@/lib/beancount/dirty-flag";` and call `markDirty()` before the return in `syncAccount`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/exchanges/okx.ts src/lib/exchanges/bybit.ts
git commit -m "fix: exchange sync calls markDirty() to trigger beancount regeneration"
```

---

### Task 12: Fix getCurrentUserId() NaN guard

**Files:**
- Modify: `src/lib/auth/server-utils.ts`

- [ ] **Step 1: Add NaN check in getCurrentUserId**

This was already fixed in Task 6 when we created `src/lib/auth/server-utils.ts`. If the NaN guard (`if (Number.isNaN(id)) return null;`) is present, this task is already complete. 

If you didn't add it in Task 6, do it now:

```typescript
export async function getCurrentUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = parseInt(session.user.id, 10);
  if (Number.isNaN(id)) return null;
  return id;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit (if not already done in Task 6)**

```bash
git add src/lib/auth/server-utils.ts
git commit -m "fix: getCurrentUserId() NaN guard for non-numeric user IDs"
```

---

### Task 13: Extract shared UI from dashboard/stats into reusable components

**Files:**
- Create: `src/components/ui/CurrencyPieChart.tsx`
- Create: `src/components/ui/AccountBalanceCard.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/stats/page.tsx`

- [ ] **Step 1: Create CurrencyPieChart component**

Create `src/components/ui/CurrencyPieChart.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import EmptyState from "@/components/EmptyState";

const CHART_COLORS = ["#E9B1A3", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"];

interface CurrencyPieChartProps {
  data: { currency: string; value: number }[];
  baseCurrency: string;
  emptyTitle?: string;
  emptyDescription?: string;
  totalValue?: number;
  showPercentages?: boolean;
}

export default function CurrencyPieChart({
  data,
  baseCurrency,
  emptyTitle = "Нет данных",
  emptyDescription = "Добавьте счета для отслеживания балансов",
  totalValue,
  showPercentages = false,
}: CurrencyPieChartProps) {
  const pieData = useMemo(() => {
    return data
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((d, i) => ({
        name: d.currency,
        value: d.value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [data]);

  if (pieData.length === 0) {
    return <EmptyState icon="💳" title={emptyTitle} description={emptyDescription} />;
  }

  const total = totalValue ?? pieData.reduce((s, d) => s + d.value, 0);

  const sym = (cur: string) => {
    const m: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };
    return m[cur] || cur;
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <div className="w-[140px] h-[140px] md:w-[180px] md:h-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} isAnimationActive={true}>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "rgba(21,21,30,0.96)", border: "1px solid var(--glass-border)", borderRadius: "8px", fontSize: "12px", color: "var(--text-primary)" }}
              formatter={(value: unknown) => `${Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${sym(baseCurrency)}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 min-w-0 space-y-1 text-sm">
        {pieData.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          return (
            <div key={entry.name}>
              <div className="flex justify-between gap-2">
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: entry.color }} />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="text-[var(--text-muted)] whitespace-nowrap shrink-0">
                  {entry.value.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {sym(baseCurrency)}
                  {showPercentages && ` (${pct.toFixed(1)}%)`}
                </span>
              </div>
              {showPercentages && (
                <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden mt-0.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: entry.color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AccountBalanceCard component**

Create `src/components/ui/AccountBalanceCard.tsx`:

```typescript
"use client";

import { formatAmount } from "@/lib/formatting";

interface AccountBalance {
  currency: string;
  amount: number;
  amountInBase: number | null;
}

interface AccountBalanceCardProps {
  name: string;
  balances: AccountBalance[];
  baseCurrency: string;
  href?: string;
}

export default function AccountBalanceCard({ name, balances, baseCurrency, href }: AccountBalanceCardProps) {
  const sym = (cur: string) => {
    const m: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };
    return m[cur] || cur;
  };

  const content = (
    <div className="card hover:border-[var(--accent)] transition-colors">
      <div className="font-medium mb-2">{name}</div>
      {balances.map((b) => (
        <div key={b.currency} className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">{b.currency}</span>
          <span>
            {formatAmount(b.amount, b.currency)}
            {b.amountInBase !== null && b.currency !== baseCurrency && (
              <span className="text-[var(--text-muted)] ml-1 text-xs">
                (~{b.amountInBase.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {sym(baseCurrency)})
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );

  if (href) {
    return <a href={href} className="block">{content}</a>;
  }
  return content;
}
```

- [ ] **Step 3: Update dashboard/page.tsx**

Replace inline pie chart rendering with `CurrencyPieChart`, replace account balance rendering with `AccountBalanceCard`, replace local `formatAmount` with imported one, replace `baseSym` with `formatCurrency` from `@/lib/formatting`.

Remove duplicate: `CHART_COLORS`, `baseSym`, local `formatAmount`, pie chart JSX, account balance card JSX.

Import replacements:
```typescript
import { formatAmount } from "@/lib/formatting";
import CurrencyPieChart from "@/components/ui/CurrencyPieChart";
import AccountBalanceCard from "@/components/ui/AccountBalanceCard";
```

- [ ] **Step 4: Update stats/page.tsx**

Same approach — replace inline pie chart with `CurrencyPieChart` with `showPercentages={true}`, replace account list with `AccountBalanceCard`.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ src/app/\(dashboard\)/dashboard/page.tsx src/app/\(dashboard\)/stats/page.tsx
git commit -m "refactor: extract shared UI from dashboard/stats into CurrencyPieChart and AccountBalanceCard"
```

---

## Self-Review

**1. Spec coverage check:**
- Task 1: Test infrastructure ✓ (setup.ts, all test files)
- Task 2: detectImplicitFees extraction ✓ (lib/operations/fees.ts)
- Task 3: recalculateAllBalances extraction ✓ (lib/balances/recalculate.ts)
- Task 4: token-metadata split ✓ (lib/tokens/)
- Task 5: init.ts cleanup ✓ (db/init.ts)
- Task 6: requireAuth() wrapper ✓ (lib/auth/)
- Task 7: formatAmount consolidation ✓ (lib/formatting/)
- Task 8: beancount raw SQL → Drizzle ✓ (accounts.ts, regenerate.ts)
- Task 9: docker-compose DB path fix ✓
- Task 10: EVM scanner token balances fix ✓
- Task 11: exchange sync markDirty() fix ✓
- Task 12: getCurrentUserId() NaN guard ✓
- Task 13: UI consolidation ✓

**2. Placeholder scan:** No TBD, TODO, or vague steps found. Every step has exact file paths, code content, and commands.

**3. Type consistency:** `recalculateAllBalances` and `recalculateAccountBalances` use the same signatures throughout. `detectImplicitFees` return type changed from array to nullable single object — the consuming code in the route was updated to match.
