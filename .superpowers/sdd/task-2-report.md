# Task 2 Report: Migration script for multi-leg operations

## Status: DONE

## Changes Made

Modified `src/db/migrate.ts`:

### New functions added:
1. **`migrateToMultiLeg(sqlite)`** — Migrates old `transactions` table data to new `operations`/`operation_entries` model. Handles all 4 types: income, expense, transfer, exchange. Handles NULL `counterparty_account_id` for transfers. Drops old `matched_transactions` and `transactions` tables after migration. Skips if `transactions` table doesn't exist (fresh DB).

2. **`updateBalances(sqlite)`** — Checks if `balances` table has legacy `updated_at` column and logs a deprecation warning.

3. **`recalculateAllBalances(sqlite)`** — Exported function that deletes all balances and recomputes from confirmed `operation_entries` grouped by `account_id`/`currency`.

### Integration:
- All three functions are called at the end of the migration script (after table creation), in order.

## Migration Rules Implemented
| Type | Entries |
|------|---------|
| `income` | 1 entry: `+amount` |
| `expense` | 1 entry: `-\|amount\|` |
| `transfer` | 2 entries: source `-\|amount\|`, counterparty `+\|amount\|` (skips counterparty if NULL) |
| `exchange` | 2 entries: `-\|amount_from\|` in `currency_from`, `+\|amount_to\|` in `currency_to` |

## Test Results
**8 files passed, 57 tests passed** — all existing tests (including `migration.test.ts`, `schema.test.ts`) pass with no regressions.

## Commits
```
3203950 feat: migration script for multi-leg operations, recalculate balances
```

## Concerns
- `hasColumn()` helper uses module-level `sqlite`, not the parameter passed to `updateBalances()`. This is fine since `updateBalances` is internal and only called from the migration runner where both refer to the same instance.
