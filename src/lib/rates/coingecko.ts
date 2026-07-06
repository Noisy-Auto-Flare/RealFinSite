import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const CRYPTO_COIN_IDS: Record<string, string[]> = {
  SOL: ["solana"],
  BNB: ["binancecoin"],
  TON: ["the-open-network", "toncoin"],
  TRX: ["tron"],
  AVAX: ["avalanche-2"],
  BTC: ["bitcoin"],
  ETH: ["ethereum"],
  USDT: ["tether"],
  USDC: ["usd-coin"],
};

const FIAT_CURRENCIES = ["RUB", "USD", "CNY", "EUR"];
const ALL_SUPPORTED = [...Object.keys(CRYPTO_COIN_IDS), ...FIAT_CURRENCIES];

interface CoinGeckoPriceResponse {
  [coinId: string]: {
    [currency: string]: number;
  };
}

interface CoinGeckoPriceWithChange {
  [coinId: string]: {
    usd?: number;
    usd_24h_change?: number;
    rub?: number;
    rub_24h_change?: number;
    cny?: number;
    cny_24h_change?: number;
  };
}

export async function fetchAndStoreRates(): Promise<void> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  const allIds = [...new Set(Object.values(CRYPTO_COIN_IDS).flat())].join(",");
  const vsCurrencies = ["usd", "rub", "cny"].join(",");

  // Fetch crypto prices in USD, RUB, CNY with 24h change
  const cryptoUrl = `${COINGECKO_BASE}/simple/price?ids=${allIds}&vs_currencies=${vsCurrencies}&include_24hr_change=true`;
  const cryptoRes = await fetch(cryptoUrl, { headers, next: { revalidate: 300 } });

  if (!cryptoRes.ok) {
    console.error(`CoinGecko crypto fetch failed: ${cryptoRes.status}`);
    return;
  }

  let cryptoData: CoinGeckoPriceWithChange;
  try {
    cryptoData = await cryptoRes.json();
  } catch {
    console.error("CoinGecko crypto fetch: empty or invalid JSON response");
    return;
  }

  // Store crypto → fiat rates (use first coin ID that returns data)
  for (const [symbol, coinIds] of Object.entries(CRYPTO_COIN_IDS)) {
    const prices = coinIds.reduce<CoinGeckoPriceWithChange[string] | null>(
      (found, id) => found || cryptoData[id] || null, null
    );
    if (!prices) continue;

    if (prices.usd) {
      upsertRate(symbol, "USD", prices.usd, prices.usd_24h_change);
    }
    if (prices.rub) {
      upsertRate(symbol, "RUB", prices.rub, prices.rub_24h_change);
    }
    if (prices.cny) {
      upsertRate(symbol, "CNY", prices.cny, prices.cny_24h_change);
    }
  }

  // Fetch fiat rates via CoinGecko (using USDT as bridge)
  const fiatUrl = `${COINGECKO_BASE}/simple/price?ids=tether&vs_currencies=rub,cny,eur`;
  const fiatRes = await fetch(fiatUrl, { headers, next: { revalidate: 300 } });

  if (fiatRes.ok) {
    let fiatData: CoinGeckoPriceResponse;
    try {
      fiatData = await fiatRes.json();
    } catch {
      console.error("CoinGecko fiat fetch: empty or invalid JSON response");
      fiatData = {};
    }
    const tether = fiatData["tether"];
    if (tether) {
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

function upsertRate(base: string, quote: string, rate: number, change24h?: number | null, source?: string) {
  const existing = db.select().from(exchangeRates).where(
    and(eq(exchangeRates.baseCurrency, base), eq(exchangeRates.quoteCurrency, quote))
  ).get();

  if (existing) {
    const updates: Record<string, unknown> = { rate, updatedAt: new Date().toISOString() };
    if (change24h !== undefined) updates.change24h = change24h;
    if (source !== undefined) updates.source = source;
    db.update(exchangeRates)
      .set(updates)
      .where(eq(exchangeRates.id, existing.id))
      .run();
  } else {
    db.insert(exchangeRates).values({
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      change24h: change24h ?? null,
      source: source || "coingecko",
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

export function parseCbrXml(xml: string): number | null {
  const match = xml.match(/<CharCode>USD<\/CharCode>[\s\S]*?<Value>([\d,]+)<\/Value>/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

export function cbrDateParam(date?: Date): string {
  const d = date ?? new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export async function fetchCbrRates(): Promise<void> {
  const url = `https://www.cbr.ru/scripts/XML_daily.asp?date_req=${cbrDateParam()}`;
  const res = await fetch(url, { next: { revalidate: 3600 }, cache: "no-store" });
  if (!res.ok) throw new Error(`CBR fetch failed: ${res.status}`);
  const xml = await res.text();
  const rate = parseCbrXml(xml);
  if (rate === null) throw new Error("CBR USD rate not found in XML response");
  upsertRate("USD", "RUB", rate, null, "cbr");
  console.log(`CBR USD/RUB: ${rate}`);
}

export { ALL_SUPPORTED as SUPPORTED_CURRENCIES };
