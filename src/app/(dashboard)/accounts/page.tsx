"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS } from "@/lib/utils";
import type { AccountType } from "@/lib/utils";

interface CredentialInfo {
  id: number;
  accountId: number;
  exchange: string;
  lastSyncAt: string | null;
}

interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  isActive: number;
  isAutoSync: number;
  balances: { currency: string; amount: number }[];
  addresses: { network: string; address: string }[];
  credentials: CredentialInfo | null;
}

const TYPE_ICONS: Record<string, string> = {
  crypto_wallet: "fa-solid fa-coins",
  cex_exchange: "fa-solid fa-building-columns",
  broker: "fa-solid fa-chart-line",
  hybrid_bank: "fa-solid fa-landmark",
  fiat_bank: "fa-solid fa-building-columns",
};

function getTypeIcon(type: string): string {
  return TYPE_ICONS[type] || "fa-solid fa-wallet";
}

function getTypeColor(type: string): string {
  switch (type) {
    case "crypto_wallet": return "purple";
    case "cex_exchange": return "blue";
    case "broker": return "green";
    case "hybrid_bank": return "orange";
    case "fiat_bank": return "blue";
    default: return "blue";
  }
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then(r => r.json())
      .then(data => { setAccounts(data); setLoading(false); });
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/accounts/sync-balances", { method: "POST" });
      const data = await res.json();
      const allCorrections = (data.results || []).flatMap((r: any) =>
        (r.corrections || []).filter((c: any) => c.correctionAmount != null)
      );
      setSyncMsg(`Синхронизировано ${data.results?.length || 0} кошельков, ${allCorrections.length} корректировок`);
      const accRes = await fetch("/api/accounts");
      setAccounts(await accRes.json());
    } catch {
      setSyncMsg("Ошибка синхронизации");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2>Счета</h2>
          <p>Все ваши кошельки и счета</p>
        </div>
        <div className="page-header-actions">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary"
            style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
          >
            <i className="fa-solid fa-rotate" />
            {syncing ? "Синхронизация..." : "Синхронизировать"}
          </button>
          <Link href="/accounts/new" className="btn-primary">
            <i className="fa-solid fa-plus" /> Добавить счёт
          </Link>
        </div>
      </header>

      {syncMsg && (
        <div className="card" style={{ marginBottom: "16px", padding: "12px 16px" }}>
          <p style={{ fontSize: "13px", color: "var(--accent)" }}>{syncMsg}</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Загрузка...</p>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <i className="fa-solid fa-wallet" style={{ fontSize: "48px", color: "var(--text-muted)", marginBottom: "16px" }} />
          <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>У вас ещё нет счетов</p>
          <Link href="/accounts/new" className="btn-primary">
            <i className="fa-solid fa-plus" /> Создать первый счёт
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
          {accounts.map((acc) => {
            const icon = getTypeIcon(acc.type);
            const color = getTypeColor(acc.type);
            const label = ACCOUNT_TYPE_LABELS[acc.type] || acc.type;
            return (
              <Link key={acc.id} href={`/accounts/${acc.id}`} className="card" style={{ cursor: "pointer", transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className={`tx-icon ${color}`}><i className={icon} /></div>
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div style={{ fontWeight: 500, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{label}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {acc.balances.map((b) => (
                        <span key={b.currency} className="badge badge-confirmed" style={{ fontSize: "13px", padding: "4px 12px" }}>
                          {b.currency}: {b.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                        </span>
                      ))}
                    </div>
                    {acc.addresses.length > 0 && (
                      <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                        {acc.addresses.map((a) => (
                          <div key={a.network} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.network}: {a.address.slice(0, 8)}...{a.address.slice(-4)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="badge" style={{ flexShrink: 0, fontSize: "11px" }}>
                    {acc.credentials ? (
                      <span className="badge badge-confirmed">{acc.credentials.exchange.toUpperCase()}</span>
                    ) : acc.isAutoSync ? (
                      <span className="badge badge-confirmed">Авто</span>
                    ) : (
                      <span className="badge badge-pending">Ручной</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
