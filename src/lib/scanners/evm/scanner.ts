import { IScanner, RawBlockchainEvent, NativeBalanceResult, AllBalancesResult } from "../interface";
import { getNetworkApiKey } from "../api-keys";
import { EVM_NETWORKS, EvmNetworkConfig } from "./config";

interface ExplorerTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
  contractAddress?: string;
  tokenDecimal?: string;
  tokenSymbol?: string;
  gasPrice?: string;
  gasUsed?: string;
}

interface ExplorerResponse {
  status: string;
  message: string;
  result: ExplorerTx[];
}

export class EvmScanner implements IScanner {
  network: string;
  config: EvmNetworkConfig;

  constructor(network: string) {
    const cfg = EVM_NETWORKS[network];
    if (!cfg) throw new Error(`Unsupported EVM network: ${network}`);
    this.network = network;
    this.config = cfg;
  }

  getApiKey(): string {
    return process.env[this.config.envKey] || getNetworkApiKey(this.network) || "";
  }

  private async fetchExplorer(
    action: string,
    address: string,
    fromBlock: number
  ): Promise<ExplorerTx[]> {
    const apiKey = this.getApiKey();
    const results: ExplorerTx[] = [];
    let page = 1;

    while (true) {
      const url = `${this.config.apiUrl}?module=account&action=${action}&address=${address}&startblock=${fromBlock}&endblock=99999999&sort=asc&page=${page}&offset=10000&apikey=${apiKey}`;

      let res: Response;
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      } catch {
        break;
      }
      if (!res.ok) break;

      let data: ExplorerResponse;
      try {
        data = await res.json();
      } catch {
        break;
      }

      if (data.status !== "1" || !Array.isArray(data.result)) break;

      results.push(...data.result);

      if (data.result.length < 10000) break;
      page++;
    }

    return results;
  }

  async fetchNewTransactions(address: string, fromBlock: number): Promise<RawBlockchainEvent[]> {
    const events: RawBlockchainEvent[] = [];

    const normalTxs = await this.fetchExplorer("txlist", address, fromBlock);
    for (const tx of normalTxs) {
      if (tx.value === "0") continue;
      events.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: tx.value,
        tokenContract: null,
        decimals: this.config.nativeDecimals,
        timestamp: parseInt(tx.timeStamp, 10),
        blockNumber: parseInt(tx.blockNumber, 10),
        tokenSymbol: this.config.nativeSymbol,
      });
    }

    const tokenTxs = await this.fetchExplorer("tokentx", address, fromBlock);
    for (const tx of tokenTxs) {
      const decimals = parseInt(tx.tokenDecimal || String(this.config.nativeDecimals), 10);
      events.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: tx.value,
        tokenContract: tx.contractAddress || null,
        decimals,
        timestamp: parseInt(tx.timeStamp, 10),
        blockNumber: parseInt(tx.blockNumber, 10),
        tokenSymbol: tx.tokenSymbol,
      });
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }

  async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
    const apiKey = this.getApiKey();

    try {
      const balanceRes = await fetch(
        `${this.config.apiUrl}?module=account&action=balance&address=${address}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!balanceRes.ok) return null;
      const balanceData: { status: string; result: string } = await balanceRes.json();
      if (balanceData.status !== "1") return null;

      const blockRes = await fetch(
        `${this.config.apiUrl}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!blockRes.ok) return null;
      const blockData: { result: string } = await blockRes.json();

      return {
        balance: balanceData.result,
        decimals: this.config.nativeDecimals,
        blockNumber: parseInt(blockData.result, 16),
      };
    } catch {
      return null;
    }
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const native = await this.fetchNativeBalance(address);
    if (!native) return null;
    return {
      balances: [{ currency: this.config.nativeSymbol, balance: native.balance, decimals: native.decimals }],
      blockNumber: native.blockNumber,
    };
  }
}
