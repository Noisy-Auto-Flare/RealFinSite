import { NextResponse } from "next/server";
import { db } from "@/db";
import { operationGroups, operations } from "@/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // List groups with first operation description and operation count
  const list = db.select({
    id: operationGroups.id,
    userId: operationGroups.userId,
    createdAt: operationGroups.createdAt,
    opCount: sql<number>`count(${operations.id})`,
    firstOpDescription: sql<string>`min(${operations.description})`,
  }).from(operationGroups)
    .leftJoin(operations, eq(operations.groupId, operationGroups.id))
    .where(eq(operationGroups.userId, userId))
    .groupBy(operationGroups.id)
    .orderBy(desc(operationGroups.createdAt))
    .all();

  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const operationIds: number[] = body.operationIds || [];

  const created = db.insert(operationGroups).values({ userId }).returning().get();

  if (operationIds.length > 0) {
    const validOps = db.select({ id: operations.id }).from(operations)
      .where(and(
        eq(operations.userId, userId),
        inArray(operations.id, operationIds)
      )).all();
    const validIds = validOps.map(o => o.id);
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?").join(",");
      db.run(sql.raw(`UPDATE operations SET group_id = ${created.id} WHERE id IN (${placeholders})`), ...validIds);
    }
  }

  return NextResponse.json({ id: created.id, colorIndex: created.id % 6 }, { status: 201 });
}
