"use client";

import { useEffect, useState } from "react";

interface Balance {
  accountId: number;
  accountName: string;
  currency: string;
  amount: number;
  amountInBase: number | null;
}

interface Summary {
  totalCapital: number;
  totalCapitalConverted: number;
  baseCurrency: string;
  balances: Balance[];
  income: number;
  incomeConverted: number;
  expense: number;
  expenseConverted: number;
}

const baseSym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };

export default function StatsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("RUB");
  const [ratesDate, setRatesDate] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/stats/summary?base_currency=${baseCurrency}`)
      .then((r) => r.json())
      .then(setSummary);
  }, [baseCurrency]);

  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((data) => { if (data?.updatedAt) setRatesDate(data.updatedAt); });
  }, []);

  async function handleUpdateRates() {
    setUpdating(true);
    try {
      await fetch("/api/rates", { method: "POST" });
      const res = await fetch(`/api/stats/summary?base_currency=${baseCurrency}`);
      setSummary(await res.json());
      const ratesRes = await fetch("/api/rates");
      const ratesData = await ratesRes.json();
      if (ratesData?.updatedAt) setRatesDate(ratesData.updatedAt);
    } catch (e) {
      console.error(e);
    }
    setUpdating(false);
  }

  if (!summary) {
    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Сводка</h1>
        <p className="text-[var(--text-muted)]">Загрузка...</p>
      </div>
    );
  }

  // Group by currency for distribution
  const groupedByCurrency: Record<string, { total: number; totalInBase: number }> = {};
  for (const b of summary.balances) {
    if (!groupedByCurrency[b.currency]) {
      groupedByCurrency[b.currency] = { total: 0, totalInBase: 0 };
    }
    groupedByCurrency[b.currency].total += Math.abs(b.amount);
    if (b.amountInBase !== null) {
      groupedByCurrency[b.currency].totalInBase += b.amountInBase;
    }
  }

  const totalInBase = Object.values(groupedByCurrency).reduce((s, v) => s + v.totalInBase, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Сводка</h1>

        <div className="flex items-center gap-2">
          {ratesDate && (
            <span className="text-xs text-[var(--text-muted)]">
              Курсы: {new Date(ratesDate).toLocaleString("ru-RU")}
            </span>
          )}
          <button onClick={handleUpdateRates} disabled={updating} className="btn btn-secondary text-sm px-2 py-1">
            🔄
          </button>

          <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-0.5">
            {["RUB", "USD"].map((cur) => (
              <button
                key={cur}
                onClick={() => setBaseCurrency(cur)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  baseCurrency === cur
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Capital summary */}
      <div className="card">
        <div className="text-sm text-[var(--text-secondary)] mb-1">Общий капитал</div>
        <div className="text-3xl font-bold">
          {summary.totalCapitalConverted.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {" "}{baseSym[baseCurrency] || baseCurrency}
        </div>
        <div className="flex gap-4 mt-2 text-sm">
          <span className="text-[var(--success)]">
            +{summary.incomeConverted.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {baseSym[baseCurrency] || baseCurrency} доход
          </span>
          <span className="text-[var(--danger)]">
            −{summary.expenseConverted.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {baseSym[baseCurrency] || baseCurrency} расход
          </span>
        </div>
      </div>

      {/* Distribution by currency */}
      <div className="card">
        <h2 className="font-medium mb-3">Распределение по валютам</h2>
        <div className="space-y-2">
          {Object.entries(groupedByCurrency)
            .sort(([, a], [, b]) => b.totalInBase - a.totalInBase)
            .map(([currency, data]) => {
              const pct = totalInBase > 0 ? (data.totalInBase / totalInBase) * 100 : 0;
              return (
                <div key={currency}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{currency}</span>
                    <span>
                      {data.totalInBase.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                      {" "}{baseSym[baseCurrency] || baseCurrency}
                      {" "}({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Distribution by account */}
      <div className="card">
        <h2 className="font-medium mb-3">Балансы по счетам</h2>
        <div className="space-y-3">
          {(() => {
            const byAccount: Record<number, { name: string; balances: Balance[] }> = {};
            for (const b of summary.balances) {
              if (!byAccount[b.accountId]) byAccount[b.accountId] = { name: b.accountName, balances: [] };
              byAccount[b.accountId].balances.push(b);
            }
            return Object.entries(byAccount).map(([accId, acc]) => {
              const accountTotal = acc.balances.reduce((s, b) => s + (b.amountInBase ?? 0), 0);
              return (
                <div key={accId}>
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>{acc.name}</span>
                    <span className="text-[var(--text-muted)]">
                      {accountTotal.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {baseSym[baseCurrency] || baseCurrency}
                    </span>
                  </div>
                  {acc.balances.map((b) => (
                    <div key={b.currency} className="flex justify-between text-sm text-[var(--text-secondary)] pl-3">
                      <span>{b.currency}</span>
                      <span>
                        {b.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                        {b.amountInBase !== null && b.currency !== baseCurrency && (
                          <span className="text-[var(--text-muted)] ml-1">
                            (~{b.amountInBase.toLocaleString("ru-RU", { minimumFractionDigits: 2 })})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
