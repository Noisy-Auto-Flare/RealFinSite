const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽", USD: "$", EUR: "€", CNY: "¥",
  USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON",
  BTC: "BTC", ETH: "ETH",
};

export function formatAmount(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  return `${formatted} ${sym}`;
}

export function formatCurrency(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}
