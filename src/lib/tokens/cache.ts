export interface TokenMetadata {
  chain: string;
  contractAddress: string;
  symbol: string;
  name?: string;
  decimals: number;
  source: string;
}

const metadataCache = new Map<string, TokenMetadata>();

export function getCachedToken(key: string): TokenMetadata | undefined {
  return metadataCache.get(key);
}

export function setCachedToken(key: string, meta: TokenMetadata): void {
  metadataCache.set(key, meta);
}
