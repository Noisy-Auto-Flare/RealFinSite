# Wallet Balance Sync — Design

## Goal

A manual "Sync balance" button on the accounts list page that fetches the current native token balance from the blockchain for each crypto wallet address and creates a correction operation if the blockchain balance differs from the sum of existing confirmed operations.

## Architecture

### 1. `fetchNativeBalance()` — new method on `IScanner`

```
fetchNativeBalance(address: string): Promise<{ balance: string; decimals: number; blockNumber: number } | null>
```

| Chain | API | Endpoint | Balance format | Decimals | Block identifier |
|-------|-----|----------|---------------|----------|-----------------|
| bsc | BscScan | `api.bscscan.com/api?module=account&action=balance` | wei (string) | 18 | `proxy&action=eth_blockNumber` (hex → int) |
| avalanche | Snowtrace | `api.snowtrace.io/api?module=account&action=balance` | wei (string) | 18 | `proxy&action=eth_blockNumber` (hex → int) |
| ethereum | Etherscan | `api.etherscan.io/api?module=account&action=balance` | wei (string) | 18 | `proxy&action=eth_blockNumber` (hex → int) |
| solana | Helius RPC | `mainnet.helius-rpc.com/?api-key=...` — `getBalance` | lamports (number) | 9 | `result.context.slot` |
| ton | Toncenter v2 | `toncenter.com/api/v2/getAddressInformation` | nanoTON (string) | 9 | `result.block_id.seqno` |

### 2. Correction logic

For each address, after fetching balance:

```
blockchain_balance_native = parseFloat(balance) / 10^decimals
existing_sum = SUM of confirmed operation_entries for (account_id, native_currency)
gap = blockchain_balance_native - existing_sum
```

If `|gap| > 0.000001` (tolerance for dust):
- Insert operation with `source: "balance_correction"`, `status: "confirmed"`
- Insert one operation_entry with `amount: gap`, `currency: native_symbol`
- Update `lastSyncBlock` for the address to the fetched `blockNumber`

Then `recalculateAllBalances()`.

If `gap` is near zero → skip.

### 3. API endpoint

`POST /api/accounts/sync-balances`

- Iterates all addresses in `accountAddresses` where a scanner supports the network
- For each address, runs correction logic
- If `lastSyncBlock` is already ≥ fetched `blockNumber`, do NOT roll it back (use `max(existing, fetched)`)
- On error per address (network, parse, etc.) → log and continue to next address
- Returns `{ success: true, results: [{ accountId, address, network, existingSum, delta, correctionAmount }] }`
- After all addresses processed, calls `recalculateAllBalances()`

### 4. UI

A "Sync balances" `<button>` at the top of `/accounts` page:
- Calls `POST /api/accounts/sync-balances`
- Shows spinner during request
- Displays brief result (e.g., "Synced 3 wallets")
- Re-fetches accounts data to update displayed balances

## Native currency mapping

| network | symbol |
|---------|--------|
| bsc | BNB |
| avalanche | AVAX |
| ethereum | ETH |
| solana | SOL |
| ton | TON |

## Files changed

| File | Change |
|------|--------|
| `src/lib/scanners/interface.ts` | add `fetchNativeBalance` to `IScanner` |
| `src/lib/scanners/evm.ts` | implement `fetchNativeBalance` using block explorer balance API + eth_blockNumber |
| `src/lib/scanners/solana.ts` | implement `fetchNativeBalance` using Helius `getBalance` RPC |
| `src/lib/scanners/ton.ts` | implement `fetchNativeBalance` using Toncenter `getAddressInformation` |
| `src/lib/scanners/runner.ts` | re-export `NATIVE_SYMBOLS`, add `syncAddressBalance()` function |
| `src/app/api/accounts/sync-balances/route.ts` | new API route |
| `src/app/(dashboard)/accounts/page.tsx` | add "Sync balances" button |
