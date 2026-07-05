"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_TYPE_LABELS } from "@/lib/utils";
import type { AccountType } from "@/lib/utils";
import Select from "@/components/Select";

const ACCOUNT_TYPES: AccountType[] = [
  "crypto_wallet", "cex_exchange", "broker", "hybrid_bank", "fiat_bank", "external",
];

const EXCHANGES = ["bybit", "okx"];

interface Address {
  network: string;
  address: string;
}

interface Balance {
  currency: string;
  amount: number;
}

export default function NewAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("fiat_bank");
  const [currency, setCurrency] = useState("RUB");
  const [connectionType, setConnectionType] = useState<"manual" | "auto">("manual");
  const [exchange, setExchange] = useState("bybit");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiPassphrase, setApiPassphrase] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [initialBalances, setInitialBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name) return setError("Название счёта обязательно");
    setLoading(true);
    setError("");

    const body: Record<string, unknown> = {
      name,
      type,
      currency: (type === "cex_exchange" || type === "crypto_wallet") ? undefined : currency,
      addresses: addresses.filter((a) => a.network && a.address),
      initialBalances: initialBalances.length > 0 ? initialBalances : undefined,
    };

    if (type === "cex_exchange" && connectionType === "auto") {
      body.connectionType = "auto";
      body.exchange = exchange;
      body.apiKey = apiKey;
      body.apiSecret = apiSecret;
      if (exchange === "okx") body.apiPassphrase = apiPassphrase;
    }

    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  const isCrypto = type === "crypto_wallet";
  const isExchange = type === "cex_exchange";
  const multiCurrency = isCrypto || isExchange;
  const networks = ["solana", "bsc", "avalanche", "ethereum", "ton", "tron"];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Новый счёт</h1>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg">{error}</div>
      )}

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
            <Select value={type} onChange={(e) => { setType(e.target.value as AccountType); setConnectionType("manual"); }}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </div>

          {!multiCurrency && (
            <div>
              <label className="block text-sm mb-1">Основная валюта</label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="USDT">USDT</option>
                <option value="CNY">CNY</option>
                <option value="SOL">SOL</option>
                <option value="BNB">BNB</option>
                <option value="TON">TON</option>
              </Select>
            </div>
          )}

          {multiCurrency && (
            <p className="text-sm text-[var(--text-muted)]">
              Для {isExchange ? "бирж" : "криптокошельков"} основная валюта не задаётся — поддерживаются все валюты.
            </p>
          )}

          <button onClick={() => setStep(2)} className="btn btn-primary w-full">Далее →</button>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          {isExchange && (
            <>
              <h2 className="font-medium">Подключение к бирже</h2>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setConnectionType("manual")}
                  className={`flex-1 p-3 rounded-lg border-2 text-sm text-left transition-colors ${
                    connectionType === "manual"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <div className="font-medium mb-1">✍️ Ручной</div>
                  <div className="text-xs text-[var(--text-muted)]">Добавлять операции вручную</div>
                </button>
                <button
                  onClick={() => setConnectionType("auto")}
                  className={`flex-1 p-3 rounded-lg border-2 text-sm text-left transition-colors ${
                    connectionType === "auto"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <div className="font-medium mb-1">⚡ Автоматический</div>
                  <div className="text-xs text-[var(--text-muted)]">Синхронизация через API биржи</div>
                </button>
              </div>

              {connectionType === "auto" && (
                <div className="space-y-3 bg-[var(--bg-primary)] p-4 rounded-lg">
                  <div>
                    <label className="block text-sm mb-1">Биржа</label>
                    <Select value={exchange} onChange={(e) => { setExchange(e.target.value); setApiPassphrase(""); }}>
                      {EXCHANGES.map((e) => <option key={e} value={e}>{e.toUpperCase()}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">API Key</label>
                    <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Введите API Key" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">API Secret</label>
                    <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Введите API Secret" />
                  </div>
                  {exchange === "okx" && (
                    <div>
                      <label className="block text-sm mb-1">Passphrase</label>
                      <input type="password" value={apiPassphrase} onChange={(e) => setApiPassphrase(e.target.value)} placeholder="Введите Passphrase" />
                    </div>
                  )}
                  <p className="text-xs text-[var(--text-muted)]">
                    Ключи шифруются и сохраняются в базе. Мы не храним их в открытом виде.
                  </p>
                </div>
              )}
            </>
          )}

          {isCrypto && (
            <>
              <h2 className="font-medium">Адреса кошельков</h2>
              <p className="text-sm text-[var(--text-muted)]">Добавьте адреса для автоматического сканирования</p>

              {addresses.map((addr, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={addr.network}
                    onChange={(e) => {
                      const copy = [...addresses];
                      copy[idx].network = e.target.value;
                      setAddresses(copy);
                    }}
                    className="sm:w-1/3"
                  >
                    {networks.map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
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
                    className="btn btn-danger text-sm px-2 sm:w-auto w-full"
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
            </>
          )}

          {!isCrypto && !isExchange && (
            <>
              <h2 className="font-medium">Начальный баланс (необязательно)</h2>

              {initialBalances.map((bal, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={bal.currency}
                    onChange={(e) => {
                      const copy = [...initialBalances];
                      copy[idx].currency = e.target.value;
                      setInitialBalances(copy);
                    }}
                    className="sm:w-auto"
                  >
                    <option value="RUB">RUB</option>
                    <option value="USD">USD</option>
                    <option value="USDT">USDT</option>
                    <option value="CNY">CNY</option>
                    <option value="SOL">SOL</option>
                  </Select>
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
                    className="btn btn-danger text-sm px-2 sm:w-auto w-full"
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
            </>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Назад</button>
            <button onClick={() => setStep(3)} className="btn btn-primary flex-1">Далее →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="font-medium">Готово к созданию</h2>

          <div className="text-sm space-y-2 bg-[var(--bg-primary)] p-4 rounded-lg">
            <p><strong>Название:</strong> {name}</p>
            <p><strong>Тип:</strong> {ACCOUNT_TYPE_LABELS[type]}</p>
            {!multiCurrency && <p><strong>Валюта:</strong> {currency}</p>}
            {isExchange && (
              <p><strong>Подключение:</strong> {connectionType === "auto" ? `Авто (${exchange.toUpperCase()})` : "Ручное"}</p>
            )}
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
