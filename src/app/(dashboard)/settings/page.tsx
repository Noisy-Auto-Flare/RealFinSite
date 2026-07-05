"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

const ETHERSCAN_KEY = { id: "etherscan", label: "EtherScan API Key", placeholder: "EtherScan API Key" };

const NON_ETHERSCAN_NETWORKS = [
  { id: "avalanche", label: "Avalanche (SnowTrace)", placeholder: "SnowTrace API Key" },
  { id: "solana", label: "Solana (Helius)", placeholder: "Helius API Key" },
  { id: "ton", label: "TON (Toncenter)", placeholder: "Toncenter API Key" },
  { id: "tron", label: "TRON (TronGrid)", placeholder: "TronGrid API Key" },
];

const ETHERSCAN_NETWORKS_LIST = [
  "Ethereum", "BSC (BNB)", "Polygon", "Arbitrum", "Optimism",
  "Base", "Fantom", "Cronos", "Aurora", "Moonbeam", "Gnosis",
];

const ALL_KEY_FIELDS = [ETHERSCAN_KEY, ...NON_ETHERSCAN_NETWORKS];

interface KeyEntry {
  network: string;
  hasKey: boolean;
}

interface UserRow {
  id: number;
  username: string;
  role: string;
  status: string;
  created_at: string;
}

export default function SettingsPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedNetworks, setSavedNetworks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/settings/blockchain-keys")
      .then((r) => r.json())
      .then((data: (KeyEntry & { network: string; hasKey: boolean })[]) => {
        const saved = new Set<string>();
        for (const k of data) {
          if (k.hasKey) saved.add(k.network);
        }
        setSavedNetworks(saved);
        setKeys({});
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: UserRow[]) => { setUsers(data); setUsersLoading(false); })
      .catch(() => setUsersLoading(false));
  }, []);

  async function deleteUser(userId: number) {
    if (!confirm("Удалить пользователя? Все его счета и операции будут безвозвратно удалены.")) return;
    setDeletingId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Пользователь удалён");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else {
      const err = await res.json().catch(() => ({ error: "Ошибка" }));
      toast.error(err.error || "Ошибка удаления");
    }
    setDeletingId(null);
  }

  async function handleSave() {
    setSaving(true);
    const payload = ALL_KEY_FIELDS
      .filter((n) => keys[n.id] && keys[n.id].length > 0)
      .map((n) => ({ network: n.id, apiKey: keys[n.id] }));

    const res = await fetch("/api/settings/blockchain-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const saved = new Set(savedNetworks);
      for (const n of ALL_KEY_FIELDS) {
        if (keys[n.id] && keys[n.id].length > 0) saved.add(n.id);
      }
      setSavedNetworks(saved);
      setKeys({});
      toast.success("Ключи сохранены");
    } else {
      toast.error("Ошибка при сохранении");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl md:text-2xl font-bold">Настройки</h1>

      <div className="card">
        <h2 className="font-medium mb-1">API-ключи блокчейнов</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Ключи используются для сканирования транзакций и балансов кошельков.
          Можно также задать через переменные окружения.
        </p>

        {loading ? (
          <p className="text-[var(--text-muted)]">Загрузка...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {ETHERSCAN_KEY.label}
                {savedNetworks.has("etherscan") && (
                  <span className="ml-2 text-xs text-green-600">✓ ключ сохранён</span>
                )}
              </label>
              <input
                type="password"
                placeholder={savedNetworks.has("etherscan") ? "••••••••" : ETHERSCAN_KEY.placeholder}
                value={keys["etherscan"] || ""}
                onChange={(e) => setKeys((prev) => ({ ...prev, "etherscan": e.target.value }))}
                className="w-full font-mono text-sm"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Один ключ для всех сетей EtherScan: {ETHERSCAN_NETWORKS_LIST.join(", ")}.
                Для сетей, недоступных на бесплатном тарифе (BSC, Base, Optimism),
                балансы автоматически запрашиваются через публичные RPC.
              </p>
            </div>

            <hr className="border-[var(--border)]" />

            <p className="text-sm font-medium">Остальные сети</p>

            {NON_ETHERSCAN_NETWORKS.map((net) => (
              <div key={net.id}>
                <label className="block text-sm font-medium mb-1">
                  {net.label}
                  {savedNetworks.has(net.id) && (
                    <span className="ml-2 text-xs text-green-600">✓ ключ сохранён</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={savedNetworks.has(net.id) ? "••••••••" : net.placeholder}
                  value={keys[net.id] || ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [net.id]: e.target.value }))}
                  className="w-full font-mono text-sm"
                />
              </div>
            ))}

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? "Сохранение..." : "Сохранить ключи"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-medium mb-3">Пользователи</h2>
        {usersLoading ? (
          <p className="text-[var(--text-muted)]">Загрузка...</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                <div>
                  <span className="font-mono text-sm">{u.username}</span>
                  <span className="ml-2 text-xs text-[var(--text-muted)]">{u.role}</span>
                  <span className={`ml-2 text-xs ${u.status === "approved" ? "text-green-600" : "text-red-500"}`}>
                    {u.status}
                  </span>
                </div>
                {u.role !== "master" && (
                  <button
                    onClick={() => deleteUser(u.id)}
                    disabled={deletingId === u.id}
                    className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingId === u.id ? "Удаление..." : "Удалить"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
