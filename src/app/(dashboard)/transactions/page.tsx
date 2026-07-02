"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Transaction {
  id: number;
  accountId: number;
  type: string;
  amount: number;
  currency: string;
  amountFrom: number | null;
  currencyFrom: string | null;
  amountTo: number | null;
  currencyTo: string | null;
  category: string | null;
  description: string | null;
  status: string;
  source: string;
  operationDate: string;
  txHash: string | null;
}

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    loadTxs();
  }, [filterStatus]);

  function loadTxs() {
    setLoading(true);
    const url = filterStatus
      ? `/api/transactions?limit=100&status=${filterStatus}`
      : "/api/transactions?limit=100";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setTxs(data); setLoading(false); });
  }

  function formatAmount(amount: number, currency: string) {
    const sym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥", USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON" };
    return `${amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${sym[currency] || currency}`;
  }

  function getTxTypeDisplay(tx: Transaction) {
    if (tx.type === "exchange") {
      return `${tx.amountFrom} ${tx.currencyFrom} → ${tx.amountTo} ${tx.currencyTo}`;
    }
    return formatAmount(tx.amount, tx.currency);
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case "income": return "📥";
      case "expense": return "📤";
      case "transfer": return "🔄";
      case "exchange": return "💱";
      default: return "📝";
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "confirmed": return <span className="badge badge-confirmed">✅ Подтверждено</span>;
      case "pending": return <span className="badge badge-pending">🔵 Новое</span>;
      case "matched_candidate": return <span className="badge badge-candidate">🟡 Кандидат</span>;
      default: return <span className="badge badge-pending">{status}</span>;
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">История операций</h1>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-auto"
        >
          <option value="">Все статусы</option>
          <option value="confirmed">Подтверждённые</option>
          <option value="pending">Новые (не проверены)</option>
          <option value="matched_candidate">Требуют связывания</option>
        </select>

        <span className="text-sm text-[var(--text-muted)]">
          {loading ? "" : `Найдено: ${txs.length}`}
        </span>
      </div>

      {/* Pending/matched section */}
      {txs.filter((t) => t.status !== "confirmed").length > 0 && (
        <div className="card border-yellow-500/30">
          <h2 className="font-medium mb-2 text-[var(--warning)]">⚠️ Требуют внимания</h2>
          {txs.filter((t) => t.status !== "confirmed").slice(0, 5).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 text-sm">
              <div className="flex items-center gap-2">
                <span>{getTypeIcon(tx.type)}</span>
                <span>{getTxTypeDisplay(tx)}</span>
                {tx.source.startsWith("scanner") && <span className="badge badge-pending">авто</span>}
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(tx.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All transactions */}
      <div className="card">
        {loading ? (
          <p className="text-[var(--text-muted)]">Загрузка...</p>
        ) : txs.length === 0 ? (
          <p className="text-[var(--text-muted)] text-center py-8">
            Нет операций.{ " " }
            <button onClick={() => {}} className="text-[var(--accent)] hover:underline">
              Создать первую
            </button>
          </p>
        ) : (
          <div className="space-y-1">
            {txs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getTypeIcon(tx.type)}</span>
                  <div>
                    <div className="text-sm">{getTxTypeDisplay(tx)}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {new Date(tx.operationDate).toLocaleDateString("ru-RU")}
                      {tx.category && <span> · {tx.category}</span>}
                      {tx.source.startsWith("scanner") && <span> · авто-скан</span>}
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
