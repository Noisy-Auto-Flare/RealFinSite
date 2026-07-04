"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

interface BalanceEntry {
  account: string;
  balance: { number: string; currency: string };
}

export default function BalancesPage() {
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/beancount/balances")
      .then(r => r.json())
      .then(data => {
        setBalances(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build tree from flat account paths
  function buildTree(entries: BalanceEntry[]): any[] {
    const root: Record<string, any> = {};
    for (const e of entries) {
      const parts = e.account.split(":");
      let current = root;
      for (const part of parts) {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
      current._balance = e.balance;
    }
    function toList(obj: Record<string, any>, depth = 0): any[] {
      return Object.entries(obj)
        .filter(([k]) => !k.startsWith("_"))
        .map(([key, val]) => ({
          name: key,
          balance: (val as any)._balance || null,
          children: toList(val as any, depth + 1),
          depth,
        }));
    }
    return toList(root);
  }

  const tree = buildTree(balances);

  if (loading) return <div className="p-6">Загрузка...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl md:text-2xl font-bold">Балансы</h1>

      {tree.length === 0 ? (
        <EmptyState icon="💰" title="Нет данных" description="Балансы появятся здесь после создания операций" />
      ) : (
        <div className="space-y-1">
          {tree.map((node, i) => (
            <TreeNode key={i} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node }: { node: any }) {
  const [open, setOpen] = useState(node.depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm cursor-pointer hover:bg-[var(--bg-primary)] ${
          node.depth === 0 ? "font-bold" : ""
        }`}
        style={{ paddingLeft: `${12 + node.depth * 20}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren && <span className="text-xs text-[var(--text-muted)]">{open ? "▼" : "▶"}</span>}
        {!hasChildren && <span className="text-xs text-[var(--text-muted)]">•</span>}
        <span className="truncate">{node.name}</span>
        {node.balance && (
          <span className="ml-auto tabular-nums text-[var(--text-secondary)]">
            {parseFloat(node.balance.number).toFixed(2)} {node.balance.currency}
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((child: any, i: number) => (
            <TreeNode key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
