import { NextResponse } from "next/server";
import { db } from "@/db";
import { operationGroups, operations } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
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

  const created = db.insert(operationGroups).values({ userId }).returning().get();
  return NextResponse.json(created, { status: 201 });
}
