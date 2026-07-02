"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pulsedRef = useRef(false);
  const isDashboard = pathname === "/dashboard";

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 100);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { pulsedRef.current = true; }, 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setDropdownOpen(false);
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
      {/* Fixed top bar */}
      <header className="fixed top-0 left-0 right-0 h-14 z-80 flex items-center justify-between px-4 bg-[rgba(15,15,19,0.85)] backdrop-blur-[16px] border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xl p-1 -ml-1 md:hidden"
            aria-label="Меню"
          >
            ☰
          </button>
          <Link href="/dashboard" className="font-bold text-sm tracking-wide">
            FinTracker
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {role === "master" && (
            <span className="text-xs" title="Администратор">🛡️</span>
          )}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--bg-primary)] flex items-center justify-center text-xs font-bold">
                {username.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm hidden sm:block">{username}</span>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-[rgba(21,21,30,0.96)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.06)] rounded-xl shadow-xl z-50 py-1 animate-fade-in">
                  <Link href="/profile" className="block px-4 py-2 text-sm hover:bg-[rgba(255,255,255,0.06)]">
                    👤 Профиль
                  </Link>
                  {role === "master" && (
                    <>
                      <Link href="/admin/users" className="block px-4 py-2 text-sm hover:bg-[rgba(255,255,255,0.06)]">
                        👥 Пользователи
                      </Link>
                      <Link href="/admin/logs" className="block px-4 py-2 text-sm hover:bg-[rgba(255,255,255,0.06)]">
                        📋 Журнал
                      </Link>
                    </>
                  )}
                  <hr className="border-[rgba(255,255,255,0.06)] my-1" />
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--danger)] hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    🚪 Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

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

      {/* FAB */}
      <button
        onClick={() => setShowNewTx(true)}
        className={`fab md:hidden ${showFab ? "visible" : ""} ${showFab && !pulsedRef.current ? "pulse" : ""}`}
        aria-label="Новая операция"
      >
        +
      </button>

      {/* Drawer overlay */}
      <div
        className={`drawer-overlay md:hidden ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel */}
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
                ? "bg-[rgba(233,177,163,0.1)] text-[var(--accent)] border-l-[3px] border-[var(--accent)] pl-[calc(0.75rem-3px)]"
                : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <hr className="border-[rgba(255,255,255,0.06)] my-2" />
        <Link
          href="/profile"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/profile"
              ? "bg-[rgba(233,177,163,0.1)] text-[var(--accent)] border-l-[3px] border-[var(--accent)] pl-[calc(0.75rem-3px)]"
              : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[rgba(255,255,255,0.04)]"
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
                  ? "bg-[rgba(233,177,163,0.1)] text-[var(--accent)] border-l-[3px] border-[var(--accent)] pl-[calc(0.75rem-3px)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[rgba(255,255,255,0.04)]"
              }`}
            >
              <span>👥</span>
              Пользователи
            </Link>
            <Link
              href="/admin/logs"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname?.startsWith("/admin/logs")
                  ? "bg-[rgba(233,177,163,0.1)] text-[var(--accent)] border-l-[3px] border-[var(--accent)] pl-[calc(0.75rem-3px)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[rgba(255,255,255,0.04)]"
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
