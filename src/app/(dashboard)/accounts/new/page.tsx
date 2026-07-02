"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_TYPE_LABELS } from "@/lib/utils";
import type { AccountType } from "@/lib/utils";

const ACCOUNT_TYPES: AccountType[] = [
  "crypto_wallet", "cex_exchange", "broker", "hybrid_bank", "fiat_bank",
];

export default function NewAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("fiat_bank");
  const [currency, setCurrency] = useState("RUB");
  const [addresses, setAddresses] = useState<{ network: string; address: string }[]>([]);
  const [initialBalances, setInitialBalances] = useState<{ currency: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name) return setError("Название счёта обязательно");
    setLoading(true);
    setError("");

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type,
        currency,
        addresses: addresses.filter((a) => a.network && a.address),
        initialBalances: initialBalances.length > 0 ? initialBalances : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ошибка создания счёта");
      setLoading(false);
      return;
    }

    router.push("/accounts");
    router.refresh();
  }

  const isCrypto = type === "crypto_wallet" || type === "cex_exchange";
  const networks = ["solana", "bsc", "avalanche", "ethereum", "ton", "tron"];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Новый счёт</h1>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            onClick={() => s < step ? setStep(s) : undefined}
            className={`flex-1 h-2 rounded-full transition-colors cursor-pointer ${
              s <= step ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-medium">Основная информация</h2>

          <div>
            <label className="block text-sm mb-1">Название счёта</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Сбер, Phantom, Bybit" />
          </div>

          <div>
            <label className="block text-sm mb-1">Тип счёта</label>
            <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Основная валюта</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="USDT">USDT</option>
              <option value="CNY">CNY</option>
              <option value="SOL">SOL</option>
              <option value="BNB">BNB</option>
              <option value="TON">TON</option>
            </select>
          </div>

          <button onClick={() => setStep(2)} className="btn btn-primary w-full">Далее →</button>
        </div>
      )}

      {step === 2 && isCrypto && (
        <div className="card space-y-4">
          <h2 className="font-medium">Адреса кошельков</h2>
          <p className="text-sm text-[var(--text-muted)]">Добавьте адреса для каждой сети</p>

          {addresses.map((addr, idx) => (
            <div key={idx} className="flex gap-2">
              <select
                value={addr.network}
                onChange={(e) => {
                  const copy = [...addresses];
                  copy[idx].network = e.target.value;
                  setAddresses(copy);
                }}
                className="w-1/3"
              >
                {networks.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                value={addr.address}
                onChange={(e) => {
                  const copy = [...addresses];
                  copy[idx].address = e.target.value;
                  setAddresses(copy);
                }}
                placeholder="Адрес кошелька"
                className="flex-1"
              />
              <button
                onClick={() => setAddresses(addresses.filter((_, i) => i !== idx))}
                className="btn btn-danger text-sm px-2"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={() => setAddresses([...addresses, { network: "solana", address: "" }])}
            className="btn btn-secondary w-full text-sm"
          >
            + Добавить адрес
          </button>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Назад</button>
            <button onClick={() => setStep(3)} className="btn btn-primary flex-1">Далее →</button>
          </div>
        </div>
      )}

      {step === 2 && !isCrypto && (
        <div className="card space-y-4">
          <h2 className="font-medium">Начальный баланс (необязательно)</h2>

          {initialBalances.map((bal, idx) => (
            <div key={idx} className="flex gap-2">
              <select
                value={bal.currency}
                onChange={(e) => {
                  const copy = [...initialBalances];
                  copy[idx].currency = e.target.value;
                  setInitialBalances(copy);
                }}
              >
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="USDT">USDT</option>
                <option value="CNY">CNY</option>
                <option value="SOL">SOL</option>
              </select>
              <input
                type="number"
                value={bal.amount || ""}
                onChange={(e) => {
                  const copy = [...initialBalances];
                  copy[idx].amount = parseFloat(e.target.value) || 0;
                  setInitialBalances(copy);
                }}
                placeholder="Сумма"
                className="flex-1"
              />
              <button
                onClick={() => setInitialBalances(initialBalances.filter((_, i) => i !== idx))}
                className="btn btn-danger text-sm px-2"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={() => setInitialBalances([...initialBalances, { currency, amount: 0 }])}
            className="btn btn-secondary w-full text-sm"
          >
            + Добавить баланс
          </button>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Назад</button>
            <button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Создание..." : "Создать счёт"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="font-medium">Готово к созданию</h2>

          <div className="text-sm space-y-2 bg-[var(--bg-primary)] p-4 rounded-lg">
            <p><strong>Название:</strong> {name}</p>
            <p><strong>Тип:</strong> {ACCOUNT_TYPE_LABELS[type]}</p>
            <p><strong>Валюта:</strong> {currency}</p>
            {addresses.length > 0 && (
              <div>
                <strong>Адреса:</strong>
                {addresses.map((a, i) => <p key={i} className="text-[var(--text-muted)] pl-2">{a.network}: {a.address.slice(0, 16)}...</p>)}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="btn btn-secondary flex-1">Назад</button>
            <button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Создание..." : "✅ Создать счёт"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
