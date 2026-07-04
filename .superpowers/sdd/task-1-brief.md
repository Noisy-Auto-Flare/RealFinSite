# Task 1: Create `evm/config.ts` — EVM network configuration

**Files:**
- Create: `src/lib/scanners/evm/config.ts`

**Acceptance Criteria:**
1. `EvmNetworkConfig` interface with `name`, `apiUrl`, `envKey`, `nativeSymbol`, `nativeDecimals`
2. `EVM_NETWORKS` Record with 12 networks: ethereum, bsc, avalanche, polygon, base, arbitrum, optimism, fantom, cronos, aurora, moonbeam, gnosis
3. Networks use exact values:
   - ethereum: apiUrl=https://api.etherscan.io/api, envKey=ETHERSCAN_API_KEY, nativeSymbol=ETH, nativeDecimals=18
   - bsc: apiUrl=https://api.bscscan.com/api, envKey=BSCSCAN_API_KEY, nativeSymbol=BNB, nativeDecimals=18
   - avalanche: apiUrl=https://api.snowtrace.io/api, envKey=SNOWTRACE_API_KEY, nativeSymbol=AVAX, nativeDecimals=18
   - polygon: apiUrl=https://api.polygonscan.com/api, envKey=POLYGONSCAN_API_KEY, nativeSymbol=POL, nativeDecimals=18
   - base: apiUrl=https://api.basescan.org/api, envKey=BASESCAN_API_KEY, nativeSymbol=ETH, nativeDecimals=18
   - arbitrum: apiUrl=https://api.arbiscan.io/api, envKey=ARBISCAN_API_KEY, nativeSymbol=ETH, nativeDecimals=18
   - optimism: apiUrl=https://api-optimistic.etherscan.io/api, envKey=OPTIMISM_API_KEY, nativeSymbol=ETH, nativeDecimals=18
   - fantom: apiUrl=https://api.ftmscan.com/api, envKey=FANTOM_API_KEY, nativeSymbol=FTM, nativeDecimals=18
   - cronos: apiUrl=https://api.cronoscan.com/api, envKey=CRONOS_API_KEY, nativeSymbol=CRO, nativeDecimals=18
   - aurora: apiUrl=https://api.aurorascan.dev/api, envKey=AURORA_API_KEY, nativeSymbol=ETH, nativeDecimals=18
   - moonbeam: apiUrl=https://api.moonbeam.moonscan.io/api, envKey=MOONBEAM_API_KEY, nativeSymbol=GLMR, nativeDecimals=18
   - gnosis: apiUrl=https://api.gnosisscan.io/api, envKey=GNOSIS_API_KEY, nativeSymbol=xDAI, nativeDecimals=18
4. `npx tsc --noEmit` passes with no errors

No testing framework for this task — verify with `npx tsc --noEmit`.
