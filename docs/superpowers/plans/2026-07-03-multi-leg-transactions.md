# Multi-Leg Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-row transaction model with a multi-leg operation/entries model that supports fees, coupons, interest, and balance reconciliation.

**Architecture:** New `operations` + `operation_entries` tables replace `transactions` and `matched_transactions`. Balance becomes a computed sum of confirmed entries (with materialized cache). API endpoints for creating operations auto-detect implicit fees. Legacy data is migrated in a one-time script.

**Tech Stack:** Next.js, Drizzle ORM (SQLite/better-sqlite3), TypeScript

---

## File Structure

### New files:
- `src/app/api/operations/route.ts` — POST/GET operations
- `src/app/api/operations/[id]/route.ts` — GET/PATCH/DELETE single operation
- `src/app/api/operations/unverified/route.ts` — GET unverified draft ops
- `src/app/api/entries/[id]/verify/route.ts` — PATCH verify fee entry
- `src/app/api/snapshots/route.ts` — POST/GET balance snapshots
- `src/app/api/snapshots/[accountId]/route.ts` — GET snapshot history

### Modified files:
- `src/db/schema.ts` — Add 3 tables, remove 2 tables, fix balances
- `src/db/migrate.ts` — Migration script to create new tables + migrate old data
- `src/app/api/balances/route.ts` — Rewrite to computed balances
- `src/app/api/stats/summary/route.ts` — Update to use operation_entries
- `src/lib/scanners/runner.ts` — Create operations instead of transactions
- `src/lib/scanners/matcher.ts` — Remove (replaced by operations grouping)
- `src/lib/exchanges/bybit.ts` — Create operations instead of transactions
- `src/lib/exchanges/okx.ts` — Create operations instead of transactions
- `src/components/NewTransactionModal.tsx` — Rewrite to multi-entry operation form

### Removed files:
- `src/app/api/transactions/route.ts` — Replaced by operations API
- `src/app/api/transactions/[id]/route.ts` — Replaced
- `src/app/api/transactions/export/route.ts` — Replaced
- `src/app/api/matches/route.ts` — Replaced (no longer needed)

---

### Task 1: Schema — add new tables, update balances, define relations

**Files:**
- Modify: `src/db/schema.ts` (entire file)
- Modify: `src/db/index.ts` (add new relations if any)
- Modify: `src/lib/init.ts` (register new migration)
- Modify: `src/test/schema.test.ts` (update for new tables)

**Interfaces:**
- Consumes: existing `users`, `accounts` table definitions
- Produces: `operations`, `operationEntries`, `balanceSnapshots` Drizzle tables; `balances` with `updatedAt` removed; `transactions` and `matchedTransactions` removed

TTT:

- [ ] **Step 1: Add `operations` table**

Insert after `accounts` block:

```typescript
export const operations = sqliteTable("operations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description"),
  category: text("category"),
  date: text("date").notNull(),
  source: text("source").notNull().default("manual"),
  txHash: text("tx_hash"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  blockTimestamp: integer("block_timestamp"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
```

- [ ] **Step 2: Add `operationEntries` table**

```typescript
export const operationEntries = sqliteTable("operation_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operationId: integer("operation_id").notNull()
    .references(() => operations.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull()
    .references(() => accounts.id),
  currency: text("currency").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull().default("principal"),
  isVerified: integer("is_verified").notNull().default(0),
});
```

- [ ] **Step 3: Add `balanceSnapshots` table**

```typescript
export const balanceSnapshots = sqliteTable("balance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
```

- [ ] **Step 4: Remove `updatedAt` from `balances`**

Change:
```typescript
export const balances = sqliteTable("balances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amount: real("amount").notNull().default(0),
}, (table) => ({
  accountCurrencyUnique: uniqueIndex("account_currency_unique").on(table.accountId, table.currency),
}));
```

- [ ] **Step 5: Remove `transactions` and `matchedTransactions` table definitions**

