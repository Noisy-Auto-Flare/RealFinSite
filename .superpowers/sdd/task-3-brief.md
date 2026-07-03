# Task 3: Operations API — CRUD

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
- Consumes: `db` from `@/db`, `operations`/`operationEntries` from `@/db/schema`
- Produces: Full CRUD API for operations with fee auto-detection

**Important: Import note for `recalculateAllBalances`**

The `recalculateAllBalances` function in `src/db/migrate.ts` currently takes a `sqlite: Database` parameter. For API routes, it needs to be called without arguments using the module-level sqlite from migrate.ts. **Fix the function signature**: make the parameter optional with a default:

```typescript
// In migrate.ts, change:
export function recalculateAllBalances(sqlite: Database) { ... }
// To:
export function recalculateAllBalances(sqlite?: Database) {
  const _sqlite = sqlite || (() => { throw new Error("no sqlite") })();
  // or better: use module-level sqlite as default
}
```

OR better: keep a module-level reference in migrate.ts:

```typescript
function _recalc() { ... existing code using the sqlite param ... }
// For API usage:
export function recalculateAllBalances() { _recalc(moduleSqlite); }
// For migration:
export function recalculateAllBalancesFrom(sqlite: Database) { _recalc(sqlite); }
```

Simplify: just make `recalculateAllBalances` always use the module-level `sqlite` constant at the top of migrate.ts.

## Steps from plan

### Step 1: Create `POST /api/operations`

File: `src/app/api/operations/route.ts`
- Import from `@/db`, `@/db/schema`, `@/db/migrate`
- `detectImplicitFees()` utility function
- `POST` handler: validate entries, insert operation + entries, detect fees, recalculate balances, return

### Step 2: `GET /api/operations` with filtering/pagination

Same file. Query params: page, limit, date_from, date_to, category, status, search

### Step 3: Operation detail, update, delete

File: `src/app/api/operations/[id]/route.ts`
- GET: single operation with entries
- PATCH: update description, category, date, status. If status→confirmed, recalculate
- DELETE: delete operation (cascade handles entries), recalculate balances

### Step 4: Unverified operations

File: `src/app/api/operations/unverified/route.ts`
- GET: all draft operations with isVerified=0 entries, grouped by operation

### Step 5: Verify entry

File: `src/app/api/entries/[id]/verify/route.ts`
- PATCH: set isVerified=1 on fee entry, optionally update amount
- recalculate balances

### Step 6: Remove old API files

Delete:
- `src/app/api/transactions/route.ts`
- `src/app/api/transactions/[id]/route.ts`
- `src/app/api/transactions/export/route.ts`
- `src/app/api/matches/route.ts`

### Step 7: Build test

Run: `npx vitest run`
Expected: all tests pass (some old transaction-importing tests may fail — fix them)

### Step 8: Commit

```bash
git add src/app/api/
git rm src/app/api/transactions/
git rm src/app/api/matches/
git commit -m "feat: operations API with CRUD, fee detection, unverified queue"
```
