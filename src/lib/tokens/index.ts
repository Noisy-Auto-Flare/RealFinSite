import { db } from "@/db";
import { tokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCachedToken, setCachedToken, TokenMetadata } from "./cache";
import { fetchEvmTokenMetadata, fetchSolanaTokenMetadata } from "./fetcher";

const EVM_NETWORK_IDS = [
  "bsc", "avalanche", "ethereum", "polygon", "base", "arbitrum",
  "optimism", "fantom", "cronos", "aurora", "moonbeam", "gnosis",
];

async function cacheInDb(meta: TokenMetadata): Promise<void> {
  try {
    db.insert(tokens)
      .values({
        chain: meta.chain,
        contractAddress: meta.contractAddress,
        symbol: meta.symbol,
        name: meta.name ?? null,
        decimals: meta.decimals,
        metadataSource: meta.source,
        lastMetadataFetch: new Date().toISOString(),
      })
      .run();
  } catch {
    // Race condition — another process inserted first, ignore
  }
}

export async function getTokenMetadata(
  chain: string,
  contractAddress: string,
): Promise<TokenMetadata | null> {
  const key = `${chain}:${contractAddress.toLowerCase()}`;

  const cached = getCachedToken(key);
  if (cached) return cached;

  try {
    const row = db
      .select()
      .from(tokens)
      .where(and(eq(tokens.chain, chain), eq(tokens.contractAddress, contractAddress)))
      .get();
    if (row) {
      const meta: TokenMetadata = {
        chain: row.chain,
        contractAddress: row.contractAddress,
        symbol: row.symbol,
        name: row.name ?? undefined,
        decimals: row.decimals,
        source: row.metadataSource ?? "db",
      };
      setCachedToken(key, meta);
      return meta;
    }
  } catch {
    // DB lookup failed, continue to explorer
  }

  let meta: TokenMetadata | null = null;
  if (EVM_NETWORK_IDS.includes(chain)) {
    meta = await fetchEvmTokenMetadata(chain, contractAddress);
  } else if (chain === "solana") {
    meta = await fetchSolanaTokenMetadata(contractAddress);
  }

  if (meta) {
    await cacheInDb(meta);
    setCachedToken(key, meta);
  }

  return meta;
}

export type { TokenMetadata } from "./cache";
