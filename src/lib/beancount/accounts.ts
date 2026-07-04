import type { Database } from "better-sqlite3";

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

export function getAllAccountsInfo(sqlite: Database): AccountInfo[] {
  return sqlite.prepare("SELECT id, user_id as userId, name, currency FROM accounts").all() as AccountInfo[];
}

export function getUniqueCategories(sqlite: Database): { category: string; count: number }[] {
  return sqlite.prepare(`
    SELECT category, COUNT(*) as count FROM operations
    WHERE category IS NOT NULL AND category != '' AND status = 'confirmed'
    GROUP BY category ORDER BY count DESC
  `).all() as { category: string; count: number }[];
}
