import { TokenMetadata } from "./cache";

export async function fetchEvmTokenMetadata(
  chain: string,
  contractAddress: string,
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
    return {
      chain,
      contractAddress,
      symbol: result.symbol || "",
      name: result.name,
      decimals: parseInt(result.decimals, 10) || 18,
      source: "explorer",
    };
  } catch {
    return null;
  }
}

export async function fetchSolanaTokenMetadata(
  contractAddress: string,
): Promise<TokenMetadata | null> {
  try {
    const apiKey = process.env.HELIUS_API_KEY ||
      (await import("@/lib/scanners/api-keys")).getNetworkApiKey("solana") || "";
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

    return {
      chain: "solana",
      contractAddress,
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals ?? 9,
      source: "helius",
    };
  } catch {
    return null;
  }
}
