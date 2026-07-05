import { auth } from "@/auth";

export async function getCurrentUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = parseInt(session.user.id, 10);
  if (Number.isNaN(id)) return null;
  return id;
}

export async function isMaster(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "master";
}

export async function requireAuth(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
