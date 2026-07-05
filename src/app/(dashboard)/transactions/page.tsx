"use client";

import { useEffect, useState } from "react";
import { formatAmount } from "@/lib/formatting";
import Select from "@/components/Select";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import NewTransactionModal from "@/components/NewTransactionModal";

interface OperationSummary {
  id: number;
  description: string | null;
  date: string;
  source: string;
  status: string;
  entries: { currency: string; amount: number; type: string }[];
}

function getTxIcon(entries: { amount: number }[], source: string): string {
  if (source.startsWith("scanner") || source.startsWith("api")) {
    const isIncoming = entries.some(e => e.amount > 0);
    if (isIncoming) return "fa-solid fa-arrow-trend-up";
    return "fa-solid fa-arrow-trend-down";
  }
  const isIncoming = entries.some(e => e.amount > 0);
  if (isIncoming) return "fa-solid fa-circle-plus";
  return "fa-solid fa-circle-minus";
}

function getTxColor(entries: { amount: number }[]): string {
  const total = entries.reduce((s, e) => s + e.amount, 0);
  return total > 0 ? "green" : "red";
}

export default function TransactionsPage() {
  const toast = useToast();
  const [txs, setTxs] = useState<OperationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(20);
  const [page, setPage] = useState(0);

  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);
  const [groups, setGroups] = useState<Record<number, { firstOpDescription: string | null; opCount: number }>>({});
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [groupOperations, setGroupOperations] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("search");
    if (q) setSearchQuery(q);
  }, []);

  const [editTx, setEditTx] = useState<OperationSummary | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { setPage(0); }, [filterStatus, searchQuery]);

  useEffect(() => {
    fetch("/api/groups").then(r => r.json()).then((list) => {
      const map: Record<number, { firstOpDescription: string | null; opCount: number }> = {};
      for (const g of list) map[g.id] = g;
      setGroups(map);
    });
  }, []);

  useEffect(() => {
    if (!expandedGroupId) { setGroupOperations([]); return; }
    fetch(`/api/groups/${expandedGroupId}`)
      .then(r => r.json())
      .then(data => setGroupOperations(data.operations || []))
      .catch(() => {});
  }, [expandedGroupId]);

  useEffect(() => { loadTxs(); }, [page, filterStatus, searchQuery]);

  function loadTxs() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("page", String(page + 1));
    if (filterStatus) params.set("status", filterStatus);
    if (searchQuery) params.set("search", searchQuery);

    fetch(`/api/operations?${params.toString()}`)
      .then(r => r.json().catch(() => ({ operations: [], total: 0 })))
      .then(data => {
        setTxs(data.operations || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  const totalPages = Math.ceil(total / limit);

  function openEdit(tx: OperationSummary) {
    setEditTx(tx);
    setEditDescription(tx.description || "");
  }

  async function saveEdit() {
    if (!editTx) return;
    setSaving(true);
    const res = await fetch(`/api/operations/${editTx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: editDescription }),
    });
    setSaving(false);
    setEditTx(null);
    if (res.ok) toast.success("Операция обновлена");
    else toast.error("Ошибка обновления");
    loadTxs();
  }

  async function deleteTx(id: number) {
    if (!confirm("Удалить эту операцию?")) return;
    const res = await fetch(`/api/operations/${id}`, { method: "DELETE" });
    if (res.ok) toast.success("Операция удалена");
    else toast.error("Ошибка удаления");
    loadTxs();
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/scanner/run", { method: "POST" });
      const data = await res.json();
      if (data.eventsFound > 0) toast.success(`Найдено ${data.eventsFound} новых транзакций`);
      else toast.info("Новых транзакций не найдено");
      loadTxs();
    } catch {
      toast.error("Ошибка сканирования");
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2>Транзакции</h2>
          <p>Все операции по счетам</p>
        </div>
        <div className="page-header-actions">
          <div className="search-wrap">
            <i className="fa-solid fa-search" />
            <input
              type="text"
              placeholder="Поиск транзакций..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => setShowNewTx(true)}>
            <i className="fa-solid fa-plus" /> Добавить
          </button>
        </div>
      </header>

      <button
        onClick={() => setShowFilters(!showFilters)}
        className="btn-primary"
        style={{ background: "var(--bg-card)", color: "var(--text-secondary)", marginBottom: "16px" }}
      >
        <i className={`fa-solid ${showFilters ? "fa-chevron-up" : "fa-chevron-down"}`} />
        Фильтры
      </button>

      {showFilters && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="flex gap-3 items-center flex-wrap">
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto min-w-[130px]">
              <option value="">Все статусы</option>
              <option value="confirmed">Подтверждённые</option>
              <option value="pending">Черновики</option>
            </Select>

            <span className="text-sm text-[var(--text-muted)] whitespace-nowrap">
              {total} операций
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="tx-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Все операции</h3>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="btn-primary"
            style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "6px 16px", fontSize: "12px" }}
          >
            <i className="fa-solid fa-rotate" />
            {scanning ? "Проверка..." : "Проверить новые"}
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Загрузка...</p>
        ) : txs.length === 0 ? (
          <EmptyState icon="📋" title="Нет операций" description="Транзакции появятся после добавления счетов" />
        ) : (
          <div className="tx-list">
            {txs.map((tx) => {
              const totalAmount = tx.entries.reduce((s, e) => s + e.amount, 0);
              const icon = getTxIcon(tx.entries, tx.source);
              const color = getTxColor(tx.entries);
              return (
                <div key={tx.id} className="tx-item" onClick={() => openEdit(tx)}>
                  <div className={`tx-icon ${color}`}><i className={icon} /></div>
                  <div className="tx-info">
                    <div className="tx-name">{tx.description || "Операция"}</div>
                    <div className="tx-desc">
                      {new Date(tx.date).toLocaleDateString("ru-RU")}
                      {tx.status === "draft" && <span className="badge badge-pending" style={{ marginLeft: "8px" }}>Черновик</span>}
                    </div>
                  </div>
                  {(tx as any).groupId && groups[(tx as any).groupId] && (
                    <button
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 mt-1 hover:bg-[var(--accent)]/20 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedGroupId(expandedGroupId === (tx as any).groupId ? null : (tx as any).groupId);
                      }}
                    >
                      <i className="fa-solid fa-layer-group text-[9px]" />
                      Группа ({groups[(tx as any).groupId].opCount})
                    </button>
                  )}
                  <div className={`tx-amount mono ${totalAmount > 0 ? "income" : "expense"}`}>
                    {totalAmount > 0 ? "+" : ""}{totalAmount.toFixed(2)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTx(tx.id); }}
                    className="btn-icon"
                    style={{ width: "32px", height: "32px", fontSize: "14px", flexShrink: 0 }}
                    title="Удалить"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {expandedGroupId && (
          <div className="col-span-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                Группа: {groups[expandedGroupId]?.firstOpDescription || `Группа #${expandedGroupId}`}
              </h4>
              <button
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                onClick={() => setExpandedGroupId(null)}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            {groupOperations.map((gop: any) => (
              <div key={gop.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${getTxIcon(gop.entries, gop.source)} ${getTxColor(gop.entries) === "green" ? "text-green-400" : "text-red-400"} text-sm`} />
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{gop.description || "—"}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{gop.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${getTxColor(gop.entries) === "green" ? "text-green-400" : "text-red-400"}`}>
                    {formatAmount(gop.entries.reduce((s: number, e: any) => s + e.amount, 0), gop.entries[0]?.currency || "")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", paddingTop: "16px", borderTop: "1px solid var(--border)", marginTop: "12px" }}>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn-primary"
              style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "6px 16px", fontSize: "12px" }}
            >
              <i className="fa-solid fa-chevron-left" /> Назад
            </button>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn-primary"
              style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "6px 16px", fontSize: "12px" }}
            >
              Вперёд <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        )}
      </div>

      {editTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditTx(null); }}>
          <div className="card w-full max-w-md space-y-4 animate-modal-enter">
            <div className="flex justify-between items-center">
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Редактировать операцию</h3>
              <button onClick={() => setEditTx(null)} className="btn-icon" style={{ width: "32px", height: "32px", fontSize: "16px" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <p>{editTx.entries?.map(e => formatAmount(e.amount, e.currency)).join(" | ") || "—"}</p>
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ fontWeight: 500 }}>Описание</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="Комментарий" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditTx(null)} className="btn-primary" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", flex: 1 }}>Отмена</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary" style={{ flex: 1 }}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewTx && <NewTransactionModal onClose={() => setShowNewTx(false)} />}
    </>
  );
}
