import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getLedgerText } from "@/lib/beancount/fava-api";
import fs from "fs";
import path from "path";

export async function GET() {
  ensureFresh();
  const fava = await getLedgerText();
  if (fava) {
    return new NextResponse(fava, {
      headers: { "Content-Type": "text/plain", "Content-Disposition": 'attachment; filename="ledger.beancount"' },
    });
  }
  // Fallback: read file directly
  const ledgerPath = path.join(path.dirname(process.env.DATABASE_URL || "./data/fintracker.db"), "ledger.beancount");
  if (fs.existsSync(ledgerPath)) {
    const content = fs.readFileSync(ledgerPath, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain", "Content-Disposition": 'attachment; filename="ledger.beancount"' },
    });
  }
  return NextResponse.json({ error: "No ledger available" }, { status: 503 });
}
