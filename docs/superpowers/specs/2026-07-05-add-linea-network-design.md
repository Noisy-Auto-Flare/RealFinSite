# Add Linea Network to FinTracker Scanner

## Goal
Add Linea (EVM chain, chain ID 59144) as a supported network in the blockchain scanner, enabling users to track Linea addresses and balances.

## Background
The scanner uses Etherscan-compatible block explorer APIs for all EVM chains. A new EVM network is added by:
1. Adding an entry to the `EVM_NETWORKS` config map
2. Registering the env var name in `api-keys.ts`
3. Adding the corresponding field in the settings UI
4. Adding the network to the new-account network picker

No database migrations, new scanner logic, or test changes are needed.

## Changes

### 1. `src/lib/scanners/evm/config.ts` — Add Linea entry
```typescript
linea: {
  name: "Linea",
  apiUrl: "https://api.lineascan.build/api",
  envKey: "LINEASCAN_API_KEY",
  nativeSymbol: "ETH",
  nativeDecimals: 18,
},
```
- Explorer: LineaScan (`api.lineascan.build`)
- Native currency: ETH (Linea is an Ethereum L2)
- Decimals: 18 (standard EVM)

### 2. `src/lib/scanners/api-keys.ts` — Add env var mapping
Add to `ENV_MAP`: `"linea" → "LINEASCAN_API_KEY"`

### 3. `src/app/(dashboard)/settings/page.tsx` — Add settings field
Add a `type="password"` input for `LINEASCAN_API_KEY` between Gnosis and Solana entries, labeled `"Linea (LineaScan)"`.

### 4. `src/app/(dashboard)/accounts/new/page.tsx` — Add to network picker
Add `"linea"` to the list of selectable EVM networks if the list is hardcoded.

## Why This Works
- `getScanner("linea")` checks `EVM_NETWORKS["linea"]` → found → returns `new EvmScanner("linea")`
- `EvmScanner` reads config from `EVM_NETWORKS["linea"]`, uses `api.lineascan.build/api` for all queries
- LineaScan API is Etherscan-compatible — same `?module=account&action=txlist&...` parameters
- API key resolves via `LINEASCAN_API_KEY` env var or `blockchain_api_keys` DB table
- Settings page already renders all EVM networks dynamically — adding one more is consistent

## Verification
- After deploy: create a Linea address for an account → scanner cycle picks it up
- `GET /api/beancount/transactions` shows Linea transactions (if any)
- Balance sync works via `syncAddressBalance()`
