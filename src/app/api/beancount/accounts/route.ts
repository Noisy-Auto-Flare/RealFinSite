import { NextResponse } from "next/server";
import { ensureFresh } from "../ensure-fresh";
import { getAccounts } from "@/lib/beancount/fava-api";
import { db } from "@/db";
import { accounts as accountsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  ensureFresh();
  const fava = await getAccounts();
  if (fava) return NextResponse.json(fava);

  const rows = db.select().from(accountsTable).all();
  return NextResponse.json({
    type: "root",
    name: "FinTracker",
    children: rows.map(a => ({
      type: "account",
      name: a.name,
      account: `Assets:FinTracker:User${a.userId}:${a.id}`,
    })),
  });
}