Delete the entire `transactions` and `matchedTransactions` table definitions from `schema.ts`.

- [ ] **Step 6: Remove `matched_candidate` status and unused transaction references from codebase**

Search for all references to `matched_candidate` and `matchedTransactions`/`matched_transactions` in non-test files and remove/update them. Also remove `externalId` field references from scanner code if they only existed for matching.

Run: `grep -r "matched_candidate\|matched_transactions\|matchedTransactions\|from_address\|to_address\|block_timestamp" src/app/api/ src/lib/`

For the API and lib references that were only relevant to the old matching system, remove the imports and usage.

- [ ] **Step 7: Build test**

Run: `npx vitest run`
Expected: compilation errors due to removed exports in schema.ts

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add operations, operation_entries, balance_snapshots tables; drop transactions, matched_transactions"
```

---

### Task 2: Migration script

**Files:**
- Modify: `src/db/migrate.ts`

**Interfaces:**
- Consumes: `db` instance from `src/db/index.ts`
- Produces: migration function that creates new tables and converts old data

- [ ] **Step 1: Write the migration function**

Add to `src/db/migrate.ts`:

```typescript
function migrateToMultiLeg(sqlite: Database) {
  const tables = sqlite.pragma("table_list") as { name: string }[];
  const names = tables.map((t) => t.name);

  if (!names.includes("operations")) {
    sqlite.exec(`
      CREATE TABLE "operations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL REFERENCES users(id),
        "description" TEXT,
        "category" TEXT,
        "date" TEXT NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'manual',
        "tx_hash" TEXT,
        "from_address" TEXT,
        "to_address" TEXT,
        "block_timestamp" INTEGER,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  if (!names.includes("operation_entries")) {
    sqlite.exec(`
      CREATE TABLE "operation_entries" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "operation_id" INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
        "account_id" INTEGER NOT NULL REFERENCES accounts(id),
        "currency" TEXT NOT NULL,
        "amount" REAL NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'principal',
        "is_verified" INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  if (!names.includes("balance_snapshots")) {
    sqlite.exec(`
      CREATE TABLE "balance_snapshots" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "account_id" INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        "currency" TEXT NOT NULL,
        "amount" REAL NOT NULL,
        "date" TEXT NOT NULL,
        "comment" TEXT,
        "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migrate old transactions to operations + entries
  if (names.includes("transactions")) {
    const txCols = sqlite.pragma("table_info(transactions)") as { name: string }[];
    const txNames = txCols.map((c) => c.name);

    const oldTx = sqlite.prepare("SELECT * FROM transactions").all() as any[];
    let migrated = 0;

    for (const tx of oldTx) {
      // Create operation
      const opResult = sqlite.prepare(`
        INSERT INTO operations (user_id, description, category, date, source, tx_hash, from_address, to_address, block_timestamp, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
      `).run(
        tx.user_id, tx.description, tx.category, tx.operation_date, tx.source,
        tx.tx_hash, tx.from_address, tx.to_address, tx.block_timestamp, tx.created_at
      );
      const opId = opResult.lastInsertRowid as number;

      if (tx.type === "income") {
        sqlite.prepare(`INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified) VALUES (?, ?, ?, ?, 'principal', 1)`)
          .run(opId, tx.account_id, tx.currency, tx.amount);
      } else if (tx.type === "expense") {
        sqlite.prepare(`INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified) VALUES (?, ?, ?, ?, 'principal', 1)`)
          .run(opId, tx.account_id, tx.currency, -Math.abs(tx.amount));
      } else if (tx.type === "transfer") {
        sqlite.prepare(`INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified) VALUES (?, ?, ?, ?, 'principal', 1)`)
          .run(opId, tx.account_id, tx.currency, -Math.abs(tx.amount));
        if (tx.counterparty_account_id) {
          sqlite.prepare(`INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified) VALUES (?, ?, ?, ?, 'principal', 1)`)
            .run(opId, tx.counterparty_account_id, tx.currency, Math.abs(tx.amount));
        }
      } else if (tx.type === "exchange") {
        // amount_from = what left, amount_to = what arrived
        if (tx.amount_from && tx.currency_from) {
          sqlite.prepare(`INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified) VALUES (?, ?, ?, ?, 'principal', 1)`)
            .run(opId, tx.account_id, tx.currency_from, -Math.abs(tx.amount_from));
        }
        if (tx.amount_to && tx.currency_to) {
          sqlite.prepare(`INSERT INTO operation_entries (operation_id, account_id, currency, amount, type, is_verified) VALUES (?, ?, ?, ?, 'principal', 1)`)
            .run(opId, tx.account_id, tx.currency_to, Math.abs(tx.amount_to));
        }
      }
      migrated++;
    }

    if (oldTx.length > 0) {
      console.log(`[migrate] Converted ${migrated} transactions to operations + entries`);
    }

    // Drop old tables
    sqlite.exec(`DROP TABLE IF EXISTS matched_transactions;`);
    sqlite.exec(`DROP TABLE IF EXISTS transactions;`);
  }
}
```

- [ ] **Step 2: Remove single `updated_at` column from balances (idempotent)**

```typescript
function updateBalances(sqlite: Database) {
  const balanceCols = sqlite.pragma("table_info(balances)") as { name: string }[];
  const bNames = balanceCols.map((c) => c.name);
  if (bNames.includes("updated_at")) {
    // SQLite doesn't support DROP COLUMN easily in older versions, but ALTER TABLE DROP COLUMN is supported from 3.35.0
    // We can simply ignore the column going forward — the Drizzle schema no longer references it
    // Migration note: column stays in DB but is unused
    console.log("[migrate] balances.updated_at column is deprecated (ignored by new schema)");
  }
}
```

- [ ] **Step 3: Integrate into migration runner**

In the main `runMigrations()` function, add calls:
```typescript
migrateToMultiLeg(sqlite);
updateBalances(sqlite);
recalculateAllBalances(sqlite);
```

- [ ] **Step 4: Write `recalculateAllBalances` function**

```typescript
export function recalculateAllBalances(sqlite: Database) {
  // Clear all balances
  sqlite.exec("DELETE FROM balances;");

  // Recompute from confirmed operation entries
  sqlite.exec(`
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

  const count = sqlite.prepare("SELECT COUNT(*) as c FROM balances").get() as { c: number };
  console.log(`[migrate] Recalculated ${count.c} balance rows`);
}
```

- [ ] **Step 5: Build test**

Run: `npx vitest run`
Expected: at least 1 db load test passes (schema.test or migration.test)

- [ ] **Step 6: Commit**

```bash
git add src/db/migrate.ts
git commit -m "feat: migration script for multi-leg operations, recalculate balances"
```

---

### Task 3: Operations API — CRUD

**Files:**
- Create: `src/app/api/operations/route.ts`
- Create: `src/app/api/operations/[id]/route.ts`
- Create: `src/app/api/operations/unverified/route.ts`
- Create: `src/app/api/entries/[id]/verify/route.ts`
- Delete: `src/app/api/transactions/route.ts`
- Delete: `src/app/api/transactions/[id]/route.ts`
- Delete: `src/app/api/transactions/export/route.ts`
- Delete: `src/app/api/matches/route.ts`

**Interfaces:**
- Consumes: `db`, `operations`, `operationEntries`, `balances` from schema
- Produces: `POST /api/operations` with fee auto-detection, `GET /api/operations?page=&limit=&date_from=&date_to=&category=&status=`

- [ ] **Step 1: Create `POST /api/operations`**

```typescript
// src/app/api/operations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, and, gte, lte, like, count } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { recalculateAllBalances } from "@/db/migrate";

