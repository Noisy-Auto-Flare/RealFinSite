"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

interface Transaction {
  id: number;
  accountId: number;
  type: string;
  amount: number;
  currency: string;
  category: string | null;
  description: string | null;
  status: string;
  operationDate: string;
  amountFrom: number | null;
  currencyFrom: string | null;
  amountTo: number | null;
  currencyTo: string | null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
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
    fetch("/api/transactions?limit=10")
      .then((r) => r.json())
      .then((tx) => {
        setRecentTx(tx);
        setPendingCount(tx.filter((t: Transaction) => t.status !== "confirmed").length);
      });
  }, [baseCurrency]);

  function handleCurrencyChange(newCurrency: string) {
    setBaseCurrency(newCurrency);
  }

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

  function formatAmount(amount: number, currency: string) {
    const sym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥", USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON" };
    return `${amount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${sym[currency] || currency}`;
  }

  function getTxIcon(type: string) {
    switch (type) {
      case "income": return "📥";
      case "expense": return "📤";
      case "transfer": return "🔄";
      case "exchange": return "💱";
      default: return "📝";
    }
  }

  function getStatusBadge(status: string) {
    if (status === "confirmed") return <span className="badge badge-confirmed">🟢</span>;
    if (status === "pending") return <span className="badge badge-pending">🔵</span>;
    return <span className="badge badge-candidate">🟡</span>;
  }

  const baseSym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Дашборд</h1>

        <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-0.5">
          {["RUB", "USD"].map((cur) => (
            <button
              key={cur}
              onClick={() => handleCurrencyChange(cur)}
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

      {/* Rates indicator */}
      {ratesDate && (
        <div className="text-xs text-[var(--text-muted)] text-right">
          Курсы: {new Date(ratesDate).toLocaleString("ru-RU")}
        </div>
      )}

      {/* Summary block */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[var(--text-secondary)]">Общий капитал</span>
          <span className="text-sm text-[var(--text-muted)]">{baseCurrency}</span>
        </div>
        <div className="text-3xl font-bold">
          {summary
            ? `${summary.totalCapitalConverted.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${baseSym[baseCurrency] || baseCurrency}`
            : "Загрузка..."}
        </div>
        {summary && (
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-[var(--success)]">
              +{summary.incomeConverted.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {baseSym[baseCurrency] || baseCurrency} доход
            </span>
            <span className="text-[var(--danger)]">
              −{summary.expenseConverted.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {baseSym[baseCurrency] || baseCurrency} расход
            </span>
          </div>
        )}
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
                      (~{b.amountInBase.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {baseSym[baseCurrency] || baseCurrency})
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
          <p className="text-[var(--text-muted)] text-sm">Нет операций. Нажмите «+ Новая операция» чтобы добавить.</p>
        ) : (
          <div className="space-y-2">
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2">
                  <span>{getTxIcon(tx.type)}</span>
                  <div>
                    <div className="text-sm">
                      {tx.type === "exchange"
                        ? `${tx.amountFrom} ${tx.currencyFrom} → ${tx.amountTo} ${tx.currencyTo}`
                        : `${formatAmount(tx.amount, tx.currency)}`}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {tx.category || tx.description || new Date(tx.operationDate).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(tx.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
