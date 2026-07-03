# Task 2: Migration script

**Files:**
- Modify: `src/db/migrate.ts`

**Interfaces:**
- Consumes: `sqlite` (better-sqlite3 Database instance)
- Produces: 
  - `migrateToMultiLeg(sqlite)` — migrate old transactions to operations+entries, drop old tables
  - `updateBalances(sqlite)` — log deprecation of updated_at column
  - `recalculateAllBalances(sqlite)` — recompute balances from confirmed entries
  - Integration into migration runner

**Context:** The current `src/db/migrate.ts` is a script that runs top-to-bottom. The migration logic uses a module-level `sqlite` instance. The plan's `recalculateAllBalances` needs to be exported so it can be called from Tasks 3-4 API code.

## Steps

### Step 1: Write the migration function

Add a `migrateToMultiLeg(sqlite)` function that:
1. Creates `operations`, `operation_entries`, `balance_snapshots` tables if they don't exist
2. If old `transactions` table exists, iterates each row and creates operation + entries
3. Drops `matched_transactions` and `transactions` tables after migration

Migration rules per transaction type:
- `income` → operation + 1 entry: `(+amount, principal, verified=1)`
- `expense` → operation + 1 entry: `(-|amount|, principal, verified=1)`
- `transfer` → operation + 2 entries: `source: (-|amount|, principal)`, `counterparty: (+|amount|, principal)`
- `exchange` → operation + 2 entries: `(-|amount_from|, currency_from)`, `(+|amount_to|, currency_to)`

### Step 2: Write `updateBalances()` function

Check if `balances` table has `updated_at` column. If so, log deprecation message.

### Step 3: Write `recalculateAllBalances()` function

```typescript
export function recalculateAllBalances(sqlite: Database) {
  sqlite.exec("DELETE FROM balances;");
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
}
```

**This function must be exported** — it's used by Tasks 3-4.

### Step 4: Integrate into migration runner

At the end of the migration script, add calls to the three new functions (after the existing table creation code).

### Step 5: Build test

Run: `npx vitest run`
Expected: all tests pass (existing migrate.test.ts may also test migration script).

### Step 6: Commit

```bash
git add src/db/migrate.ts
git commit -m "feat: migration script for multi-leg operations, recalculate balances"
```
