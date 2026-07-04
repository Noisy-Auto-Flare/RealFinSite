import { db } from "@/db";
import { tokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface TokenMetadata {
  chain: string;
  contractAddress: string;
  symbol: string;
  name?: string;
  decimals: number;
  source: string;
}

const EVM_NETWORK_IDS = [
  "bsc", "avalanche", "ethereum", "polygon", "base", "arbitrum",
  "optimism", "fantom", "cronos", "aurora", "moonbeam", "gnosis",
];

const metadataCache = new Map<string, TokenMetadata>();

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

async function fetchEvmTokenMetadata(
  chain: string,
  contractAddress: string,
  cacheKey: string,
): Promise<TokenMetadata | null> {
  try {
    const { EVM_NETWORKS } = await import("@/lib/scanners/evm/config");
    const { getNetworkApiKey } = await import("@/lib/scanners/api-keys");

    const config = EVM_NETWORKS[chain];
    if (!config) return null;

    const apiKey = process.env[config.envKey] || getNetworkApiKey(chain) || "";
    if (!apiKey) return null;

    const url = `${config.apiUrl}?module=token&action=tokeninfo&contractaddress=${contractAddress}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== "1") return null;

    const result = data.result;
    const meta: TokenMetadata = {
      chain,
      contractAddress,
      symbol: result.symbol || "",
      name: result.name,
      decimals: parseInt(result.decimals, 10) || 18,
      source: "explorer",
    };

    await cacheInDb(meta);
    metadataCache.set(cacheKey, meta);
    return meta;
  } catch {
    return null;
  }
}

async function fetchSolanaTokenMetadata(
  contractAddress: string,
  cacheKey: string,
): Promise<TokenMetadata | null> {
  try {
    const apiKey = process.env.HELIUS_API_KEY || (await import("@/lib/scanners/api-keys")).getNetworkApiKey("solana") || "";
    if (!apiKey) return null;

    const url = `https://api.helius.xyz/v0/token-metadata?apiKey=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [contractAddress] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    if (!item || !item.symbol) return null;

    const meta: TokenMetadata = {
      chain: "solana",
      contractAddress,
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals ?? 9,
      source: "helius",
    };

    await cacheInDb(meta);
    metadataCache.set(cacheKey, meta);
    return meta;
  } catch {
    return null;
  }
}

export async function getTokenMetadata(
  chain: string,
  contractAddress: string,
): Promise<TokenMetadata | null> {
  const key = `${chain}:${contractAddress.toLowerCase()}`;

  const cached = metadataCache.get(key);
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
      metadataCache.set(key, meta);
      return meta;
    }
  } catch {
    // DB lookup failed, continue to explorer
  }

  if (EVM_NETWORK_IDS.includes(chain)) {
    return fetchEvmTokenMetadata(chain, contractAddress, key);
  }

  if (chain === "solana") {
    return fetchSolanaTokenMetadata(contractAddress, key);
  }

  return null;
}
