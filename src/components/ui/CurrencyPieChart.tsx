"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import EmptyState from "@/components/EmptyState";

const CHART_COLORS = ["#E9B1A3", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"];

interface CurrencyPieChartProps {
  data: { currency: string; value: number }[];
  baseCurrency: string;
  emptyTitle?: string;
  emptyDescription?: string;
  totalValue?: number;
  showPercentages?: boolean;
}

export default function CurrencyPieChart({
  data,
  baseCurrency,
  emptyTitle = "Нет данных",
  emptyDescription = "Добавьте счета для отслеживания балансов",
  totalValue,
  showPercentages = false,
}: CurrencyPieChartProps) {
  const pieData = useMemo(() => {
    return data
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((d, i) => ({
        name: d.currency,
        value: d.value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [data]);

  if (pieData.length === 0) {
    return <EmptyState icon="💳" title={emptyTitle} description={emptyDescription} />;
  }

  const total = totalValue ?? pieData.reduce((s, d) => s + d.value, 0);

  const sym = (cur: string) => {
    const m: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥" };
    return m[cur] || cur;
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <div className="w-[140px] h-[140px] md:w-[180px] md:h-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} isAnimationActive={true}>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "rgba(21,21,30,0.96)", border: "1px solid var(--glass-border)", borderRadius: "8px", fontSize: "12px", color: "var(--text-primary)" }}
              formatter={(value: unknown) => `${Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${sym(baseCurrency)}`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 min-w-0 space-y-1 text-sm">
        {pieData.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          return (
            <div key={entry.name}>
              <div className="flex justify-between gap-2">
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: entry.color }} />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="text-[var(--text-muted)] whitespace-nowrap shrink-0">
                  {entry.value.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {sym(baseCurrency)}
                  {showPercentages && ` (${pct.toFixed(1)}%)`}
                </span>
              </div>
              {showPercentages && (
                <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden mt-0.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: entry.color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
