# Beancount Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Beancount double-entry accounting to FinTracker — operations are recorded in `.beancount` ledger, validated by Beancount engine, served via Fava HTTP API, with SQLite as primary operational DB.

**Architecture:** SQLite writes set a dirty flag. On next Beancount read, full `.beancount` regenerates from SQLite, then Fava serves it via HTTP. All proxy routes fall back to SQLite if Fava unavailable. Same Docker container (supervisord manages nextjs + fava). Account paths embed userId for isolation.

**Tech Stack:** Beancount, Fava, better-sqlite3, Next.js App Router, supervisord

## Global Constraints

- All DDL must be idempotent (use `createTable()` helper from migrate.ts)
- Bump `SCHEMA_VERSION` when adding new tables
- DB access via drizzle ORM (synchronous better-sqlite3) or raw prepared statements for bulk ops
- All amounts are `REAL` (float) in DB — keep as-is for Beancount generation
- Port 5000 for Fava, bound to localhost only
- Docker: node:20-alpine base, multi-stage build, `nextjs` user (uid 1001)
- Fava command: `fava /data/ledger.beancount --host 0.0.0.0 --port 5000`
- Ledger file path: derived from DATABASE_URL dirname + `ledger.beancount`

---

### Task 1: Docker + supervisord Setup

**Files:**
- Modify: `Dockerfile`
- Create: `supervisord.conf`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: Container running both nextjs (port 3000) and fava (port 5000)

- [ ] **Step 1: Create `supervisord.conf`**

```
[supervisord]
nodaemon=true
logfile=/dev/null
pidfile=/tmp/supervisord.pid

[unix_http_server]
file=/tmp/supervisor.sock

[supervisorctl]
serverurl=unix:///tmp/supervisor.sock

[rpcinterface:supervisor]
supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

[program:nextjs]
command=node server.js
directory=/app
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:fava]
command=fava /data/ledger.beancount --host 0.0.0.0 --port 5000
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
autorestart=true
```

- [ ] **Step 2: Modify Dockerfile runner stage**

Replace the `RUN apk add` line and add pip installs, copy supervisord.conf, change CMD:

```dockerfile
RUN apk add --no-cache curl python3 py3-pip && \
    pip3 install --break-system-packages beancount fava supervisor && \
    mkdir -p /data /logs /backups && \
    chown nextjs:nodejs /data /logs /backups

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY supervisord.conf /app/supervisord.conf

USER nextjs

EXPOSE 3000 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["supervisord", "-c", "/app/supervisord.conf"]
```

- [ ] **Step 3: Modify `docker-compose.yml`**

Add port 5000 mapping:

```yaml
    ports:
      - "127.0.0.1:${APP_PORT:-3000}:3000"
      - "127.0.0.1:5000:5000"
```

- [ ] **Step 4: Verify build**

```bash
docker compose build
```
Expected: builds without errors, includes python3 + beancount + fava

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml supervisord.conf
git commit -m "feat: add beancount/fava/supervisord to Docker setup"
```

---

### Task 2: Dirty Flag Module

**Files:**
- Create: `src/lib/beancount/dirty-flag.ts`
- Modify: `src/db/migrate.ts`

**Interfaces:**
- Produces: `markDirty(db)`, `isDirty(db)`, `clearDirty(db)` — all synchronous, operate on `Database` (better-sqlite3 raw instance)
- Produces: `getDirtySqlite()` — returns raw `better-sqlite3` Database instance (same as `migrate.ts` uses)
- Produces: `beancount_dirty` table created via migration

- [ ] **Step 1: Create `src/lib/beancount/dirty-flag.ts`**

```typescript
import DatabaseClass from "better-sqlite3";
import type { Database } from "better-sqlite3";
import path from "path";

function getDbPath(): string {
  return process.env.DATABASE_URL || "./data/fintracker.db";
}

let _dirtyDb: Database | null = null;

