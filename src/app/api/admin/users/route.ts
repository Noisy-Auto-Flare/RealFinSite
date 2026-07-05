import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId, isMaster } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

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

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const { userId, action, newPassword } = body; // action: 'approve' | 'reject' | 'reset_password'

  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action are required" }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (action === "approve" || action === "reject") {
    const newStatus = action === "approve" ? "approved" : "rejected";
    db.update(users).set({ status: newStatus }).where(eq(users.id, userId)).run();

    logAction({
      userId: await getCurrentUserId() || 0,
      username: "master",
      action,
      entityType: "user",
      entityId: userId,
      details: `User ${user.username} → ${newStatus}`,
    });

    return NextResponse.json({ success: true, status: newStatus });
  }

  if (action === "reset_password") {
    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: "New password must be at least 4 characters" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    db.update(users).set({ password: hashed }).where(eq(users.id, userId)).run();

    logAction({
      userId: await getCurrentUserId() || 0,
      username: "master",
      action: "update",
      entityType: "user",
      entityId: userId,
      details: `Password reset for ${user.username}`,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

