import { accountPath, incomePath, expensePath, feesPath } from "./accounts";

export interface OperationRow {
  id: number;
  userId: number;
  description: string | null;
  date: string;
}

export interface EntryRow {
  accountId: number;
  currency: string;
  amount: number;
  type: string;
}

function formatAmount(amount: number): string {
  // Avoid -0.00 display
  if (Math.abs(amount) < 1e-9) return "0";
  return amount.toFixed(amount % 1 === 0 ? 0 : 6);
}

export function operationToBeancount(op: OperationRow, entries: EntryRow[]): string {
  const lines: string[] = [];
  const payee = op.description || "Unknown";
  const narration = (op.description || "").replace(/"/g, "'");
  lines.push(`${op.date} * "${payee}" "${narration}"`);

  const postings: string[] = [];
  let total = 0;

  const activeEntries = entries.filter(e => e.type === "principal" || e.type === "fee");

  if (activeEntries.length === 1) {
    // Single entry: create balancing posting
    const e = activeEntries[0];
    const acc = accountPath(e.accountId, op.userId, e.currency);
    postings.push(`  ${acc}  ${formatAmount(e.amount)} ${e.currency}`);
    total += e.amount;

    if (e.amount >= 0) {
      // Positive → incoming, offset is income
      const inc = incomePath(op.description || "Unknown");
      postings.push(`  ${inc}  ${formatAmount(-e.amount)} ${e.currency}`);
      total -= e.amount;
    } else {
      // Negative → outgoing, offset is expense (positive)
      const exp = expensePath(op.description || "Unknown");
      postings.push(`  ${exp}  ${formatAmount(Math.abs(e.amount))} ${e.currency}`);
      total += Math.abs(e.amount);
    }
  } else {
    // Multiple entries: each one is a posting directly
    for (const e of activeEntries) {
      const acc = accountPath(e.accountId, op.userId, e.currency);
      postings.push(`  ${acc}  ${formatAmount(e.amount)} ${e.currency}`);
      total += e.amount;
    }
  }

  // Auto-balance rounding errors to Expenses:Fees
  if (Math.abs(total) > 1e-9) {
    postings.push(`  ${feesPath()}  ${formatAmount(-total)} ${entries[0]?.currency || "RUB"}`);
  }

  lines.push(...postings);
  lines.push("");
  return lines.join("\n");
}
