export interface EvmNetworkConfig {
  name: string;
  apiUrl: string;
  envKey: string;
  rpcUrl: string;
  nativeSymbol: string;
  nativeDecimals: number;
  isEtherScan: boolean;
}

export const EVM_NETWORKS: Record<string, EvmNetworkConfig> = {
  ethereum: {
    name: "ethereum",
    apiUrl: "https://api.etherscan.io/api",
    envKey: "ETHERSCAN_API_KEY",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  bsc: {
    name: "bsc",
    apiUrl: "https://api.bscscan.com/api",
    envKey: "BSCSCAN_API_KEY",
    rpcUrl: "https://bsc-dataseed.binance.org",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  avalanche: {
    name: "avalanche",
    apiUrl: "https://api.snowtrace.io/api",
    envKey: "SNOWTRACE_API_KEY",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    nativeSymbol: "AVAX",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  polygon: {
    name: "polygon",
    apiUrl: "https://api.polygonscan.com/api",
    envKey: "POLYGONSCAN_API_KEY",
    rpcUrl: "https://polygon-rpc.com",
    nativeSymbol: "POL",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  base: {
    name: "base",
    apiUrl: "https://api.basescan.org/api",
    envKey: "BASESCAN_API_KEY",
    rpcUrl: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  arbitrum: {
    name: "arbitrum",
    apiUrl: "https://api.arbiscan.io/api",
    envKey: "ARBISCAN_API_KEY",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  optimism: {
    name: "optimism",
    apiUrl: "https://api-optimistic.etherscan.io/api",
    envKey: "OPTIMISM_API_KEY",
    rpcUrl: "https://mainnet.optimism.io",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  fantom: {
    name: "fantom",
    apiUrl: "https://api.ftmscan.com/api",
    envKey: "FANTOM_API_KEY",
    rpcUrl: "https://rpc.ankr.com/fantom",
    nativeSymbol: "FTM",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  cronos: {
    name: "cronos",
    apiUrl: "https://api.cronoscan.com/api",
    envKey: "CRONOS_API_KEY",
    rpcUrl: "https://evm.cronos.org",
    nativeSymbol: "CRO",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  aurora: {
    name: "aurora",
    apiUrl: "https://api.aurorascan.dev/api",
    envKey: "AURORA_API_KEY",
    rpcUrl: "https://mainnet.aurora.dev",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  moonbeam: {
    name: "moonbeam",
    apiUrl: "https://api.moonbeam.moonscan.io/api",
    envKey: "MOONBEAM_API_KEY",
    rpcUrl: "https://rpc.api.moonbeam.network",
    nativeSymbol: "GLMR",
    nativeDecimals: 18,
    isEtherScan: true,
  },
  gnosis: {
    name: "gnosis",
    apiUrl: "https://api.gnosisscan.io/api",
    envKey: "GNOSIS_API_KEY",
    rpcUrl: "https://rpc.gnosischain.com",
    nativeSymbol: "xDAI",
    nativeDecimals: 18,
    isEtherScan: true,
  },
};

export const ETHERSCAN_NETWORKS = Object.values(EVM_NETWORKS)
  .filter((n) => n.isEtherScan)
  .map((n) => n.name);
