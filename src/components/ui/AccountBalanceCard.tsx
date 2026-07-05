"use client";

import { formatAmount } from "@/lib/formatting";

interface Balance {
  currency: string;
  amount: number;
  amountInBase: number | null;
}

interface AccountBalanceCardProps {
  name: string;
  balances: Balance[];
  baseCurrency: string;
  href?: string;
}

export default function AccountBalanceCard({ name, balances, baseCurrency, href }: AccountBalanceCardProps) {
  const sym = (cur: string) => {
    const m: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };
    return m[cur] || cur;
  };

  const content = (
    <div className="card hover:border-[var(--accent)] transition-colors">
      <div className="font-medium mb-2">{name}</div>
      {balances.map((b) => (
        <div key={b.currency} className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">{b.currency}</span>
          <span>
            {formatAmount(b.amount, b.currency)}
            {b.amountInBase !== null && b.currency !== baseCurrency && (
              <span className="text-[var(--text-muted)] ml-1 text-xs">
                (~{b.amountInBase.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {sym(baseCurrency)})
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );

  if (href) {
    return <a href={href} className="block">{content}</a>;
  }
  return content;
}
