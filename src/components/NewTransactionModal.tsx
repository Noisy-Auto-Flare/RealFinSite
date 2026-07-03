"use client";

import { useEffect, useState, memo } from "react";
import Select from "@/components/Select";
import { useToast } from "@/components/Toast";

interface Props {
  onClose: () => void;
}

interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
}

interface Entry {
  accountId: number | "";
  currency: string;
  amount: string;
  type: "principal" | "fee" | "discount" | "interest" | "coupon";
}

const CURRENCIES = ["RUB", "USD", "USDT", "CNY", "SOL", "BNB", "TON"];
const ENTRY_TYPES = ["principal", "fee", "discount", "interest", "coupon"] as const;

export default memo(function NewTransactionModal({ onClose }: Props) {
  const toast = useToast();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [entries, setEntries] = useState<Entry[]>([
    { accountId: "", currency: "RUB", amount: "", type: "principal" },
  ]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdOperation, setCreatedOperation] = useState<any>(null);
  const [confirmingFees, setConfirmingFees] = useState(false);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  function addEntry() {
    setEntries((prev) => [
      ...prev,
      { accountId: "", currency: "RUB", amount: "", type: "principal" },
    ]);
  }

  function removeEntry(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEntry(index: number, field: keyof Entry, value: string | number) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const body = {
      date,
      description: description || null,
      category: category || null,
      entries: entries.map((e) => ({
        accountId: Number(e.accountId),
        currency: e.currency,
        amount: parseFloat(e.amount),
        type: e.type,
      })),
    };

    const res = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error saving operation");
      setLoading(false);
      return;
    }

    const data = await res.json();

    if (data.unverifiedFees?.length > 0) {
      setCreatedOperation(data.operation);
      setConfirmingFees(true);
    } else {
      toast.success("Операция создана");
      onClose();
      window.location.reload();
    }
  }

  async function verifyFee(feeId: number) {
    await fetch(`/api/entries/${feeId}/verify`, { method: "PATCH" });
    setCreatedOperation((prev: any) => ({
      ...prev,
      entries: prev.entries.map((e: any) =>
        e.id === feeId ? { ...e, isVerified: 1 } : e
      ),
    }));
  }

  async function verifyAllFees() {
    const unverifiedFees = createdOperation.entries.filter((e: any) => !e.isVerified);
    for (const fee of unverifiedFees) {
      await fetch(`/api/entries/${fee.id}/verify`, { method: "PATCH" });
    }
    setConfirmingFees(false);
    toast.success("Комиссии подтверждены");
    onClose();
    window.location.reload();
  }

  async function confirmOperation() {
    await fetch(`/api/operations/${createdOperation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    toast.success("Операция подтверждена");
    onClose();
    window.location.reload();
  }

  function reset() {
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setCategory("");
    setEntries([{ accountId: "", currency: "RUB", amount: "", type: "principal" }]);
    setError("");
  }

  if (confirmingFees && createdOperation) {
    const unverifiedFees = createdOperation.entries?.filter((e: any) => !e.isVerified) || [];
    const allVerified = unverifiedFees.length === 0;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-lg shadow-2xl border border-[var(--border)] animate-modal-enter">
          <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
            <h2 className="font-bold text-lg">Подтверждение комиссий</h2>
            <button onClick={() => { reset(); onClose(); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
          </div>
          <div className="p-4 space-y-4">
            {!allVerified && (
              <>
                <p className="text-sm text-[var(--text-secondary)]">⚠️ Обнаружены неверифицированные комиссии:</p>
                <div className="space-y-2">
                  {unverifiedFees.map((fee: any) => (
                    <div key={fee.id} className="flex items-center justify-between bg-[var(--bg-primary)] p-3 rounded-lg">
                      <span className="text-sm">
                        {Math.abs(fee.amount)} {fee.currency} ({fee.type === "fee" ? "комиссия сети" : fee.type})
                      </span>
                      <button
                        onClick={() => verifyFee(fee.id)}
                        className="btn btn-primary text-sm px-3 py-1"
                      >
                        Подтвердить
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={verifyAllFees} className="btn btn-primary flex-1">Подтвердить всё</button>
                  <button onClick={() => { reset(); onClose(); }} className="btn btn-secondary flex-1">Отклонить</button>
                  <button onClick={() => { reset(); onClose(); }} className="btn btn-secondary flex-1">Оставить как черновик</button>
                </div>
              </>
            )}
            {allVerified && (
              <>
                <p className="text-sm text-[var(--text-secondary)]">Все комиссии подтверждены. Подтвердите операцию.</p>
                <div className="flex gap-2">
                  <button onClick={confirmOperation} className="btn btn-primary flex-1">Подтвердить операцию</button>
                  <button onClick={() => { reset(); onClose(); }} className="btn btn-secondary flex-1">Закрыть</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const allFilled = entries.every(
    (e) => e.accountId !== "" && e.amount !== ""
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose(); }}}>
      <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-lg shadow-2xl border border-[var(--border)] animate-modal-enter">
        <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-lg">Новая операция</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {error && <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm mb-1">Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm mb-1">Описание (необязательно)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Комментарий к операции" />
          </div>

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

          <div className="space-y-3">
            <label className="block text-sm mb-1">Записи</label>
            {entries.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Select
                    value={entry.accountId}
                    onChange={(e) =>
                      updateEntry(index, "accountId", parseInt(e.target.value) || "")
                    }
                  >
                    <option value="">Счёт</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-20 shrink-0">
                  <Select
                    value={entry.currency}
                    onChange={(e) => updateEntry(index, "currency", e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-24 shrink-0">
                  <input
                    type="number"
                    value={entry.amount}
                    onChange={(e) => updateEntry(index, "amount", e.target.value)}
                    placeholder="0.00"
                    step="any"
                  />
                </div>
                <div className="w-24 shrink-0">
                  <Select
                    value={entry.type}
                    onChange={(e) =>
                      updateEntry(index, "type", e.target.value)
                    }
                  >
                    {ENTRY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(index)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] text-lg px-1 shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addEntry}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              + Добавить запись
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => { reset(); onClose(); }} className="btn btn-secondary flex-1">
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !allFilled}
              className="btn btn-primary flex-1"
            >
              {loading ? "Сохранение..." : "💾 Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
