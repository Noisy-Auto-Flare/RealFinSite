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
  groupId?: number;
  tags?: string[];
  fromAddress?: string | null;
  toAddress?: string | null;
  blockTimestamp?: number | null;
  entries: { currency: string; amount: number; type: string; accountName?: string }[];
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
  const [relatedOnly, setRelatedOnly] = useState(false);
  const [groups, setGroups] = useState<Record<number, { firstOpDescription: string | null; opCount: number }>>({});
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [groupOperations, setGroupOperations] = useState<OperationSummary[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const GROUP_COLORS = ['#E9B1A3', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("search");
    if (q) setSearchQuery(q);
  }, []);

  const [editTx, setEditTx] = useState<OperationSummary | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { setPage(0); }, [filterStatus, searchQuery, relatedOnly]);

  function loadGroups() {
    fetch("/api/groups").then(r => r.json()).then((list) => {
      const map: Record<number, { firstOpDescription: string | null; opCount: number }> = {};
      for (const g of list) map[g.id] = g;
      setGroups(map);
    });
  }
  useEffect(() => { loadGroups(); }, []);

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
    if (relatedOnly) params.set("related", "true");

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

      <div className="flex gap-1 mb-4 items-center flex-wrap">
        <button
          onClick={() => {
            setRelatedOnly(false);
            setSelectMode(false);
            setSelectedIds(new Set());
          }}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            !selectMode && !relatedOnly
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Все
        </button>
        <button
          onClick={() => {
            if (selectMode) {
              setSelectMode(false);
              setSelectedIds(new Set());
            } else {
              setSelectMode(true);
            }
          }}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            selectMode
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {selectMode ? "Отмена" : "Связанные"}
        </button>
        {selectMode && selectedIds.size >= 2 && (
          <button
            onClick={async () => {
              const res = await fetch("/api/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ operationIds: [...selectedIds] }),
              });
              if (res.ok) {
                toast.success(`Связано ${selectedIds.size} операций`);
                setSelectMode(false);
                setSelectedIds(new Set());
                loadTxs();
                loadGroups();
              } else {
                toast.error("Ошибка связывания");
              }
            }}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors bg-[var(--accent)] text-white"
          >
            <i className="fa-solid fa-link mr-1" /> Связать ({selectedIds.size})
          </button>
        )}
        {selectMode && (
          <span className="text-xs text-[var(--text-muted)] ml-auto">
            Выбрано: {selectedIds.size}
          </span>
        )}
      </div>

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
              const icon = getTxIcon(tx.entries, tx.source);
              const color = getTxColor(tx.entries);
              const isSelected = selectedIds.has(tx.id);
              const groupColor = tx.groupId ? GROUP_COLORS[tx.groupId % 6] : undefined;
              return (
                <div
                  key={tx.id}
                  className="tx-item"
                  style={{
                    borderLeft: groupColor ? `3px solid ${groupColor}` : undefined,
                    paddingLeft: groupColor ? "11px" : undefined,
                    ...(isSelected ? { background: "rgba(233, 177, 163, 0.06)" } : {}),
                  }}
                  onClick={() => {
                    if (selectMode) {
                      const next = new Set(selectedIds);
                      if (next.has(tx.id)) next.delete(tx.id);
                      else next.add(tx.id);
                      setSelectedIds(next);
                    } else {
                      openEdit(tx);
                    }
                  }}
                >
                  {selectMode && (
                    <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 40 }}
                      onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(tx.id)) next.delete(tx.id);
                          else next.add(tx.id);
                          setSelectedIds(next);
                        }}
                        style={{ accentColor: "var(--accent)", cursor: "pointer", width: 16, height: 16 }}
                      />
                    </div>
                  )}
                  <div className={`tx-icon ${color}`}><i className={icon} /></div>
                  <div className="tx-info">
                    <div className="tx-name">{tx.description || "Операция"}</div>
                    <div className="tx-desc">
                      {new Date(tx.date).toLocaleDateString("ru-RU")}
                      {tx.status === "draft" && <span className="badge badge-pending" style={{ marginLeft: "8px" }}>Черновик</span>}
                      {tx.source.startsWith("scanner") && <span style={{ marginLeft: "6px" }}>· авто</span>}
                      {tx.groupId && groups[tx.groupId] && (
                        <button
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ml-2 border transition-colors"
                          style={{
                            background: `${groupColor}18`,
                            color: groupColor,
                            borderColor: `${groupColor}30`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedGroupId(expandedGroupId === tx.groupId ? null : (tx.groupId ?? null));
                          }}
                        >
                          <i className="fa-solid fa-layer-group text-[9px]" />
                          {groups[tx.groupId].opCount}
                        </button>
                      )}
                    </div>
                    {tx.entries.map((e, i) => (
                      <div key={i} className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1 flex-wrap">
                        {e.accountName ? (
                          <span className="truncate max-w-[120px]">{e.accountName}</span>
                        ) : tx.fromAddress || tx.toAddress ? (
                          <>
                            {tx.fromAddress && <span title={tx.fromAddress} className="shrink-0">{tx.fromAddress.slice(0, 4)}..{tx.fromAddress.slice(-4)}</span>}
                            {tx.fromAddress && tx.toAddress && <span className="shrink-0">→</span>}
                            {tx.toAddress && <span title={tx.toAddress} className="shrink-0">{tx.toAddress.slice(0, 4)}..{tx.toAddress.slice(-4)}</span>}
                          </>
                        ) : null}
                        <span className="ml-auto shrink-0">{formatAmount(e.amount, e.currency)}</span>
                      </div>
                    ))}
                  </div>
                  {!selectMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTx(tx.id); }}
                      className="btn-icon"
                      style={{ width: "32px", height: "32px", fontSize: "14px", flexShrink: 0, alignSelf: "center" }}
                      title="Удалить"
                    >
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {expandedGroupId && (
          <div className="col-span-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mt-2">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                <i className="fa-solid fa-layer-group mr-2" />
                {groups[expandedGroupId]?.firstOpDescription || `Группа #${expandedGroupId}`}
                <span className="ml-2 text-[var(--text-muted)] font-normal">
                  {groupOperations.length} операций
                </span>
              </h4>
              <button
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                onClick={() => setExpandedGroupId(null)}
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            {/* Summary: from → to with accounts */}
            {(() => {
              const fromOps = groupOperations.filter(o => o.entries.some(e => e.amount < 0 && e.type === "principal"));
              const toOps = groupOperations.filter(o => o.entries.some(e => e.amount > 0 && e.type === "principal"));
              const feeOps = groupOperations.filter(o => o.entries.some(e => e.type === "fee"));
              const allCurrencies = [...new Set(groupOperations.flatMap(o => o.entries.map(e => e.currency)))];
              return (
                <div className="space-y-3 mb-4 text-sm">
                  {fromOps.length > 0 && (
                    <div>
                      <span className="text-[var(--text-muted)] text-xs font-medium">Откуда</span>
                      {fromOps.map(o => o.entries.filter(e => e.amount < 0 && e.type === "principal").map((e, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <span className="font-medium">{e.accountName || o.fromAddress?.slice(0, 8) || "—"}</span>
                          <span className="text-red-400">{formatAmount(Math.abs(e.amount), e.currency)}</span>
                        </div>
                      )))}
                    </div>
                  )}
                  {toOps.length > 0 && (
                    <div>
                      <span className="text-[var(--text-muted)] text-xs font-medium">Куда</span>
                      {toOps.map(o => o.entries.filter(e => e.amount > 0 && e.type === "principal").map((e, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <span className="font-medium">{e.accountName || o.toAddress?.slice(0, 8) || "—"}</span>
                          <span className="text-green-400">{formatAmount(e.amount, e.currency)}</span>
                        </div>
                      )))}
                    </div>
                  )}
                  {feeOps.length > 0 && (
                    <div>
                      <span className="text-[var(--text-muted)] text-xs font-medium">Комиссия</span>
                      {feeOps.map(o => o.entries.filter(e => e.type === "fee").map((e, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <span className="font-medium">{e.accountName || "—"}</span>
                          <span className="text-red-400">{formatAmount(Math.abs(e.amount), e.currency)}</span>
                        </div>
                      )))}
                    </div>
                  )}
                  {allCurrencies.length > 1 && (
                    <div className="text-[var(--text-muted)] text-xs">
                      <i className="fa-solid fa-arrows-left-right mr-1" />
                      Конвертация: {allCurrencies.join(" ↔ ")}
                    </div>
                  )}
                  {groupOperations[0]?.blockTimestamp && (
                    <div className="text-[var(--text-muted)] text-xs">
                      <i className="fa-regular fa-clock mr-1" />
                      {new Date(groupOperations[0].blockTimestamp * 1000).toLocaleString("ru-RU")}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              {groupOperations.map((gop: OperationSummary) => (
                <div key={gop.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--bg-primary)]/20 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className={`fa-solid ${getTxIcon(gop.entries, gop.source)} ${getTxColor(gop.entries) === "green" ? "text-green-400" : "text-red-400"} text-sm shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{gop.description || "—"}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {gop.entries.map((e, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)]/30 text-[var(--text-muted)]">
                            {e.accountName || ""} {formatAmount(e.amount, e.currency)}
                            {e.type === "fee" && " (fee)"}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-sm font-semibold ${getTxColor(gop.entries) === "green" ? "text-green-400" : "text-red-400"}`}>
                      {formatAmount(gop.entries.filter(e => e.type === "principal").reduce((s: number, e: any) => s + e.amount, 0), gop.entries[0]?.currency || "")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
