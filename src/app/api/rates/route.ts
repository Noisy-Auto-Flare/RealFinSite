import { NextResponse } from "next/server";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import { getCurrentUserId, isMaster } from "@/lib/server-utils";
import { fetchAndStoreRates } from "@/lib/rates/coingecko";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rates = db.select().from(exchangeRates).all();

  const ratesMap: Record<string, Record<string, number>> = {};
  for (const r of rates) {
    if (!ratesMap[r.baseCurrency]) ratesMap[r.baseCurrency] = {};
    ratesMap[r.baseCurrency][r.quoteCurrency] = r.rate;
  }

  return NextResponse.json({
    rates: ratesMap,
    updatedAt: rates.length > 0 ? rates[0].updatedAt : null,
  });
}

export async function POST() {
  if (!await isMaster()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await fetchAndStoreRates();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