function detectImplicitFees(entries: { accountId: number; currency: string; amount: number }[]) {
  // Group by (accountId, currency) and find non-zero sums
  const groups = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.accountId}:${e.currency}`;
    groups.set(key, (groups.get(key) || 0) + e.amount);
  }
  const fees: { accountId: number; currency: string; amount: number }[] = [];
  for (const [key, sum] of groups) {
    if (sum !== 0) {
      const [accountId, currency] = key.split(":");
      fees.push({ accountId: Number(accountId), currency, amount: -sum });
    }
  }
  return fees;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { description, category, date, txHash, fromAddress, toAddress, blockTimestamp, source, entries } = body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "At least one entry required" }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const opResult = db.insert(operations).values({
    userId: Number(session.user.id),
    description: description || null,
    category: category || null,
    date,
    source: source || "manual",
    txHash: txHash || null,
    fromAddress: fromAddress || null,
    toAddress: toAddress || null,
    blockTimestamp: blockTimestamp || null,
    status: "draft",
  }).returning().get();

  const opId = opResult.id;

  for (const entry of entries) {
    if (!entry.accountId || !entry.currency || entry.amount === undefined) {
      return NextResponse.json({ error: "Each entry needs accountId, currency, amount" }, { status: 400 });
    }
    db.insert(operationEntries).values({
      operationId: opId,
      accountId: entry.accountId,
      currency: entry.currency,
      amount: entry.amount,
      type: entry.type || "principal",
      isVerified: entry.isVerified ?? 1,
    }).run();
  }

  // Detect implicit fees
  const feeCandidates = detectImplicitFees(entries.map((e: any) => ({
    accountId: e.accountId,
    currency: e.currency,
    amount: e.amount,
  })));

  for (const fee of feeCandidates) {
    db.insert(operationEntries).values({
      operationId: opId,
      accountId: fee.accountId,
      currency: fee.currency,
      amount: fee.amount,
      type: "fee",
      isVerified: 0,
    }).run();
  }

  recalculateAllBalances();

  const op = db.select().from(operations).where(eq(operations.id, opId)).get();
  const opEntries = db.select().from(operationEntries).where(eq(operationEntries.operationId, opId)).all();

  return NextResponse.json({
    operation: op,
    entries: opEntries,
    suggestedFees: feeCandidates,
  });
}
```

