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
    const tag = `[evm.${this.network}.fetchNativeBalance]`;

    try {
      const balanceRes = await fetch(
        `${this.config.apiUrl}?module=account&action=balance&address=${address}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!balanceRes.ok) { console.log(`${tag} balance HTTP ${balanceRes.status}`); return null; }
      const balanceData: { status: string; result: string } = await balanceRes.json();
      if (balanceData.status !== "1") { console.log(`${tag} balance API status=${balanceData.status}`); return null; }

      const blockRes = await fetch(
        `${this.config.apiUrl}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      let blockNumber = 0;
      if (blockRes.ok) {
        const blockData: { result: string } = await blockRes.json();
        blockNumber = parseInt(blockData.result, 16) || 0;
      } else {
        console.log(`${tag} blockNumber HTTP ${blockRes.status}, using 0`);
      }

      console.log(`${tag} balance=${balanceData.result}, block=${blockNumber}`);
      return {
        balance: balanceData.result,
        decimals: this.config.nativeDecimals,
        blockNumber,
      };
    } catch {
      console.log(`${tag} exception`);
      return null;
    }
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const tag = `[evm.${this.network}.fetchAllBalances]`;
    const native = await this.fetchNativeBalance(address);
    if (!native) { console.log(`${tag} native balance failed, returning null`); return null; }
    const result: AllBalancesResult = {
      balances: [{ currency: this.config.nativeSymbol, balance: native.balance, decimals: native.decimals }],
      blockNumber: native.blockNumber,
    };
    console.log(`${tag} ${this.config.nativeSymbol}: ${parseInt(native.balance) / 10 ** native.decimals}`);

    const apiKey = this.getApiKey();
    try {
      const tokUrl = `${this.config.apiUrl}?module=account&action=tokenlist&address=${address}&apikey=${apiKey}`;
      const tokRes = await fetch(tokUrl, { signal: AbortSignal.timeout(15000) });
      if (tokRes.ok) {
        const tokData: { status: string; result: Array<{ contractAddress: string; symbol: string; balance: string; decimals: string }> } = await tokRes.json();
        if (tokData.status === "1" && Array.isArray(tokData.result)) {
          for (const tok of tokData.result) {
            const bal = tok.balance || "0";
            if (bal !== "0") {
              result.balances.push({
                currency: tok.symbol,
                balance: bal,
                decimals: parseInt(tok.decimals, 10) || 18,
                tokenContract: tok.contractAddress,
              });
            }
          }
          console.log(`${tag} ${result.balances.length - 1} tokens found`);
        }
      }
    } catch (e) {
      console.log(`${tag} token fetch failed:`, e);
    }

    console.log(`${tag} total balances: ${result.balances.length}`);
    return result;
  }
}
