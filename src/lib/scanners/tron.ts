import { IScanner, NativeBalanceResult, RawBlockchainEvent, BalanceEntry, AllBalancesResult } from "./interface";
import { getNetworkApiKey } from "./api-keys";

interface Trc20Transfer {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info: {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
  };
  type: string;
}

interface Trc20Response {
  data?: Trc20Transfer[];
  meta?: { at: number; page_size: number; fingerprints?: string[] };
}

interface Trc20TokenMeta {
  data?: Array<{ symbol: string; decimals: number }>;
}

const TRC20_DECIMALS: Record<string, number> = {};
const TRC20_SYMBOLS: Record<string, string> = {};
const TX_CACHE: Record<string, { blockNumber: number; fee: number }> = {};

export class TronScanner implements IScanner {
  network = "tron";

  async fetchNewTransactions(address: string, fromBlock: number): Promise<RawBlockchainEvent[]> {
    const events: RawBlockchainEvent[] = [];
    const apiKey = process.env.TRONGRID_API_KEY || getNetworkApiKey("tron") || "";

    let url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=200`;
    if (fromBlock > 0) url += `&min_block_number=${fromBlock + 1}`;
    if (apiKey) url += `&api_key=${apiKey}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return events;

      const data: Trc20Response = await res.json();
      if (!data.data?.length) return events;

      for (const tx of data.data) {
        if (tx.type === "Approval") continue;
        const info = await getTxInfo(tx.transaction_id);
        const evt: RawBlockchainEvent = {
          txHash: tx.transaction_id,
          fromAddress: tx.from,
          toAddress: tx.to,
          amount: tx.value,
          tokenContract: tx.token_info.address,
          decimals: tx.token_info.decimals,
          timestamp: Math.floor(tx.block_timestamp / 1000),
          blockNumber: info.blockNumber,
          tokenSymbol: tx.token_info.symbol,
        };
        if (info.fee && info.fee > 0) {
          evt.fee = { amount: String(info.fee), decimals: 6, currency: "TRX" };
        }
        events.push(evt);
      }
    } catch {}

    return events;
  }

  async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
    const apiKey = process.env.TRONGRID_API_KEY || getNetworkApiKey("tron") || "";

    try {
      let url = `https://api.trongrid.io/v1/accounts/${address}`;
      if (apiKey) url += `?api_key=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data: { data?: Array<{ balance: number }> } = await res.json();
        if (data.data?.length) {
          return { balance: String(data.data[0].balance ?? 0), decimals: 6, blockNumber: 0 };
        }
      }
    } catch {}

    try {
      const url = `https://api.trongrid.io/wallet/getaccount`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data: { balance?: number } = await res.json();
        return { balance: String(data.balance ?? 0), decimals: 6, blockNumber: 0 };
      }
    } catch {}

    return null;
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const apiKey = process.env.TRONGRID_API_KEY || getNetworkApiKey("tron") || "";
    const balances: BalanceEntry[] = [];

    try {
      let url = `https://api.trongrid.io/v1/accounts/${address}`;
      if (apiKey) url += `?api_key=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;

      const data: { data?: Array<{ balance: number; trc20?: Record<string, string>[] }>; meta?: unknown } = await res.json();
      if (!data.data?.length) return null;

      const acct = data.data[0];
      balances.push({ currency: "TRX", balance: String(acct.balance ?? 0), decimals: 6 });

      if (acct.trc20) {
        for (const entry of acct.trc20) {
          for (const [contractAddr, rawBalance] of Object.entries(entry)) {
            const amt = BigInt(rawBalance);
            if (amt <= BigInt(0)) continue;
            const meta = await getTrc20Meta(contractAddr);
            balances.push({
              currency: meta.symbol || contractAddr.slice(0, 8),
              balance: rawBalance,
              decimals: meta.decimals,
              tokenContract: contractAddr,
            });
          }
        }
      }

      return { balances, blockNumber: 0 };
    } catch (e) {
      console.log(`[tron.fetchAllBalances] error: ${e}`);
      return null;
    }
  }
}

async function getTxInfo(txId: string): Promise<{ blockNumber: number; fee: number }> {
  if (TX_CACHE[txId] !== undefined) return TX_CACHE[txId];

  try {
    const res = await fetch("https://api.trongrid.io/wallet/gettransactioninfobyid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: txId }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data: { blockNumber?: number; fee?: number; net_fee?: number; energy_fee?: number } = await res.json();
      const blockNumber = data.blockNumber ?? 0;
      const fee = data.fee ?? data.net_fee ?? data.energy_fee ?? 0;
      TX_CACHE[txId] = { blockNumber, fee };
      return { blockNumber, fee };
    }
  } catch {}

  return { blockNumber: 0, fee: 0 };
}

async function getTrc20Meta(contract: string): Promise<{ decimals: number; symbol: string }> {
  if (TRC20_DECIMALS[contract] !== undefined) {
    return { decimals: TRC20_DECIMALS[contract], symbol: TRC20_SYMBOLS[contract] || "" };
  }

  const apiKey = process.env.TRONGRID_API_KEY || getNetworkApiKey("tron") || "";

  try {
    let url = `https://api.trongrid.io/v1/tokens/${contract}`;
    if (apiKey) url += `?api_key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data: Trc20TokenMeta = await res.json();
      if (data.data?.length) {
        const d = Number(data.data[0].decimals) ?? 6;
        const s = data.data[0].symbol || "";
        TRC20_DECIMALS[contract] = d;
        TRC20_SYMBOLS[contract] = s;
        return { decimals: d, symbol: s };
      }
    }
  } catch {}

  TRC20_DECIMALS[contract] = 6;
  return { decimals: 6, symbol: "" };
}
