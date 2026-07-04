export const ENTRY_TYPES = [
  { value: "principal", label: "Основное движение" },
  { value: "fee", label: "Комиссия" },
  { value: "discount", label: "Скидка" },
  { value: "interest", label: "Проценты" },
  { value: "coupon", label: "Купон" },
] as const;

export const ENTRY_TYPE_HINTS: Record<string, string> = {
  principal: "Основное движение средств по операции. Обязательно присутствует как минимум в одной записи.",
  fee: "Комиссия сети, банка или биржи. Если сумма по счёту не сходится — оставшаяся разница автоматически выделяется как комиссия.",
  discount: "Скидка, кэшбэк или бонус, полученный при операции.",
  interest: "Начисленные проценты на остаток, вклад или стейкинг.",
  coupon: "Купонный доход по облигациям.",
};

export type EntryType = (typeof ENTRY_TYPES)[number]["value"];

export function getEntryTypeLabel(value: string): string {
  return ENTRY_TYPES.find((t) => t.value === value)?.label ?? value;
}
