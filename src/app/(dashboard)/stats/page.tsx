"use client";

import { useEffect, useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import EmptyState from "@/components/EmptyState";
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

const baseSym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };
const CHART_COLORS = ["#E9B1A3", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"];

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
      .map(([name, data], i) => ({ name, value: data.totalInBase, color: CHART_COLORS[i % CHART_COLORS.length] })),
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

  const sym = (cur: string) => baseSym[cur] || cur;

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
          <AnimatedCounter value={summary.totalCapitalConverted} /> {sym(baseCurrency)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm tabular-nums">
          <span className="text-[var(--success)] whitespace-nowrap">
            +<AnimatedCounter value={summary.incomeConverted} /> {sym(baseCurrency)} доход
          </span>
          <span className="text-[var(--danger)] whitespace-nowrap">
            −<AnimatedCounter value={summary.expenseConverted} /> {sym(baseCurrency)} расход
          </span>
        </div>
      </div>

      {/* Distribution by currency — PieChart */}
      <div className="card">
        <h2 className="font-medium mb-3">Распределение по валютам</h2>
        {pieData.length > 0 ? (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-[150px] h-[150px] md:w-[200px] md:h-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} isAnimationActive={true}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "rgba(21,21,30,0.96)", border: "1px solid var(--glass-border)", borderRadius: "8px", fontSize: "12px", color: "var(--text-primary)" }}
                    formatter={(value: unknown) => `${Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${sym(baseCurrency)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {pieData.map((entry, i) => {
                const pct = totalInBase > 0 ? (entry.value / totalInBase) * 100 : 0;
                return (
                  <div key={entry.name}>
                    <div className="flex justify-between text-sm gap-2">
                      <span className="flex items-center gap-1 min-w-0 truncate">
                        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: entry.color }} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="text-[var(--text-muted)] whitespace-nowrap shrink-0">
                        {entry.value.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {sym(baseCurrency)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden mt-0.5">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: entry.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState icon="📊" title="Нет данных" description="Распределение балансов появится после добавления счетов" />
        )}
      </div>

      {/* Distribution by account */}
      <div className="card">
        <h2 className="font-medium mb-3">Балансы по счетам</h2>
        <div className="space-y-3">
          {byAccount.map(([accId, acc]) => {
            const accountTotal = acc.balances.reduce((s, b) => s + (b.amountInBase ?? 0), 0);
            return (
              <div key={accId}>
                  <div className="flex justify-between text-sm font-medium mb-1 gap-2">
                    <span className="truncate min-w-0">{acc.name}</span>
                    <span className="text-[var(--text-muted)] whitespace-nowrap shrink-0">
                      {accountTotal.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {sym(baseCurrency)}
                    </span>
                  </div>
                  {acc.balances.map((b) => (
                    <div key={b.currency} className="flex justify-between text-sm text-[var(--text-secondary)] pl-3 gap-2">
                      <span className="truncate min-w-0">{b.currency}</span>
                      <span className="whitespace-nowrap shrink-0">
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
          })}
        </div>
      </div>
    </div>
  );
}