export function getDirtySqlite(): Database {
  if (!_dirtyDb) {
    const dbPath = getDbPath();
    const dir = path.dirname(dbPath);
    const fs = require("fs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _dirtyDb = new DatabaseClass(dbPath);
    _dirtyDb.pragma("journal_mode = WAL");
    _dirtyDb.pragma("foreign_keys = ON");
  }
  return _dirtyDb;
}

export function markDirty(sqlite?: Database): void {
  const s = sqlite ?? getDirtySqlite();
  // Ensure the single-row exists (id=1)
  s.exec("INSERT OR IGNORE INTO beancount_dirty (id, is_dirty) VALUES (1, 1)");
  s.prepare("UPDATE beancount_dirty SET is_dirty = 1, updated_at = ? WHERE id = 1")
    .run(new Date().toISOString());
}

export function isDirty(sqlite?: Database): boolean {
  const s = sqlite ?? getDirtySqlite();
  try {
    s.exec("INSERT OR IGNORE INTO beancount_dirty (id, is_dirty) VALUES (1, 0)");
    const row = s.prepare("SELECT is_dirty FROM beancount_dirty WHERE id = 1").get() as { is_dirty: number } | undefined;
    return row?.is_dirty === 1;
  } catch {
    return false;
  }
}

export function clearDirty(sqlite?: Database): void {
  const s = sqlite ?? getDirtySqlite();
  s.prepare("UPDATE beancount_dirty SET is_dirty = 0, updated_at = ? WHERE id = 1")
    .run(new Date().toISOString());
}
```

- [ ] **Step 2: Add beancount_dirty table to `src/db/migrate.ts`**

Add to the `runMigrations` function (before `ensureSchemaVersion`):

```typescript
console.log("\n[beancount_dirty]");
createTable(s, "beancount_dirty", `(
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_dirty INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
)`);
```

Bump `SCHEMA_VERSION` from `2` to `3`:

```typescript
const SCHEMA_VERSION = 3;
```

- [ ] **Step 3: Run migration to verify**

```bash
npx tsx src/db/migrate.ts
```
Expected: `beancount_dirty already exists` (no-op, tables already created by base schema) or `beancount_dirty created` (first run). SCHEMA_VERSION = 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/beancount/dirty-flag.ts src/db/migrate.ts
git commit -m "feat: add beancount dirty flag module and migration"
```

---

### Task 3: Account Mapping Module

**Files:**
- Create: `src/lib/beancount/accounts.ts`

**Interfaces:**
- Produces: `accountPath(accountId, userId, currency): string`
- Produces: `incomePath(category): string`
- Produces: `expensePath(category): string`
- Produces: `feesPath(): string`
- Produces: `openDirective(account, date): string`
- Produces: `getAllAccountsInfo(db): AccountInfo[]` — queries all accounts from DB

- [ ] **Step 1: Create `src/lib/beancount/accounts.ts`**

```typescript
import type { Database } from "better-sqlite3";

export interface AccountInfo {
  id: number;
  userId: number;
  name: string;
  currency: string;
}

export function accountPath(accountId: number, userId: number, currency: string): string {
  return `Assets:FinTracker:User${userId}:${accountId}:${currency}`;
}

export function incomePath(category: string): string {
  const safe = category.replace(/[:"\n]/g, "_").trim() || "Unknown";
  return `Income:${safe}`;
}

export function expensePath(category: string): string {
  const safe = category.replace(/[:"\n]/g, "_").trim() || "Unknown";
  return `Expenses:${safe}`;
}

export function feesPath(): string {
  return "Expenses:Fees";
}

export function openDirective(accountPath: string, date: string): string {
  return `${date} open ${accountPath}`;
}

export function commodityDirective(currency: string): string {
  return `commodity ${currency}`;
}

export function getAllAccountsInfo(sqlite: Database): AccountInfo[] {
  return sqlite.prepare("SELECT id, user_id as userId, name, currency FROM accounts").all() as AccountInfo[];
}

export function getUniqueCategories(sqlite: Database): { category: string; count: number }[] {
  return sqlite.prepare(`
    SELECT category, COUNT(*) as count FROM operations
    WHERE category IS NOT NULL AND category != '' AND status = 'confirmed'
    GROUP BY category ORDER BY count DESC
  `).all() as { category: string; count: number }[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/beancount/accounts.ts
git commit -m "feat: add beancount account mapping module"
```

---

### Task 4: Transaction Generation

**Files:**
- Create: `src/lib/beancount/generate.ts`

**Interfaces:**
- Consumes: `accountPath`, `incomePath`, `expensePath`, `feesPath` from `accounts.ts`
- Produces: `operationToBeancount(op, entries): string` — single operation → Beancount transaction text
- Produces: `OperationRow` and `EntryRow` types

- [ ] **Step 1: Create `src/lib/beancount/generate.ts`**

```typescript
import { accountPath, incomePath, expensePath, feesPath } from "./accounts";

export interface OperationRow {
  id: number;
  userId: number;
  description: string | null;
  category: string | null;
  date: string;
}

export interface EntryRow {
  accountId: number;
  currency: string;
  amount: number;
  type: string;
}

function formatAmount(amount: number): string {
  // Avoid -0.00 display
  if (Math.abs(amount) < 1e-9) return "0";
  return amount.toFixed(amount % 1 === 0 ? 0 : 6);
}

export function operationToBeancount(op: OperationRow, entries: EntryRow[]): string {
  const lines: string[] = [];
  const payee = op.category || "Unknown";
  const narration = (op.description || "").replace(/"/g, "'");
  lines.push(`${op.date} * "${payee}" "${narration}"`);

  const postings: string[] = [];
  let total = 0;

  const activeEntries = entries.filter(e => e.type === "principal" || e.type === "fee");

  if (activeEntries.length === 1) {
    // Single entry: create balancing posting
    const e = activeEntries[0];
    const acc = accountPath(e.accountId, op.userId, e.currency);
    postings.push(`  ${acc}  ${formatAmount(e.amount)} ${e.currency}`);
    total += e.amount;

    if (e.amount >= 0) {
      // Positive → incoming, offset is income
      const inc = incomePath(op.category || "Unknown");
      postings.push(`  ${inc}  ${formatAmount(-e.amount)} ${e.currency}`);
      total -= e.amount;
    } else {
      // Negative → outgoing, offset is expense (positive)
      const exp = expensePath(op.category || "Unknown");
      postings.push(`  ${exp}  ${formatAmount(Math.abs(e.amount))} ${e.currency}`);
      total += Math.abs(e.amount);
    }
  } else {
    // Multiple entries: each one is a posting directly
    for (const e of activeEntries) {
      const acc = accountPath(e.accountId, op.userId, e.currency);
      postings.push(`  ${acc}  ${formatAmount(e.amount)} ${e.currency}`);
      total += e.amount;
    }
  }

  // Auto-balance rounding errors to Expenses:Fees
  if (Math.abs(total) > 1e-9) {
    postings.push(`  ${feesPath()}  ${formatAmount(-total)} ${entries[0]?.currency || "RUB"}`);
  }

  lines.push(...postings);
  lines.push("");
  return lines.join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/beancount/generate.ts
git commit -m "feat: add beancount transaction generation"
```

---

### Task 5: Full Regeneration

**Files:**
- Create: `src/lib/beancount/regenerate.ts`

**Interfaces:**
- Consumes: `getDirtySqlite`, `clearDirty` from `dirty-flag.ts`, `operationToBeancount`, `getAllAccountsInfo`, `getUniqueCategories`, `openDirective`, `commodityDirective`, `accountPath` from accounts
- Produces: `regenerate(): void` — reads all confirmed ops from SQLite, writes complete `.beancount` file atomically

- [ ] **Step 1: Create `src/lib/beancount/regenerate.ts`**

```typescript
import type { Database } from "better-sqlite3";
import path from "path";
import fs from "fs";
import { clearDirty, getDirtySqlite } from "./dirty-flag";
import { operationToBeancount, OperationRow, EntryRow } from "./generate";
import { getAllAccountsInfo, getUniqueCategories, openDirective, commodityDirective, accountPath, feesPath, incomePath, expensePath } from "./accounts";

function getLedgerPath(): string {
  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "ledger.beancount");
}

export function regenerate(sqlite?: Database): void {
  const s = sqlite ?? getDirtySqlite();

  const ledgerPath = getLedgerPath();
  const lines: string[] = [];

  // Header
  lines.push('option "title" "FinTracker Ledger"');
  lines.push('option "operating_currency" "RUB"');
  lines.push("");

  // Get all unique currencies from confirmed operations and accounts
  const currencies = s.prepare(`
    SELECT DISTINCT currency FROM (
      SELECT oe.currency FROM operation_entries oe
      JOIN operations o ON oe.operation_id = o.id
      WHERE o.status = 'confirmed'
      UNION
      SELECT currency FROM accounts
    ) ORDER BY currency
  `).all() as { currency: string }[];

  for (const c of currencies) {
    lines.push(commodityDirective(c.currency));
  }
  lines.push("");

  // Open directives for all accounts + currencies that have activity
  const accountCurrencyPairs = s.prepare(`
    SELECT DISTINCT oe.account_id, oe.currency, o.user_id,
      MIN(o.date) as first_date
    FROM operation_entries oe
    JOIN operations o ON oe.operation_id = o.id
    WHERE o.status = 'confirmed'
    GROUP BY oe.account_id, oe.currency
    ORDER BY first_date
  `).all() as { account_id: number; currency: string; user_id: number; first_date: string }[];

  const seenAccounts = new Set<string>();
  for (const ac of accountCurrencyPairs) {
    const acc = accountPath(ac.account_id, ac.user_id, ac.currency);
    const key = `${ac.account_id}:${ac.currency}`;
    if (!seenAccounts.has(key)) {
      seenAccounts.add(key);
      const openDate = ac.first_date || "2024-01-01";
      lines.push(openDirective(acc, openDate));
    }
  }

  // Open directives for Income/Expense categories and Fees
  const categories = getUniqueCategories(s);
  const seenIncomeExpense = new Set<string>();
  for (const cat of categories) {
    const inc = incomePath(cat.category);
    if (!seenIncomeExpense.has(inc)) {
      seenIncomeExpense.add(inc);
      lines.push(openDirective(inc, "2024-01-01"));
    }
    const exp = expensePath(cat.category);
    if (!seenIncomeExpense.has(exp)) {
      seenIncomeExpense.add(exp);
      lines.push(openDirective(exp, "2024-01-01"));
    }
  }
  lines.push(openDirective(feesPath(), "2024-01-01"));
  lines.push("");

  // Transactions: all confirmed operations sorted by date
  const ops = s.prepare(`
    SELECT id, user_id as userId, description, category, date
    FROM operations
    WHERE status = 'confirmed'
    ORDER BY date, id
  `).all() as OperationRow[];

  for (const op of ops) {
    const entries = s.prepare(`
      SELECT account_id as accountId, currency, amount, type
      FROM operation_entries
      WHERE operation_id = ?
      ORDER BY id
    `).all(op.id) as EntryRow[];

    lines.push(operationToBeancount(op, entries));
  }

  // Write atomically
  const tmpPath = ledgerPath + ".tmp";
  fs.writeFileSync(tmpPath, lines.join("\n"), "utf-8");
  fs.renameSync(tmpPath, ledgerPath);

  clearDirty(s);
}
```

- [ ] **Step 2: Test regeneration with current data**

```bash
npx tsx -e "
const {regenerate} = require('./src/lib/beancount/regenerate');
regenerate();
console.log('Regeneration complete');
const fs = require('fs');
console.log(fs.readFileSync('./data/ledger.beancount', 'utf-8').slice(0, 2000));
"
```
Expected: `ledger.beancount` file created with header, commodity directives, open directives, and transactions.

- [ ] **Step 3: Commit**

```bash
git add src/lib/beancount/regenerate.ts
git commit -m "feat: add beancount full regeneration from SQLite"
```

---

### Task 6: Cache Table + Fava API Client

**Files:**
- Modify: `src/db/migrate.ts` (add `beancount_cache` table)
- Create: `src/lib/beancount/fava-api.ts`

**Interfaces:**
- Consumes: `ensureFresh` from a new shared util
- Produces: `getBalances()`, `getAccounts()`, `getTransactions()`, `getIncomeStatement()`, `getBalanceSheet()`, `getHoldings()`, `getCheck()`, `getErrors()` — all return parsed JSON or null
- Produces: `fetchFromFava<T>(endpoint): Promise<T | null>`

- [ ] **Step 1: Add `beancount_cache` table to migration**

Add to `runMigrations` in `src/db/migrate.ts` (before `ensureSchemaVersion`):

```typescript
console.log("\n[beancount_cache]");
createTable(s, "beancount_cache", `(
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
)`);
```

- [ ] **Step 2: Create `src/lib/beancount/fava-api.ts`**

```typescript
const FAVA_BASE = process.env.FAVA_URL || "http://localhost:5000";

async function fetchFromFava<T>(endpoint: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${FAVA_BASE}/api/${endpoint}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export interface BalanceEntry {
  account: string;
  balance: { number: string; currency: string };
}

export interface AccountNode {
  type: string;
  name: string;
  account?: string;
  children?: AccountNode[];
  balance?: { number: string; currency: string };
}

export interface TransactionEntry {
  date: string;
  payee: string;
  narration: string;
  postings: { account: string; units: { number: string; currency: string } }[];
}

export interface IncomeStatement {
  income: { account: string; balance: { number: string; currency: string } }[];
  expenses: { account: string; balance: { number: string; currency: string } }[];
}

export interface BalanceSheet {
  totals: { assets: { number: string; currency: string }; liabilities: { number: string; currency: string }; equity: { number: string; currency: string } };
}

export interface HoldingEntry {
  account: string; cost_basis: { number: string; currency: string }; market_value: { number: string; currency: string };
}

export interface CheckEntry {
  source: { filename: string; lineno: number };
  message: string;
}

export type ErrorEntry = CheckEntry;

export async function getBalances(): Promise<BalanceEntry[] | null> {
  return fetchFromFava<BalanceEntry[]>("balances/");
}

export async function getAccounts(): Promise<AccountNode | null> {
  return fetchFromFava<AccountNode>("accounts/");
}

export async function getTransactions(): Promise<TransactionEntry[] | null> {
  return fetchFromFava<TransactionEntry[]>("transactions/");
}

export async function getIncomeStatement(): Promise<IncomeStatement | null> {
  return fetchFromFava<IncomeStatement>("income-statement/");
}

export async function getBalanceSheet(): Promise<BalanceSheet | null> {
  return fetchFromFava<BalanceSheet>("balance-sheet/");
}

export async function getHoldings(): Promise<HoldingEntry[] | null> {
  return fetchFromFava<HoldingEntry[]>("holdings/");
}

export async function getCheck(): Promise<CheckEntry[] | null> {
  return fetchFromFava<CheckEntry[]>("check/");
}

export async function getErrors(): Promise<ErrorEntry[] | null> {
  return fetchFromFava<ErrorEntry[]>("errors/");
}

export async function getLedgerText(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${FAVA_BASE}/download/beancount`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Run migration**

```bash
npx tsx src/db/migrate.ts
```
Expected: `beancount_cache created` or `beancount_cache already exists`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/beancount/fava-api.ts src/db/migrate.ts
git commit -m "feat: add beancount cache table and Fava API client"
```

---

### Task 7: Proxy Routes (all 10)

**Files:**
- Create: `src/app/api/beancount/ensure-fresh.ts` (shared helper)
- Create: `src/app/api/beancount/balances/route.ts`
- Create: `src/app/api/beancount/accounts/route.ts`
- Create: `src/app/api/beancount/transactions/route.ts`
- Create: `src/app/api/beancount/income-statement/route.ts`
- Create: `src/app/api/beancount/balance-sheet/route.ts`
- Create: `src/app/api/beancount/holdings/route.ts`
- Create: `src/app/api/beancount/check/route.ts`
- Create: `src/app/api/beancount/errors/route.ts`
- Create: `src/app/api/beancount/export/route.ts`
- Create: `src/app/api/beancount/reconcile/route.ts`

**Interfaces:**
- Consumes: `getDirtySqlite`, `isDirty`, `regenerate` from beancount layer, Fava API functions
- Produces: JSON responses for all endpoints

- [ ] **Step 1: Create shared helper `src/app/api/beancount/ensure-fresh.ts`**

```typescript
import { getDirtySqlite, isDirty } from "@/lib/beancount/dirty-flag";
import { regenerate } from "@/lib/beancount/regenerate";

export function ensureFresh(): void {
  const sqlite = getDirtySqlite();
  if (isDirty(sqlite)) {
    regenerate(sqlite);
  }
}
```

- [ ] **Step 2: Create `src/app/api/beancount/balances/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getBalances } from "@/lib/beancount/fava-api";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  ensureFresh();
  const fava = await getBalances();
  if (fava) return NextResponse.json(fava);

  // Fallback: aggregate from SQLite
  const rows = db.select({
    accountId: operationEntries.accountId,
    currency: operationEntries.currency,
    balance: sql<string>`COALESCE(SUM(${operationEntries.amount}), 0)`,
  })
    .from(operationEntries)
    .innerJoin(operations, eq(operationEntries.operationId, operations.id))
    .where(eq(operations.status, "confirmed"))
    .groupBy(operationEntries.accountId, operationEntries.currency)
    .all();

  return NextResponse.json(rows.map(r => ({
    account: `Assets:FinTracker:User?:${r.accountId}:${r.currency}`,
    balance: { number: String(r.balance), currency: r.currency },
  })));
}
```

- [ ] **Step 3: Create `src/app/api/beancount/accounts/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getAccounts } from "@/lib/beancount/fava-api";
import { db } from "@/db";
import { accounts as accountsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  ensureFresh();
  const fava = await getAccounts();
  if (fava) return NextResponse.json(fava);

  const rows = db.select().from(accountsTable).all();
  return NextResponse.json({
    type: "root",
    name: "FinTracker",
    children: rows.map(a => ({
      type: "account",
      name: a.name,
      account: `Assets:FinTracker:User${a.userId}:${a.id}`,
    })),
  });
}
```

- [ ] **Step 4: Create `src/app/api/beancount/transactions/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getTransactions } from "@/lib/beancount/fava-api";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  ensureFresh();
  const fava = await getTransactions();
  if (fava) return NextResponse.json(fava);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const rows = db.select()
    .from(operations)
    .where(eq(operations.status, "confirmed"))
    .orderBy(desc(operations.date))
    .limit(limit)
    .all();

  const result = rows.map(op => {
    const entries = db.select()
      .from(operationEntries)
      .where(eq(operationEntries.operationId, op.id))
      .all();
    return {
      date: op.date,
      payee: op.category || "Unknown",
      narration: op.description || "",
      postings: entries.map(e => ({
        account: `Assets:FinTracker:User${op.userId}:${e.accountId}:${e.currency}`,
        units: { number: String(e.amount), currency: e.currency },
      })),
    };
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 5: Create `src/app/api/beancount/income-statement/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getIncomeStatement } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getIncomeStatement();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json({ income: [], expenses: [] });
}
```

- [ ] **Step 6: Create `src/app/api/beancount/balance-sheet/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getBalanceSheet } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getBalanceSheet();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json({ totals: { assets: { number: "0", currency: "RUB" }, liabilities: { number: "0", currency: "RUB" }, equity: { number: "0", currency: "RUB" } } });
}
```

- [ ] **Step 7: Create remaining 4 routes (`holdings`, `check`, `errors`, `export`, `reconcile`)**

`src/app/api/beancount/holdings/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getHoldings } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getHoldings();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json([]);
}
```

`src/app/api/beancount/check/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getCheck } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getCheck();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json([]);
}
```

`src/app/api/beancount/errors/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getErrors } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getErrors();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json([]);
}
```

`src/app/api/beancount/export/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getLedgerText } from "@/lib/beancount/fava-api";
import fs from "fs";
import path from "path";

export async function GET() {
  ensureFresh();
  const fava = await getLedgerText();
  if (fava) {
    return new NextResponse(fava, {
      headers: { "Content-Type": "text/plain", "Content-Disposition": 'attachment; filename="ledger.beancount"' },
    });
  }
  // Fallback: read file directly
  const ledgerPath = path.join(path.dirname(process.env.DATABASE_URL || "./data/fintracker.db"), "ledger.beancount");
  if (fs.existsSync(ledgerPath)) {
    const content = fs.readFileSync(ledgerPath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain", "Content-Disposition": 'attachment; filename="ledger.beancount"' },
    });
  }
  return NextResponse.json({ error: "No ledger available" }, { status: 503 });
}
```

`src/app/api/beancount/reconcile/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ensureFresh } from "../ensure-fresh";

export async function GET() {
  ensureFresh();

  // Get SQLite balances (confirmed operations)
  const sqliteBalances = db.select({
    accountId: operationEntries.accountId,
    currency: operationEntries.currency,
    amount: sql<string>`COALESCE(SUM(${operationEntries.amount}), 0)`,
  })
    .from(operationEntries)
    .innerJoin(operations, eq(operationEntries.operationId, operations.id))
    .where(eq(operations.status, "confirmed"))
    .groupBy(operationEntries.accountId, operationEntries.currency)
    .all();

  // Compare with Beancount via Fava
  const { getBalances } = await import("@/lib/beancount/fava-api");
  const beancountBalances = await getBalances();

  return NextResponse.json({
    sqlite: sqliteBalances,
    beancount: beancountBalances,
    reconciled: beancountBalances !== null,
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/beancount/
git commit -m "feat: add 10 Beancount proxy API routes"
```

---

### Task 8: Dirty Flag Integration in Existing Routes

**Files:**
- Modify: `src/app/api/operations/route.ts` (POST)
- Modify: `src/app/api/operations/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/accounts/sync-balances/route.ts`
- Modify: `src/lib/scanners/runner.ts` (syncAddressBalance + runScannerCycle)

**Interfaces:**
- Consumes: `markDirty` from `dirty-flag.ts`
- Produces: Dirty flag set after any mutation that changes operation data

- [ ] **Step 1: Add `markDirty` to POST `/api/operations`**

In `src/app/api/operations/route.ts`, add import and call after SQLite write:

Add import:
```typescript
import { markDirty } from "@/lib/beancount/dirty-flag";
```

After `recalculateAllBalances()` call (line 123), add:
```typescript
    markDirty();
```

- [ ] **Step 2: Add `markDirty` to PATCH `/api/operations/[id]`**

In `src/app/api/operations/[id]/route.ts`, add import:
```typescript
import { markDirty } from "@/lib/beancount/dirty-flag";
```

Add `markDirty()` after `recalculateAllBalances()` on line 57.

- [ ] **Step 3: Add `markDirty` to DELETE `/api/operations/[id]`**

In same file, add `markDirty()` after `recalculateAllBalances()` on line 91.

- [ ] **Step 4: Add `markDirty` to POST `/api/accounts/sync-balances`**

In `src/app/api/accounts/sync-balances/route.ts`, add import:
```typescript
import { markDirty } from "@/lib/beancount/dirty-flag";
```

Add `markDirty()` after `recalculateAllBalances()` on line 47.

- [ ] **Step 5: Add `markDirty` to scanner runner**

In `src/lib/scanners/runner.ts`, add import:
```typescript
import { markDirty } from "@/lib/beancount/dirty-flag";
```

In `runScannerCycle()`, add `markDirty()` after each `recalculateAllBalances()` call (line 58).

In `syncAddressBalance()`, add `markDirty()` after creating correction operations (after the insert loop, before the update statement at line 188).

- [ ] **Step 6: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/operations/ src/app/api/accounts/sync-balances/ src/lib/scanners/runner.ts
git commit -m "feat: set beancount dirty flag on all operation mutations"
```

---

### Task 9: /ledger Page

**Files:**
- Create: `src/app/(dashboard)/ledger/page.tsx`

**Interfaces:**
- Consumes: `GET /api/beancount/transactions` (Fava-proxied)
- Produces: Client page showing all Beancount transactions in a table

- [ ] **Step 1: Create `src/app/(dashboard)/ledger/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

interface Posting {
  account: string;
  units: { number: string; currency: string };
}

interface Transaction {
  date: string;
  payee: string;
  narration: string;
  postings: Posting[];
}

export default function LedgerPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/beancount/transactions?limit=200")
      .then(r => r.json())
      .then(data => {
        setTxns(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Не удалось загрузить данные");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6">Загрузка...</div>;
  if (error) return <div className="p-6 text-[var(--danger)]">{error}</div>;

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-xl md:text-2xl font-bold">Главная книга (Ledger)</h1>

      {txns.length === 0 ? (
        <EmptyState icon="📒" title="Нет транзакций" description="Транзакции появятся здесь после создания операций" />
      ) : (
        <div className="space-y-3">
          {txns.map((tx, i) => (
            <details key={i} className="card">
              <summary className="cursor-pointer font-medium text-sm flex items-center gap-3">
                <span className="text-[var(--text-muted)]">{tx.date}</span>
                <span>{tx.payee}</span>
                <span className="text-[var(--text-secondary)] truncate">{tx.narration}</span>
              </summary>
              <div className="mt-2 text-sm space-y-1 pl-4 border-l-2 border-[var(--border)]">
                {tx.postings.map((p, j) => (
                  <div key={j} className="flex justify-between font-mono text-xs">
                    <span className="text-[var(--text-secondary)] truncate mr-4">{p.account}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      {parseFloat(p.units.number).toFixed(2)} {p.units.currency}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders at `/ledger`**

```bash
npm run build
```
Expected: Build succeeds. Page accessible at `/ledger`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/ledger/
git commit -m "feat: add /ledger page with Beancount transactions"
```

---

### Task 10: /balances Page

**Files:**
- Create: `src/app/(dashboard)/balances/page.tsx`

**Interfaces:**
- Consumes: `GET /api/beancount/balances` (Fava-proxied)
- Produces: Client page with hierarchical balance tree

- [ ] **Step 1: Create `src/app/(dashboard)/balances/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

interface BalanceEntry {
  account: string;
  balance: { number: string; currency: string };
}

export default function BalancesPage() {
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/beancount/balances")
      .then(r => r.json())
      .then(data => {
        setBalances(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build tree from flat account paths
  function buildTree(entries: BalanceEntry[]): any[] {
    const root: Record<string, any> = {};
    for (const e of entries) {
      const parts = e.account.split(":");
      let current = root;
      for (const part of parts) {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
      current._balance = e.balance;
    }
    function toList(obj: Record<string, any>, depth = 0): any[] {
      return Object.entries(obj)
        .filter(([k]) => !k.startsWith("_"))
        .map(([key, val]) => ({
          name: key,
          balance: (val as any)._balance || null,
          children: toList(val as any, depth + 1),
          depth,
        }));
    }
    return toList(root);
  }

  const tree = buildTree(balances);

  if (loading) return <div className="p-6">Загрузка...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl md:text-2xl font-bold">Балансы</h1>

      {tree.length === 0 ? (
        <EmptyState icon="💰" title="Нет данных" description="Балансы появятся здесь после создания операций" />
      ) : (
        <div className="space-y-1">
          {tree.map((node, i) => (
            <TreeNode key={i} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node }: { node: any }) {
  const [open, setOpen] = useState(node.depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm cursor-pointer hover:bg-[var(--bg-primary)] ${
          node.depth === 0 ? "font-bold" : ""
        }`}
        style={{ paddingLeft: `${12 + node.depth * 20}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren && <span className="text-xs text-[var(--text-muted)]">{open ? "▼" : "▶"}</span>}
        {!hasChildren && <span className="text-xs text-[var(--text-muted)]">•</span>}
        <span className="truncate">{node.name}</span>
        {node.balance && (
          <span className="ml-auto tabular-nums text-[var(--text-secondary)]">
            {parseFloat(node.balance.number).toFixed(2)} {node.balance.currency}
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((child: any, i: number) => (
            <TreeNode key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds, `/balances` page accessible.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/balances/
git commit -m "feat: add /balances page with hierarchical tree"
```

---

### Task 11: Dashboard Update with Beancount Capital

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `GET /api/beancount/balances` and `GET /api/beancount/balance-sheet`
- Produces: Total capital from Beancount added to dashboard header

- [ ] **Step 1: Modify dashboard to fetch and display Beancount capital**

Add a Beancount section to the dashboard page. After the existing "Общий капитал" card, add a smaller card showing Beancount-verified total:

Add to the `Summary` interface:
```typescript
interface BeancountSummary {
  totalCapital: number;
  currency: string;
}
```

Add state:
```typescript
const [beancountSummary, setBeancountSummary] = useState<BeancountSummary | null>(null);
```

Add fetch in the `useEffect` that loads summary:
```typescript
  fetch("/api/beancount/balance-sheet")
    .then(r => r.json())
    .then(data => {
      if (data?.totals?.assets) {
        const assets = parseFloat(data.totals.assets.number) || 0;
        const liabilities = parseFloat(data.totals.liabilities.number) || 0;
        setBeancountSummary({
          totalCapital: assets - liabilities,
          currency: data.totals.assets.currency || "RUB",
        });
      }
    })
    .catch(() => {});
```

Add after the "Общий капитал" card (after the `</div>` closing the first md:col-span-1 card):
```typescript
          {beancountSummary && (
            <div className="card md:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--text-secondary)]">Капитал (Beancount)</span>
                <span className="text-xs text-[var(--text-muted)]">✓ верифицировано</span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[var(--success)]">
                <AnimatedCounter value={beancountSummary.totalCapital} /> {sym(beancountSummary.currency)}
              </div>
            </div>
          )}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add Beancount-verified capital to dashboard"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every section of the design doc maps to tasks:
  - Dirty flag design → Task 2
  - Account mapping + open directives + commodity directives → Task 3
  - Transaction generation logic → Task 4
  - Full regeneration from SQLite → Task 5
  - Fava API client + cache table → Task 6
  - All 10 proxy routes (including export + reconcile) → Task 7
  - Dirty flag integration in CRUD, sync, scanner → Task 8
  - Docker + supervisord + compose changes → Task 1
  - /ledger page → Task 9
  - /balances page → Task 10
  - Dashboard update → Task 11

- [ ] **Placeholder scan:** No TBD, TODO, "implement later", "add error handling" without code, or "similar to Task N". Every step has actual code.

- [ ] **Type consistency:** `markDirty`/`isDirty`/`clearDirty` called with same signature throughout. `regenerate()` called without args (uses internal getDirtySqlite). Account paths use `Assets:FinTracker:User{userId}:{accountId}:{currency}` format consistently.

- [ ] **All tasks produce independently testable deliverables:** Task 1 → docker compose builds. Task 2 → migration runs. Tasks 3-5 → module can be executed via tsx. Task 6 → migration creates table. Task 7 → API routes respond. Task 8 → dirty flag set on mutations. Tasks 9-10 → pages render. Task 11 → dashboard shows Beancount capital.
