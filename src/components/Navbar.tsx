"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import NewTransactionModal from "./NewTransactionModal";

interface NavbarProps {
  role: string;
  username: string;
}

const navItems = [
  { href: "/dashboard", label: "Дашборд", icon: "🏠" },
  { href: "/accounts", label: "Счета", icon: "💳" },
  { href: "/transactions", label: "История", icon: "📋" },
  { href: "/matches", label: "Связи", icon: "🔗" },
  { href: "/stats", label: "Сводка", icon: "📊" },
];

export default function Navbar({ role, username }: NavbarProps) {
  const pathname = usePathname();
  const [showNewTx, setShowNewTx] = useState(false);

  return (
    <>
      <nav className="w-56 bg-[var(--bg-secondary)] border-r border-[var(--border)] p-4 flex flex-col gap-2 shrink-0">
        <div className="text-lg font-bold mb-4 text-center">FinTracker</div>
        <div className="text-sm text-[var(--text-muted)] text-center mb-4">
          {username}
          {role === "master" && <span className="badge badge-confirmed ml-2">admin</span>}
        </div>

        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)]"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <Link
          href="/profile"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/profile"
              ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
              : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)]"
          }`}
        >
          <span>👤</span>
          Профиль
        </Link>

        {role === "master" && (
          <>
            <Link
              href="/admin/users"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname?.startsWith("/admin/users")
                  ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)]"
              }`}
            >
              <span>👥</span>
              Пользователи
            </Link>
            <Link
              href="/admin/logs"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname?.startsWith("/admin/logs")
                  ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)]"
              }`}
            >
              <span>📋</span>
              Журнал
            </Link>
          </>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setShowNewTx(true)}
          className="btn btn-primary w-full text-sm"
        >
          + Новая операция
        </button>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn btn-secondary w-full text-sm mt-2"
        >
          Выйти
        </button>
      </nav>

      {showNewTx && <NewTransactionModal onClose={() => setShowNewTx(false)} />}
    </>
  );
}
