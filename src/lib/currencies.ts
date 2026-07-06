export const ALL_CURRENCIES = [
  "RUB", "USD", "USDT", "CNY", "SOL", "BNB", "TON",
  "TRX", "AVAX", "BTC", "ETH", "USDC", "EUR",
] as const;

export type Currency = (typeof ALL_CURRENCIES)[number];
