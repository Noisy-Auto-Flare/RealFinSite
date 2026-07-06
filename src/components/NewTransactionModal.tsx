"use client";

import { useEffect, useState, memo } from "react";
import Select from "@/components/Select";
import { useToast } from "@/components/Toast";
import { ENTRY_TYPES, ENTRY_TYPE_HINTS } from "@/lib/operation-types";
import { ALL_CURRENCIES } from "@/lib/currencies";

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

const STEPS = ["Основное", "Записи", "Проверка"];

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center px-4 pt-3 pb-2">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div
            className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
              i <= current
                ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-[0_0_12px_rgba(233,177,163,0.4)]"
                : "bg-[var(--bg-card)] text-[var(--text-muted)]"
            }`}
          >
            {i < current ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1.5 rounded transition-all duration-500 ${
                i < current ? "bg-[var(--accent)]" : "bg-[var(--border)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-[var(--text-muted)]/20 text-[var(--text-muted)] text-[10px] font-bold flex items-center justify-center hover:bg-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors"
        aria-label={text}
      >
        i
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] whitespace-nowrap z-10 shadow-lg pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--border)]" />
        </span>
      )}
    </span>
  );
}

export default memo(function NewTransactionModal({ onClose }: Props) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [entries, setEntries] = useState<Entry[]>([
    { accountId: "", currency: "RUB", amount: "", type: "principal" },
  ]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdOperation, setCreatedOperation] = useState<any>(null);
  const [confirmingFees, setConfirmingFees] = useState(false);
  const [allTags, setAllTags] = useState<{ id: number; name: string; color: string | null }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

  const [showExtra, setShowExtra] = useState(false);
  const [groups, setGroups] = useState<{ id: number; firstOpDescription: string | null; opCount: number }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [createNewGroup, setCreateNewGroup] = useState(false);

  const [debts, setDebts] = useState<{ id: number; personName: string; amount: number; currency: string; status: string }[]>([]);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);
  const [isLoanGiven, setIsLoanGiven] = useState(false);
  const [loanPersonName, setLoanPersonName] = useState("");
  const [loanDescription, setLoanDescription] = useState("");

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  useEffect(() => {
    fetch("/api/tags").then(r => r.json()).then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/groups").then(r => r.json()).then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/debts").then(r => r.json()).then(setDebts).catch(() => {});
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

  const allFilled = entries.every((e) => e.accountId !== "" && e.amount !== "");

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const body: Record<string, unknown> = {
      description,
      date,
      status: "confirmed",
      tags: selectedTags,
      entries: entries.map((e) => ({
        accountId: Number(e.accountId),
        currency: e.currency,
        amount: parseFloat(e.amount.replace(",", ".")),
        type: e.type,
      })),
    };

    if (selectedGroupId) body.groupId = selectedGroupId;
    if (createNewGroup) {
      const groupRes = await fetch("/api/groups", { method: "POST" });
      const groupData = await groupRes.json();
      body.groupId = groupData.id;
    }
    if (selectedDebtId) {
      body.debtId = selectedDebtId;
    } else if (isLoanGiven && loanPersonName) {
      const totalAmount = Math.abs(entries.reduce((s: number, e: Entry) => s + Number(e.amount || 0), 0));
      const debtRes = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: loanPersonName,
          description: loanDescription || `${description || "Долг"}`,
          amount: totalAmount,
          currency: entries[0]?.currency || "RUB",
        }),
      });
      const debtData = await debtRes.json();
      body.debtId = debtData.id;
    }

    const res = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Ошибка при сохранении");
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
    await fetch(`/api/operations/${createdOperation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setConfirmingFees(false);
    toast.success("Операция подтверждена");
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
    setSelectedTags([]);
    setSelectedGroupId(null);
    setCreateNewGroup(false);
    setSelectedDebtId(null);
    setIsLoanGiven(false);
    setLoanPersonName("");
    setLoanDescription("");
    setEntries([{ accountId: "", currency: "RUB", amount: "", type: "principal" }]);
    setError("");
    setStep(0);
  }

  function getAccountName(id: number | "") {
    const a = accounts.find((a) => a.id === id);
    return a ? `${a.name} (${a.currency})` : "—";
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
                <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                  <span className="text-[var(--warning)] text-base">⚠️</span>
                  Обнаружены неверифицированные комиссии:
                </p>
                <div className="space-y-2">
                  {unverifiedFees.map((fee: any) => (
                    <div key={fee.id} className="flex items-center justify-between bg-[var(--bg-primary)] p-3 rounded-lg">
                      <span className="text-sm">
                        {Math.abs(fee.amount)} {fee.currency}
                        <span className="text-[var(--text-muted)] ml-2">
                          {fee.type === "fee" ? "комиссия сети" : fee.type}
                        </span>
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
                <div className="flex flex-wrap gap-2">
                  <button onClick={verifyAllFees} className="btn btn-primary flex-1">Подтвердить всё</button>
                  <button onClick={() => { reset(); onClose(); }} className="btn btn-secondary flex-1">Отклонить</button>
                  <button onClick={() => { reset(); onClose(); }} className="btn btn-secondary flex-1">Оставить черновиком</button>
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose(); }}}>
      <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-lg shadow-2xl border border-[var(--border)] animate-modal-enter">
        <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-lg">Новая операция</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
        </div>

        <StepIndicator steps={STEPS} current={step} />

        <div className="overflow-y-auto max-h-[55vh] px-4 pb-20">
          <div key={step} className="pt-2 space-y-4 animate-slide-up">
            {error && (
              <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {step === 0 && (
              <>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Опишите операцию: что произошло, когда и к какой категории это относится.
                  Эти данные помогут в аналитике и поиске.
                </p>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Дата</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Описание
                    <span className="text-[var(--text-muted)] font-normal ml-1">— необязательно</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Например: перевод другу, оплата подписки..."
                    className="resize-none"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Теги</label>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTags((prev) =>
                            prev.includes(tag.name)
                              ? prev.filter((t) => t !== tag.name)
                              : [...prev, tag.name]
                          );
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                          selectedTags.includes(tag.name)
                            ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]"
                            : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                        }`}
                        style={selectedTags.includes(tag.name) ? { borderColor: tag.color || undefined, color: tag.color || undefined } : undefined}
                      >
                        {tag.name}
                      </button>
                    ))}
                    {/* Inline tag creation */}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        placeholder="+ тег"
                        className="w-20 px-2 py-1 rounded-full text-xs border border-[var(--border)] bg-transparent outline-none focus:border-[var(--accent)]"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && newTagName.trim()) {
                            e.preventDefault();
                            await fetch("/api/tags", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
                            });
                            setNewTagName("");
                            fetch("/api/tags").then(r => r.json()).then(setAllTags).catch(() => {});
                          }
                        }}
                      />
                      <input
                        type="color"
                        value={newTagColor}
                        onChange={e => setNewTagColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newTagName.trim()) return;
                          await fetch("/api/tags", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
                          });
                          setNewTagName("");
                          fetch("/api/tags").then(r => r.json()).then(setAllTags).catch(() => {});
                        }}
                        className="text-xs text-[var(--accent)] hover:text-[var(--accent)]/80"
                      >
                        <i className="fa-solid fa-plus" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible "Доп. опции" */}
                <button
                  type="button"
                  onClick={() => setShowExtra(!showExtra)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  <span><i className="fa-solid fa-gear mr-2" />Доп. опции</span>
                  <i className={`fa-solid fa-chevron-${showExtra ? "up" : "down"} transition-transform`} />
                </button>

                {showExtra && (
                  <div className="space-y-4 animate-slide-up">
                    <div className="form-group">
                      <label className="form-label">Группа</label>
                      <Select
                        value={selectedGroupId ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__new__") {
                            setCreateNewGroup(true);
                            setSelectedGroupId(null);
                          } else {
                            setSelectedGroupId(val ? Number(val) : null);
                            setCreateNewGroup(false);
                          }
                        }}
                      >
                        <option value="">— Без группы —</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.firstOpDescription || `Группа #${g.id}`} ({g.opCount} оп.)
                          </option>
                        ))}
                        <option value="__new__">+ Новая группа</option>
                      </Select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <input type="checkbox" checked={isLoanGiven} onChange={(e) => setIsLoanGiven(e.target.checked)} className="mr-2" />
                        Операция с долгом
                      </label>
                      {isLoanGiven && (
                        <div className="mt-2 space-y-2 pl-4 border-l-2 border-[var(--accent)]/30">
                          {selectedDebtId === null && (
                            <>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Имя человека"
                                value={loanPersonName}
                                onChange={(e) => setLoanPersonName(e.target.value)}
                              />
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Заметка (необязательно)"
                                value={loanDescription}
                                onChange={(e) => setLoanDescription(e.target.value)}
                              />
                            </>
                          )}
                          {debts.filter(d => d.status === "active").length > 0 && (
                            <Select
                              value={selectedDebtId ?? ""}
                              onChange={(e) => setSelectedDebtId(e.target.value ? Number(e.target.value) : null)}
                            >
                              <option value="">— Создать новый долг —</option>
                              {debts.filter(d => d.status === "active").map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.personName} — {d.amount} {d.currency}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Добавьте одну или несколько записей — движение средств по каждому счёту.
                  Для переводов добавьте две записи: исходящую (отрицательная сумма) с одного счёта
                  и входящую (положительная) на другой.
                </p>

                <div className="space-y-3">
                  {entries.map((entry, index) => (
                    <div
                      key={index}
                      className="bg-[var(--bg-card)] rounded-lg p-3 space-y-2 border border-[var(--glass-border)] transition-all duration-200 hover:border-[var(--border)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Запись {index + 1}</span>
                        {entries.length > 1 && (
                          <button
                            onClick={() => removeEntry(index)}
                            className="text-[var(--text-muted)] hover:text-[var(--danger)] text-sm transition-colors"
                            aria-label="Удалить запись"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="text-xs text-[var(--text-muted)] block mb-1">Счёт</label>
                          <Select
                            value={entry.accountId}
                            onChange={(e) =>
                              updateEntry(index, "accountId", parseInt(e.target.value) || "")
                            }
                          >
                            <option value="">Выберите счёт</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs text-[var(--text-muted)] block mb-1">Валюта</label>
                          <Select
                            value={entry.currency}
                            onChange={(e) => updateEntry(index, "currency", e.target.value)}
                          >
                            {ALL_CURRENCIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs text-[var(--text-muted)] block mb-1">Сумма</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entry.amount}
                            onChange={(e) => updateEntry(index, "amount", e.target.value.replace(/[^0-9.,\-]/g, ""))}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-[var(--text-muted)] block mb-1">
                            Тип
                            <InfoTip text={ENTRY_TYPE_HINTS[entry.type]} />
                          </label>
                          <Select
                            value={entry.type}
                            onChange={(e) =>
                              updateEntry(index, "type", e.target.value)
                            }
                          >
                            {ENTRY_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addEntry}
                    className="w-full py-2.5 rounded-lg border-2 border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all duration-200"
                  >
                    + Добавить запись
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Проверьте данные перед сохранением. После сохранения вы сможете подтвердить
                  операцию и при необходимости отредактировать её.
                </p>

                <div className="space-y-3">
                  <div className="bg-[var(--bg-card)] rounded-lg p-3 space-y-2 border border-[var(--glass-border)]">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Дата</span>
                      <span>{new Date(date).toLocaleDateString("ru-RU")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Описание</span>
                      <span className="text-right max-w-[60%] truncate">{description || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-muted)]">Теги</span>
                      <span className="text-right max-w-[60%] truncate">{selectedTags.length > 0 ? selectedTags.join(", ") : "—"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-[var(--text-muted)]">Записи ({entries.length})</span>
                    {entries.map((entry, i) => (
                      <div
                        key={i}
                        className="bg-[var(--bg-card)] rounded-lg px-3 py-2 border border-[var(--glass-border)] flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate">{getAccountName(entry.accountId)}</span>
                        <span className="tabular-nums shrink-0">
                          <span className={entry.type === "fee" ? "text-[var(--warning)]" : ""}>
                            {parseFloat(entry.amount) >= 0 ? "+" : ""}{entry.amount} {entry.currency}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-[var(--text-muted)]">Статус</span>
                    <span className="text-[var(--text-secondary)]">Черновик</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center p-4 border-t border-[var(--border)]">
          <div>
            {step === 0 ? (
              <button onClick={() => { reset(); onClose(); }} className="btn btn-secondary">
                Отмена
              </button>
            ) : (
              <button onClick={() => setStep((s) => s - 1)} className="btn btn-secondary">
                ← Назад
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="btn btn-primary"
              >
                Далее →
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button
                onClick={handleSubmit}
                disabled={loading || !allFilled}
                className="btn btn-primary"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Сохранение...
                  </span>
                ) : (
                  "💾 Сохранить"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
