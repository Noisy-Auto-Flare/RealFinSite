# RealFinSite: Architectural Refactoring Design

**Date:** 2026-07-05
**Project:** RealFinSite — Personal finance tracker
**Stack:** Next.js 16, SQLite + Drizzle ORM, NextAuth.js, Vitest

---

## 1. Motivation

The codebase (~75 files, ~6200 lines) has grown organically with several architectural problems:

- **Mixed responsibilities** — `db/migrate.ts` contains runtime `recalculateAllBalances` alongside DDL migrations; `init.ts` handles DB init + seeding + scheduler startup in one file.
- **Duplication** — `formatAmount` defined in 4+ places (pages, components, utils); `dashboard/page.tsx` and `stats/page.tsx` share ~80% identical code.
- **Raw SQL bypassing Drizzle** — beancount modules use direct prepared statements, losing type safety when schema changes.
- **Bugs** — docker-compose DB path mismatch, EVM scanner doesn't fetch token balances, exchange sync misses `markDirty()`.
- **No test infrastructure** — `vitest.config.ts` references a missing `setup.ts`.
- **No input validation** — all validation is ad-hoc string/number checks.

## 2. Target Architecture

```
src/
├── app/                        # Next.js App Router (unchanged structure)
├── components/
│   ├── ui/                     # Select, Toast, EmptyState, AnimatedCounter
│   ├── transactions/           # TransactionRow, NewTransactionModal
│   └── ...Navbar, ClientSessionProvider
├── db/
│   ├── schema.ts
│   ├── index.ts                # DB connection (Drizzle)
│   ├── init.ts                 # (new) ensure DB exists, run migrations
│   ├── migrate.ts              # (cleaned) DDL migrations only
│   └── seed.ts
├── lib/
│   ├── auth/
│   │   ├── index.ts            # re-export from @/auth.ts
│   │   └── server-utils.ts     # getCurrentUserId, isMaster, requireAuth
│   ├── balances/
│   │   ├── recalculate.ts      # recalculateAllBalances (moved from db/migrate)
│   │   ├── snapshots.ts        # snapshot logic
│   │   └── index.ts
│   ├── beancount/              # (unchanged structure, replace raw SQL with Drizzle)
│   ├── exchanges/              # (unchanged)
│   ├── formatting/
│   │   └── index.ts            # formatAmount, formatCurrency (single source of truth)
│   ├── operations/
│   │   ├── fees.ts             # detectImplicitFees
│   │   ├── operation-types.ts  # moved from lib/
│   │   └── index.ts
│   ├── rates/                  # (unchanged)
│   ├── scanners/
│   │   ├── evm/
│   │   ├── interface.ts        # + factory (unchanged)
│   │   ├── runner.ts           # (unchanged)
│   │   ├── scheduler.ts        # (unchanged)
│   │   ├── solana.ts           # (unchanged)
│   │   ├── ton.ts              # (unchanged)
│   │   └── api-keys.ts         # (unchanged)
│   ├── tokens/
│   │   ├── cache.ts            # in-memory LRU cache
│   │   ├── fetcher.ts          # API calls (EVM, Solana)
│   │   └── index.ts            # orchestrator
│   ├── validation/
│   │   └── index.ts            # zod schemas
│   ├── crypto.ts               # (unchanged, fix fallback key warning)
│   ├── init.ts                 # (reduced) wrapper calling db/init + scheduler
│   ├── logger.ts               # (unchanged)
│   └── action-log.ts           # (unchanged)
├── middleware.ts                # (unchanged)
└── test/
    ├── setup.ts                # in-memory SQLite + migrations + seed data
    ├── auth.test.ts
    ├── crypto.test.ts
    ├── schema.test.ts
    ├── rates.test.ts
    ├── bybit.test.ts
    ├── okx.test.ts
    ├── network-scanners.test.ts
    ├── migration.test.ts
    ├── deployment.test.ts
    ├── balances/
    │   └── recalculate.test.ts
    └── operations/
        ├── fees.test.ts
        └── operation-types.test.ts
```

### Key principle

Each `lib/{domain}/` subdirectory has:
1. **Pure logic** — functions without side effects, testable in isolation
2. **Data access** — Drizzle queries (no raw SQL)
3. **Public API** — `index.ts` re-exports what external modules should use

## 3. Module Decomposition Details

### 3.1 `lib/balances/recalculate.ts`

Move `recalculateAllBalances` from `src/db/migrate.ts` to its own module. Add incremental variant.

```typescript
export function recalculateAllBalances(): void
export function recalculateAccountBalances(accountId: number): void  // incremental
```