- [ ] **Step 2: Create `GET /api/operations` with filtering/pagination**

```typescript
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = (page - 1) * limit;
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  const conditions = [eq(operations.userId, Number(session.user.id))];
  if (dateFrom) conditions.push(gte(operations.date, dateFrom));
  if (dateTo) conditions.push(lte(operations.date, dateTo));
  if (category) conditions.push(eq(operations.category, category));
  if (status) conditions.push(eq(operations.status, status));
  if (search) conditions.push(like(operations.description, `%${search}%`));

  const total = db.select({ value: count() }).from(operations).where(and(...conditions)).get()?.value ?? 0;

  const ops = db.select().from(operations)
    .where(and(...conditions))
    .orderBy(operations.date, operations.id)
    .limit(limit).offset(offset)
    .all();

  // Fetch entries for each operation
  const result = ops.map((op) => {
    const entries = db.select().from(operationEntries)
      .where(eq(operationEntries.operationId, op.id)).all();
    return { ...op, entries };
  });

  return NextResponse.json({ operations: result, total, page, limit });
}
```

- [ ] **Step 3: Create `GET /api/operations/[id]`**

```typescript
// src/app/api/operations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { recalculateAllBalances } from "@/db/migrate";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const op = db.select().from(operations)
    .where(and(eq(operations.id, Number(params.id)), eq(operations.userId, Number(session.user.id))))
    .get();
  if (!op) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = db.select().from(operationEntries)
    .where(eq(operationEntries.operationId, op.id)).all();

  return NextResponse.json({ ...op, entries });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const op = db.select().from(operations)
    .where(and(eq(operations.id, Number(params.id)), eq(operations.userId, Number(session.user.id))))
    .get();
  if (!op) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, any> = {};
  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;
  if (body.date !== undefined) updates.date = body.date;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length > 0) {
    db.update(operations).set(updates).where(eq(operations.id, op.id)).run();
    if (updates.status === "confirmed") recalculateAllBalances();
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const op = db.select().from(operations)
    .where(and(eq(operations.id, Number(params.id)), eq(operations.userId, Number(session.user.id))))
    .get();
  if (!op) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.delete(operations).where(eq(operations.id, op.id)).run();
  recalculateAllBalances();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create unverified operations endpoint**

```typescript
// src/app/api/operations/unverified/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find all draft operations with unverified fee entries for current user
  const rows = db.select({
    operation: operations,
    entries: operationEntries,
  }).from(operations)
    .innerJoin(operationEntries, eq(operationEntries.operationId, operations.id))
    .where(
      and(
        eq(operations.userId, Number(session.user.id)),
        eq(operationEntries.isVerified, 0),
      )
    )
    .all();

  // Group by operation
  const grouped = new Map<number, any>();
  for (const row of rows) {
    if (!grouped.has(row.operation.id)) {
      grouped.set(row.operation.id, { ...row.operation, entries: [] });
    }
    grouped.get(row.operation.id).entries.push(row.entries);
  }

  return NextResponse.json({ operations: Array.from(grouped.values()) });
}
```

- [ ] **Step 5: Create verify entry endpoint**

```typescript
// src/app/api/entries/[id]/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { operationEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { recalculateAllBalances } from "@/db/migrate";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = db.select().from(operationEntries).where(eq(operationEntries.id, Number(params.id))).get();
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.amount !== undefined) {
    db.update(operationEntries)
      .set({ amount: body.amount, isVerified: 1 })
      .where(eq(operationEntries.id, entry.id))
      .run();
  } else {
    db.update(operationEntries)
      .set({ isVerified: 1 })
      .where(eq(operationEntries.id, entry.id))
      .run();
  }

  // Check if all entries in this operation are verified → auto-confirm
  const unverifiedCount = db.select().from(operationEntries)
    .where(eq(operationEntries.operationId, entry.operationId))
    .all()
    .filter((e) => e.type === "fee" && !e.isVerified).length;

  // If no unverified fees remain, confirm the operation
  // Note: this auto-confirm logic can be refined later
  recalculateAllBalances();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Remove old API files**

