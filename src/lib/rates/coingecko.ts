import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const CRYPTO_IDS: Record<string, string> = {
  SOL: "solana",
  BNB: "binancecoin",
  TON: "toncoin",
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
};

const FIAT_CURRENCIES = ["RUB", "USD", "CNY", "EUR"];
const ALL_SUPPORTED = [...Object.keys(CRYPTO_IDS), ...FIAT_CURRENCIES];

interface CoinGeckoPriceResponse {
  [coinId: string]: {
    [currency: string]: number;
  };
}

export async function fetchAndStoreRates(): Promise<void> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  const coinIds = Object.values(CRYPTO_IDS).join(",");
  const vsCurrencies = ["usd", "rub", "cny"].join(",");

  // Fetch crypto prices in USD, RUB, CNY
  const cryptoUrl = `${COINGECKO_BASE}/simple/price?ids=${coinIds}&vs_currencies=${vsCurrencies}`;
  const cryptoRes = await fetch(cryptoUrl, { headers, next: { revalidate: 300 } });

  if (!cryptoRes.ok) {
    console.error(`CoinGecko crypto fetch failed: ${cryptoRes.status}`);
    return;
  }

  const cryptoData: CoinGeckoPriceResponse = await cryptoRes.json();

  // Store crypto → fiat rates
  for (const [symbol, coinId] of Object.entries(CRYPTO_IDS)) {
    const prices = cryptoData[coinId];
    if (!prices) continue;

    if (prices.usd) {
      upsertRate(symbol, "USD", prices.usd);
    }
    if (prices.rub) {
      upsertRate(symbol, "RUB", prices.rub);
    }
    if (prices.cny) {
      upsertRate(symbol, "CNY", prices.cny);
    }
  }

  // Fetch fiat rates via CoinGecko (using USDT as bridge)
  const fiatUrl = `${COINGECKO_BASE}/simple/price?ids=tether&vs_currencies=rub,cny,eur`;
  const fiatRes = await fetch(fiatUrl, { headers, next: { revalidate: 300 } });

  if (fiatRes.ok) {
    const fiatData: CoinGeckoPriceResponse = await fiatRes.json();
    const tether = fiatData["tether"];
    if (tether) {
      if (tether.rub) upsertRate("USD", "RUB", tether.rub);
      if (tether.cny) upsertRate("USD", "CNY", tether.cny);
      if (tether.eur) upsertRate("USD", "EUR", tether.eur);
    }
  }

  // Store inverse fiat rates (RUB→USD, CNY→USD, etc.)
  ensureInverseRate("USD", "RUB");
  ensureInverseRate("USD", "CNY");
  ensureInverseRate("USD", "EUR");
  ensureInverseRate("RUB", "CNY");

  console.log(`Rates updated: ${new Date().toISOString()}`);
}

function upsertRate(base: string, quote: string, rate: number) {
  const existing = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, base), eq(exchangeRates.quoteCurrency, quote))
  ).get();

  if (existing) {
    db.update(exchangeRates)
      .set({ rate, updatedAt: new Date().toISOString() })
      .where(eq(exchangeRates.id, existing.id))
      .run();
  } else {
    db.insert(exchangeRates).values({
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      source: "coingecko",
    }).run();
  }
}

function ensureInverseRate(base: string, quote: string) {
  const direct = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, base), eq(exchangeRates.quoteCurrency, quote))
  ).get();

  const inverse = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, quote), eq(exchangeRates.quoteCurrency, base))
  ).get();

  if (direct && !inverse) {
    upsertRate(quote, base, 1 / direct.rate);
  } else if (!direct && inverse) {
    upsertRate(base, quote, 1 / inverse.rate);
  }
}

export function getRate(base: string, quote: string): number | null {
  if (base === quote) return 1;

  const direct = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, base), eq(exchangeRates.quoteCurrency, quote))
  ).get();

  if (direct) return direct.rate;

  // Try via USD bridge
  const baseToUsd = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, base), eq(exchangeRates.quoteCurrency, "USD"))
  ).get();

  const usdToQuote = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, "USD"), eq(exchangeRates.quoteCurrency, quote))
  ).get();

  if (baseToUsd && usdToQuote) {
    return baseToUsd.rate * usdToQuote.rate;
  }

  // Try reverse: quote→base and invert
  const reverse = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, quote), eq(exchangeRates.quoteCurrency, base))
  ).get();

  if (reverse) return 1 / reverse.rate;

  return null;
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): { converted: number; rate: number } | null {
  const rate = getRate(fromCurrency, toCurrency);
  if (rate === null) return null;
  return { converted: amount * rate, rate };
}

export function isKnownCurrency(currency: string): boolean {
  return ALL_SUPPORTED.includes(currency);
}

export { ALL_SUPPORTED as SUPPORTED_CURRENCIES };
