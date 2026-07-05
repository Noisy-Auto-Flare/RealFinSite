import { IScanner, RawBlockchainEvent, NativeBalanceResult, AllBalancesResult } from "../interface";
import { getNetworkApiKey } from "../api-keys";
import { EVM_NETWORKS, EvmNetworkConfig } from "./config";

const BALANCE_OF_SIG = "0x70a08231";

function balanceOfData(address: string): string {
  const padded = address.slice(2).toLowerCase().padStart(64, "0");
  return `${BALANCE_OF_SIG}${padded}`;
}

const KNOWN_TOKENS: Record<string, Array<{ symbol: string; contract: string; decimals: number }>> = {
  ethereum: [
    { symbol: "USDT", contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "USDC", contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  ],
  bsc: [
    { symbol: "USDT", contract: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", contract: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  ],
  avalanche: [
    { symbol: "USDT", contract: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    { symbol: "USDC", contract: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
  ],
  polygon: [
    { symbol: "USDT", contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", contract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
  ],
  arbitrum: [
    { symbol: "USDT", contract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", contract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  ],
  optimism: [
    { symbol: "USDT", contract: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    { symbol: "USDC", contract: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
  ],
  base: [
    { symbol: "USDC", contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  ],
};

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

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: { code: number; message: string };
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
    return getNetworkApiKey(this.network);
  }

  private async rpcCall(method: string, params: unknown[]): Promise<string | null> {
    const tag = `[evm.${this.network}.rpc]`;
    try {
      const res = await fetch(this.config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { console.log(`${tag} HTTP ${res.status}`); return null; }
      const data: JsonRpcResponse = await res.json();
      if (data.error) { console.log(`${tag} error: ${data.error.message}`); return null; }
      return data.result ?? null;
    } catch {
      console.log(`${tag} exception`);
      return null;
    }
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
    const tag = `[evm.${this.network}.fetchNativeBalance]`;
    const apiKey = this.getApiKey();

    if (apiKey) {
      try {
        const balanceRes = await fetch(
          `${this.config.apiUrl}?module=account&action=balance&address=${address}&apikey=${apiKey}`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (!balanceRes.ok) { console.log(`${tag} balance HTTP ${balanceRes.status}`); }
        else {
          const balanceData: { status: string; result: string; message?: string } = await balanceRes.json();
          if (balanceData.status === "1") {
            const blockRes = await fetch(
              `${this.config.apiUrl}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`,
              { signal: AbortSignal.timeout(15000) }
            );
            let blockNumber = 0;
            if (blockRes.ok) {
              const blockData: { result: string } = await blockRes.json();
              blockNumber = parseInt(blockData.result, 16) || 0;
            }
            console.log(`${tag} balance=${balanceData.result}, block=${blockNumber}`);
            return {
              balance: balanceData.result,
              decimals: this.config.nativeDecimals,
              blockNumber,
            };
          }
          console.log(`${tag} explorer API status=${balanceData.status}: ${balanceData.message || "falling back to RPC"}`);
        }
      } catch { console.log(`${tag} explorer exception, falling back to RPC`); }
    }

    console.log(`${tag} trying RPC...`);
    const balHex = await this.rpcCall("eth_getBalance", [address, "latest"]);
    if (!balHex) { console.log(`${tag} RPC failed`); return null; }
    const balance = BigInt(balHex).toString();

    const blockHex = await this.rpcCall("eth_blockNumber", []);
    let blockNumber = 0;
    if (blockHex) blockNumber = parseInt(blockHex, 16) || 0;

    console.log(`${tag} RPC balance=${balance}, block=${blockNumber}`);
    return {
      balance,
      decimals: this.config.nativeDecimals,
      blockNumber,
    };
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const tag = `[evm.${this.network}.fetchAllBalances]`;
    const native = await this.fetchNativeBalance(address);
    if (!native) { console.log(`${tag} native balance failed, returning null`); return null; }
    const result: AllBalancesResult = {
      balances: [{ currency: this.config.nativeSymbol, balance: native.balance, decimals: native.decimals }],
      blockNumber: native.blockNumber,
    };
    const nativeDisplay = (BigInt(native.balance) * BigInt(10000) / BigInt(10 ** native.decimals));
    console.log(`${tag} ${this.config.nativeSymbol}: ${Number(nativeDisplay) / 10000}`);

    const apiKey = this.getApiKey();
    if (apiKey) {
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
    }

    const known = KNOWN_TOKENS[this.network];
    if (known) {
      for (const token of known) {
        const balHex = await this.rpcCall("eth_call", [{ to: token.contract, data: balanceOfData(address) }, "latest"]);
        if (balHex && balHex !== "0x") {
          const balance = BigInt(balHex).toString();
          if (balance !== "0") {
            const existing = result.balances.find(
              (b) => b.currency === token.symbol || b.tokenContract?.toLowerCase() === token.contract.toLowerCase()
            );
            if (!existing) {
              const human = Number(BigInt(balance) * BigInt(10000) / BigInt(10 ** token.decimals)) / 10000;
              console.log(`${tag} ${token.symbol}: ${human} (RPC)`);
              result.balances.push({
                currency: token.symbol,
                balance,
                decimals: token.decimals,
                tokenContract: token.contract,
              });
            }
          }
        } else {
          console.log(`${tag} ${token.symbol}: no RPC balance returned`);
        }
      }
    }

    console.log(`${tag} total balances: ${result.balances.length}`);
    return result;
  }
}
