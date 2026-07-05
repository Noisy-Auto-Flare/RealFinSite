import { db } from "@/db";
import { accounts, operations } from "@/db/schema";
import { and, isNotNull, ne, sql, eq } from "drizzle-orm";

export interface AccountInfo {
  id: number;
  userId: number;
  name: string;
  currency: string;
}

export function accountPath(accountId: number, userId: number, currency: string): string {
  return `Assets:FinTracker:User${userId}:${accountId}:${currency}`;
}

export function incomePath(category: string): string {
  const safe = category.replace(/[:"\n]/g, "_").trim() || "Unknown";
  return `Income:${safe}`;
}

export function expensePath(category: string): string {
  const safe = category.replace(/[:"\n]/g, "_").trim() || "Unknown";
  return `Expenses:${safe}`;
}

export function feesPath(): string {
  return "Expenses:Fees";
}

export function openDirective(accountPath: string, date: string): string {
  return `${date} open ${accountPath}`;
}

export function commodityDirective(currency: string): string {
  return `commodity ${currency}`;
}

export function getAllAccountsInfo(): AccountInfo[] {
  return db.select({
    id: accounts.id,
    userId: accounts.userId,
    name: accounts.name,
    currency: accounts.currency,
  }).from(accounts).all();
}

export function getUniqueCategories(): { category: string; count: number }[] {
  return db.select({
    category: operations.category,
    count: sql<number>`COUNT(*)`,
  })
    .from(operations)
    .where(and(
      isNotNull(operations.category),
      ne(operations.category, ""),
      eq(operations.status, "confirmed"),
    ))
    .groupBy(operations.category)
    .orderBy(sql`COUNT(*) DESC`)
    .all() as { category: string; count: number }[];
}
