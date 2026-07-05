"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Debt {
  id: number;
  personName: string;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  settledAt: string | null;
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("RUB");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);

  function loadDebts() {
    setLoading(true);
    fetch("/api/debts")
      .then(r => r.json())
      .then(setDebts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDebts(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personName: newName,
        amount: parseFloat(newAmount),
        currency: newCurrency,
        description: newDesc || null,
      }),
    });
    setNewName(""); setNewAmount(""); setNewDesc("");
    setShowForm(false);
    loadDebts();
  }

  async function handleSettle(id: number) {
    await fetch(`/api/debts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "settled",
        settledAt: new Date().toISOString().split("T")[0],
      }),
    });
    loadDebts();
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить долг?")) return;
    await fetch(`/api/debts/${id}`, { method: "DELETE" });
    loadDebts();
  }

  const active = debts.filter(d => d.status === "active");
  const settled = debts.filter(d => d.status !== "active");

  if (loading) return <div className="p-8 text-center text-[var(--text-muted)]">Загрузка...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Долги</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {active.length > 0
              ? `${active.length} активных, общая сумма: ${active.reduce((s, d) => s + d.amount, 0).toLocaleString()} ${active[0]?.currency || "RUB"}`
              : "Нет активных долгов"}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="fa-solid fa-plus mr-1.5" />
          Новый долг
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input className="form-input" placeholder="Имя" value={newName} onChange={e => setNewName(e.target.value)} required />
            <input className="form-input" type="number" step="0.01" placeholder="Сумма" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
            <select className="form-input" value={newCurrency} onChange={e => setNewCurrency(e.target.value)}>
              {["RUB", "USD", "USDT", "CNY"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="form-input" placeholder="Заметка" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">
            <i className="fa-solid fa-check mr-1.5" />
            Создать
          </button>
        </form>
      )}

      {/* Active debts */}
      <div className="space-y-2">
        {active.map((d) => (
          <div key={d.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                <i className="fa-solid fa-user text-[var(--accent)] text-sm" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{d.personName}</p>
                {d.description && <p className="text-xs text-[var(--text-muted)]">{d.description}</p>}
                <p className="text-[11px] text-[var(--text-muted)]">
                  {new Date(d.createdAt).toLocaleDateString("ru-RU")}
                  {" · "}
                  {Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24))} дн.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[var(--text-primary)]">
                +{d.amount.toLocaleString()} {d.currency}
              </span>
              <button className="btn-success text-xs" onClick={() => handleSettle(d.id)}>
                <i className="fa-solid fa-check mr-1" />
                Закрыть
              </button>
              <button className="btn-ghost text-xs text-[var(--text-muted)]" onClick={() => handleDelete(d.id)}>
                <i className="fa-solid fa-trash-can" />
              </button>
            </div>
          </div>
        ))}
        {active.length === 0 && (
          <div className="card p-8 text-center text-[var(--text-muted)]">
            <i className="fa-solid fa-face-smile text-2xl mb-2" />
            <p>Активных долгов нет</p>
          </div>
        )}
      </div>

      {/* Settled debts */}
      {settled.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Закрытые</h3>
          <div className="space-y-1">
            {settled.map((d) => (
              <div key={d.id} className="card p-3 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check-circle text-green-400 text-sm" />
                  <span className="text-sm text-[var(--text-secondary)]">{d.personName}</span>
                  {d.description && <span className="text-xs text-[var(--text-muted)]">— {d.description}</span>}
                </div>
                <span className="text-sm text-[var(--text-muted)]">
                  {d.amount.toLocaleString()} {d.currency}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
