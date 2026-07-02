"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isDashboard = pathname === "/dashboard";

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 100);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname?.startsWith(href);
  }

  const showFab = !isDashboard || scrolled;

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-56 bg-[var(--bg-secondary)] border-r border-[var(--border)] p-4 flex-col gap-2 shrink-0">
        <div className="text-lg font-bold mb-4 text-center">FinTracker</div>
        <div className="text-sm text-[var(--text-muted)] text-center mb-4">
          {username}
          {role === "master" && <span className="badge badge-confirmed ml-2">admin</span>}
        </div>

        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(item.href)
                ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)]"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

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

      {/* Mobile: header with hamburger + title */}
      <div className="flex md:hidden items-center justify-between px-3 py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border)] sticky top-0 z-80 gap-2">
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-xl p-1 -ml-1 shrink-0"
          aria-label="Меню"
        >
          ☰
        </button>
        <span className="font-bold text-xs truncate min-w-0">FinTracker</span>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "active" : ""}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* FAB — always visible on mobile, hidden on desktop */}
      <button
        onClick={() => setShowNewTx(true)}
        className={`fab md:hidden ${showFab ? "visible" : ""}`}
        aria-label="Новая операция"
      >
        +
      </button>

      {/* Mobile drawer overlay */}
      <div
        className={`drawer-overlay md:hidden ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Mobile drawer panel */}
      <div className={`drawer-panel md:hidden ${drawerOpen ? "open" : ""}`}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold">FinTracker</span>
          <button onClick={() => setDrawerOpen(false)} className="text-xl text-[var(--text-muted)]">✕</button>
        </div>

        <div className="text-sm text-[var(--text-muted)] mb-4">
          {username}
          {role === "master" && <span className="badge badge-confirmed ml-2">admin</span>}
        </div>

        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive(item.href)
                ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)]"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <hr className="border-[var(--border)] my-2" />

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
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn btn-secondary w-full text-sm"
        >
          Выйти
        </button>
      </div>

      {showNewTx && <NewTransactionModal onClose={() => setShowNewTx(false)} />}
    </>
  );
}