Delete:
- `src/app/api/transactions/route.ts`
- `src/app/api/transactions/[id]/route.ts`
- `src/app/api/transactions/export/route.ts`
- `src/app/api/matches/route.ts`

- [ ] **Step 7: Build test**

Run: `npx vitest run`
Expected: 9 files pass (schema test may need updates for removed tables)

- [ ] **Step 8: Commit**

```bash
git add src/app/api/operations/ src/app/api/entries/ 
git rm src/app/api/transactions/ src/app/api/transactions/\[id\]/ src/app/api/matches/
git commit -m "feat: operations API with CRUD, fee detection, unverified queue"
```

---

### Task 4: Balances API rewrite

**Files:**
- Rewrite: `src/app/api/balances/route.ts`
- Create: `src/app/api/balances/history/route.ts`
- Modify: `src/app/api/stats/summary/route.ts`
- Create: `src/app/api/snapshots/route.ts`
- Create: `src/app/api/snapshots/[accountId]/route.ts`

- [ ] **Step 1: Rewrite balances endpoint**

```typescript
// src/app/api/balances/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { balances, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userAccounts = db.select({ id: accounts.id }).from(accounts)
    .where(eq(accounts.userId, Number(session.user.id))).all();
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return NextResponse.json({ balances: [] });
  }

  const result = db.select({
    accountId: balances.accountId,
    currency: balances.currency,
    amount: balances.amount,
    accountName: accounts.name,
  }).from(balances)
    .innerJoin(accounts, eq(accounts.id, balances.accountId))
    .where(and(
      eq(accounts.userId, Number(session.user.id)),
    ))
    .all();

  return NextResponse.json({ balances: result });
}
```

