export interface RawBlockchainEvent {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenContract: string | null;
  decimals: number;
  timestamp: number;
  blockNumber: number;
  tokenSymbol?: string;
}

export interface NativeBalanceResult {
  balance: string;
  decimals: number;
  blockNumber: number;
}

export interface BalanceEntry {
  currency: string;
  balance: string;
  decimals: number;
  tokenContract?: string;
}

export interface AllBalancesResult {
  balances: BalanceEntry[];
  blockNumber: number;
}

export interface IScanner {
  network: string;
  fetchNewTransactions(
    address: string,
    fromBlock: number
  ): Promise<RawBlockchainEvent[]>;
  fetchNativeBalance(address: string): Promise<NativeBalanceResult | null>;
  fetchAllBalances(address: string): Promise<AllBalancesResult | null>;
}

import { EVM_NETWORKS } from "./evm/config";

export async function getScanner(network: string): Promise<IScanner | null> {
  if (EVM_NETWORKS[network]) {
    const { EvmScanner } = await import("./evm/scanner");
    return new EvmScanner(network);
  }

  switch (network) {
    case "solana": {
      const { SolanaScanner } = await import("./solana");
      return new SolanaScanner();
    }
    case "ton": {
      const { TonScanner } = await import("./ton");
      return new TonScanner();
    }
    case "tron": {
      const { TronScanner } = await import("./tron");
      return new TronScanner();
    }
    default:
      return null;
  }
}
