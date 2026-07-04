"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

interface Posting {
  account: string;
  units: { number: string; currency: string };
}

interface Transaction {
  date: string;
  payee: string;
  narration: string;
  postings: Posting[];
}

export default function LedgerPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/beancount/transactions?limit=200")
      .then(r => r.json())
      .then(data => {
        setTxns(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Не удалось загрузить данные");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6">Загрузка...</div>;
  if (error) return <div className="p-6 text-[var(--danger)]">{error}</div>;

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-xl md:text-2xl font-bold">Главная книга (Ledger)</h1>

      {txns.length === 0 ? (
        <EmptyState icon="📒" title="Нет транзакций" description="Транзакции появятся здесь после создания операций" />
      ) : (
        <div className="space-y-3">
          {txns.map((tx, i) => (
            <details key={i} className="card">
              <summary className="cursor-pointer font-medium text-sm flex items-center gap-3">
                <span className="text-[var(--text-muted)]">{tx.date}</span>
                <span>{tx.payee}</span>
                <span className="text-[var(--text-secondary)] truncate">{tx.narration}</span>
              </summary>
              <div className="mt-2 text-sm space-y-1 pl-4 border-l-2 border-[var(--border)]">
                {tx.postings.map((p, j) => (
                  <div key={j} className="flex justify-between font-mono text-xs">
                    <span className="text-[var(--text-secondary)] truncate mr-4">{p.account}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      {parseFloat(p.units.number).toFixed(2)} {p.units.currency}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
