import { IScanner, RawBlockchainEvent } from "./interface";

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
    const apiKey = process.env.HELIUS_API_KEY || "";

    const events: RawBlockchainEvent[] = [];
    let beforeTx: string | undefined;
    let hasMore = true;
    let iterations = 0;

    while (hasMore && iterations < 5) {
      iterations++;
      let url = `https://api.helius.xyz/v0/addresses/${address}/transactions?apiKey=${apiKey}&limit=100`;
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
}

async function getSplMeta(mint: string): Promise<{ decimals: number; symbol: string }> {
  if (SPL_TOKEN_DECIMALS[mint] !== undefined) {
    return { decimals: SPL_TOKEN_DECIMALS[mint], symbol: TOKEN_SYMBOLS[mint] || "" };
  }
  try {
    const url = `https://api.helius.xyz/v0/token-metadata?apiKey=${process.env.HELIUS_API_KEY || ""}`;
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
