import { IScanner, RawBlockchainEvent, NativeBalanceResult, BalanceEntry, AllBalancesResult } from "./interface";
import { getNetworkApiKey } from "./api-keys";

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

const EVM_NATIVE_CURRENCY: Record<string, string> = {
  bsc: "BNB",
  avalanche: "AVAX",
  ethereum: "ETH",
};

const API_URLS: Record<string, { url: string; keyEnv: string }> = {
  bsc: { url: "https://api.bscscan.com/api", keyEnv: "BSCSCAN_API_KEY" },
  avalanche: { url: "https://api.snowtrace.io/api", keyEnv: "SNOWTRACE_API_KEY" },
  ethereum: { url: "https://api.etherscan.io/api", keyEnv: "ETHERSCAN_API_KEY" },
};

export class EvmScanner implements IScanner {
  network: string;

  constructor(network: string) {
    this.network = network;
  }

  async fetchNewTransactions(address: string, fromBlock: number): Promise<RawBlockchainEvent[]> {
    const cfg = API_URLS[this.network];
    if (!cfg) throw new Error(`Unsupported EVM network: ${this.network}`);

    const apiKey = process.env[cfg.keyEnv] || getNetworkApiKey(this.network);
    const events: RawBlockchainEvent[] = [];

    const normalTxs = await this.fetchPage(cfg.url, apiKey, "txlist", address, fromBlock);
    for (const tx of normalTxs) {
      const valueWei = tx.value;
      if (valueWei === "0") continue;
      events.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: valueWei,
        tokenContract: null,
        decimals: 18,
        timestamp: parseInt(tx.timeStamp, 10),
        blockNumber: parseInt(tx.blockNumber, 10),
      });
    }

    const tokenTxs = await this.fetchPage(cfg.url, apiKey, "tokentx", address, fromBlock);
    for (const tx of tokenTxs) {
      const decimals = parseInt(tx.tokenDecimal || "18", 10);
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
    const cfg = API_URLS[this.network];
    if (!cfg) return null;

    const apiKey = process.env[cfg.keyEnv] || getNetworkApiKey(this.network);

    try {
      const balanceRes = await fetch(
        `${cfg.url}?module=account&action=balance&address=${address}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!balanceRes.ok) return null;
      const balanceData: { status: string; result: string } = await balanceRes.json();
      if (balanceData.status !== "1") return null;

      const blockRes = await fetch(
        `${cfg.url}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!blockRes.ok) return null;
      const blockData: { result: string } = await blockRes.json();

      return {
        balance: balanceData.result,
        decimals: 18,
        blockNumber: parseInt(blockData.result, 16),
      };
    } catch {
      return null;
    }
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const native = await this.fetchNativeBalance(address);
    if (!native) return null;
    const currency = EVM_NATIVE_CURRENCY[this.network] || this.network.toUpperCase();
    return {
      balances: [{ currency, balance: native.balance, decimals: native.decimals }],
      blockNumber: native.blockNumber,
    };
  }

  private async fetchPage(
    baseUrl: string,
    apiKey: string,
    action: string,
    address: string,
    fromBlock: number,
    page = 1
  ): Promise<ExplorerTx[]> {
    const url = `${baseUrl}?module=account&action=${action}&address=${address}&startblock=${fromBlock}&endblock=99999999&sort=asc&page=${page}&offset=10000&apikey=${apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch {
      return [];
    }

    if (!res.ok) return [];

    let data: ExplorerResponse;
    try {
      data = await res.json();
    } catch {
      return [];
    }

    if (data.status !== "1" || !Array.isArray(data.result)) return [];

    if (data.result.length >= 10000) {
      const next = await this.fetchPage(baseUrl, apiKey, action, address, fromBlock, page + 1);
      return [...data.result, ...next];
    }

    return data.result;
  }
}
