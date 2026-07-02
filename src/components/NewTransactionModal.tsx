"use client";

import { useEffect, useState } from "react";
import Select from "@/components/Select";

interface Props {
  onClose: () => void;
}

interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  balances: { currency: string; amount: number }[];
}

type TxType = "income" | "expense" | "transfer" | "exchange";

export default function NewTransactionModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [txType, setTxType] = useState<TxType | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Form state
  const [accountId, setAccountId] = useState<number | "">("");
  const [counterpartyAccountId, setCounterpartyAccountId] = useState<number | "">("");
  const [currency, setCurrency] = useState("RUB");
  const [amount, setAmount] = useState("");
  const [currencyFrom, setCurrencyFrom] = useState("RUB");
  const [amountFrom, setAmountFrom] = useState("");
  const [currencyTo, setCurrencyTo] = useState("USDT");
  const [amountTo, setAmountTo] = useState("");
  const [sameAccount, setSameAccount] = useState(true);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  const totalSteps = 5;

  function currentAccountBalances() {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.balances.map((b) => b.currency) || [];
  }

  function otherAccounts() {
    return accounts.filter((a) => a.id !== accountId);
  }

  function getAccountCurrencies(accId: number | "") {
    const acc = accounts.find((a) => a.id === accId);
    return acc?.balances.map((b) => b.currency) || [acc?.currency].filter(Boolean) || [currency];
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const body: Record<string, unknown> = {
      type: txType,
      accountId,
      category: category || null,
      description: description || null,
      operationDate: new Date().toISOString(),
    };

    if (txType === "income" || txType === "expense") {
      body.amount = parseFloat(amount);
      body.currency = currency;
    } else if (txType === "transfer") {
      body.amount = parseFloat(amount);
      body.currency = currency;
      body.counterpartyAccountId = counterpartyAccountId;
    } else if (txType === "exchange") {
      body.amountFrom = parseFloat(amountFrom);
      body.currencyFrom = currencyFrom;
      body.amountTo = parseFloat(amountTo);
      body.currencyTo = currencyTo;
      if (!sameAccount) {
        body.counterpartyAccountId = counterpartyAccountId;
      } else {
        body.amount = parseFloat(amountFrom);
        body.currency = currencyFrom;
      }
    }

    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ошибка сохранения");
      setLoading(false);
      return;
    }

    onClose();
    window.location.reload();
  }

  function reset() {
    setStep(0);
    setTxType(null);
    setAccountId("");
    setCounterpartyAccountId("");
    setCurrency("RUB");
    setAmount("");
    setCurrencyFrom("RUB");
    setAmountFrom("");
    setCurrencyTo("USDT");
    setAmountTo("");
    setCategory("");
    setDescription("");
    setError("");
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose(); }}}>
      <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-lg shadow-2xl border border-[var(--border)]">
        <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-lg">Новая операция</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-4 pt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
          ))}
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg">{error}</div>}

          {/* Step 0: Choose type */}
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-secondary)] mb-3">Выберите тип операции</p>
              {[
                { type: "income" as TxType, icon: "📥", label: "Доход", desc: "Пополнение, зарплата, кэшбэк" },
                { type: "expense" as TxType, icon: "📤", label: "Расход", desc: "Покупка, перевод человеку" },
                { type: "transfer" as TxType, icon: "🔄", label: "Перевод между своими", desc: "С одного своего счёта на другой" },
                { type: "exchange" as TxType, icon: "💱", label: "Обмен / Конвертация", desc: "Разные валюты, включая мама→Alipay" },
              ].map(({ type, icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => { setTxType(type); setStep(1); }}
                  className="w-full text-left p-3 rounded-lg bg-[var(--bg-primary)] hover:border-[var(--accent)] border border-transparent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Select account */}
          {step === 1 && txType && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {txType === "income" ? "На какой счёт пришли деньги?" :
                 txType === "expense" ? "С какого счёта списать?" :
                 txType === "transfer" ? "С какого счёта перевести?" :
                 "С какого счёта списать?"}
              </p>
              <Select value={accountId} onChange={(e) => setAccountId(parseInt(e.target.value) || "")}>
                <option value="">Выберите счёт</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>

              {txType === "exchange" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sameAccount} onChange={(e) => setSameAccount(e.target.checked)} className="w-auto" />
                  В рамках одного счёта (конвертация внутри)
                </label>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(0)} className="btn btn-secondary flex-1">Назад</button>
                <button onClick={() => setStep(2)} disabled={!accountId} className="btn btn-primary flex-1">Далее →</button>
              </div>
            </div>
          )}

          {/* Step 2: Currency/Amount for income/expense/transfer */}
          {step === 2 && txType && (txType === "income" || txType === "expense" || txType === "transfer") && (
            <div className="space-y-3">
              {txType === "income" && <p className="text-sm text-[var(--text-secondary)]">В какой валюте?</p>}
              {txType === "expense" && <p className="text-sm text-[var(--text-secondary)]">В какой валюте?</p>}
              {txType === "transfer" && <p className="text-sm text-[var(--text-secondary)]">В какой валюте?</p>}

              <div>
                <label className="block text-sm mb-1">Валюта</label>
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

              <div>
                <label className="block text-sm mb-1">
                  {txType === "income" ? "Сумма" : txType === "expense" ? "Сумма" : "Сумма перевода"}
                </label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min={0} step="any" />
              </div>

              {txType === "transfer" && (
                <div>
                  <label className="block text-sm mb-1">Счёт-получатель</label>
                  <Select value={counterpartyAccountId} onChange={(e) => setCounterpartyAccountId(parseInt(e.target.value) || "")}>
                    <option value="">Выберите счёт</option>
                    {otherAccounts().map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Назад</button>
                <button onClick={() => setStep(4)} className="btn btn-primary flex-1">Далее →</button>
              </div>
            </div>
          )}

          {/* Step 2 (exchange): From */}
          {step === 2 && txType === "exchange" && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">Из какой валюты?</p>

              <div>
                <label className="block text-sm mb-1">Валюта списания</label>
                <Select value={currencyFrom} onChange={(e) => setCurrencyFrom(e.target.value)}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="USDT">USDT</option>
                  <option value="CNY">CNY</option>
                  <option value="SOL">SOL</option>
                  <option value="BNB">BNB</option>
                  <option value="TON">TON</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm mb-1">Сумма списания</label>
                <input type="number" value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} placeholder="0.00" min={0} step="any" />
              </div>

              {!sameAccount && (
                <div>
                  <label className="block text-sm mb-1">Счёт-получатель</label>
                  <Select value={counterpartyAccountId} onChange={(e) => setCounterpartyAccountId(parseInt(e.target.value) || "")}>
                    <option value="">Выберите счёт</option>
                    {otherAccounts().map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Назад</button>
                <button onClick={() => setStep(3)} className="btn btn-primary flex-1">Далее →</button>
              </div>
            </div>
          )}

          {/* Step 3 (exchange only): To */}
          {step === 3 && txType === "exchange" && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">В какую валюту?</p>

              <div>
                <label className="block text-sm mb-1">Валюта зачисления</label>
                <Select value={currencyTo} onChange={(e) => setCurrencyTo(e.target.value)}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="USDT">USDT</option>
                  <option value="CNY">CNY</option>
                  <option value="SOL">SOL</option>
                  <option value="BNB">BNB</option>
                  <option value="TON">TON</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm mb-1">Сумма зачисления</label>
                <input type="number" value={amountTo} onChange={(e) => setAmountTo(e.target.value)} placeholder="0.00" min={0} step="any" />
              </div>

              {amountFrom && amountTo && currencyFrom && currencyTo && (
                <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-primary)] p-2 rounded">
                  Курс: 1 {currencyFrom} = {amountTo && amountFrom ? (parseFloat(amountTo) / parseFloat(amountFrom)).toFixed(6) : "?"} {currencyTo}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="btn btn-secondary flex-1">Назад</button>
                <button onClick={() => setStep(4)} className="btn btn-primary flex-1">Далее →</button>
              </div>
            </div>
          )}

          {/* Step 4: Category + Description */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">Дополнительная информация</p>

              <div>
                <label className="block text-sm mb-1">Категория</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Без категории</option>
                  <option value="Зарплата">Зарплата</option>
                  <option value="Продукты">Продукты</option>
                  <option value="Транспорт">Транспорт</option>
                  <option value="Комиссия">Комиссия сети / банка</option>
                  <option value="Перевод маме">Перевод маме</option>
                  <option value="Перевод другому">Перевод другому</option>
                  <option value="Обмен">Обмен валют</option>
                  <option value="Вывод с биржи">Вывод с биржи</option>
                  <option value="Пополнение">Пополнение</option>
                  <option value="Другое">Другое</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm mb-1">Описание (необязательно)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Комментарий к операции" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(txType === "exchange" ? 3 : 2)} className="btn btn-secondary flex-1">Назад</button>
                <button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1">
                  {loading ? "Сохранение..." : "💾 Сохранить"}
                </button>
              </div>
            </div>
          )}

          {/* Replace step 5+ with the actual step count */}
          {/* Actually let's fix the step numbering */}
        </div>
      </div>
    </div>
  );
}
