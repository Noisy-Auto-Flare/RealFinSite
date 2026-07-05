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

const mainLinks = [
  { href: "/dashboard", label: "Обзор", icon: "fa-solid fa-th-large" },
  { href: "/accounts", label: "Счета", icon: "fa-solid fa-wallet" },
  { href: "/transactions", label: "Транзакции", icon: "fa-solid fa-arrow-right-arrow-left" },
  { href: "/debts", label: "Долги", icon: "fa-solid fa-hand-holding-dollar" },
];

const bottomLinks = [
  { href: "/dashboard", label: "Обзор", icon: "fa-solid fa-th-large" },
  { href: "/accounts", label: "Счета", icon: "fa-solid fa-wallet" },
  { href: "/transactions", label: "Транзакции", icon: "fa-solid fa-arrow-right-arrow-left" },
  { href: "/debts", label: "Долги", icon: "fa-solid fa-hand-holding-dollar" },
  { href: "/settings", label: "Настройки", icon: "fa-solid fa-cog" },
];

export default function Navbar({ role, username }: NavbarProps) {
  const pathname = usePathname();
  const [showNewTx, setShowNewTx] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isDashboard = pathname === "/dashboard";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
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

  function NavLink({ href, label, icon, isActive: active }: { href: string; label: string; icon: string; isActive: boolean }) {
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
          active
            ? "bg-[rgba(233,177,163,0.1)] text-[var(--accent)] font-medium border border-[rgba(233,177,163,0.15)]"
            : "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-card)]"
        }`}
      >
        <i className={`${icon} w-5 text-center shrink-0`} />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  function sidebarContent(closeNav?: () => void) {
    return (
      <>
        <div className="sidebar-brand">
          <div className="logo-icon">
            <i className="fa-solid fa-star" />
          </div>
          <h1>Fin<span>ly</span></h1>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Основное</div>
          {mainLinks.map((item) => (
            <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
          ))}

          <div className="nav-label">Другое</div>
          <NavLink href="/settings" label="Настройки" icon="fa-solid fa-cog" isActive={!!pathname?.startsWith("/settings")} />
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{username.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <div className="name">{username}</div>
              <div className="email">{role === "master" ? "Администратор" : "Пользователь"}</div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-[var(--text-muted)] hover:text-[var(--accent)] text-sm" title="Выйти">
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </div>

        {closeNav && (
          <button onClick={closeNav} className="absolute top-4 right-4 text-xl text-[var(--text-muted)] lg:hidden">
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <style>{`
        .sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: var(--sidebar-width); z-index: 100; background: var(--bg-secondary); border-right: 1px solid var(--glass-border); padding: 24px 16px; display: flex; flex-direction: column; backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); overflow-y: auto; }
        .sidebar-brand { display: flex; align-items: center; gap: 12px; padding: 0 8px 28px 8px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
        .sidebar-brand .logo-icon { width: 40px; height: 40px; background: var(--accent); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--bg-primary); flex-shrink: 0; }
        .sidebar-brand h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
        .sidebar-brand h1 span { color: var(--accent); }
        .sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .sidebar-nav .nav-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); padding: 16px 12px 8px 12px; font-weight: 600; }
        .sidebar-nav a { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-radius: var(--radius-sm); color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; cursor: pointer; }
        .sidebar-nav a i { width: 20px; font-size: 16px; text-align: center; flex-shrink: 0; }
        .sidebar-nav a:hover { background: var(--bg-card); color: var(--text-primary); }
        .sidebar-nav a.active { background: var(--bg-card); color: var(--accent); border: 1px solid rgba(233, 177, 163, 0.15); box-shadow: 0 0 20px rgba(233, 177, 163, 0.04); }
        .sidebar-footer { border-top: 1px solid var(--border); padding-top: 20px; margin-top: 8px; }
        .sidebar-footer .user-card { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: var(--radius-sm); }
        .sidebar-footer .user-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-secondary)); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 15px; color: var(--bg-primary); flex-shrink: 0; }
        .sidebar-footer .user-info { flex: 1; min-width: 0; }
        .sidebar-footer .user-info .name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
        .sidebar-footer .user-info .email { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>

      <aside className="sidebar hidden lg:flex" role="navigation" aria-label="Основная навигация">
        {sidebarContent()}
      </aside>

      <div className={`drawer-overlay lg:hidden ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />

      <div className={`lg:hidden fixed top-0 left-0 bottom-0 w-[80vw] max-w-[280px] z-[96] bg-[var(--bg-secondary)] backdrop-blur-[20px] border-r border-[var(--border)] rounded-r-[16px] p-4 flex flex-col gap-2 shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent(() => setDrawerOpen(false))}
      </div>

      <nav className="bottom-nav" role="navigation" aria-label="Мобильная навигация">
        {bottomLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "active" : ""}
          >
            <i className={item.icon} />
            <span className="nav-label-mobile">{item.label}</span>
          </Link>
        ))}
        <a href="#" id="mobileMenuToggle" onClick={(e) => { e.preventDefault(); setDrawerOpen(true); }}>
          <i className="fa-solid fa-bars" />
          <span className="nav-label-mobile">Меню</span>
        </a>
      </nav>

      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 z-80 flex items-center justify-between px-4 bg-[rgba(15,15,19,0.85)] backdrop-blur-[16px] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawerOpen(true)} className="text-xl p-1 -ml-1" aria-label="Меню">
            <i className="fa-solid fa-bars" />
          </button>
          <Link href="/dashboard" className="font-bold text-sm tracking-wide">
            Fin<span style={{ color: "var(--accent)" }}>ly</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] text-[var(--bg-primary)] flex items-center justify-center text-xs font-bold">
            {username.charAt(0).toUpperCase()}
          </span>
        </div>
      </header>

      <button
        onClick={() => setShowNewTx(true)}
        className={`fab ${showFab ? "visible" : ""}`}
        aria-label="Новая операция"
      >
        <i className="fa-solid fa-plus" />
      </button>

      {showNewTx && <NewTransactionModal onClose={() => setShowNewTx(false)} />}
    </>
  );
}
