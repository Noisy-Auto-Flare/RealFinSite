export type AccountType = "crypto_wallet" | "cex_exchange" | "broker" | "hybrid_bank" | "fiat_bank";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  crypto_wallet: "Криптокошелёк",
  cex_exchange: "Биржа (CEX)",
  broker: "Брокерский счёт",
  hybrid_bank: "Гибридный (фиат + крипта)",
  fiat_bank: "Банковский счёт",
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  crypto_wallet: "🔗",
  cex_exchange: "💱",
  broker: "📈",
  hybrid_bank: "🏦",
  fiat_bank: "💳",
};

export function formatAmount(amount: number, currency: string): string {
  const sym: Record<string, string> = {
    RUB: "₽", USD: "$", EUR: "€", CNY: "¥",
    USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON",
    BTC: "BTC", ETH: "ETH",
  };
  const s = sym[currency] || currency;
  const formatted = amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  return `${formatted} ${s}`;
}
