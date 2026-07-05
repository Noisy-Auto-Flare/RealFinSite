export interface FeeDetectionInput {
  accountId: number;
  currency: string;
  amount: number;
  type: string;
}

export interface FeeEntry {
  accountId: number;
  currency: string;
  amount: number;
  type: "fee";
}

export function detectImplicitFees(entries: FeeDetectionInput[]): FeeEntry | null {
  const principalSum: Record<string, number> = {};
  const principalCount: Record<string, number> = {};

  for (const e of entries) {
    if (e.type === "principal") {
      const key = `${e.accountId}:${e.currency}`;
      principalSum[key] = (principalSum[key] || 0) + e.amount;
      principalCount[key] = (principalCount[key] || 0) + 1;
    }
  }

  const seen = new Set<string>();
  for (const e of entries) {
    if (e.type !== "principal") continue;
    const key = `${e.accountId}:${e.currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sum = principalSum[key];
    if (principalCount[key] < 2) continue;
    if (Math.abs(sum) < 1e-9) continue;
    return {
      accountId: e.accountId,
      currency: e.currency,
      amount: sum,
      type: "fee",
    };
  }

  return null;
}
