import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, accounts, operations, actionLogs } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUserId, isMaster } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isMaster()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (!userId) return NextResponse.json({ error: "Invalid userId" }, { status: 400 });

  const currentUserId = await getCurrentUserId();
  if (userId === currentUserId) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.role === "master") {
    return NextResponse.json({ error: "Cannot delete master user" }, { status: 400 });
  }

  const userAccounts = db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)).all();
  const accountIds = userAccounts.map((a) => a.id);

  db.delete(operations).where(eq(operations.userId, userId)).run();
  db.delete(actionLogs).where(eq(actionLogs.userId, userId)).run();

  if (accountIds.length > 0) {
    db.delete(accounts).where(inArray(accounts.id, accountIds)).run();
  }

  db.delete(users).where(eq(users.id, userId)).run();

  await logAction({
    userId: currentUserId || 0,
    username: "master",
    action: "delete",
    entityType: "user",
    entityId: userId,
    details: `Deleted user ${user.username} (id=${userId})`,
  });

  return NextResponse.json({ success: true });
}
