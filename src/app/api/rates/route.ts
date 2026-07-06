import { NextResponse } from "next/server";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { getCurrentUserId, isMaster } from "@/lib/auth";
import { fetchAndStoreRates, fetchCbrRates } from "@/lib/rates/coingecko";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rates = db.select().from(exchangeRates).all();

  const ratesMap: Record<string, Record<string, number>> = {};
  const changesMap: Record<string, Record<string, number | null>> = {};
  const sourcesMap: Record<string, Record<string, string>> = {};
  for (const r of rates) {
    if (!ratesMap[r.baseCurrency]) {
      ratesMap[r.baseCurrency] = {};
      changesMap[r.baseCurrency] = {};
      sourcesMap[r.baseCurrency] = {};
    }
    ratesMap[r.baseCurrency][r.quoteCurrency] = r.rate;
    changesMap[r.baseCurrency][r.quoteCurrency] = r.change24h ?? null;
    sourcesMap[r.baseCurrency][r.quoteCurrency] = r.source || "coingecko";
  }

  return NextResponse.json({
    rates: ratesMap,
    changes: changesMap,
    sources: sourcesMap,
    updatedAt: rates.length > 0 ? rates[0].updatedAt : null,
  });
}

export async function POST() {
  if (!await isMaster()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [geckoResult, cbrResult] = await Promise.allSettled([
      fetchAndStoreRates(),
      fetchCbrRates(),
    ]);
    const errors: string[] = [];
    if (geckoResult.status === "rejected") {
      console.error("CoinGecko fetch error:", geckoResult.reason);
      errors.push(`CoinGecko: ${geckoResult.reason}`);
    }
    if (cbrResult.status === "rejected") {
      console.error("CBR fetch error:", cbrResult.reason);
      errors.push(`CBR: ${cbrResult.reason}`);
    }
    return NextResponse.json({ success: errors.length === 0, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

