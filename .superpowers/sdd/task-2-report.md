# Task 2 Report: Add `tokens` table to schema and migration

## What I implemented

1. **`src/db/schema.ts`**: Added `tokens` table after `blockchainApiKeys` with:
   - `id` (integer primary key autoincrement)
   - `chain` (text, not null)
   - `contractAddress` → `contract_address` (text, not null)
   - `symbol` (text, not null)
   - `name` (text, nullable)
   - `decimals` (integer, not null, default 18)
   - `logoUrl` → `logo_url` (text, nullable)
   - `metadataSource` → `metadata_source` (text, default `'explorer'`)
   - `lastMetadataFetch` → `last_metadata_fetch` (text, default `CURRENT_TIMESTAMP`)
   - Unique index `chain_contract_idx` on `(chain, contract_address)` via Drizzle `uniqueIndex`

2. **`src/db/migrate.ts`**:
   - Bumped `SCHEMA_VERSION` from 1 to 2 (line 17)
   - Added `[tokens]` section before `[indexes]` with `createTable()` for the tokens table and `createIndex()` for `chain_contract_idx` (unique)

## Test results

- `npx tsc --noEmit` — passes with no errors

## Files changed

- `src/db/schema.ts` — added `tokens` table definition (export + uniqueIndex)
- `src/db/migrate.ts` — bumped SCHEMA_VERSION to 2, added tokens table creation + index

## Self-review findings

- All acceptance criteria met
- Column naming convention matches existing patterns (`contract_address`, `logo_url`, `metadata_source`, `last_metadata_fetch`)
- `uniqueIndex` pattern matches existing `exchangeRates` and `balances` tables
- `createTable`/`createIndex` helpers used correctly in migrate.ts
- The `tokens` section is placed before `[indexes]` per brief instructions

## Issues or concerns

- None
