"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS } from "@/lib/utils";
import type { AccountType } from "@/lib/utils";

interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  isActive: number;
  isAutoSync: number;
  balances: { currency: string; amount: number }[];
  addresses: { network: string; address: string }[];
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => { setAccounts(data); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Счета</h1>
        <Link href="/accounts/new" className="btn btn-primary">
          + Добавить счёт
        </Link>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)]">Загрузка...</p>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">💳</div>
          <p className="text-[var(--text-secondary)] mb-4">У вас ещё нет счетов</p>
          <Link href="/accounts/new" className="btn btn-primary">
            Создать первый счёт
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => {
            const icon = ACCOUNT_TYPE_ICONS[acc.type] || "💳";
            const label = ACCOUNT_TYPE_LABELS[acc.type] || acc.type;

            return (
              <div key={acc.id} className="card hover:border-[var(--accent)] transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{icon}</span>
                      <div>
                        <span className="font-medium">{acc.name}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">{label}</span>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {acc.balances.map((b) => (
                        <div key={b.currency} className="text-sm">
                          <span className="text-[var(--text-secondary)]">{b.currency}:</span>{" "}
                          {b.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                        </div>
                      ))}
                    </div>

                    {acc.addresses.length > 0 && (
                      <div className="mt-2 text-xs text-[var(--text-muted)]">
                        {acc.addresses.map((a) => (
                          <div key={a.network}>
                            {a.network}: {a.address.slice(0, 10)}...{a.address.slice(-4)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {acc.isAutoSync ? (
                      <span className="badge badge-confirmed">Авто-скан</span>
                    ) : (
                      <span className="badge badge-pending">Ручной</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
