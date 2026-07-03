import { NextResponse } from "next/server";
import { db } from "@/db";
import { operations, operationEntries } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const draftOps = db.select().from(operations)
    .where(and(eq(operations.userId, userId), eq(operations.status, "draft")))
    .orderBy(desc(operations.date))
    .all();

  if (draftOps.length === 0) return NextResponse.json({ operations: [] });

  const opIds = draftOps.map((o) => o.id);
  const entries = db.select().from(operationEntries)
    .where(and(
      inArray(operationEntries.operationId, opIds),
      eq(operationEntries.isVerified, 0),
    ))
    .all();

  const entriesByOpId: Record<number, typeof entries> = {};
  for (const e of entries) {
    if (!entriesByOpId[e.operationId]) entriesByOpId[e.operationId] = [];
    entriesByOpId[e.operationId].push(e);
  }

  const result = draftOps
    .filter((o) => entriesByOpId[o.id]?.length > 0)
    .map((o) => ({
      ...o,
      entries: entriesByOpId[o.id] || [],
    }));

  return NextResponse.json({ operations: result });
}
