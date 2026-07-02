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

function NavLink({ href, label, icon, isActive }: { href: string; label: string; icon: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
        isActive
          ? "bg-[rgba(233,177,163,0.1)] text-[var(--accent)] font-medium"
          : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[rgba(255,255,255,0.04)]"
      }`}
    >
      <span className="text-lg w-6 text-center shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function Navbar({ role, username }: NavbarProps) {
  const pathname = usePathname();
  const [showNewTx, setShowNewTx] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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

  function sidebarContent(closeNav?: () => void) {
    return (
      <>
        <div className="flex items-center justify-between mb-6 shrink-0">
          <Link href="/dashboard" className="font-bold text-base tracking-wide">
            FinTracker
          </Link>
          {closeNav && (
            <button onClick={closeNav} className="text-xl text-[var(--text-muted)]">✕</button>
          )}
        </div>

        <div className="flex items-center gap-2 mb-6 px-1 shrink-0">
          <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--bg-primary)] flex items-center justify-center text-sm font-bold shrink-0">
            {username.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="text-sm truncate">{username}</div>
            {role === "master" && <span className="text-xs text-[var(--accent)]">Администратор</span>}
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
          ))}

          <hr className="border-[rgba(255,255,255,0.06)] my-2" />

          <NavLink href="/profile" label="Профиль" icon="👤" isActive={pathname === "/profile"} />

          {role === "master" && (
            <>
              <NavLink href="/admin/users" label="Пользователи" icon="👥" isActive={!!pathname?.startsWith("/admin/users")} />
              <NavLink href="/admin/logs" label="Журнал" icon="📋" isActive={!!pathname?.startsWith("/admin/logs")} />
            </>
          )}
        </nav>

        <div className="flex flex-col gap-2 shrink-0 mt-4">
          <button
            onClick={() => setShowNewTx(true)}
            className="btn btn-primary w-full text-sm"
          >
            + Новая операция
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn btn-secondary w-full text-sm"
          >
            🚪 Выйти
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 z-80 flex-col p-4 gap-1 bg-[rgba(15,15,19,0.92)] backdrop-blur-[20px] border-r border-[rgba(255,255,255,0.06)]">
        {sidebarContent()}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 z-80 flex items-center justify-between px-4 bg-[rgba(15,15,19,0.85)] backdrop-blur-[16px] border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xl p-1 -ml-1"
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
          <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--bg-primary)] flex items-center justify-center text-xs font-bold">
            {username.charAt(0).toUpperCase()}
          </span>
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

      {/* Mobile FAB */}
      <button
        onClick={() => setShowNewTx(true)}
        className={`fab md:hidden ${showFab ? "visible" : ""} ${showFab && !pulsedRef.current ? "pulse" : ""}`}
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
        {sidebarContent(() => setDrawerOpen(false))}
      </div>

      {showNewTx && <NewTransactionModal onClose={() => setShowNewTx(false)} />}
    </>
  );
}
