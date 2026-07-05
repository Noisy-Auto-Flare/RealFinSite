import { IScanner, NativeBalanceResult, RawBlockchainEvent, BalanceEntry, AllBalancesResult } from "./interface";
import { getNetworkApiKey } from "./api-keys";
import { mergeBalances } from "./currency-aliases";

interface HeliusTx {
  type: string;
  timestamp: number;
  signature: string;
  slot: number;
  nativeTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }[];
  tokenTransfers?: {
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    rawTokenAmount: {
      tokenAmount: string;
    };
  }[];
  accountData?: {
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges?: Record<string, {
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
    }>;
  }[];
}

const SPL_TOKEN_DECIMALS: Record<string, number> = {};
const TOKEN_SYMBOLS: Record<string, string> = {};

export class SolanaScanner implements IScanner {
  network = "solana";

  async fetchNewTransactions(address: string, fromSlot: number): Promise<RawBlockchainEvent[]> {
    const apiKey = process.env.HELIUS_API_KEY || getNetworkApiKey("solana");

    const events: RawBlockchainEvent[] = [];
    let beforeTx: string | undefined;
    let hasMore = true;
    let iterations = 0;

    while (hasMore && iterations < 5) {
      iterations++;
      let url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}&limit=100`;
      if (beforeTx) url += `&beforeTx=${beforeTx}`;

      let res: Response;
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      } catch {
        break;
      }

      if (!res.ok) break;

      let data: HeliusTx[];
      try {
        data = await res.json();
      } catch {
        break;
      }

      if (!Array.isArray(data) || data.length === 0) break;

      let allOld = true;
      for (const tx of data) {
        if (tx.slot <= fromSlot) continue;
        allOld = false;

        if (tx.nativeTransfers) {
          for (const n of tx.nativeTransfers) {
            if (n.amount <= 0) continue;
            events.push({
              txHash: tx.signature,
              fromAddress: n.fromUserAccount,
              toAddress: n.toUserAccount,
              amount: String(n.amount),
              tokenContract: null,
              decimals: 9,
              timestamp: tx.timestamp,
              blockNumber: tx.slot,
              tokenSymbol: "SOL",
            });
          }
        }

        if (tx.tokenTransfers) {
          for (const t of tx.tokenTransfers) {
            const mint = t.mint;
            const { decimals, symbol } = await getSplMeta(mint);
            events.push({
              txHash: tx.signature,
              fromAddress: t.fromUserAccount,
              toAddress: t.toUserAccount,
              amount: t.rawTokenAmount.tokenAmount,
              tokenContract: mint,
              decimals,
              timestamp: tx.timestamp,
              blockNumber: tx.slot,
              tokenSymbol: symbol || undefined,
            });
          }
        }
      }

      if (allOld) { hasMore = false; break; }

      beforeTx = data[data.length - 1].signature;
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }

  async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
    const apiKey = process.env.HELIUS_API_KEY || getNetworkApiKey("solana");
    if (!apiKey) return null;

    try {
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [address],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      const data: { result: { context: { slot: number }; value: number } } = await res.json();
      if (!data.result) return null;

      return {
        balance: String(data.result.value),
        decimals: 9,
        blockNumber: data.result.context.slot,
      };
    } catch {
      return null;
    }
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const apiKey = process.env.HELIUS_API_KEY || getNetworkApiKey("solana");
    if (!apiKey) return null;

    try {
      const [balancesRes, slotRes] = await Promise.all([
        fetch(
          `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${apiKey}`,
          { signal: AbortSignal.timeout(15000) }
        ),
        fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }),
          signal: AbortSignal.timeout(15000),
        }),
      ]);

      let data: { nativeBalance: number; tokens?: { mint: string; amount: number; decimals: number; tokenSymbol?: string }[] };

      if (balancesRes.ok) {
        data = await balancesRes.json();
      } else {
        // v0 might be deprecated; try v1 wallet API
        console.log(`[solana.fetchAllBalances] v0 returned ${balancesRes.status}, trying v1...`);
        const v1Res = await fetch(
          `https://api.helius.xyz/v1/wallet/${address}/balances?api-key=${apiKey}&showNfts=false&showZeroBalance=false`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (!v1Res.ok) {
          console.log(`[solana.fetchAllBalances] v1 also returned ${v1Res.status} for ${address}`);
          return null;
        }
        const v1Json: {
          balances: { mint: string; symbol?: string; balance: number; decimals: number }[];
        } = await v1Res.json();
        data = {
          nativeBalance: 0,
          tokens: (v1Json.balances || []).map((b) => ({
            mint: b.mint,
            amount: b.balance === 0 ? 0 : Math.round(b.balance * 10 ** b.decimals),
            decimals: b.decimals,
            tokenSymbol: b.symbol,
          })),
        };
        // Pick native SOL from the list if present
        const solEntry = v1Json.balances?.find(
          (b) => b.mint === "So11111111111111111111111111111111111111112"
        );
        if (solEntry) {
          data.nativeBalance = Math.round(solEntry.balance * 10 ** solEntry.decimals);
        }
      }

      const balances: BalanceEntry[] = [{
        currency: "SOL",
        balance: String(data.nativeBalance),
        decimals: 9,
      }];

      for (const t of data.tokens || []) {
        if (t.amount <= 0) continue;
        balances.push({
          currency: t.tokenSymbol || t.mint.slice(0, 8),
          balance: String(t.amount),
          decimals: t.decimals,
        });
      }

      let blockNumber = 0;
      if (slotRes.ok) {
        const slotData: { result: number } = await slotRes.json();
        blockNumber = slotData.result ?? 0;
      }

      return { balances: mergeBalances(balances), blockNumber };
    } catch (e) {
      console.log(`[solana.fetchAllBalances] error: ${e}`);
      return null;
    }
  }
}

async function getSplMeta(mint: string): Promise<{ decimals: number; symbol: string }> {
  if (SPL_TOKEN_DECIMALS[mint] !== undefined) {
    return { decimals: SPL_TOKEN_DECIMALS[mint], symbol: TOKEN_SYMBOLS[mint] || "" };
  }
  try {
    const url = `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_API_KEY || getNetworkApiKey("solana")}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [mint] }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const meta: any[] = await res.json();
      if (meta.length > 0) {
        const d = meta[0].decimals ?? 6;
        const s = meta[0].symbol || "";
        SPL_TOKEN_DECIMALS[mint] = d;
        TOKEN_SYMBOLS[mint] = s;
        return { decimals: d, symbol: s };
      }
    }
  } catch {}
  SPL_TOKEN_DECIMALS[mint] = 6;
  return { decimals: 6, symbol: "" };
}
