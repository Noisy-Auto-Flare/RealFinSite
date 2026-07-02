"use client";

import { useEffect, useState, useCallback } from "react";
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
}

const CATEGORIES = [
  "", "Зарплата", "Продукты", "Транспорт", "Комиссия",
  "Перевод маме", "Перевод другому", "Обмен",
  "Вывод с биржи", "Пополнение", "Другое",
];

const TYPES = ["", "income", "expense", "transfer", "exchange"];
const STATUSES = ["", "confirmed", "pending", "matched_candidate"];

const TYPE_LABELS: Record<string, string> = {
  income: "Доход", expense: "Расход", transfer: "Перевод", exchange: "Обмен",
};

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(20);
  const [page, setPage] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit modal
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [filterType, filterStatus, filterCategory, searchQuery]);

  useEffect(() => {
    loadTxs();
  }, [page, filterType, filterStatus, filterCategory, searchQuery]);

  function loadTxs() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    if (filterCategory) params.set("category", filterCategory);
    if (searchQuery) params.set("search", searchQuery);

    fetch(`/api/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setTxs(data.transactions);
        setTotal(data.total);
        setLoading(false);
      });
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
      case "confirmed": return <span className="badge badge-confirmed">✅</span>;
      case "pending": return <span className="badge badge-pending">🔵</span>;
      case "matched_candidate": return <span className="badge badge-candidate">🟡</span>;
      default: return <span className="badge badge-pending">{status}</span>;
    }
  }

  const totalPages = Math.ceil(total / limit);

  function openEdit(tx: Transaction) {
    setEditTx(tx);
    setEditCategory(tx.category || "");
    setEditDescription(tx.description || "");
  }

  async function saveEdit() {
    if (!editTx) return;
    setSaving(true);
    await fetch(`/api/transactions/${editTx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: editCategory, description: editDescription }),
    });
    setSaving(false);
    setEditTx(null);
    loadTxs();
  }

  async function deleteTx(id: number) {
    if (!confirm("Удалить эту операцию?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    loadTxs();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">История операций</h1>
        <a href="/api/transactions/export" className="btn btn-secondary text-sm">
          📥 CSV
        </a>
      </div>

      {/* Filters + Search */}
      <div className="flex gap-3 items-center flex-wrap">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-auto">
          <option value="">Все типы</option>
          {TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto">
          <option value="">Все статусы</option>
          <option value="confirmed">Подтверждённые</option>
          <option value="pending">Новые</option>
          <option value="matched_candidate">Кандидаты</option>
        </select>

        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-auto">
          <option value="">Все категории</option>
          {CATEGORIES.filter(Boolean).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по описанию..."
          className="w-auto flex-1 min-w-[120px]"
        />

        <span className="text-sm text-[var(--text-muted)] whitespace-nowrap">
          {loading ? "" : `${total} оп.`}
        </span>
      </div>

      {/* Transaction list */}
      <div className="card">
        {loading ? (
          <p className="text-[var(--text-muted)]">Загрузка...</p>
        ) : txs.length === 0 ? (
          <p className="text-[var(--text-muted)] text-center py-8">Нет операций</p>
        ) : (
          <div className="space-y-0.5">
            {txs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5 px-1 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-primary)]/30 rounded transition-colors group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg shrink-0">{getTypeIcon(tx.type)}</span>
                  <div className="min-w-0">
                    <div className="text-sm truncate">{getTxTypeDisplay(tx)}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">
                      {new Date(tx.operationDate).toLocaleDateString("ru-RU")}
                      {tx.category && <span> · {tx.category}</span>}
                      {tx.source.startsWith("scanner") && <span> · авто</span>}
                      {tx.source === "api_bybit" && <span> · bybit</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(tx.status)}

                  {/* Edit */}
                  <button
                    onClick={() => openEdit(tx)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Редактировать"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  {tx.source === "manual" && (
                    <button
                      onClick={() => deleteTx(tx.id)}
                      className="text-xs text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4 border-t border-[var(--border)] mt-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn btn-secondary text-sm px-3 py-1"
            >
              ← Назад
            </button>
            <span className="text-sm text-[var(--text-muted)]">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn btn-secondary text-sm px-3 py-1"
            >
              Вперёд →
            </button>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditTx(null); }}>
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-md p-4 border border-[var(--border)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Редактировать операцию</h3>
              <button onClick={() => setEditTx(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>

            <div className="text-sm text-[var(--text-secondary)] space-y-1">
              <p>{getTypeIcon(editTx.type)} {TYPE_LABELS[editTx.type] || editTx.type}</p>
              <p className="font-mono">{getTxTypeDisplay(editTx)}</p>
            </div>

            <div>
              <label className="block text-sm mb-1">Категория</label>
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                <option value="">Без категории</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Описание</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="Комментарий" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditTx(null)} className="btn btn-secondary flex-1">Отмена</button>
              <button onClick={saveEdit} disabled={saving} className="btn btn-primary flex-1">
                {saving ? "Сохранение..." : "💾 Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
