# Task 3: Rewrite `evm.ts` into modular `evm/scanner.ts`

**Files:**
- Create: `src/lib/scanners/evm/scanner.ts`
- Delete: `src/lib/scanners/evm.ts`

**Acceptance Criteria:**
1. Create `evm/` directory and `evm/scanner.ts` implementing `IScanner`
2. EvmScanner uses `EVM_NETWORKS` from `./config` and `getNetworkApiKey` from `../api-keys`
3. Support both `txlist` and `tokentx` explorer endpoints
4. Pagination: fetch next page if result >= 10000 items
5. `fetchNewTransactions` returns sorted events (by timestamp)
6. `fetchNativeBalance` uses `balance` action + `eth_blockNumber` proxy action
7. `fetchAllBalances` returns native balance only
8. Delete old `src/lib/scanners/evm.ts`
9. `npx tsc --noEmit` passes with no errors

**Implementation detail:**
- The old `evm.ts` has a `fetchPage` method; the new scanner should inline pagination in `fetchExplorer` (see plan code)
- Constructor takes `network: string`, throws if network not in EVM_NETWORKS
- `getApiKey()` falls back: `process.env[cfg.envKey] || getNetworkApiKey(network) || ""`
- All explorer calls use `AbortSignal.timeout(15000)`
- Full code is in the plan — use it verbatim

No tests — verify with `npx tsc --noEmit`.
