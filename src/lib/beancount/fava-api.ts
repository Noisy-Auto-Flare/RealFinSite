const FAVA_BASE = process.env.FAVA_URL || "http://localhost:5000";

async function fetchFromFava<T>(endpoint: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${FAVA_BASE}/api/${endpoint}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export interface BalanceEntry {
  account: string;
  balance: { number: string; currency: string };
}

export interface AccountNode {
  type: string;
  name: string;
  account?: string;
  children?: AccountNode[];
  balance?: { number: string; currency: string };
}

export interface TransactionEntry {
  date: string;
  payee: string;
  narration: string;
  postings: { account: string; units: { number: string; currency: string } }[];
}

export interface IncomeStatement {
  income: { account: string; balance: { number: string; currency: string } }[];
  expenses: { account: string; balance: { number: string; currency: string } }[];
}

export interface BalanceSheet {
  totals: { assets: { number: string; currency: string }; liabilities: { number: string; currency: string }; equity: { number: string; currency: string } };
}

export interface HoldingEntry {
  account: string; cost_basis: { number: string; currency: string }; market_value: { number: string; currency: string };
}

export interface CheckEntry {
  source: { filename: string; lineno: number };
  message: string;
}

export type ErrorEntry = CheckEntry;

export async function getBalances(): Promise<BalanceEntry[] | null> {
  return fetchFromFava<BalanceEntry[]>("balances/");
}

export async function getAccounts(): Promise<AccountNode | null> {
  return fetchFromFava<AccountNode>("accounts/");
}

export async function getTransactions(): Promise<TransactionEntry[] | null> {
  return fetchFromFava<TransactionEntry[]>("transactions/");
}

export async function getIncomeStatement(): Promise<IncomeStatement | null> {
  return fetchFromFava<IncomeStatement>("income-statement/");
}

export async function getBalanceSheet(): Promise<BalanceSheet | null> {
  return fetchFromFava<BalanceSheet>("balance-sheet/");
}

export async function getHoldings(): Promise<HoldingEntry[] | null> {
  return fetchFromFava<HoldingEntry[]>("holdings/");
}

export async function getCheck(): Promise<CheckEntry[] | null> {
  return fetchFromFava<CheckEntry[]>("check/");
}

export async function getErrors(): Promise<ErrorEntry[] | null> {
  return fetchFromFava<ErrorEntry[]>("errors/");
}

export async function getLedgerText(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${FAVA_BASE}/download/beancount`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
