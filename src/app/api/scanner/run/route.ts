import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { runScannerCycle } from "@/lib/scanners/runner";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runScannerCycle();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[api/scanner/run] Scanner cycle failed:", e);
    return NextResponse.json({ error: "Scanner cycle failed" }, { status: 500 });
  }
}