`recalculateAccountBalances(id)` recalculates balances for a single account by re-reading all confirmed operations + entries for that account. This avoids a full table scan — currently every operation confirmation deletes and rebuilds ALL balances.

### 3.2 `lib/tokens/` (split from `token-metadata.ts`)

- **`cache.ts`**: In-memory `Map<string, TokenInfo>` — dedup requests, reduce DB reads.
- **`fetcher.ts`**: Network calls to block explorer APIs. No cache logic, no DB writes. Returns raw data or null.
- **`index.ts`**: Orchestrator: cache → DB → fetcher → DB → cache. Public `getTokenMetadata()`.

### 3.3 `db/init.ts` + `lib/init.ts`

Split current `lib/init.ts` responsibilities:

- **`db/init.ts`**: `ensureDbExists()` creates SQLite file + directory, `runPendingMigrations()` applies DDL.
- **`lib/init.ts`**: Thin wrapper that calls the above, then starts background jobs via `scheduler.ts`. Called once from `layout.tsx`.

### 3.4 `lib/operations/fees.ts`

Extract `detectImplicitFees` from `app/api/operations/route.ts`:

```typescript
export interface FeeEntry {
  accountId: number;
  currency: string;
  amount: number;
  type: "fee";
  isVerified: number;
}

export function detectImplicitFees(entries: NewEntry[]): FeeEntry | null
```

Logic: sum all entries for each currency. If sum ≠ 0, create a fee/discount entry for the remainder.

### 3.5 Beancount raw SQL → Drizzle

Replace `prepare()`/`all()` calls in `beancount/accounts.ts` and `beancount/regenerate.ts` with `db.select().from(...).where(...)`.

### 3.6 `lib/formatting/index.ts`

Single source of truth for `formatAmount`. Remove all duplicate definitions from:
- `TransactionRow.tsx`
- `dashboard/page.tsx`
- `transactions/page.tsx`
- `lib/utils.ts` (keep `AccountType` types, move formatting)

## 4. Bug Fixes

| Bug | Location | Fix |
|---|---|---|
| DB path mismatch | `docker-compose.yml:19` | `DATABASE_URL=/data/fintracker.db` |
| EVM scanner: no token balances | `scanners/evm/scanner.ts` | Add `?module=account&action=tokenlist` call in `fetchAllBalances` |
| Exchange sync: no `markDirty()` | `exchanges/*.ts` | Call `markDirty()` after `syncAccount()` completes |
| `getCurrentUserId` NaN | `lib/server-utils.ts` | Add `Number.isNaN` check, return null |

## 5. Test Strategy

### 5.1 Setup (`src/test/setup.ts`)

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
// create in-memory DB, run DDL, seed 1 user + 1 account + 1 operation
```

### 5.2 Test Coverage

| File | Tests |
|---|---|
| `fees.test.ts` | 6 cases: no fee when balanced, fee when remainder, discount when negative, existing fee not duplicated, multiple currencies, empty entries |
| `recalculate.test.ts` | 4 cases: fresh recalc, incremental by account, after new operation, after entry verification |
| `crypto.test.ts` | 2 cases: encrypt/decrypt roundtrip, wrong key fails |
| `operation-types.test.ts` | 2 cases: label lookup returns correct value, unknown value returns itself |

## 6. Implementation Order (14 Commits)

Each commit leaves the app functional. Run `lint && typecheck && test` before each commit.

```
1. test: add test setup with in-memory SQLite
2. test: cover detectImplicitFees, crypto, recalculateAllBalances
3. refactor: extract detectImplicitFees → lib/operations/fees.ts
4. refactor: extract recalculateAllBalances → lib/balances/recalculate.ts
5. refactor: split token-metadata → lib/tokens/{cache,fetcher,index}.ts
6. refactor: clean init.ts → db/init.ts + lib/init.ts
7. refactor: add requireAuth() wrapper, reduce API boilerplate
8. refactor: consolidate formatAmount into lib/formatting/index.ts
9. refactor: convert beancount raw SQL to Drizzle ORM
10. fix: docker-compose DATABASE_URL → fintracker.db
11. fix: EVM scanner fetch token balances (all ERC-20)
12. fix: exchange sync calls markDirty()
13. fix: getCurrentUserId() NaN guard
14. refactor: extract shared UI from dashboard/stats into reusable components
```

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Beancount raw SQL → Drizzle changes query behavior | Write integration tests that compare output before/after |
| `recalculateAccountBalances` changes balance values | Tests verify exact expected balances |
| `init.ts` restructure breaks startup | Manual smoke test: `npm run dev` → health check passes |
| `formatAmount` removal from pages breaks rendering | TypeScript will catch all import errors |
| Token metadata fetcher restructure breaks scanner flow | Integration test with mock API responses |
