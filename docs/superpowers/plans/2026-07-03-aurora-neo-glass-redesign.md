# Aurora Neo-Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Aurora neo-glass visual redesign across all FinTracker pages preserving all functionality.

**Architecture:** Layer-first: global CSS theme (glass, colors, fonts, animations) → shared components (toast, empty state, nav) → page-level updates → performance optimization. Each layer builds on the previous.

**Tech Stack:** Next.js 16 (Turbopack), TypeScript, Tailwind CSS, Recharts, react-window

## Global Constraints
- All existing API routes, database schema, and business logic must remain unchanged
- All 59 existing tests must pass after each phase
- No new pages — only visual changes to existing ones
- Fonts: Onest (body/headings) + DM Mono (numbers) — both from `@fontsource`
- All CSS changes in `src/app/globals.css` or Tailwind utility classes
- React.memo only for components that re-render on parent state change without prop changes

---

### Task 1: Global CSS Foundation — fonts, variables, glass cards, animations

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nothing
- Produces: CSS variables `--bg-primary`, `--accent`, etc.; `.card` glass styles; `@keyframes` animations; updated media queries

- [ ] **Step 1: Replace font imports**

In `src/app/globals.css`, replace the Lilex + Martian Mono imports with Onest + DM Mono:

```css
@import "tailwindcss";
@import "@fontsource/onest/400.css";
@import "@fontsource/onest/500.css";
@import "@fontsource/onest/600.css";
@import "@fontsource/onest/700.css";
@import "@fontsource/dm-mono/400.css";
@import "@fontsource/dm-mono/500.css";
```

- [ ] **Step 2: Update CSS variables**

```css
:root {
  --bg-primary: #0f0f13;
  --bg-secondary: #15151e;
  --bg-card: rgba(255,255,255,0.04);
  --accent: #E9B1A3;
  --accent-hover: #d49a8a;
  --accent-secondary: #fbbf24;
  --text-primary: #f1f1f3;
  --text-secondary: #9b9ba7;
  --text-muted: #5c5c6a;
  --border: rgba(255,255,255,0.06);
  --glass-border: rgba(255,255,255,0.08);
  --glass-blur: 12px;
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
}
```

- [ ] **Step 3: Update body styles**

```css
body {
  background-color: #0f0f13;
  background-image: /* keep existing 12-layer radial gradient */;
  background-attachment: fixed;
  color: var(--text-primary);
  font-family: 'Onest', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Copy the existing 12-layer gradient from current code. Remove the `text-shadow: 0 1px 3px` from body.

- [ ] **Step 4: Update heading styles**

Remove the text-shadow from `strong, b, h1-h6, th, label, .font-bold, .font-medium`. Change font-family to 'Onest':

```css
strong, b, h1, h2, h3, h4, h5, h6, th, label, .font-bold, .font-medium {
  font-family: 'Onest', system-ui, -apple-system, sans-serif;
  font-weight: 700;
}
```

- [ ] **Step 5: Rewrite .card with glass styles**

```css
.card {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 2px 20px rgba(0,0,0,0.2);
  overflow: hidden;
  min-width: 0;
}

.card > * {
  min-width: 0;
}
```

- [ ] **Step 6: Update button styles**

```css
.btn {
  font-family: 'Onest', system-ui, -apple-system, sans-serif;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  border-radius: 10px;
  font-weight: 500;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--accent);
  color: var(--bg-primary);
}

.btn-primary:hover {
  background-color: var(--accent-hover);
  box-shadow: 0 4px 16px rgba(233, 177, 163, 0.3);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary);
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(4px);
}

