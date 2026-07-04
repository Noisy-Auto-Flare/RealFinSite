"use client";

import { useEffect, useState } from "react";
import Select from "@/components/Select";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import TransactionRow from "@/components/TransactionRow";

interface OperationSummary {
  id: number;
  description: string | null;
  category: string | null;
  date: string;
  source: string;
  status: string;
  entries: { currency: string; amount: number; type: string }[];
}

const CATEGORIES = [
  "", "Зарплата", "Продукты", "Транспорт", "Комиссия",
  "Перевод маме", "Перевод другому", "Обмен",
  "Вывод с биржи", "Пополнение", "Другое",
];

export default function TransactionsPage() {
  const toast = useToast();
  const [txs, setTxs] = useState<OperationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(20);
  const [page, setPage] = useState(0);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [editTx, setEditTx] = useState<OperationSummary | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [filterStatus, filterCategory, searchQuery]);

  useEffect(() => {
    loadTxs();
  }, [page, filterStatus, filterCategory, searchQuery]);

  function loadTxs() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("page", String(page + 1));
    if (filterStatus) params.set("status", filterStatus);
    if (filterCategory) params.set("category", filterCategory);
    if (searchQuery) params.set("search", searchQuery);

    fetch(`/api/operations?${params.toString()}`)
      .then((r) => r.json().catch(() => ({ operations: [], total: 0 })))
      .then((data) => {
        setTxs(data.operations || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }

  function formatAmount(amount: number, currency: string) {
    const sym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥", USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON" };
    return `${amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${sym[currency] || currency}`;
  }

  const totalPages = Math.ceil(total / limit);

  function openEdit(tx: OperationSummary) {
    setEditTx(tx);
    setEditCategory(tx.category || "");
    setEditDescription(tx.description || "");
  }

  async function saveEdit() {
    if (!editTx) return;
    setSaving(true);
    const res = await fetch(`/api/operations/${editTx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: editCategory, description: editDescription }),
    });
    setSaving(false);
    setEditTx(null);
    if (res.ok) {
      toast.success("Операция обновлена");
    } else {
      toast.error("Ошибка обновления");
    }
    loadTxs();
  }

  async function deleteTx(id: number) {
    if (!confirm("Удалить эту операцию?")) return;
    const res = await fetch(`/api/operations/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Операция удалена");
    } else {
      toast.error("Ошибка удаления");
    }
    loadTxs();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl md:text-2xl font-bold truncate min-w-0">История операций</h1>
        
      </div>

      {/* Mobile: toggle filter button */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="btn btn-secondary text-sm w-full md:hidden"
      >
        {showFilters ? "▲ Скрыть фильтры" : "▼ Фильтры"}
      </button>

      {/* Filters + Search */}
      <div className={`${showFilters ? "flex" : "hidden"} md:flex gap-3 items-center flex-wrap`}>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto min-w-[130px]">
          <option value="">Все статусы</option>
          <option value="confirmed">Подтверждённые</option>
          <option value="pending">Черновики</option>
        </Select>

        <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-auto min-w-[150px]">
          <option value="">Все категории</option>
          {CATEGORIES.filter(Boolean).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>

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
          <EmptyState icon="📋" title="Нет операций" description="Транзакции появятся после добавления счетов и проведения операций" />
        ) : (
          <div className="space-y-0.5">
            {txs.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onEdit={openEdit} onDelete={deleteTx} />
            ))}
          </div>
        )}

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
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-md p-4 border border-[var(--border)] space-y-4 animate-modal-enter">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Редактировать операцию</h3>
              <button onClick={() => setEditTx(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>

            <div className="text-sm text-[var(--text-secondary)] space-y-1">
              <p>{editTx.entries?.some(e => e.amount > 0) ? "📥" : "📤"} Операция</p>
              <p className="font-mono">{editTx.entries?.map(e => formatAmount(e.amount, e.currency)).join(" | ") || "—"}</p>
            </div>

            <div>
              <label className="block text-sm mb-1">Категория</label>
              <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                <option value="">Без категории</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
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
