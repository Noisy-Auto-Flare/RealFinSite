"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

const SUPPORTED_NETWORKS = [
  { id: "bsc", label: "BSC (BscScan)", placeholder: "BscScan API Key" },
  { id: "avalanche", label: "Avalanche (SnowTrace)", placeholder: "SnowTrace API Key" },
  { id: "ethereum", label: "Ethereum (EtherScan)", placeholder: "EtherScan API Key" },
  { id: "solana", label: "Solana (Helius)", placeholder: "Helius API Key" },
  { id: "ton", label: "TON (Toncenter)", placeholder: "Toncenter API Key" },
];

interface KeyEntry {
  network: string;
  apiKey: string;
  updatedAt?: string | null;
}

export default function SettingsPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/blockchain-keys")
      .then((r) => r.json())
      .then((data: KeyEntry[]) => {
        const map: Record<string, string> = {};
        for (const k of data) {
          map[k.network] = k.apiKey;
        }
        setKeys(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    const payload = SUPPORTED_NETWORKS
      .filter((n) => keys[n.id])
      .map((n) => ({ network: n.id, apiKey: keys[n.id] }));

    const res = await fetch("/api/settings/blockchain-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
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
          Ключи используются для автоматического сканирования транзакций кошельков.
          Можно также задать через переменные окружения.
        </p>

        {loading ? (
          <p className="text-[var(--text-muted)]">Загрузка...</p>
        ) : (
          <div className="space-y-3">
            {SUPPORTED_NETWORKS.map((net) => (
              <div key={net.id}>
                <label className="block text-sm font-medium mb-1">{net.label}</label>
                <input
                  type="password"
                  placeholder={net.placeholder}
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
    </div>
  );
}
