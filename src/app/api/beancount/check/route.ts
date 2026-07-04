import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getCheck } from "@/lib/beancount/fava-api";

export async function GET() {
  ensureFresh();
  const fava = await getCheck();
  if (fava) return NextResponse.json(fava);
  return NextResponse.json([]);
}