.btn-secondary:hover {
  background: rgba(255,255,255,0.1);
  border-color: var(--accent);
  transform: translateY(-1px);
}
```

- [ ] **Step 7: Update input/textarea styles**

```css
input, textarea {
  font-family: 'Onest', system-ui, -apple-system, sans-serif;
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  width: 100%;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus, textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(233, 177, 163, 0.12);
}
```

- [ ] **Step 8: Add keyframe animations**

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 4px 16px rgba(233, 177, 163, 0.4); transform: scale(1); }
  50% { box-shadow: 0 4px 24px rgba(233, 177, 163, 0.6); transform: scale(1.08); }
}

@keyframes spin-in {
  from { opacity: 0; transform: scale(0.95) rotate(-3deg); }
  to { opacity: 1; transform: scale(1) rotate(0); }
}

@keyframes count-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in { animation: fade-in 0.3s ease-out; }
.animate-slide-up { animation: slide-up 0.4s ease-out; }
.animate-spin-in { animation: spin-in 0.25s ease-out; }
.animate-count-up { animation: count-up 0.6s ease-out; }
```

- [ ] **Step 9: Update bottom nav styles**

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  min-height: 64px;
  background: rgba(21, 21, 30, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: flex-start;
  justify-content: space-around;
  z-index: 90;
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom, 12px));
}

.bottom-nav a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 4px;
  border-radius: 8px;
  font-size: 0.55rem;
  line-height: 1.15;
  color: var(--text-muted);
  text-decoration: none;
  transition: all 0.2s;
  min-width: 0;
  max-width: 64px;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav a.active {
  color: var(--accent);
  transform: scale(1.05);
}

.bottom-nav a.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
}

.bottom-nav a:not(.active):hover {
  transform: scale(1.1);
  color: var(--text-secondary);
}

.bottom-nav a span.icon {
  font-size: 1.2rem;
  line-height: 1;
}
```

- [ ] **Step 10: Update drawer styles**

```css
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 95;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.drawer-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.drawer-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 80vw;
  max-width: 280px;
  background: rgba(21, 21, 30, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255,255,255,0.06);
  border-radius: 0 16px 16px 0;
  z-index: 96;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transform: translateX(-100%);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  box-shadow: 4px 0 24px rgba(0,0,0,0.4);
}

.drawer-panel.open {
  transform: translateX(0);
}

.drawer-panel a.active-link {
  border-left: 3px solid var(--accent);
  padding-left: calc(0.75rem - 3px);
}
```

- [ ] **Step 11: Update FAB styles with pulse**

```css
.fab {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0));
  right: 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--accent);
  color: var(--bg-primary);
  border: none;
  box-shadow: 0 4px 16px rgba(233, 177, 163, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  z-index: 85;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s;
  opacity: 0;
  transform: scale(0.8);
  pointer-events: none;
}

.fab.visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.fab.pulse {
  animation: pulse-glow 2s ease-in-out 3;
}

.fab.active {
  transform: scale(1) rotate(45deg);
}

.fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(233, 177, 163, 0.5);
}
```

- [ ] **Step 12: Add global transition and responsive rules**

```css
* {
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}

@media (max-width: 768px) {
  main {
    padding: 1rem !important;
    padding-bottom: calc(80px + env(safe-area-inset-bottom, 0)) !important;
  }

  .card {
    padding: 1rem;
  }
}

@media (max-width: 400px) {
  .bottom-nav a span:not(.icon) {
    display: none;
  }
  .bottom-nav a { font-size: 0; gap: 0; padding: 8px 6px; }
  .bottom-nav a span.icon { font-size: 1.3rem; }
}
```

- [ ] **Step 13: Install font packages and build**

Run:
```bash
npm install @fontsource/onest @fontsource/dm-mono
npm run build
```

Expected: build succeeds, fonts are bundled.

---

### Task 2: Toast System

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/app/globals.css` (add toast styles)

**Interfaces:**
- Consumes: CSS variables for colors
- Produces: `useToast() → { toast, success, error, info }`; `<ToastProvider>`

- [ ] **Step 1: Write Toast.tsx**

```tsx
"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: useCallback((msg: string) => addToast(msg, "success"), [addToast]),
    error: useCallback((msg: string) => addToast(msg, "error"), [addToast]),
    info: useCallback((msg: string) => addToast(msg, "info"), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type} pointer-events-auto`}
            onClick={() => removeToast(t.id)}
          >
            <span>{t.message}</span>
            <button className="toast-close">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 2: Add toast styles to globals.css**

