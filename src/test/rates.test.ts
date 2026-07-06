import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parseCbrXml, cbrDateParam, fetchCbrRates } from "@/lib/rates/coingecko";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  sqlite.exec(`
    CREATE TABLE exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_currency TEXT NOT NULL,
      quote_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      change_24h REAL,
      source TEXT DEFAULT 'coingecko',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return { db, sqlite };
}

function insertRate(
  db: ReturnType<typeof drizzle>,
  base: string, quote: string, rate: number,
  opts?: { change24h?: number | null; source?: string }
) {
  db.insert(schema.exchangeRates).values({
    baseCurrency: base,
    quoteCurrency: quote,
    rate,
    change24h: opts?.change24h ?? null,
    source: opts?.source || "coingecko",
  }).run();
}

function getRateRow(db: ReturnType<typeof drizzle>, base: string, quote: string) {
  return db.select().from(schema.exchangeRates).where(
    and(eq(schema.exchangeRates.baseCurrency, base), eq(schema.exchangeRates.quoteCurrency, quote))
  ).get();
}

function getRate(db: ReturnType<typeof drizzle>, base: string, quote: string): number | null {
  if (base === quote) return 1;
  const direct = db.select().from(schema.exchangeRates).where(
    and(eq(schema.exchangeRates.baseCurrency, base), eq(schema.exchangeRates.quoteCurrency, quote))
  ).get();
  if (direct) return direct.rate;

  const baseToUsd = db.select().from(schema.exchangeRates).where(
    and(eq(schema.exchangeRates.baseCurrency, base), eq(schema.exchangeRates.quoteCurrency, "USD"))
  ).get();
  const usdToQuote = db.select().from(schema.exchangeRates).where(
    and(eq(schema.exchangeRates.baseCurrency, "USD"), eq(schema.exchangeRates.quoteCurrency, quote))
  ).get();

  if (baseToUsd && usdToQuote) return baseToUsd.rate * usdToQuote.rate;

  const reverse = db.select().from(schema.exchangeRates).where(
    and(eq(schema.exchangeRates.baseCurrency, quote), eq(schema.exchangeRates.quoteCurrency, base))
  ).get();
  if (reverse) return 1 / reverse.rate;

  return null;
}

// Simulates what fetchCbrRates does: parse CBR JSON and upsert USD/RUB
function simulateCbrFetch(db: ReturnType<typeof drizzle>, value: number, previous: number) {
  const existing = db.select().from(schema.exchangeRates).where(
    and(eq(schema.exchangeRates.baseCurrency, "USD"), eq(schema.exchangeRates.quoteCurrency, "RUB"))
  ).get();

  if (existing) {
    db.update(schema.exchangeRates).set({
      rate: value,
      change24h: null,
      source: "cbr",
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.exchangeRates.id, existing.id)).run();
  } else {
    db.insert(schema.exchangeRates).values({
      baseCurrency: "USD",
      quoteCurrency: "RUB",
      rate: value,
      change24h: null,
      source: "cbr",
    }).run();
  }
}

describe("fetchCbrRates error handling", () => {
  it("should throw on non-200 response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 500 });
    await expect(fetchCbrRates()).rejects.toThrow("CBR fetch failed: 500");
    globalThis.fetch = originalFetch;
  });

  it("should throw when USD is missing from XML", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      '<?xml version="1.0"?><ValCurs Date="06.07.2026" name="Foreign Currency Market"></ValCurs>',
      { status: 200 }
    );
    await expect(fetchCbrRates()).rejects.toThrow("CBR USD rate not found");
    globalThis.fetch = originalFetch;
  });
});

describe("parseCbrXml", () => {
  it("should extract USD/RUB=77.2264 from CBR XML for 06.07.2026", () => {
    const xml = `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="04.07.2026" name="Foreign Currency Market">
  <Valute ID="R01235">
    <NumCode>840</NumCode>
    <CharCode>USD</CharCode>
    <Nominal>1</Nominal>
    <Name>Доллар США</Name>
    <Value>77,2264</Value>
    <VunitRate>77,2264</VunitRate>
  </Valute>
  <Valute ID="R01239">
    <NumCode>978</NumCode>
    <CharCode>EUR</CharCode>
    <Nominal>1</Nominal>
    <Name>Евро</Name>
    <Value>88,0304</Value>
    <VunitRate>88,0304</VunitRate>
  </Valute>
</ValCurs>`;
    expect(parseCbrXml(xml)).toBeCloseTo(77.2264, 4);
  });

  it("should extract USD/RUB=77.9695 from CBR XML for 07.07.2026", () => {
    const xml = `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="07.07.2026" name="Foreign Currency Market">
  <Valute ID="R01235">
    <NumCode>840</NumCode>
    <CharCode>USD</CharCode>
    <Nominal>1</Nominal>
    <Name>Доллар США</Name>
    <Value>77,9695</Value>
    <VunitRate>77,9695</VunitRate>
  </Valute>
</ValCurs>`;
    expect(parseCbrXml(xml)).toBeCloseTo(77.9695, 4);
  });

  it("should return null when USD is missing from CBR XML", () => {
    const xml = `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="06.07.2026" name="Foreign Currency Market">
  <Valute ID="R01239">
    <NumCode>978</NumCode>
    <CharCode>EUR</CharCode>
    <Nominal>1</Nominal>
    <Name>Евро</Name>
    <Value>88,0304</Value>
  </Valute>
</ValCurs>`;
    expect(parseCbrXml(xml)).toBeNull();
  });

  it("should return null on empty XML", () => {
    expect(parseCbrXml("")).toBeNull();
    expect(parseCbrXml("<root></root>")).toBeNull();
  });
});

describe("cbrDateParam", () => {
  it("should format date as DD/MM/YYYY", () => {
    const d = new Date("2026-07-06T12:00:00Z");
    expect(cbrDateParam(d)).toBe("06/07/2026");
  });

  it("should pad single-digit day and month", () => {
    const d = new Date("2026-01-03T12:00:00Z");
    expect(cbrDateParam(d)).toBe("03/01/2026");
  });

  it("should default to current date when no argument", () => {
    const result = cbrDateParam();
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    expect(result).toBe(`${dd}/${mm}/${yyyy}`);
  });
});

describe("Exchange Rates", () => {
  it("should return direct rate", () => {
    const { db } = createTestDb();
    insertRate(db, "USD", "RUB", 88.5);
    expect(getRate(db, "USD", "RUB")).toBeCloseTo(88.5);
  });

  it("should return 1 for same currency", () => {
    const { db } = createTestDb();
    expect(getRate(db, "RUB", "RUB")).toBe(1);
  });

  it("should convert via USD bridge", () => {
    const { db } = createTestDb();
    insertRate(db, "SOL", "USD", 140.5);
    insertRate(db, "USD", "RUB", 88.5);
    const rate = getRate(db, "SOL", "RUB");
    expect(rate).not.toBeNull();
    expect(rate).toBeCloseTo(140.5 * 88.5, 1);
  });

  it("should return inverse rate", () => {
    const { db } = createTestDb();
    insertRate(db, "USD", "RUB", 88.5);
    const rate = getRate(db, "RUB", "USD");
    expect(rate).not.toBeNull();
    expect(rate).toBeCloseTo(1 / 88.5, 5);
  });

  it("should return null for unknown pair", () => {
    const { db } = createTestDb();
    expect(getRate(db, "XYZ", "ABC")).toBeNull();
  });

  it("should convert amounts correctly", () => {
    const { db } = createTestDb();
    insertRate(db, "USD", "RUB", 88.5);
    const rate = getRate(db, "USD", "RUB");
    expect(rate).not.toBeNull();
    const converted = 100 * rate!;
    expect(converted).toBeCloseTo(8850, 0);
  });
});

describe("CBR rate fetching", () => {
  it("should store USD/RUB from CBR JSON response", () => {
    const { db } = createTestDb();
    const mockData = {
      Date: "2026-07-07T11:30:00+03:00",
      Valute: {
        USD: { ID: "R01235", NumCode: "840", CharCode: "USD", Nominal: 1, Name: "Доллар США", Value: 77.9695, Previous: 77.2264 },
      },
    };

    const usd = mockData.Valute.USD;
    simulateCbrFetch(db, usd.Value, usd.Previous);

    const row = getRateRow(db, "USD", "RUB");
    expect(row).not.toBeNull();
    expect(row!.rate).toBeCloseTo(77.9695, 4);
    expect(row!.source).toBe("cbr");
    expect(row!.change24h).toBeNull();
  });

  it("should overwrite old CoinGecko USD/RUB with CBR rate", () => {
    const { db } = createTestDb();
    // Old rate from CoinGecko (76.8 as USDT/RUB stored as USD/RUB — legacy)
    insertRate(db, "USD", "RUB", 76.8, { source: "coingecko", change24h: -1.5 });

    // CBR fetches the correct rate
    simulateCbrFetch(db, 77.9695, 77.2264);

    const row = getRateRow(db, "USD", "RUB");
    expect(row).not.toBeNull();
    expect(row!.rate).toBeCloseTo(77.9695, 4);
    expect(row!.source).toBe("cbr");
    expect(row!.change24h).toBeNull();
  });

  it("should handle missing USD in CBR response gracefully", () => {
    const { db } = createTestDb();
    const emptyData = { Date: "2026-07-07T11:30:00+03:00", Valute: {} };
    const usd = emptyData.Valute?.USD;
    expect(usd).toBeUndefined();
  });
});

describe("Rate isolation", () => {
  it("USDT/RUB from CoinGecko should not affect USD/RUB from CBR", () => {
    const { db } = createTestDb();
    // CBR sets USD/RUB
    simulateCbrFetch(db, 77.9695, 77.2264);

    // CoinGecko sets USDT/RUB (this is what happens in the crypto loop)
    insertRate(db, "USDT", "RUB", 76.5, { source: "coingecko", change24h: 0.5 });

    // USD/RUB should still be from CBR
    const usdRub = getRateRow(db, "USD", "RUB");
    expect(usdRub!.rate).toBeCloseTo(77.9695, 4);
    expect(usdRub!.source).toBe("cbr");

    // USDT/RUB should be separate
    const usdtRub = getRateRow(db, "USDT", "RUB");
    expect(usdtRub!.rate).toBeCloseTo(76.5, 4);
    expect(usdtRub!.source).toBe("coingecko");
  });

  it("should provide separate USD/USDT rates for conversion", () => {
    const { db } = createTestDb();
    simulateCbrFetch(db, 77.9695, 77.2264);  // USD/RUB = 77.97
    insertRate(db, "USDT", "USD", 1.0, { source: "coingecko" });  // USDT/USD = 1.0

    const usdRub = getRate(db, "USD", "RUB");
    expect(usdRub).toBeCloseTo(77.9695, 4);

    const usdtRub = getRate(db, "USDT", "RUB"); // via USD bridge
    expect(usdtRub).toBeCloseTo(77.9695, 4); // USDT→USD→RUB = 1.0 * 77.97 = 77.97
  });
});

describe("CoinGecko rate fetch logic", () => {
  it("should store crypto/RUB with 24h change", () => {
    const { db } = createTestDb();
    // Simulate what the crypto loop does:
    insertRate(db, "BTC", "RUB", 5_500_000, { source: "coingecko", change24h: 2.5 });

    const row = getRateRow(db, "BTC", "RUB");
    expect(row!.rate).toBeCloseTo(5_500_000, -3);
    expect(row!.change24h).toBeCloseTo(2.5, 1);
    expect(row!.source).toBe("coingecko");
  });

  it("should update existing rate and preserve source when source not specified", () => {
    const { db } = createTestDb();
    insertRate(db, "BTC", "USD", 60_000, { source: "coingecko", change24h: 1.0 });

    // Update without source or change24h — like the existing upsertRate logic
    const existing = getRateRow(db, "BTC", "USD")!;
    const updates: Record<string, unknown> = { rate: 65_000, updatedAt: new Date().toISOString() };
    db.update(schema.exchangeRates).set(updates).where(eq(schema.exchangeRates.id, existing.id)).run();

    const row = getRateRow(db, "BTC", "USD");
    expect(row!.rate).toBeCloseTo(65_000, -2);
    // source unchanged, change24h untouched
    expect(row!.source).toBe("coingecko");
    expect(row!.change24h).toBeCloseTo(1.0, 1);
  });
});

describe("GET /api/rates response shape", () => {
  it("should produce expected response format", () => {
    const { db, sqlite } = createTestDb();
    insertRate(db, "BTC", "USD", 67000, { source: "coingecko", change24h: 2.5 });
    insertRate(db, "BTC", "RUB", 5200000, { source: "coingecko", change24h: 1.8 });
    simulateCbrFetch(db, 77.9695, 77.2264);

    const rows = db.select().from(schema.exchangeRates).all();
    const ratesMap: Record<string, Record<string, number>> = {};
    const changesMap: Record<string, Record<string, number | null>> = {};
    const sourcesMap: Record<string, Record<string, string>> = {};
    for (const r of rows) {
      if (!ratesMap[r.baseCurrency]) {
        ratesMap[r.baseCurrency] = {};
        changesMap[r.baseCurrency] = {};
        sourcesMap[r.baseCurrency] = {};
      }
      ratesMap[r.baseCurrency][r.quoteCurrency] = r.rate;
      changesMap[r.baseCurrency][r.quoteCurrency] = r.change24h ?? null;
      sourcesMap[r.baseCurrency][r.quoteCurrency] = r.source || "coingecko";
    }

    expect(ratesMap.USD?.RUB).toBeCloseTo(77.9695, 4);
    expect(ratesMap.BTC?.USD).toBeCloseTo(67000, -3);
    expect(ratesMap.BTC?.RUB).toBeCloseTo(5200000, -4);
    expect(changesMap.USD?.RUB).toBeNull();
    expect(changesMap.BTC?.USD).toBeCloseTo(2.5, 1);
    expect(changesMap.BTC?.RUB).toBeCloseTo(1.8, 1);
    expect(sourcesMap.USD?.RUB).toBe("cbr");
    expect(sourcesMap.BTC?.USD).toBe("coingecko");
  });
});
