# Schema Versioning & Blockchain API Keys

## Problem

1. **`recalculateAllBalances()` runs on every HMR restart** — module-level `initialized` flag resets, causing `DELETE FROM balances` + re-INSERT on every file change. Write-locked backup files accumulate.

2. **Scanners silently return nothing** — API keys read from `process.env` only (`ETHERSCAN_API_KEY`, `HELIUS_API_KEY`, `TONCENTER_API_KEY`). No env vars set → empty responses. No way to configure via UI.

## Solution

### 1. Schema Versioning (`migrate.ts`)

- New `_schema_version` table with single `version` row.
- `SCHEMA_VERSION = 1` constant.
- `runMigrations()`: if `_schema_version.version >= SCHEMA_VERSION`, return instantly — no logs, no backup, no DDL, no recalculation.
- After migration work: `UPSERT INTO _schema_version SET version = SCHEMA_VERSION`.
- Future schema changes bump `SCHEMA_VERSION` → migration runs once.

### 2. Transactional Recalculation

`recalculateAllBalances()` wraps DELETE + INSERTs in `BEGIN/COMMIT` so readers never see an empty state.

### 3. Blockchain API Keys

- New table `blockchain_api_keys` (id, network UNIQUE, api_key, created_at, updated_at).
- Helper `getNetworkApiKey(network)` — checks env var first, then DB.
- Scanners call helper instead of `process.env` directly.
- `GET/PUT /api/settings/blockchain-keys` — returns masked keys, accepts upsert array.
- Settings page at `/dashboard/settings` with per-network input fields.

### Migration Flow

On existing DB: version = 0 → migration runs → creates `blockchain_api_keys` table → sets version = 1. All subsequent starts: version = 1 >= 1 → skip.
