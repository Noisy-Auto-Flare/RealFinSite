import { IScanner, RawBlockchainEvent } from "./interface";

interface TonTx {
  transaction_id: { lt: string; hash: string };
  time: number;
  in_msg?: {
    source: string;
    destination: string;
    value: string;
    msg_data?: { body?: string };
  };
  out_msgs: {
    source: string;
    destination: string;
    value: string;
  }[];
}

interface TonJettonTransfer {
  transaction_id: { lt: string; hash: string };
  time: number;
  source: string;
  destination: string;
  amount: string;
  jetton_master_address: string;
  jetton_wallet_address: string;
}

interface TonResponse<T> {
  ok: boolean;
  result: T[];
}

const JETTON_DECIMALS: Record<string, number> = {};
const JETTON_SYMBOLS: Record<string, string> = {};
const JETTON_FETCHING = new Set<string>();

export class TonScanner implements IScanner {
  network = "ton";

  async fetchNewTransactions(address: string, fromLt: number): Promise<RawBlockchainEvent[]> {
    const apiKey = process.env.TONCENTER_API_KEY || "";
    const baseUrl = apiKey
      ? `https://toncenter.com/api/v2`
      : `https://testnet.toncenter.com/api/v2`;

    const events: RawBlockchainEvent[] = [];

    // Fetch TON transfers (in/out messages)
    const tonTxs = await this.fetchTonTransactions(baseUrl, apiKey, address, fromLt);
    for (const tx of tonTxs) {
      if (tx.in_msg && tx.in_msg.source && tx.in_msg.destination) {
        const value = parseInt(tx.in_msg.value, 10);
        if (value > 0) {
          events.push({
            txHash: tx.transaction_id.hash,
            fromAddress: tx.in_msg.source,
            toAddress: tx.in_msg.destination,
            amount: String(value),
            tokenContract: null,
            decimals: 9,
            timestamp: tx.time,
            blockNumber: parseInt(tx.transaction_id.lt, 10),
            tokenSymbol: "TON",
          });
        }
      }

      for (const msg of tx.out_msgs) {
        if (!msg.source || !msg.destination) continue;
        const value = parseInt(msg.value, 10);
        if (value > 0) {
          const isOutgoing = msg.source.toLowerCase() === address.toLowerCase();
          events.push({
            txHash: tx.transaction_id.hash,
            fromAddress: msg.source,
            toAddress: msg.destination,
            amount: String(value),
            tokenContract: null,
            decimals: 9,
            timestamp: tx.time,
            blockNumber: parseInt(tx.transaction_id.lt, 10),
            tokenSymbol: "TON",
          });
        }
      }
    }

    // Fetch Jetton transfers
    const jettonTxs = await this.fetchJettonTransfers(baseUrl, apiKey, address, fromLt);
    for (const tx of jettonTxs) {
      const { decimals, symbol } = await getJettonMeta(tx.jetton_master_address);
      events.push({
        txHash: tx.transaction_id.hash,
        fromAddress: tx.source,
        toAddress: tx.destination,
        amount: tx.amount,
        tokenContract: tx.jetton_master_address,
        decimals,
        timestamp: tx.time,
        blockNumber: parseInt(tx.transaction_id.lt, 10),
        tokenSymbol: symbol || undefined,
      });
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }

  private async fetchTonTransactions(
    baseUrl: string,
    apiKey: string,
    address: string,
    fromLt: number
  ): Promise<TonTx[]> {
    const url = `${baseUrl}/getTransactions?address=${address}&limit=100&start_lt=${fromLt || 0}&sort=asc${apiKey ? `&api_key=${apiKey}` : ""}`;

    let res: Response;
    try { res = await fetch(url, { signal: AbortSignal.timeout(15000) }); } catch { return []; }
    if (!res.ok) return [];

    let data: TonResponse<TonTx>;
    try { data = await res.json(); } catch { return []; }

    if (!data.ok || !Array.isArray(data.result)) return [];
    return data.result;
  }

  private async fetchJettonTransfers(
    baseUrl: string,
    apiKey: string,
    address: string,
    fromLt: number
  ): Promise<TonJettonTransfer[]> {
    const url = `${baseUrl}/getJettonTransfers?address=${address}&limit=100&start_lt=${fromLt || 0}&sort=asc${apiKey ? `&api_key=${apiKey}` : ""}`;

    let res: Response;
    try { res = await fetch(url, { signal: AbortSignal.timeout(15000) }); } catch { return []; }
    if (!res.ok) return [];

    let data: TonResponse<TonJettonTransfer>;
    try { data = await res.json(); } catch { return []; }

    if (!data.ok || !Array.isArray(data.result)) return [];
    return data.result;
  }
}

async function getJettonMeta(master: string): Promise<{ decimals: number; symbol: string }> {
  if (JETTON_DECIMALS[master] !== undefined) {
    return { decimals: JETTON_DECIMALS[master], symbol: JETTON_SYMBOLS[master] || "" };
  }

  if (JETTON_FETCHING.has(master)) {
    return { decimals: 9, symbol: "" };
  }

  JETTON_FETCHING.add(master);

  try {
    const apiKey = process.env.TONCENTER_API_KEY || "";
    const baseUrl = apiKey ? "https://toncenter.com/api/v2" : "https://testnet.toncenter.com/api/v2";
    const url = `${baseUrl}/getJettonInfo?address=${master}${apiKey ? `&api_key=${apiKey}` : ""}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.result) {
        const d = data.result.decimals ?? 9;
        const s = data.result.symbol || "";
        JETTON_DECIMALS[master] = d;
        JETTON_SYMBOLS[master] = s;
        return { decimals: d, symbol: s };
      }
    }
  } catch {}

  JETTON_DECIMALS[master] = 9;
  return { decimals: 9, symbol: "" };
}
