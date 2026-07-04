"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS, formatAmount } from "@/lib/utils";
import type { AccountType } from "@/lib/utils";
import Select from "@/components/Select";
import { useToast } from "@/components/Toast";

interface Balance {
  currency: string;
  amount: number;
}

interface Address {
  network: string;
  address: string;
}

interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  isActive: number;
  isAutoSync: number;
  balances: Balance[];
  addresses: Address[];
}

interface Credential {
  id: number;
  accountId: number;
  exchange: string;
  lastSyncAt: string | null;
}

export default function AccountDetailPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const accountId = Number(params.id);

  const [account, setAccount] = useState<Account | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [exchangeType, setExchangeType] = useState("bybit");
  const [apiPassphrase, setApiPassphrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/accounts/${accountId}`)
      .then((r) => r.json())
      .then((data) => { setAccount(data); setLoading(false); });
    fetch("/api/exchange/credentials")
      .then((r) => r.json())
      .then((data) => {
        const match = data.find((c: Credential) => c.accountId === accountId);
        if (match) setCredential(match);
      });
  }, [accountId]);

  async function saveCredentials() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/exchange/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, exchange: exchangeType, apiKey, apiSecret, apiPassphrase }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setCredential(data);
    setApiKey("");
    setApiSecret("");
    setSaving(false);
    toast.success("Ключи сохранены");
  }

  async function deleteCredentials() {
    if (!credential) return;
    setError("");
    const res = await fetch("/api/exchange/credentials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: credential.id }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error); return; }
    setCredential(null);
    toast.success("Ключи удалены");
  }

  async function startSync() {
    setSyncing(true);
    setSyncResult(null);
    setError("");
    const res = await fetch("/api/exchange/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); setSyncing(false); return; }
    toast.success(`Синхронизировано: ${data.balances} балансов, ${data.transactions} транзакций`);
    setSyncing(false);
    const credRes = await fetch("/api/exchange/credentials");
    const credData = await credRes.json();
    const match = credData.find((c: Credential) => c.accountId === accountId);
    if (match) setCredential(match);
  }

  async function saveEdit() {
    if (!editName.trim() || !account) return;
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!res.ok) { toast.error("Ошибка при сохранении"); return; }
    setAccount({ ...account, name: editName.trim() });
    setEditing(false);
    toast.success("Счёт переименован");
  }

  async function deleteAccount() {
    const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Ошибка при удалении"); return; }
    toast.success("Счёт удалён");
    router.push("/accounts");
  }

  if (loading) return <p className="text-[var(--text-muted)]">Загрузка...</p>;
  if (!account) return <p className="text-red-400">Счёт не найден</p>;

  const icon = ACCOUNT_TYPE_ICONS[account.type] || "💳";
  const label = ACCOUNT_TYPE_LABELS[account.type] || account.type;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="card">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex gap-2 items-center">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
                />
                <button onClick={saveEdit} className="btn btn-primary text-sm px-3">Сохранить</button>
                <button onClick={() => setEditing(false)} className="btn btn-secondary text-sm px-3">Отмена</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold truncate">{account.name}</h1>
                <button
                  onClick={() => { setEditName(account.name); setEditing(true); }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                  title="Редактировать"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleting(true)}
                  className="text-[var(--danger)] hover:text-red-300 transition-colors shrink-0 ml-auto"
                  title="Удалить счёт"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-sm text-[var(--text-muted)]">{label}</p>
          </div>
        </div>

        <div className="space-y-2">
          {account.balances.map((b) => (
            <div key={b.currency} className="flex justify-between text-sm gap-2">
              <span className="text-[var(--text-secondary)] truncate min-w-0">{b.currency}</span>
              <span className="font-mono whitespace-nowrap shrink-0">{formatAmount(b.amount, b.currency)}</span>
            </div>
          ))}
        </div>

        {account.addresses.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium">Адреса</p>
            {account.addresses.map((a) => (
              <div key={a.network} className="text-xs text-[var(--text-muted)] font-mono truncate">
                {a.network}: {a.address}
              </div>
            ))}
          </div>
        )}
      </div>

      {account.type === "cex_exchange" && (
        <div className="card">
          <h2 className="font-medium mb-3">Привязка биржи</h2>

          {credential ? (
            <div className="space-y-3">
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <p>Статус: <span className="text-green-400">Подключено ({credential.exchange.toUpperCase()})</span></p>
                {credential.lastSyncAt && (
                  <p>
                    Последняя синхронизация:{" "}
                    {new Date(credential.lastSyncAt).toLocaleString("ru-RU")}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={startSync}
                  disabled={syncing}
                  className="btn btn-primary"
                >
                  {syncing ? "Синхронизация..." : "Синхронизировать"}
                </button>
                <button
                  onClick={deleteCredentials}
                  className="btn bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  Отвязать
                </button>
              </div>
              {syncResult && (
                <p className="text-sm text-green-400">{syncResult}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Введите API-ключи биржи (read-only) для автоматической синхронизации балансов и истории операций.
              </p>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Select value={exchangeType} onChange={(e) => { setExchangeType(e.target.value); setApiPassphrase(""); }}>
                <option value="bybit">Bybit</option>
                <option value="okx">OKX</option>
              </Select>
              <input
                placeholder="API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full"
              />
              <input
                type="password"
                placeholder="API Secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="w-full"
              />
              {exchangeType === "okx" && (
                <input
                  type="password"
                  placeholder="Passphrase"
                  value={apiPassphrase}
                  onChange={(e) => setApiPassphrase(e.target.value)}
                  className="w-full"
                />
              )}
              <button
                onClick={saveCredentials}
                disabled={saving || !apiKey || !apiSecret || (exchangeType === "okx" && !apiPassphrase)}
                className="btn btn-primary"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          )}
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-sm shadow-2xl border border-[var(--border)] p-6 space-y-4">
            <h2 className="font-bold text-lg">Удалить счёт?</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Все балансы и адреса будут удалены. Операции останутся в истории.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(false)} className="btn btn-secondary flex-1">Отмена</button>
              <button onClick={deleteAccount} className="btn bg-red-500/10 text-red-400 hover:bg-red-500/20 flex-1">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
