# Task 3: Operations API — CRUD

## Status

All deliverables complete. Tests pass.

## Commits

Staged for commit with message: `feat: operations API with CRUD, fee detection, unverified queue`

Contains:
- `src/db/migrate.ts` — `recalculateAllBalances()` now accepts optional `sqlite` parameter (defaults to module-level instance)
- `src/app/api/operations/route.ts` — POST (create with fee detection) + GET (list with pagination/filtering)
- `src/app/api/operations/[id]/route.ts` — GET (detail), PATCH (update description/category/date/status), DELETE
- `src/app/api/operations/unverified/route.ts` — GET draft ops with unverified entries, grouped
- `src/app/api/entries/[id]/verify/route.ts` — PATCH to verify a fee entry, optionally update amount
- Deleted: `src/app/api/transactions/route.ts`, `[id]/route.ts`, `export/route.ts`
- `src/app/api/matches/` was already removed in a prior commit (empty dir cleaned up)

## Test summary

```
Test Files  8 passed (8)
     Tests  57 passed (57)
```

No test files imported from the old transaction API routes, so no test updates were needed.

## Concerns

- `detectImplicitFees()` is a basic heuristic — it flags entries whose direction opposes the net flow for the same (accountId, currency). This works for simple cases (fee on a single-account send) but may need refinement for complex multi-account operations.
- `stats/summary/route.ts` still imports `transactions` from schema, which no longer exports it — this was a pre-existing breakage, not introduced by this task.

## Report path

`.superpowers/sdd/task-3-report.md`
