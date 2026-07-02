"use client";

import { useEffect, useState } from "react";

interface TxMini {
  id: number;
  accountId: number;
  accountName: string;
  type: string;
  amount: number;
  currency: string;
  fromAddress: string | null;
  toAddress: string | null;
  txHash: string | null;
  source: string;
  operationDate: string;
}

interface Match {
  id: number;
  matchType: string;
  status: string;
  createdAt: string;
  transactionA: TxMini;
  transactionB: TxMini;
}

const MATCH_LABELS: Record<string, string> = {
  auto_suggested: "🔄 Внутренний перевод",
  exchange_pair: "💱 Обмен",
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => { loadMatches(); }, []);

  function loadMatches() {
    setLoading(true);
    fetch("/api/matches?status=suggested")
      .then((r) => r.json())
      .then((data) => { setMatches(data); setLoading(false); });
  }

  async function handleAction(matchId: number, action: "confirm" | "reject") {
    setActionMsg("");
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, action }),
    });

    if (res.ok) {
      setMatches(matches.filter((m) => m.id !== matchId));
      setActionMsg(action === "confirm" ? "✅ Связь подтверждена" : "❌ Связь отклонена");
    } else {
      setActionMsg("Ошибка");
    }

    setTimeout(() => setActionMsg(""), 3000);
  }

  function addrDisplay(addr: string | null) {
    if (!addr) return "—";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center gap-2">
        <h1 className="text-xl md:text-2xl font-bold truncate min-w-0">Связи транзакций</h1>
        <button onClick={loadMatches} className="btn btn-secondary text-sm shrink-0">
          🔄 Обновить
        </button>
      </div>

      {actionMsg && (
        <div className="card border-green-500/30 text-sm">{actionMsg}</div>
      )}

      {loading ? (
        <p className="text-[var(--text-muted)]">Загрузка...</p>
      ) : matches.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-[var(--text-secondary)]">Нет неподтверждённых связей</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Связи создаются автоматически после сканирования блокчейна
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((m) => (
            <div key={m.id} className="card border-yellow-500/30">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
                <div className="min-w-0">
                  <span className="font-medium text-sm truncate block">
                    {MATCH_LABELS[m.matchType] || m.matchType}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    #{m.id}
                  </span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(m.id, "confirm")}
                    className="btn btn-success text-sm px-3 py-1"
                  >
                    ✅ Подтвердить
                  </button>
                  <button
                    onClick={() => handleAction(m.id, "reject")}
                    className="btn btn-danger text-sm px-3 py-1"
                  >
                    ❌ Отклонить
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Transaction A */}
                <div className="bg-[var(--bg-primary)] rounded-lg p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-1">
                    {m.transactionA.accountName}
                    <span className="ml-2 badge badge-pending">
                      {m.transactionA.source.replace("scanner_", "")}
                    </span>
                  </div>
                  <div className="font-medium">
                    {m.transactionA.type === "income" ? "📥 +" : "📤 -"}
                    {m.transactionA.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}{" "}
                    {m.transactionA.currency}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                    {addrDisplay(m.transactionA.fromAddress)} → {addrDisplay(m.transactionA.toAddress)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {new Date(m.transactionA.operationDate).toLocaleString("ru-RU")}
                  </div>
                  {m.transactionA.txHash && (
                    <div className="text-xs text-[var(--text-muted)] font-mono truncate mt-1">
                      {m.transactionA.txHash.slice(0, 16)}...
                    </div>
                  )}
                </div>

                {/* Transaction B */}
                <div className="bg-[var(--bg-primary)] rounded-lg p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-1">
                    {m.transactionB.accountName}
                    <span className="ml-2 badge badge-pending">
                      {m.transactionB.source.replace("scanner_", "")}
                    </span>
                  </div>
                  <div className="font-medium">
                    {m.transactionB.type === "income" ? "📥 +" : "📤 -"}
                    {m.transactionB.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}{" "}
                    {m.transactionB.currency}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                    {addrDisplay(m.transactionB.fromAddress)} → {addrDisplay(m.transactionB.toAddress)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {new Date(m.transactionB.operationDate).toLocaleString("ru-RU")}
                  </div>
                  {m.transactionB.txHash && (
                    <div className="text-xs text-[var(--text-muted)] font-mono truncate mt-1">
                      {m.transactionB.txHash.slice(0, 16)}...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
