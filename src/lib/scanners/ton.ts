import { IScanner, NativeBalanceResult, RawBlockchainEvent, BalanceEntry, AllBalancesResult } from "./interface";
import { getNetworkApiKey } from "./api-keys";

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
    const apiKey = process.env.TONCENTER_API_KEY || getNetworkApiKey("ton");
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

  async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
    const apiKey = process.env.TONCENTER_API_KEY || getNetworkApiKey("ton");
    const baseUrl = apiKey
      ? `https://toncenter.com/api/v2`
      : `https://testnet.toncenter.com/api/v2`;

    try {
      const url = `${baseUrl}/getAddressInformation?address=${address}${apiKey ? `&api_key=${apiKey}` : ""}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;
      const data: { ok: boolean; result: { balance: string; block_id: { seqno: number }; last_transaction_id: { lt: string } } } = await res.json();
      if (!data.ok || !data.result) return null;

      return {
        balance: data.result.balance,
        decimals: 9,
        blockNumber: data.result.block_id.seqno,
      };
    } catch {
      return null;
    }
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const apiKey = process.env.TONCENTER_API_KEY || getNetworkApiKey("ton");
    const baseUrl = apiKey
      ? `https://toncenter.com/api/v2`
      : `https://testnet.toncenter.com/api/v2`;
    const baseUrlV3 = apiKey
      ? `https://toncenter.com/api/v3`
      : `https://testnet.toncenter.com/api/v3`;

    try {
      const nativeUrl = `${baseUrl}/getAddressInformation?address=${address}${apiKey ? `&api_key=${apiKey}` : ""}`;
      const nativeRes = await fetch(nativeUrl, { signal: AbortSignal.timeout(15000) });
      if (!nativeRes.ok) return null;
      const nativeData: { ok: boolean; result: { balance: string; last_transaction_id: { lt: string } } } = await nativeRes.json();
      if (!nativeData.ok || !nativeData.result) return null;

      const tonHuman = parseFloat(nativeData.result.balance) / 1e9;
      console.log(`[ton.fetchAllBalances] native TON: ${tonHuman.toFixed(4)}`);
      const balances: BalanceEntry[] = [{
        currency: "TON",
        balance: nativeData.result.balance,
        decimals: 9,
      }];
      const blockNumber = parseInt(nativeData.result.last_transaction_id.lt, 10);

      const jettonWalletsUrl = `${baseUrlV3}/jetton/wallets?owner_address=${address}&limit=100${apiKey ? `&api_key=${apiKey}` : ""}`;
      const jettonRes = await fetch(jettonWalletsUrl, { signal: AbortSignal.timeout(15000) });
      if (jettonRes.ok) {
        const jettonData: { jetton_wallets: { address: string; balance: string; jetton: string }[] } = await jettonRes.json();
        if (jettonData.jetton_wallets) {
          for (const jw of jettonData.jetton_wallets) {
            if (BigInt(jw.balance) <= BigInt(0)) continue;
            const masterAddr = jw.jetton;
            const meta = await getJettonMeta(masterAddr);
            const human = parseFloat(jw.balance) / Math.pow(10, meta.decimals);
            console.log(`[ton.fetchAllBalances]   ${meta.symbol || masterAddr.slice(0, 8)}: ${human.toFixed(4)}`);
            balances.push({
              currency: meta.symbol || masterAddr.slice(0, 8),
              balance: jw.balance,
              decimals: meta.decimals,
            });
          }
        }
      } else {
        console.log(`[ton.fetchAllBalances] v3 jetton/wallets returned ${jettonRes.status} for ${address}`);
      }

      return { balances, blockNumber };
    } catch (e) {
      console.log(`[ton.fetchAllBalances] error: ${e}`);
      return null;
    }
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

  const apiKey = process.env.TONCENTER_API_KEY || getNetworkApiKey("ton");
  const baseUrlV3 = apiKey ? "https://toncenter.com/api/v3" : "https://testnet.toncenter.com/api/v3";
  const baseUrlV2 = apiKey ? "https://toncenter.com/api/v2" : "https://testnet.toncenter.com/api/v2";

  // Try v3 /jetton/masters first (returns jetton_content with symbol/decimals)
  try {
    const v3Url = `${baseUrlV3}/jetton/masters?address=${master}&limit=1${apiKey ? `&api_key=${apiKey}` : ""}`;
    const res = await fetch(v3Url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data: { jetton_masters: { jetton_content?: Record<string, unknown> }[] } = await res.json();
      if (data.jetton_masters?.length > 0) {
        const jc = data.jetton_masters[0].jetton_content;
        if (jc) {
          const d = Number(jc.decimals ?? 9);
          const s = String(jc.symbol ?? "");
          JETTON_DECIMALS[master] = d;
          JETTON_SYMBOLS[master] = s;
          return { decimals: d, symbol: s };
        }
      }
    }
  } catch {}

  // Fall back to v2 getTokenData
  try {
    const v2Url = `${baseUrlV2}/getTokenData?address=${master}${apiKey ? `&api_key=${apiKey}` : ""}`;
    const res = await fetch(v2Url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data: { ok: boolean; result: { jetton_content?: { data?: { decimals?: string; symbol?: string } } } } = await res.json();
      if (data.ok && data.result?.jetton_content?.data) {
        const d = Number(data.result.jetton_content.data.decimals ?? 9);
        const s = data.result.jetton_content.data.symbol || "";
        JETTON_DECIMALS[master] = d;
        JETTON_SYMBOLS[master] = s;
        return { decimals: d, symbol: s };
      }
    }
  } catch {}

  JETTON_DECIMALS[master] = 9;
  return { decimals: 9, symbol: "" };
}
