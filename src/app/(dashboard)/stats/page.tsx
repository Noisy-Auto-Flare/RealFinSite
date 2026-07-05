"use client";

import { useEffect, useState, useMemo } from "react";
import { formatCurrency } from "@/lib/formatting";
import CurrencyPieChart from "@/components/ui/CurrencyPieChart";
import AccountBalanceCard from "@/components/ui/AccountBalanceCard";
import AnimatedCounter from "@/components/AnimatedCounter";

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

  const groupedByCurrency = useMemo(() => {
    if (!summary) return {};
    const map: Record<string, { total: number; totalInBase: number }> = {};
    for (const b of summary.balances) {
      if (!map[b.currency]) map[b.currency] = { total: 0, totalInBase: 0 };
      map[b.currency].total += Math.abs(b.amount);
      if (b.amountInBase !== null) map[b.currency].totalInBase += b.amountInBase;
    }
    return map;
  }, [summary]);

  const totalInBase = useMemo(() =>
    Object.values(groupedByCurrency).reduce((s, v) => s + v.totalInBase, 0),
    [groupedByCurrency]
  );

  const pieData = useMemo(() =>
    Object.entries(groupedByCurrency)
      .sort(([, a], [, b]) => b.totalInBase - a.totalInBase)
      .map(([currency, data]) => ({ currency, value: data.totalInBase })),
    [groupedByCurrency]
  );

  const byAccount = useMemo(() => {
    if (!summary) return [];
    const map: Record<number, { name: string; balances: Balance[] }> = {};
    for (const b of summary.balances) {
      if (!map[b.accountId]) map[b.accountId] = { name: b.accountName, balances: [] };
      map[b.accountId].balances.push(b);
    }
    return Object.entries(map);
  }, [summary]);

  if (!summary) {
    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Сводка</h1>
        <p className="text-[var(--text-muted)]">Загрузка...</p>
      </div>
    );
  }



  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold truncate min-w-0">Сводка</h1>

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
        <div className="text-2xl md:text-3xl font-bold truncate tabular-nums">
          <AnimatedCounter value={summary.totalCapitalConverted} /> {formatCurrency(baseCurrency)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm tabular-nums">
          <span className="text-[var(--success)] whitespace-nowrap">
            +<AnimatedCounter value={summary.incomeConverted} /> {formatCurrency(baseCurrency)} доход
          </span>
          <span className="text-[var(--danger)] whitespace-nowrap">
            −<AnimatedCounter value={summary.expenseConverted} /> {formatCurrency(baseCurrency)} расход
          </span>
        </div>
      </div>

      {/* Distribution by currency — PieChart */}
      <div className="card">
        <h2 className="font-medium mb-3">Распределение по валютам</h2>
        <CurrencyPieChart data={pieData} baseCurrency={baseCurrency} showPercentages={true} totalValue={totalInBase} />
      </div>

      {/* Distribution by account */}
      <div className="card">
        <h2 className="font-medium mb-3">Балансы по счетам</h2>
        <div className="space-y-3">
          {byAccount.map(([accId, acc]) => (
            <AccountBalanceCard key={accId} name={acc.name} balances={acc.balances} baseCurrency={baseCurrency} />
          ))}
        </div>
      </div>
    </div>
  );
}
