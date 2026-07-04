import { getDirtySqlite, isDirty } from "@/lib/beancount/dirty-flag";
import { regenerate } from "@/lib/beancount/regenerate";

export function ensureFresh(): void {
  const sqlite = getDirtySqlite();
  if (isDirty(sqlite)) {
    regenerate(sqlite);
  }
}
