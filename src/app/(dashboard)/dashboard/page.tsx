"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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

interface OperationSummary {
  id: number;
  description: string | null;
  category: string | null;
  date: string;
  source: string;
  status: string;
  entries: { currency: string; amount: number; type: string }[];
}

const CHART_COLORS = ["#E9B1A3", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"];

const baseSym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentTx, setRecentTx] = useState<OperationSummary[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [baseCurrency, setBaseCurrency] = useState("RUB");
  const [ratesDate, setRatesDate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((data) => {
        if (data?.updatedAt) setRatesDate(data.updatedAt);
      });
  }, []);

  function loadSummary(currency: string) {
    fetch(`/api/stats/summary?base_currency=${currency}`)
      .then((r) => r.json())
      .then(setSummary);
  }

  useEffect(() => {
    loadSummary(baseCurrency);
    fetch("/api/operations?limit=5&page=1")
      .then((r) => r.json())
      .then((data) => {
        const ops = data.operations || [];
        setRecentTx(ops);
        setPendingCount(ops.filter((o: OperationSummary) => o.status === "draft").length);
      });
  }, [baseCurrency]);

  const groupBalancesByAccount = () => {
    if (!summary) return [];
    const map = new Map<number, { name: string; balances: Balance[] }>();
    for (const b of summary.balances) {
      if (!map.has(b.accountId)) {
        map.set(b.accountId, { name: b.accountName, balances: [] });
      }
      map.get(b.accountId)!.balances.push(b);
    }
    return Array.from(map.values());
  };

  const pieData = useMemo(() => {
    if (!summary) return [];
    const byCurrency: Record<string, number> = {};
    for (const b of summary.balances) {
      const val = b.amountInBase ?? 0;
      if (val > 0) {
        byCurrency[b.currency] = (byCurrency[b.currency] || 0) + val;
      }
    }
    return Object.entries(byCurrency)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [summary]);

  function formatAmount(amount: number, currency: string) {
    const sym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥", USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON" };
    return `${amount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${sym[currency] || currency}`;
  }

  const sym = (cur: string) => baseSym[cur] || cur;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold truncate min-w-0">Дашборд</h1>

        <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-0.5 shrink-0">
          {["RUB", "USD"].map((cur) => (
            <button
              key={cur}
              onClick={() => setBaseCurrency(cur)}
              className={`px-2.5 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${
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

      {ratesDate && (
        <div className="text-xs text-[var(--text-muted)] text-right">
          Курсы: {new Date(ratesDate).toLocaleString("ru-RU")}
        </div>
      )}

      {/* Summary + Pie chart row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[var(--text-secondary)]">Общий капитал</span>
            <span className="text-sm text-[var(--text-muted)]">{baseCurrency}</span>
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {summary
              ? <><AnimatedCounter value={summary.totalCapitalConverted} /> {sym(baseCurrency)}</>
              : "Загрузка..."}
          </div>
          {summary && (
            <div className="flex gap-4 mt-3 text-sm tabular-nums">
              <span className="text-[var(--success)]">
                +<AnimatedCounter value={summary.incomeConverted} /> {sym(baseCurrency)}
              </span>
              <span className="text-[var(--danger)]">
                −<AnimatedCounter value={summary.expenseConverted} /> {sym(baseCurrency)}
              </span>
            </div>
          )}
        </div>

        <div className="card md:col-span-2">
          <h2 className="font-medium mb-2">Распределение по валютам</h2>
          {pieData.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-[140px] h-[140px] md:w-[180px] md:h-[180px] shrink-0">
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
              <div className="space-y-1 text-sm flex-1">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
                      {entry.name}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {entry.value.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {sym(baseCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="💳" title="Нет данных" description="Добавьте счета для отслеживания балансов" />
          )}
        </div>
      </div>

      {/* Account balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groupBalancesByAccount().map((group) => (
          <Link key={group.name} href="/accounts" className="card block hover:border-[var(--accent)] transition-colors">
            <div className="font-medium mb-2">{group.name}</div>
            {group.balances.map((b) => (
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
          </Link>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium">Последние операции</h2>
          <Link href="/transactions" className="text-sm text-[var(--accent)] hover:underline">
            Все →
          </Link>
        </div>

        {pendingCount > 0 && (
          <div className="mb-3 p-2 bg-yellow-500/10 rounded-lg text-sm text-[var(--warning)]">
            ⚠️ {pendingCount} операций требуют внимания
          </div>
        )}

        {recentTx.length === 0 ? (
          <EmptyState icon="📋" title="Нет операций" description="Последние операции появятся здесь" />
        ) : (
          <div className="space-y-2">
            {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span className="shrink-0">{tx.entries?.some(e => e.amount > 0) ? "📥" : "📤"}</span>
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-sm truncate">
                        {tx.description || tx.entries?.map(e => formatAmount(e.amount, e.currency)).join(" | ") || "—"}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {tx.category || new Date(tx.date).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tx.status === "confirmed" ? <span className="badge badge-confirmed">🟢</span> : <span className="badge badge-pending">🔵</span>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
