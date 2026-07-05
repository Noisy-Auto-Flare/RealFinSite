"use client";

import { memo } from "react";
import { formatAmount } from "@/lib/formatting";

interface OperationSummary {
  id: number;
  description: string | null;
  category: string | null;
  date: string;
  source: string;
  status: string;
  entries: { currency: string; amount: number; type: string }[];
}

interface TransactionRowProps {
  tx: OperationSummary;
  onEdit: (tx: OperationSummary) => void;
  onDelete: (id: number) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed": return <span className="badge badge-confirmed">✅</span>;
    case "pending": return <span className="badge badge-pending">🔵</span>;
    default: return <span className="badge badge-pending">{status}</span>;
  }
}

export default memo(function TransactionRow({ tx, onEdit, onDelete }: TransactionRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-primary)]/30 rounded transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-lg shrink-0">{tx.entries?.some(e => e.amount > 0) ? "📥" : "📤"}</span>
        <div className="min-w-0">
          <div className="text-sm truncate">{tx.entries?.map(e => formatAmount(e.amount, e.currency)).join(", ") || "—"}</div>
          <div className="text-xs text-[var(--text-muted)] truncate">
            {new Date(tx.date).toLocaleDateString("ru-RU")}
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
