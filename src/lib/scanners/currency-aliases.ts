const CURRENCY_ALIASES: Record<string, string> = {
  PSOL: "SOL",
  stSOL: "SOL",
  mSOL: "SOL",
  bSOL: "SOL",
  jitoSOL: "SOL",
  soBTC: "BTC",
  soETH: "ETH",
  soUSDT: "USDT",
  soUSDC: "USDC",
  "USD₮": "USDT",
};

export function normalizeCurrency(currency: string): string {
  return CURRENCY_ALIASES[currency] || currency;
}

export function mergeBalances(
  balances: { currency: string; balance: string; decimals: number }[]
): { currency: string; balance: string; decimals: number }[] {
  const map = new Map<string, { rawHuman: number; decimals: number }>();
  for (const b of balances) {
    const human = parseFloat(b.balance) / 10 ** b.decimals;
    const existing = map.get(b.currency);
    if (existing) {
      existing.rawHuman += human;
    } else {
      map.set(b.currency, { rawHuman: human, decimals: b.decimals });
    }
  }
  return Array.from(map.entries()).map(([currency, { rawHuman, decimals }]) => ({
    currency,
    balance: String(Math.round(rawHuman * 10 ** decimals)),
    decimals,
  }));
}
