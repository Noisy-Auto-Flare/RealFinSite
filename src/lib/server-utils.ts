import { auth } from "@/auth";

export async function getCurrentUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return parseInt(session.user.id, 10);
}

export async function isMaster(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "master";
}