```css
.toast {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-family: 'Onest', system-ui, -apple-system, sans-serif;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  animation: toast-in 0.3s ease-out;
  max-width: 360px;
  border: 1px solid rgba(255,255,255,0.08);
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}

.toast-success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
  border-color: rgba(34, 197, 94, 0.3);
}

.toast-error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  border-color: rgba(239, 68, 68, 0.3);
}

.toast-info {
  background: rgba(233, 177, 163, 0.15);
  color: var(--accent);
  border-color: rgba(233, 177, 163, 0.3);
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.2rem;
  padding: 0;
  line-height: 1;
  opacity: 0.6;
}

.toast-close:hover {
  opacity: 1;
}
```

- [ ] **Step 3: Wire ToastProvider into root layout**

```tsx
// src/app/layout.tsx
import ToastProvider from "@/components/Toast";

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <ClientSessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ClientSessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: build succeeds.

---

### Task 3: EmptyState Component

**Files:**
- Create: `src/components/EmptyState.tsx`

**Interfaces:**
- Consumes: CSS animations (`.animate-slide-up`)
- Produces: `<EmptyState icon title description action? />`

- [ ] **Step 1: Write EmptyState.tsx**

```tsx
import Link from "next/link";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-slide-up">
      <span className="text-5xl mb-4 block">{icon}</span>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-6">
        {description}
      </p>
      {action && (
        action.href ? (
          <Link href={action.href} className="btn btn-primary">
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="btn btn-primary">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: build succeeds.

---

### Task 4: Navbar Rewrite — Top Bar + Bottom Nav + Drawer

**Files:**
- Modify: `src/components/Navbar.tsx` (full rewrite)
- Modify: `src/app/(dashboard)/layout.tsx` (remove sidebar layout, add top bar padding)

**Interfaces:**
- Consumes: CSS classes from Task 1 (`.bottom-nav`, `.drawer-*`, `.fab`)
- Produces: updated layout with fixed top bar, same navigation links

- [ ] **Step 1: Rewrite Navbar.tsx**

Full rewrite. Remove desktop sidebar entirely. Add:
- Top bar (visible on all screens): fixed, `h-14`, glass bg, left hamburger + title, right avatar + dropdown
- Bottom nav (mobile only): same 5 items as before
- Drawer (mobile): same content as old sidebar
- FAB: keep as-is

```tsx
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
            <span className="text-xs text-[var(--accent-secondary)]" title="Администратор">🛡️</span>
          )}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors"
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
        className={`fab md:hidden ${showFab ? "visible" : ""}`}
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
```

- [ ] **Step 2: Update dashboard layout**

```tsx
// src/app/(dashboard)/layout.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div>
      <Navbar role={session.user.role} username={session.user.username} />
      <main className="flex-1 p-6 pt-[calc(3.5rem+1rem)] overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

Note: `pt-[calc(3.5rem+1rem)]` = 56px (top bar height) + 16px (padding offset).

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds, navigation works on desktop and mobile.

---

### Task 5: Replace Empty States with EmptyState Component

**Files:**
- Modify: `src/app/(dashboard)/accounts/page.tsx`
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/matches/page.tsx`

**Interfaces:**
- Consumes: `<EmptyState>` from Task 3

- [ ] **Step 1: Accounts page — replace empty state**

In `src/app/(dashboard)/accounts/page.tsx`, replace the manual empty state block at line ~49-55:

```tsx
// Before:
{accounts.length === 0 ? (
  <div className="card text-center py-12">
    <div className="text-4xl mb-3">💳</div>
    <p className="text-[var(--text-secondary)] mb-4">У вас ещё нет счетов</p>
    <Link href="/accounts/new" className="btn btn-primary">
      Создать первый счёт
    </Link>
  </div>
) : (

// After:
{accounts.length === 0 ? (
  <EmptyState
    icon="💳"
    title="Нет счетов"
    description="Добавьте первый счёт, чтобы начать отслеживать финансы"
    action={{ label: "Создать счёт", href: "/accounts/new" }}
  />
) : (
```

And add the import at the top of the file:
```tsx
import EmptyState from "@/components/EmptyState";
```

- [ ] **Step 2: Transactions page — replace empty state**

In `src/app/(dashboard)/transactions/page.tsx`, find the "Нет операций" empty state and replace:

```tsx
// Before:
{loading ? (
  <p className="text-[var(--text-muted)]">Загрузка...</p>
) : txs.length === 0 ? (
  <p className="text-[var(--text-muted)] text-center py-8">Нет операций</p>
) : (

// After:
{loading ? (
  <p className="text-[var(--text-muted)]">Загрузка...</p>
) : txs.length === 0 ? (
  <EmptyState
    icon="📋"
    title="Нет операций"
    description="Добавьте первую операцию, чтобы увидеть историю"
    action={{ label: "Новая операция", onClick: () => {} }}  // will wire later
  />
) : (
```

And add the import:
```tsx
import EmptyState from "@/components/EmptyState";
```

- [ ] **Step 3: Dashboard page — replace "Нет данных" in pie chart**

In `src/app/(dashboard)/dashboard/page.tsx`, replace the "Нет данных" text for the pie chart:

```tsx
// Before:
{pieData.length > 0 ? (
  ...chart...
) : (
  <p className="text-sm text-[var(--text-muted)]">Нет данных</p>
)}

// After:
{pieData.length > 0 ? (
  ...chart...
) : (
  <EmptyState
    icon="📊"
    title="Нет данных"
    description="Добавьте счета и операции, чтобы увидеть распределение"
  />
)}
```

Add the import at the top.

- [ ] **Step 4: Matches page — replace empty state**

In `src/app/(dashboard)/matches/page.tsx`, replace:

```tsx
// Before:
{matches.length === 0 ? (
  <div className="card text-center py-12">
    <div className="text-3xl mb-2">✅</div>
    <p className="text-[var(--text-secondary)]">Нет неподтверждённых связей</p>
    ...
  </div>
) : (

// After:
{matches.length === 0 ? (
  <EmptyState
    icon="🔗"
    title="Нет связей"
    description="Связи создаются автоматически после сканирования блокчейна. Пока всё чисто."
  />
) : (
```

Add the import.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: build succeeds.

---

### Task 6: Wire Toasts to Actions

**Files:**
- Modify: `src/app/(dashboard)/matches/page.tsx`
- Modify: `src/app/(dashboard)/accounts/[id]/page.tsx`
- Modify: `src/components/NewTransactionModal.tsx`

**Interfaces:**
- Consumes: `useToast()` from Task 2

- [ ] **Step 1: Matches page — replace actionMsg with toast**

In `src/app/(dashboard)/matches/page.tsx`:
- Import `useToast` from `@/components/Toast`
- Remove `actionMsg` state and JSX
- In `handleAction`, replace `setActionMsg(...)` + `setTimeout` with `success(...)` / `error(...)`

```tsx
import { useToast } from "@/components/Toast";

export default function MatchesPage() {
  const toast = useToast();
  // ... remove: const [actionMsg, setActionMsg] = useState("");
  // ... in handleAction:
  async function handleAction(matchId: number, action: "confirm" | "reject") {
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, action }),
    });
    if (res.ok) {
      setMatches(matches.filter((m) => m.id !== matchId));
      toast.success(action === "confirm" ? "✅ Связь подтверждена" : "❌ Связь отклонена");
    } else {
      toast.error("Ошибка при обработке связи");
    }
  }
```

Remove the `actionMsg` JSX block (`{actionMsg && <div className="card...">...}</div>`).

- [ ] **Step 2: Accounts/[id] — toast on sync/credential actions**

In `src/app/(dashboard)/accounts/[id]/page.tsx`:
```tsx
import { useToast } from "@/components/Toast";

export default function AccountDetailPage() {
  const toast = useToast();
  // ...
  // In saveCredentials success:
  toast.success("🔑 API-ключи сохранены");
  // In deleteCredentials success:
  toast.success("🔑 API-ключи удалены");
  // In startSync success:
  toast.success(data.error || "Синхронизация завершена");
  // In startSync error:
  toast.error(data.error || "Ошибка синхронизации");
```

- [ ] **Step 3: NewTransactionModal — toast on save**

In `src/components/NewTransactionModal.tsx`:
```tsx
import { useToast } from "@/components/Toast";

export default function NewTransactionModal({ onClose }: Props) {
  const toast = useToast();
  // ...
  // In handleSubmit, replace window.location.reload() with toast + onClose:
  if (res.ok) {
    toast.success("✅ Операция сохранена");
    onClose();
    window.location.reload(); // keep reload for data refresh
  } else {
    const data = await res.json();
    toast.error(data.error || "Ошибка сохранения");
  }
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: build succeeds.

---

### Task 7: Micro-interactions — Select, FAB, Modal, Transaction Hover

**Files:**
- Modify: `src/components/Select.tsx` (animated options)
- Modify: `src/components/Navbar.tsx` (FAB pulse on first visit)
- Modify: `src/components/NewTransactionModal.tsx` (modal entrance animation)
- Modify: `src/app/globals.css` (transaction row hover, modal animations)

- [ ] **Step 1: Update Select.tsx with staggered option animation**

In `src/components/Select.tsx`, add `style` with `--index` to each option in the dropdown list:

```tsx
// Inside the options map, add:
{children.map((child, i) => (
  <div
    key={i}
    className="option"
    style={{ transitionDelay: `${i * 30}ms` }}
    onClick={() => handleSelect(child.props.value)}
  >
    {child.props.children}
  </div>
))}
```

And in `globals.css`, add styles for the option entrance:
```css
.Select-dropdown .option {
  opacity: 0;
  transform: translateY(-4px);
  animation: option-enter 0.2s ease-out forwards;
}

@keyframes option-enter {
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Add FAB pulse on first visit**

In `Navbar.tsx`, add a state `hasPulsed` that tracks whether the pulse animation has played:

```tsx
const [hasPulsed, setHasPulsed] = useState(false);

useEffect(() => {
  if (showFab && !hasPulsed) {
    const timer = setTimeout(() => setHasPulsed(true), 3000);
    return () => clearTimeout(timer);
  }
}, [showFab, hasPulsed]);

// In the FAB JSX:
<button
  onClick={() => setShowNewTx(true)}
  className={`fab md:hidden ${showFab ? "visible" : ""} ${showFab && !hasPulsed ? "pulse" : ""}`}
  aria-label="Новая операция"
>
  +
</button>
```

- [ ] **Step 3: Add modal entrance animation**

In `NewTransactionModal.tsx`, wrap the modal panel container with:

```tsx
// Replace the outer div className:
<div className="fixed inset-0 bg-black/50 backdrop-blur-[4px] flex items-center justify-center z-50 p-4 animate-fade-in" ...>
  <div className="bg-[rgba(21,21,30,0.96)] backdrop-blur-[20px] rounded-xl w-full max-w-lg shadow-2xl border border-[rgba(255,255,255,0.06)] animate-spin-in">
    ...
  </div>
</div>
```

- [ ] **Step 4: Add transaction row hover effects in globals.css**

```css
.tx-row {
  transition: background-color 0.2s, transform 0.15s;
  border-radius: 8px;
}

.tx-row:hover {
  background: rgba(233, 177, 163, 0.06);
}

.tx-row .tx-actions {
  opacity: 0;
  transform: translateX(4px);
  transition: opacity 0.2s, transform 0.2s;
}

.tx-row:hover .tx-actions {
  opacity: 1;
  transform: translateX(0);
}

.tx-row .tx-actions button:nth-child(2) {
  transition-delay: 50ms;
}
```

Apply `className="tx-row"` to transaction rows and `className="tx-actions"` to the actions container in `transactions/page.tsx` and `dashboard/page.tsx`.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: build succeeds.

---

### Task 8: Dashboard + Charts — Counter Animation, Pie Animation

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/stats/page.tsx`

- [ ] **Step 1: Add animated counter for capital**

In `dashboard/page.tsx`, create a simple counter component or inline effect:

```tsx
function AnimatedNumber({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 600;
    const step = Math.max(1, value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
```

- [ ] **Step 2: Update capital card in dashboard**

```tsx
<div className="card md:col-span-1">
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm text-[var(--text-secondary)]">Общий капитал</span>
    <span className="text-xs text-[var(--text-muted)]">{baseCurrency}</span>
  </div>
  <div className="text-3xl md:text-4xl font-bold font-mono" style={{ fontFamily: "'DM Mono', monospace" }}>
    {summary
      ? `${summary.totalCapitalConverted.toLocaleString(...)}`
      : "Загрузка..."}
  </div>
  {summary && (
    <div className="flex gap-4 mt-3 text-sm">
      <span className="text-[var(--success)] flex items-center gap-1">
        <span className="text-xs">▲</span>
        +{summary.incomeConverted.toLocaleString(...)} {sym(baseCurrency)}
      </span>
      <span className="text-[var(--danger)] flex items-center gap-1">
        <span className="text-xs">▼</span>
        −{summary.expenseConverted.toLocaleString(...)} {sym(baseCurrency)}
      </span>
    </div>
  )}
</div>
```

- [ ] **Step 3: Add Pie animation to dashboard and stats**

In `dashboard/page.tsx` and `stats/page.tsx`, update `<Pie>`:

```tsx
<Pie
  isAnimationActive={true}
  animationBegin={0}
  animationDuration={1200}
  animationEasing="ease-out"
  data={pieData}
  dataKey="value"
  nameKey="name"
  cx="50%"
  cy="50%"
  outerRadius={80}
  innerRadius={40}
>
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: build succeeds.

---

### Task 9: Performance — react-window + React.memo

**Files:**
- Modify: `package.json` (add react-window)
- Modify: `src/components/NewTransactionModal.tsx` (React.memo)
- Modify: `src/app/(dashboard)/transactions/page.tsx` (virtualized list)

- [ ] **Step 1: Install react-window**

```bash
npm install react-window @types/react-window
```

- [ ] **Step 2: Wrap NewTransactionModal in React.memo**

```tsx
// At the export:
export default React.memo(NewTransactionModal);
```

Add import: `import React from "react";`

- [ ] **Step 3: Create TransactionRow component for virtualized list**

Create or extract a `TransactionRow` component in `transactions/page.tsx`:

```tsx
const TransactionRow = React.memo(function TransactionRow({ tx, style }: { tx: Transaction; style: React.CSSProperties }) {
  return (
    <div style={style} className="tx-row flex items-center justify-between px-1 py-2.5">
      {/* same as current tx rendering */}
    </div>
  );
});
```

- [ ] **Step 4: Replace map with FixedSizeList in transactions page**

```tsx
import { FixedSizeList } from "react-window";

// Replace:
{txs.map((tx) => <div key={tx.id} className="tx-row ...">...</div>)}

// With:
<FixedSizeList height={600} itemCount={txs.length} itemSize={48} width="100%">
  {({ index, style }) => <TransactionRow tx={txs[index]} style={style} />}
</FixedSizeList>
```

- [ ] **Step 5: Build and run tests**

```bash
npm run build && npm test
```

Expected: build succeeds, all 59 tests pass.

---

### Task 10: Final Polish — Audit and Test

**Files:** All modified files

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: build succeeds with no warnings.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: 59/59 tests pass.

- [ ] **Step 3: Manual checklist**
  - Verify all pages render without visual glitches
  - Verify mobile bottom nav works on < 400px screens
  - Verify drawer opens/closes smoothly
  - Verify top bar dropdown works
  - Verify toasts appear and auto-dismiss
  - Verify Select dropdown animation
  - Verify FAB pulse on dashboard
  - Verify modal entrance animation
  - Verify counter animation on dashboard capital
  - Verify pie chart animation on dashboard and stats
  - Verify empty states appear on accounts, transactions, matches
  - Verify fixed top bar doesn't overlap content on any page
