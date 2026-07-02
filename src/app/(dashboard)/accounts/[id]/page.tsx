"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS, formatAmount } from "@/lib/utils";
import type { AccountType } from "@/lib/utils";
import Select from "@/components/Select";

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
    if (!res.ok) { setError(data.error); setSyncing(false); return; }
    setSyncResult(`Синхронизировано: ${data.balances} балансов, ${data.transactions} транзакций`);
    setSyncing(false);
    const credRes = await fetch("/api/exchange/credentials");
    const credData = await credRes.json();
    const match = credData.find((c: Credential) => c.accountId === accountId);
    if (match) setCredential(match);
  }

  if (loading) return <p className="text-[var(--text-muted)]">Загрузка...</p>;
  if (!account) return <p className="text-red-400">Счёт не найден</p>;

  const icon = ACCOUNT_TYPE_ICONS[account.type] || "💳";
  const label = ACCOUNT_TYPE_LABELS[account.type] || account.type;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{icon}</span>
          <div>
            <h1 className="text-xl font-bold">{account.name}</h1>
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

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