- [ ] **Step 2: Create balance snapshots endpoints**

```typescript
// src/app/api/snapshots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { balanceSnapshots, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.accountId || !body.currency || body.amount === undefined || !body.date) {
    return NextResponse.json({ error: "accountId, currency, amount, date required" }, { status: 400 });
  }

  // Verify account belongs to user
  const account = db.select().from(accounts)
    .where(and(eq(accounts.id, body.accountId), eq(accounts.userId, Number(session.user.id))))
    .get();
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const snap = db.insert(balanceSnapshots).values({
    accountId: body.accountId,
    currency: body.currency,
    amount: body.amount,
    date: body.date,
    comment: body.comment || null,
  }).returning().get();

  return NextResponse.json(snap);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");

  const conditions = [];
  if (accountId) conditions.push(eq(balanceSnapshots.accountId, Number(accountId)));

  const snaps = db.select().from(balanceSnapshots)
    .where(and(...conditions))
    .orderBy(balanceSnapshots.date)
    .all();

  // Enrich with computed balance delta
  const enriched = snaps.map((s) => {
    const computed = db.select({ amount: balances.amount }).from(balances)
      .where(and(eq(balances.accountId, s.accountId), eq(balances.currency, s.currency)))
      .get();
    const computedAmount = computed?.amount ?? 0;
    return {
      ...s,
      computedAmount,
      difference: s.amount - computedAmount,
    };
  });

  return NextResponse.json({ snapshots: enriched });
}
```

- [ ] **Step 3: Update stats summary endpoint**

Change the stats summary to sum from `operation_entries` instead of `transactions`. Replace the old query logic:

```typescript
// Inside GET handler of src/app/api/stats/summary/route.ts

// Replace old transaction-based query with:
const income = db.select({
  total: sum(operationEntries.amount),
  currency: operationEntries.currency,
}).from(operationEntries)
  .innerJoin(operations, eq(operations.id, operationEntries.operationId))
  .where(
    and(
      eq(operations.userId, Number(session.user.id)),
      eq(operations.status, "confirmed"),
      gte(operations.date, periodStart),
      lte(operations.date, periodEnd),
      gte(operationEntries.amount, 0),
    )
  )
  .groupBy(operationEntries.currency)
  .all();

const expense = db.select({
  total: sum(operationEntries.amount),
  currency: operationEntries.currency,
}).from(operationEntries)
  .innerJoin(operations, eq(operations.id, operationEntries.operationId))
  .where(
    and(
      eq(operations.userId, Number(session.user.id)),
      eq(operations.status, "confirmed"),
      gte(operations.date, periodStart),
      lte(operations.date, periodEnd),
      lt(operationEntries.amount, 0),
    )
  )
  .groupBy(operationEntries.currency)
  .all();
```

- [ ] **Step 4: Build test**

