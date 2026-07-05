export type AccountType = "crypto_wallet" | "cex_exchange" | "broker" | "hybrid_bank" | "fiat_bank" | "external";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  crypto_wallet: "Криптокошелёк",
  cex_exchange: "Биржа (CEX)",
  broker: "Брокерский счёт",
  hybrid_bank: "Гибридный (фиат + крипта)",
  fiat_bank: "Банковский счёт",
  external: "Внешний счёт",
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  crypto_wallet: "🔗",
  cex_exchange: "💱",
  broker: "📈",
  hybrid_bank: "🏦",
  fiat_bank: "💳",
  external: "🫴",
};

