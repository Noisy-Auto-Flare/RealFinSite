import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getBalanceSheet } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getBalanceSheet();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json({ totals: { assets: { number: "0", currency: "RUB" }, liabilities: { number: "0", currency: "RUB" }, equity: { number: "0", currency: "RUB" } } });
}