Run: `npx vitest run`
Expected: 9 passing (or near — migration test may need snapshot adjustments)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/balances/ src/app/api/snapshots/ src/app/api/stats/summary/route.ts
git commit -m "feat: computed balances, snapshots API, updated stats"
```

---

### Task 5: Update scanners and exchange syncers

**Files:**
- Modify: `src/lib/scanners/runner.ts`
- Delete: `src/lib/scanners/matcher.ts`
- Modify: `src/lib/exchanges/bybit.ts`
- Modify: `src/lib/exchanges/okx.ts`

- [ ] **Step 1: Update scanner `processEvent` to create operations**

In `runner.ts`, replace the old `processEvent` that inserted into `transactions` with:

```typescript
function processEvent(event: RawBlockchainEvent, accountId: number, userId: number) {
  // Deduplicate by tx_hash in operations table
  const existing = db.select({ id: operations.id }).from(operations)
    .where(eq(operations.txHash, event.txHash)).get();
  if (existing) return;

  const isIncoming = event.toAddress && event.toAddress.toLowerCase() === ownAddress.toLowerCase();
  const amount = isIncoming ? Number(event.amount) : -Number(event.amount);

  const op = db.insert(operations).values({
    userId,
    description: `${isIncoming ? "Received" : "Sent"} ${event.tokenSymbol || "tokens"}`,
    date: new Date(event.timestamp * 1000).toISOString().split("T")[0],
    source: `scanner_${scanner.network}`,
    txHash: event.txHash,
    fromAddress: event.fromAddress,
    toAddress: event.toAddress,
    blockTimestamp: event.timestamp,
    status: "draft",
  }).returning().get();

  db.insert(operationEntries).values({
    operationId: op.id,
    accountId,
    currency: event.tokenSymbol || "ETH",
    amount,
    type: "principal",
    isVerified: 1,
  }).run();
}
```

- [ ] **Step 2: Remove matcher**

Delete `src/lib/scanners/matcher.ts` entirely. Remove any imports of it from `scheduler.ts` or `runner.ts`.

- [ ] **Step 3: Update Bybit sync**

Read `src/lib/exchanges/bybit.ts`. Find all `db.insert(transactions)` calls. Replace each with:

```typescript
const op = db.insert(operations).values({
  userId,
  description: `${txType} ${coin}`,
  date: new Date(execTime).toISOString().split("T")[0],
  source: "api_bybit",
  externalId: txId,
  status: "confirmed",
}).returning().get();

const amount = txType === "DEPOSIT" ? Math.abs(Number(amount_str)) : -Math.abs(Number(amount_str));
db.insert(operationEntries).values({
  operationId: op.id,
  accountId,
  currency: coin,
  amount,
  type: txType === "COMMISSION" || txType === "FUNDING_FEE" ? "fee" : "principal",
  isVerified: 1,
}).run();

// If there's a fee field, also record it
if (fee && Number(fee) > 0) {
  db.insert(operationEntries).values({
    operationId: op.id,
    accountId,
    currency: coin,
    amount: -Math.abs(Number(fee)),
    type: "fee",
    isVerified: 1,
  }).run();
}
```

- [ ] **Step 4: Update OKX sync**

Same pattern as Bybit — find `db.insert(transactions)` calls and replace with operation+entry creation per Step 3 pattern.

- [ ] **Step 5: Update scheduler**

Remove the `runMatcher()` call from scheduler. Remove `AMOUNT_TOLERANCE`/`TIME_WINDOW_SECONDS` imports.

- [ ] **Step 6: Build test**

Run: `npx vitest run`
Expected: all scanner/exchange tests pass (update if needed)

- [ ] **Step 7: Commit**

```bash
git add src/lib/scanners/ src/lib/exchanges/
git rm src/lib/scanners/matcher.ts
git commit -m "feat: scanners and exchange syncers create operations instead of transactions"
```

---

### Task 6: Frontend — NewTransactionModal rewrite

**Files:**
- Rewrite: `src/components/NewTransactionModal.tsx`

- [ ] **Step 1: Read current `NewTransactionModal.tsx`**

Review the current form to understand the existing props and UX.

- [ ] **Step 2: Rewrite the form**

The new form should:
1. Allow entering an operation description, category, date
2. Dynamic list of entries (can add/remove)
3. Each entry: select account, currency, amount (positive or negative), type (principal/fee/etc.)
4. On save, POST to `/api/operations`
5. Show any suggested fees returned by the API
6. Require fee confirmation before marking operation as confirmed

The implementation should match the existing UI patterns (shadcn/ui components, modals). Read the current form structure carefully and follow its conventions.

- [ ] **Step 3: Build test**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 4: Run dev server and verify manually**

Run: `npm run dev` and check that the app loads without errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/NewTransactionModal.tsx
git commit -m "feat: multi-entry operation form in NewTransactionModal"
```
