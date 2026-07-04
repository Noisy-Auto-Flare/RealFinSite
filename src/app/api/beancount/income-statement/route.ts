import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getIncomeStatement } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getIncomeStatement();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json({ income: [], expenses: [] });
}
