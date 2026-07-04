# Task 2: Add `tokens` table to schema and migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrate.ts`

**Acceptance Criteria:**
1. Add `tokens` table to `src/db/schema.ts` with:
   - `id` integer primary key autoincrement
   - `chain` text not null
   - `contractAddress` text not null
   - `symbol` text not null
   - `name` text (nullable)
   - `decimals` integer not null default 18
   - `logoUrl` text (nullable)
   - `metadataSource` text default 'explorer'
   - `lastMetadataFetch` text default CURRENT_TIMESTAMP
   - Unique index `chain_contract_idx` on `(chain, contractAddress)`
2. Bump `SCHEMA_VERSION` from 1 to 2 in `migrate.ts`
3. Add `tokens` table creation to `runMigrations` in `migrate.ts` (before `[indexes]` section) using `createTable()` + `createIndex()` helpers
4. `npx tsc --noEmit` passes with no errors

**Context:**
- The `blockchainApiKeys` table is the last table defined in schema.ts — add `tokens` after it
- migrate.ts uses `SCHEMA_VERSION = 1` on line 17 — change it to `SCHEMA_VERSION = 2`
- `createTable()` and `createIndex()` helper functions already exist in migrate.ts
- The `[indexes]` section starts at line 375 — add tokens section before it
- Use `createIndex(s, "chain_contract_idx", "tokens", "chain, contract_address", true)` — note the `true` for unique
