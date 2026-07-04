export interface EvmNetworkConfig {
  name: string;
  apiUrl: string;
  envKey: string;
  nativeSymbol: string;
  nativeDecimals: number;
}

export const EVM_NETWORKS: Record<string, EvmNetworkConfig> = {
  ethereum: {
    name: "ethereum",
    apiUrl: "https://api.etherscan.io/api",
    envKey: "ETHERSCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  bsc: {
    name: "bsc",
    apiUrl: "https://api.bscscan.com/api",
    envKey: "BSCSCAN_API_KEY",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
  },
  avalanche: {
    name: "avalanche",
    apiUrl: "https://api.snowtrace.io/api",
    envKey: "SNOWTRACE_API_KEY",
    nativeSymbol: "AVAX",
    nativeDecimals: 18,
  },
  polygon: {
    name: "polygon",
    apiUrl: "https://api.polygonscan.com/api",
    envKey: "POLYGONSCAN_API_KEY",
    nativeSymbol: "POL",
    nativeDecimals: 18,
  },
  base: {
    name: "base",
    apiUrl: "https://api.basescan.org/api",
    envKey: "BASESCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  arbitrum: {
    name: "arbitrum",
    apiUrl: "https://api.arbiscan.io/api",
    envKey: "ARBISCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  optimism: {
    name: "optimism",
    apiUrl: "https://api-optimistic.etherscan.io/api",
    envKey: "OPTIMISM_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  fantom: {
    name: "fantom",
    apiUrl: "https://api.ftmscan.com/api",
    envKey: "FANTOM_API_KEY",
    nativeSymbol: "FTM",
    nativeDecimals: 18,
  },
  cronos: {
    name: "cronos",
    apiUrl: "https://api.cronoscan.com/api",
    envKey: "CRONOS_API_KEY",
    nativeSymbol: "CRO",
    nativeDecimals: 18,
  },
  aurora: {
    name: "aurora",
    apiUrl: "https://api.aurorascan.dev/api",
    envKey: "AURORA_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  moonbeam: {
    name: "moonbeam",
    apiUrl: "https://api.moonbeam.moonscan.io/api",
    envKey: "MOONBEAM_API_KEY",
    nativeSymbol: "GLMR",
    nativeDecimals: 18,
  },
  gnosis: {
    name: "gnosis",
    apiUrl: "https://api.gnosisscan.io/api",
    envKey: "GNOSIS_API_KEY",
    nativeSymbol: "xDAI",
    nativeDecimals: 18,
  },
};
