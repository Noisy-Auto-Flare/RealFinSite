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

export interface IScanner {
  network: string;
  fetchNewTransactions(
    address: string,
    fromBlock: number
  ): Promise<RawBlockchainEvent[]>;
}

export async function getScanner(network: string): Promise<IScanner | null> {
  switch (network) {
    case "bsc":
    case "avalanche":
    case "ethereum": {
      const { EvmScanner } = await import("./evm");
      return new EvmScanner(network);
    }
    case "solana": {
      const { SolanaScanner } = await import("./solana");
      return new SolanaScanner();
    }
    case "ton": {
      const { TonScanner } = await import("./ton");
      return new TonScanner();
    }
    default:
      return null;
  }
}
