# Task 3 Report: Rewrite `evm.ts` into modular `evm/scanner.ts`

## What I implemented

1. **Created `src/lib/scanners/evm/scanner.ts`** — new `EvmScanner` class implementing `IScanner`:
   - Constructor takes `network: string`, throws if network not in `EVM_NETWORKS`
   - `getApiKey()`: `process.env[this.config.envKey] || getNetworkApiKey(this.network) || ""`
   - `fetchExplorer(action, address, fromBlock)`: inline pagination via `while` loop, fetches next page if result >= 10000 items, all requests use `AbortSignal.timeout(15000)`
   - `fetchNewTransactions`: calls `fetchExplorer` for `txlist` and `tokentx`, merges, sorts by timestamp ascending
   - Normal tx events include `tokenSymbol: this.config.nativeSymbol`
   - Token tx events include `tokenSymbol` from explorer response
   - `fetchNativeBalance`: calls `balance` action + `eth_blockNumber` proxy action
   - `fetchAllBalances`: returns native balance only (via `fetchNativeBalance`)

2. **Updated `src/lib/scanners/interface.ts`** — changed import from `"./evm"` to `"./evm/scanner"`

3. **Deleted `src/lib/scanners/evm.ts`** — old monolithic scanner file

## Test results

- `npx tsc --noEmit` — passes with no errors

## Files changed

- `src/lib/scanners/evm/scanner.ts` — created (new modular scanner)
- `src/lib/scanners/interface.ts` — updated import path
- `src/lib/scanners/evm.ts` — deleted

## Self-review findings

- All acceptance criteria met
- Pagination inlined in `fetchExplorer` per brief instruction
- Uses `EVM_NETWORKS` config (12 networks) and `getNetworkApiKey` helper
- Native tx events now include `tokenSymbol: this.config.nativeSymbol` (consistent with plan code)
- `fetchAllBalances` uses `this.config.nativeSymbol` instead of hardcoded map

## Issues or concerns

- `getScanner` in `interface.ts` still only routes `ethereum`, `bsc`, `avalanche` to `EvmScanner` via its switch statement. Other networks from `EVM_NETWORKS` (polygon, base, arbitrum, etc.) will return `null` — this is pre-existing behavior and not part of this task scope.
