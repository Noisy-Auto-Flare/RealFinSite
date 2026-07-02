import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId, isMaster } from "@/lib/server-utils";

export async function GET() {
  if (!await isMaster()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allUsers = db.select().from(users).all();
  return NextResponse.json(allUsers);
}

export async function PATCH(request: Request) {
  if (!await isMaster()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, action } = body; // action: 'approve' | 'reject'

  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action are required" }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newStatus = action === "approve" ? "approved" : "rejected";

  db.update(users).set({ status: newStatus }).where(eq(users.id, userId)).run();

  return NextResponse.json({ success: true, status: newStatus });
}
