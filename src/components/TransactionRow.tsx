"use client";

import { memo } from "react";

interface Transaction {
  id: number;
  accountId: number;
  type: string;
  amount: number;
  currency: string;
  amountFrom: number | null;
  currencyFrom: string | null;
  amountTo: number | null;
  currencyTo: string | null;
  category: string | null;
  description: string | null;
  status: string;
  source: string;
  operationDate: string;
}

interface TransactionRowProps {
  tx: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: number) => void;
}

function getTypeIcon(type: string) {
  switch (type) {
    case "income": return "📥";
    case "expense": return "📤";
    case "transfer": return "🔄";
    case "exchange": return "💱";
    default: return "📝";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed": return <span className="badge badge-confirmed">✅</span>;
    case "pending": return <span className="badge badge-pending">🔵</span>;
    case "matched_candidate": return <span className="badge badge-candidate">🟡</span>;
    default: return <span className="badge badge-pending">{status}</span>;
  }
}

function formatAmount(amount: number, currency: string) {
  const sym: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥", USDT: "USDT", SOL: "SOL", BNB: "BNB", TON: "TON" };
  return `${amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${sym[currency] || currency}`;
}

function getTxTypeDisplay(tx: Transaction) {
  if (tx.type === "exchange") {
    return `${tx.amountFrom} ${tx.currencyFrom} → ${tx.amountTo} ${tx.currencyTo}`;
  }
  return formatAmount(tx.amount, tx.currency);
}

export default memo(function TransactionRow({ tx, onEdit, onDelete }: TransactionRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-primary)]/30 rounded transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-lg shrink-0">{getTypeIcon(tx.type)}</span>
        <div className="min-w-0">
          <div className="text-sm truncate">{getTxTypeDisplay(tx)}</div>
          <div className="text-xs text-[var(--text-muted)] truncate">
            {new Date(tx.operationDate).toLocaleDateString("ru-RU")}
            {tx.category && <span> · {tx.category}</span>}
            {tx.source.startsWith("scanner") && <span> · авто</span>}
            {tx.source === "api_bybit" && <span> · bybit</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {getStatusBadge(tx.status)}

        <button
          onClick={() => onEdit(tx)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          title="Редактировать"
        >
          ✏️
        </button>

        {tx.source === "manual" && (
          <button
            onClick={() => onDelete(tx.id)}
            className="text-xs text-[var(--text-muted)] hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            title="Удалить"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
});
