import { db } from "@/db";
import { actionLogs } from "@/db/schema";

interface LogInput {
  userId: number;
  username: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
}

export function logAction(input: LogInput): void {
  try {
    db.insert(actionLogs).values({
      userId: input.userId,
      username: input.username,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
    }).run();
  } catch {
    // silently fail — logging should never break the main flow
  }
}
