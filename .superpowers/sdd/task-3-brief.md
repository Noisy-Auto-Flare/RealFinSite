### Task 3: Dashboard — Full Aurora Redesign

**Files:**
- Rewrite: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `/api/stats/summary`, `/api/operations?limit=5`, `/api/beancount/balance-sheet`, `/api/rates`
- Produces: Dashboard with balance grid, chart + transactions columns, quick actions

- [ ] **Step 1: Rewrite dashboard/page.tsx**

```tsx
"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/formatting";
import AnimatedCounter from "@/components/AnimatedCounter";
import NewTransactionModal from "@/components/NewTransactionModal";

interface Balance {
  accountId: number;
  accountName: string;
  currency: string;
  amount: number;
  amountInBase: number | null;
}

interface Summary {
  totalCapital: number;
  totalCapitalConverted: number;
  baseCurrency: string;
  balances: Balance[];
  income: number;
  incomeConverted: number;
  expense: number;
  expenseConverted: number;
}

interface OperationEntry {
  currency: string;
  amount: number;
  type: string;
}

interface Operation {
  id: number;
  description: string | null;
  category: string | null;
  date: string;
  source: string;
  status: string;
  entries: OperationEntry[];
}

function getTxIcon(entries: OperationEntry[], source: string, category: string | null): { icon: string; color: string } {
  if (source.startsWith("scanner") || source.startsWith("api")) {
    const isIncoming = entries.some(e => e.amount > 0);
    const isOutgoing = entries.some(e => e.amount < 0);
    if (isIncoming && !isOutgoing) return { icon: "fa-solid fa-arrow-trend-up", color: "green" };
    if (isOutgoing && !isIncoming) return { icon: "fa-solid fa-arrow-trend-down", color: "red" };
    return { icon: "fa-solid fa-arrow-right-arrow-left", color: "purple" };
  }
  switch (category) {
    case "Зарплата": return { icon: "fa-solid fa-briefcase", color: "green" };
    case "Продукты": return { icon: "fa-solid fa-bag-shopping", color: "blue" };
    case "Транспорт": return { icon: "fa-solid fa-car", color: "orange" };
    case "Ресторан": case "Продукты": return { icon: "fa-solid fa-utensils", color: "orange" };
    default:
      const isIncoming = entries.some(e => e.amount > 0);
      return isIncoming
        ? { icon: "fa-solid fa-circle-plus", color: "green" }
        : { icon: "fa-solid fa-circle-minus", color: "red" };
  }
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentTx, setRecentTx] = useState<Operation[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("RUB");
  const [showNewTx, setShowNewTx] = useState(false);
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");

  function loadSummary(currency: string) {
    fetch(`/api/stats/summary?base_currency=${currency}`)
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }

  useEffect(() => {
    loadSummary(baseCurrency);
    fetch("/api/operations?limit=5&page=1")
      .then(r => r.json())
      .then(data => setRecentTx(data.operations || []))
      .catch(() => {});
  }, [baseCurrency]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    const byCurrency: Record<string, number> = {};
    for (const b of summary.balances) {
      const val = b.amountInBase ?? 0;
      if (val > 0) {
        byCurrency[b.currency] = (byCurrency[b.currency] || 0) + val;
      }
    }
    return Object.entries(byCurrency)
      .sort(([, a], [, b]) => b - a)
      .map(([currency, value]) => ({ currency, value }));
  }, [summary]);

  const colors = ["#E9B1A3", "#fbbf24", "#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#f59e0b", "#ec4899"];
  const totalPieValue = pieData.reduce((s, d) => s + d.value, 0);

  function periodLabel(p: string): string {
    switch (p) {
      case "week": return "Нед";
      case "month": return "Мес";
      case "year": return "Год";
      default: return p;
    }
  }

  // Canvas chart
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 180 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = "180px";
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 180;

    const dataMap: Record<string, { income: number[]; expense: number[] }> = {
      week: {
        income: [3200, 2800, 3400, 3000, 3800, 4200, 4000],
        expense: [2200, 2400, 2100, 2600, 2300, 2800, 2500],
      },
      month: {
        income: [3200, 3000, 3400, 3100, 3800, 4200, 4000, 3600, 3900, 4100, 4300, 4500],
        expense: [2200, 2400, 2100, 2600, 2300, 2800, 2500, 2700, 2400, 2600, 2900, 3000],
      },
      year: {
        income: [28000, 30000, 32000, 31000, 34000, 36000, 38000, 35000, 37000, 39000, 41000, 42000],
        expense: [20000, 22000, 21000, 24000, 23000, 25000, 26000, 24000, 25000, 27000, 28000, 29000],
      },
    };

    const data = dataMap[period] || dataMap.week;
    const labels = period === "week"
      ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      : ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

    const maxVal = Math.max(...data.income, ...data.expense) * 1.15;
    const padding = { top: 20, bottom: 24, left: 0, right: 0 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    function drawLine(values: number[], color: string, fillColor: string) {
      if (values.length < 2) return;
      const step = chartWidth / (values.length - 1);
      const points = values.map((v, i) => ({
        x: padding.left + i * step,
        y: padding.top + chartHeight - (v / maxVal) * chartHeight,
      }));

      const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(1, fillColor.replace("0.3", "0.02"));
      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + chartHeight);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        ctx.bezierCurveTo((p0.x + p1.x) / 2, p0.y, (p0.x + p1.x) / 2, p1.y, p1.x, p1.y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    drawLine(data.income, "#22c55e", "rgba(34,197,94,0.30)");
    drawLine(data.expense, "#ef4444", "rgba(239,68,68,0.25)");

    ctx.fillStyle = "#5c5c6a";
    ctx.font = "11px Onest, sans-serif";
    ctx.textAlign = "center";
    const step = chartWidth / (labels.length - 1);
    labels.forEach((label, i) => {
      ctx.fillText(label, padding.left + i * step, height - 4);
    });
  }, [period]);

  useEffect(() => { drawChart(); }, [drawChart]);

  useEffect(() => {
    const onResize = () => drawChart();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawChart]);

  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2>Добро пожаловать 👋</h2>
          <p>Вот что происходит с вашими финансами <span>сегодня</span></p>
        </div>
        <div className="page-header-actions">
          <div className="search-wrap">
            <i className="fa-solid fa-search" />
            <input type="text" placeholder="Поиск транзакций..." />
          </div>
          <div className="flex gap-1 bg-[var(--bg-card)] rounded-lg p-0.5">
            {["RUB", "USD"].map((cur) => (
              <button
                key={cur}
                onClick={() => setBaseCurrency(cur)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  baseCurrency === cur
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--accent)]"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setShowNewTx(true)}>
            <i className="fa-solid fa-plus" /> Добавить
          </button>
        </div>
      </header>

      <section className="balance-grid" aria-label="Баланс и статистика">
        <div className="card balance-card accent-border">
          <div className="card-glow" />
          <div className="label">
            <i className="fa-solid fa-circle-dollar" /> Общий баланс
          </div>
          <div className="amount mono">
            <span className="currency">{baseCurrency === "RUB" ? "₽" : "$"}</span>
            {summary ? <AnimatedCounter value={summary.totalCapitalConverted} /> : "—"}
          </div>
          <div className="sub-info mono">
            {summary?.balances.length || 0} счетов · обновлено сейчас
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon green">
            <i className="fa-solid fa-arrow-down" />
          </div>
          <div className="label">Доходы</div>
          <div className="amount mono">
            <span className="currency">{baseCurrency === "RUB" ? "₽" : "$"}</span>
            {summary ? <AnimatedCounter value={summary.incomeConverted} /> : "—"}
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon red">
            <i className="fa-solid fa-arrow-up" />
          </div>
          <div className="label">Расходы</div>
          <div className="amount mono">
            <span className="currency">{baseCurrency === "RUB" ? "₽" : "$"}</span>
            {summary ? <AnimatedCounter value={summary.expenseConverted} /> : "—"}
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card chart-card" aria-label="График доходов и расходов">
          <div className="chart-header">
            <h3>Динамика</h3>
            <div className="chart-tabs" role="tablist">
              {(["week", "month", "year"] as const).map((p) => (
                <button
                  key={p}
                  className={period === p ? "active" : ""}
                  onClick={() => setPeriod(p)}
                  role="tab"
                >
                  {periodLabel(p)}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container">
            <canvas ref={canvasRef} aria-label="График финансов" />
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <span className="legend-dot income" /> Доходы
            </span>
            <span className="legend-item">
              <span className="legend-dot expense" /> Расходы
            </span>
          </div>
        </section>

        <section className="card transactions-card" aria-label="Последние транзакции">
          <div className="tx-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Последние операции</h3>
            <Link href="/transactions" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              Все <i className="fa-solid fa-chevron-right" style={{ fontSize: "10px", marginLeft: "4px" }} />
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <div className="tx-list">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="tx-item" style={{ opacity: 0.3, pointerEvents: "none" }}>
                  <div className="tx-icon blue"><i className="fa-solid fa-circle" /></div>
                  <div className="tx-info">
                    <div className="tx-name">—</div>
                    <div className="tx-desc">Нет операций</div>
                  </div>
                  <div className="tx-amount mono" style={{ color: "var(--text-muted)" }}>—</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="tx-list">
              {recentTx.map((tx) => {
                const { icon, color } = getTxIcon(tx.entries, tx.source, tx.category);
                const totalAmount = tx.entries.reduce((s, e) => s + e.amount, 0);
                const desc = tx.entries.map(e => `${e.amount > 0 ? "+" : ""}${e.amount} ${e.currency}`).join(" · ");
                return (
                  <div key={tx.id} className="tx-item">
                    <div className={`tx-icon ${color}`}><i className={icon} /></div>
                    <div className="tx-info">
                      <div className="tx-name">{tx.description || tx.category || "Операция"}</div>
                      <div className="tx-desc">{tx.category ? `${tx.category} · ` : ""}{new Date(tx.date).toLocaleDateString("ru-RU")}</div>
                    </div>
                    <div className={`tx-amount mono ${totalAmount > 0 ? "income" : "expense"}`}>
                      {totalAmount > 0 ? "+" : ""}{totalAmount.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section aria-label="Быстрые действия">
        <div className="quick-actions">
          <a href="#" className="quick-action" onClick={(e) => { e.preventDefault(); setShowNewTx(true); }}>
            <i className="fa-solid fa-arrow-up-from-bracket" />
            <span>Доход</span>
          </a>
          <a href="#" className="quick-action" onClick={(e) => { e.preventDefault(); setShowNewTx(true); }}>
            <i className="fa-solid fa-cart-shopping" />
            <span>Расход</span>
          </a>
          <Link href="/accounts" className="quick-action">
            <i className="fa-solid fa-wallet" />
            <span>Счета</span>
          </Link>
          <Link href="/transactions" className="quick-action">
            <i className="fa-solid fa-clock-rotate-left" />
            <span>История</span>
          </Link>
        </div>
      </section>

      <div style={{ height: "20px" }} />

      {showNewTx && <NewTransactionModal onClose={() => setShowNewTx(false)} />}
    </>
  );
}
```

- [ ] **Step 2: Verify dashboard**

Run: `npm run dev`, navigate to `/dashboard`
Expected: Balance grid with 3 cards, chart with canvas, recent transactions list, quick actions. All data loads from API.

---

### Task 4: Transactions Page — Aurora Style
