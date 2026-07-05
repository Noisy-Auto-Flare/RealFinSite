import { isDirty } from "@/lib/beancount/dirty-flag";
import { regenerate } from "@/lib/beancount/regenerate";

export function ensureFresh(): void {
  if (isDirty()) {
    regenerate();
  }
}
