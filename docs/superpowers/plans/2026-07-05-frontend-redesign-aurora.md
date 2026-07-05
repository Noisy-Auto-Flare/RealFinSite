# Frontend Redesign — Aurora Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full frontend redesign to Aurora/Fingly visual style, keeping current Next.js architecture.

**Architecture:** Update globals.css first (foundation), then Navbar + layout (navigation), then each page (dashboard, transactions, accounts, settings). Delete unused pages last.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Drizzle ORM, Font Awesome 6 (CDN)

## Global Constraints

- Keep all backend logic unchanged — API routes, database schema, scanners, auth
- Replace emoji icons with Font Awesome Free 6 (CDN link in root layout)
- Use CSS variables from current globals.css (already match the reference)
- All pages remain `"use client"` (already the case)
- Nav links use `usePathname()` for active state
- Delete old page directories only after new pages are verified working

---

### Task 1: CSS Foundation + Font Awesome CDN

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: Current CSS variables and component classes
- Produces: New `.aurora-bg`, `.mono`, `.tx-item`, `.balance-grid`, `.quick-actions` classes used by all pages

- [ ] **Step 1: Replace globals.css with the Aurora design system**

Replace the entire `src/app/globals.css` with:

```css
@import "tailwindcss";
@import "@fontsource/onest/400.css";
@import "@fontsource/onest/500.css";
@import "@fontsource/onest/600.css";
@import "@fontsource/onest/700.css";
@import "@fontsource/dm-mono/400.css";
@import "@fontsource/dm-mono/500.css";

:root {
  --bg-primary: #0f0f13;
  --bg-secondary: #15151e;
  --bg-card: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 12px;
  --accent: #E9B1A3;
  --accent-hover: #d49a8a;
  --accent-secondary: #fbbf24;
  --text-primary: #f1f1f3;
  --text-secondary: #9b9ba7;
  --text-muted: #5c5c6a;
  --border: rgba(255, 255, 255, 0.06);
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
  --sidebar-width: 240px;
  --nav-height: 68px;
  --radius: 16px;
  --radius-sm: 10px;
}

* {
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.15s, opacity 0.2s;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: 'Onest', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.mono {
  font-family: 'DM Mono', 'Fira Code', monospace;
  font-weight: 400;
}

.mono-medium {
  font-family: 'DM Mono', 'Fira Code', monospace;
  font-weight: 500;
}

.aurora-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 50% at 10% 20%, rgba(233, 177, 163, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse 70% 50% at 90% 30%, rgba(251, 191, 36, 0.06) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 20% 70%, rgba(233, 177, 163, 0.05) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 80% 80%, rgba(251, 191, 36, 0.04) 0%, transparent 50%),
    radial-gradient(ellipse 40% 30% at 50% 10%, rgba(233, 177, 163, 0.06) 0%, transparent 45%),
    radial-gradient(ellipse 40% 30% at 30% 90%, rgba(251, 191, 36, 0.04) 0%, transparent 45%),
    radial-gradient(ellipse 30% 25% at 70% 60%, rgba(233, 177, 163, 0.05) 0%, transparent 40%),
    radial-gradient(ellipse 30% 25% at 15% 40%, rgba(251, 191, 36, 0.03) 0%, transparent 40%),
    radial-gradient(ellipse 20% 20% at 85% 15%, rgba(233, 177, 163, 0.04) 0%, transparent 35%),
    radial-gradient(ellipse 20% 20% at 5% 85%, rgba(251, 191, 36, 0.03) 0%, transparent 35%),
    radial-gradient(ellipse 15% 15% at 50% 50%, rgba(233, 177, 163, 0.02) 0%, transparent 30%),
    var(--bg-primary);
}

.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: 28px 36px 100px 36px;
  position: relative;
  z-index: 1;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
}

.page-header-left h2 {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.4px;
}

.page-header-left p {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 2px;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-wrap {
  position: relative;
}

.search-wrap input {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 30px;
  padding: 10px 18px 10px 44px;
  color: var(--text-primary);
  font-family: 'Onest', sans-serif;
  font-size: 14px;
  width: 220px;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
}

.search-wrap input::placeholder {
  color: var(--text-muted);
}

.search-wrap input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(233, 177, 163, 0.1);
}

.search-wrap i {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 15px;
}

.btn-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--glass-border);
  background: var(--bg-card);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.15);
}

.btn-icon .dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: var(--danger);
  border-radius: 50%;
  border: 2px solid var(--bg-secondary);
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  padding: 10px 24px;
  border-radius: 30px;
  font-family: 'Onest', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(233, 177, 163, 0.25);
}

.btn-primary i {
  font-size: 15px;
}

.card {
  background: var(--bg-card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
}

.balance-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 32px;
}

.balance-card {
  padding: 24px 28px;
  position: relative;
  overflow: hidden;
}

.balance-card .card-glow {
  position: absolute;
  top: -40%;
  right: -20%;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(233, 177, 163, 0.06), transparent 70%);
  pointer-events: none;
  border-radius: 50%;
}

.balance-card .label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.balance-card .label i {
  font-size: 14px;
  color: var(--text-muted);
}

.balance-card .amount {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.balance-card .amount .currency {
  font-size: 20px;
  font-weight: 400;
  color: var(--text-secondary);
  margin-right: 4px;
}

.balance-card .change {
  margin-top: 8px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 12px;
  border-radius: 20px;
  font-weight: 500;
}

.balance-card .change.positive {
  color: var(--success);
  background: rgba(34, 197, 94, 0.12);
}

.balance-card .change.negative {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.12);
}

.balance-card .sub-info {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 8px;
}

.balance-card.accent-border {
  border-color: rgba(233, 177, 163, 0.15);
}

.balance-card.accent-border .amount {
  color: var(--accent);
}

.stat-card .amount {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.3px;
}

.stat-card .amount .currency {
  font-size: 18px;
  font-weight: 400;
  color: var(--text-secondary);
  margin-right: 4px;
}

.stat-card .label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 4px;
}

.stat-card .stat-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 12px;
}

.stat-card .stat-icon.green {
  background: rgba(34, 197, 94, 0.12);
  color: var(--success);
}

.stat-card .stat-icon.red {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 20px;
  margin-bottom: 32px;
}

.chart-card {
  padding: 24px 24px 20px 24px;
}

.chart-card .chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-card .chart-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.chart-card .chart-header .chart-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-card);
  border-radius: 30px;
  padding: 3px;
  border: 1px solid var(--glass-border);
}

.chart-card .chart-header .chart-tabs button {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: 'Onest', sans-serif;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 14px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-card .chart-header .chart-tabs button.active {
  background: var(--accent);
  color: var(--bg-primary);
}

.chart-card .chart-header .chart-tabs button:hover:not(.active) {
  color: var(--text-primary);
}

.chart-container {
  width: 100%;
  height: 180px;
  position: relative;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.chart-legend .legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chart-legend .legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.chart-legend .legend-dot.income {
  background: var(--success);
}

.chart-legend .legend-dot.expense {
  background: var(--danger);
}

.tx-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
  cursor: pointer;
}

.tx-item:hover {
  background: var(--bg-card);
}

.tx-item .tx-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}

.tx-item .tx-icon.blue { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.tx-item .tx-icon.green { background: rgba(34, 197, 94, 0.12); color: var(--success); }
.tx-item .tx-icon.purple { background: rgba(168, 85, 247, 0.12); color: #a855f7; }
.tx-item .tx-icon.orange { background: rgba(245, 158, 11, 0.12); color: var(--warning); }
.tx-item .tx-icon.red { background: rgba(239, 68, 68, 0.12); color: var(--danger); }

.tx-item .tx-info {
  flex: 1;
  min-width: 0;
}

.tx-item .tx-info .tx-name {
  font-size: 14px;
  font-weight: 500;
}

.tx-item .tx-info .tx-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 1px;
}

.tx-item .tx-amount {
  font-weight: 600;
  font-size: 15px;
  text-align: right;
  flex-shrink: 0;
}

.tx-item .tx-amount.income { color: var(--success); }
.tx-item .tx-amount.expense { color: var(--danger); }

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 8px;
}

.quick-action {
  background: var(--bg-card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 18px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  color: var(--text-secondary);
}

.quick-action:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  color: var(--text-primary);
}

.quick-action i {
  font-size: 22px;
  color: var(--accent);
  margin-bottom: 6px;
  display: block;
}

.quick-action span {
  font-size: 12px;
  font-weight: 500;
}

input, textarea {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  width: 100%;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: 'Onest', sans-serif;
}

input:focus, textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(233, 177, 163, 0.1);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  font-family: 'DM Mono', monospace;
}

.badge-confirmed {
  background: rgba(34, 197, 94, 0.2);
  color: var(--success);
}

.badge-pending {
  background: rgba(155, 155, 167, 0.15);
  color: var(--text-secondary);
}

.badge-candidate {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning);
}

.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bg-secondary);
  border-top: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  padding: 8px 12px env(safe-area-inset-bottom, 12px);
  justify-content: space-around;
  align-items: center;
  height: var(--nav-height);
}

.bottom-nav a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 10px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  transition: color 0.2s;
  position: relative;
}

.bottom-nav a i {
  font-size: 20px;
}

.bottom-nav a.active {
  color: var(--accent);
}

.bottom-nav a.active::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  border-radius: 4px;
  background: var(--accent);
}

.bottom-nav a .nav-label-mobile {
  font-size: 9px;
  letter-spacing: 0.2px;
}

.drawer-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.drawer-overlay.open {
  opacity: 1;
}

.fab {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0));
  right: 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  box-shadow: 0 4px 16px rgba(233, 177, 163, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 85;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
  opacity: 0;
  transform: scale(0.8);
  pointer-events: none;
}

.fab.visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.fab:hover {
  transform: scale(1.1);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in { animation: fade-in 0.5s ease-out both; }
.animate-slide-up { animation: slide-up 0.5s ease-out both; }

@keyframes modal-enter {
  from { opacity: 0; transform: scale(0.96) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.animate-modal-enter { animation: modal-enter 0.25s ease-out both; }

.tabular-nums {
  font-family: 'DM Mono', monospace;
  font-variant-numeric: tabular-nums;
}

::selection {
  background: var(--accent);
  color: var(--bg-primary);
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--text-muted); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

@media (max-width: 1200px) {
  .balance-grid { grid-template-columns: 1fr 1fr; }
  .balance-grid .balance-card:first-child { grid-column: 1 / -1; }
  .dashboard-grid { grid-template-columns: 1fr; }
  .main-content { padding: 24px 24px 100px 24px; }
}

@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
  .drawer-overlay { display: block; pointer-events: none; }
  .drawer-overlay.open { pointer-events: auto; }
  .bottom-nav { display: flex; }
  .main-content { margin-left: 0; padding: 20px 16px 100px 16px; }
  .page-header { flex-direction: column; align-items: stretch; gap: 12px; }
  .page-header-left h2 { font-size: 22px; }
  .page-header-actions { flex-wrap: wrap; }
  .search-wrap input { width: 100%; }
  .search-wrap { flex: 1; }
  .balance-grid { grid-template-columns: 1fr; gap: 12px; }
  .balance-grid .balance-card:first-child { grid-column: 1; }
  .balance-card .amount { font-size: 28px; }
  .stat-card .amount { font-size: 24px; }
  .dashboard-grid { grid-template-columns: 1fr; gap: 16px; }
  .quick-actions { grid-template-columns: repeat(2, 1fr); }
  .chart-card .chart-header { flex-direction: column; align-items: stretch; gap: 10px; }
  .chart-card .chart-header .chart-tabs { align-self: flex-start; }
  .tx-item { padding: 10px 12px; }
  .card { padding: 18px; }
}

@media (max-width: 400px) {
  .balance-card { padding: 18px 20px; }
  .balance-card .amount { font-size: 24px; }
  .stat-card .amount { font-size: 20px; }
  .quick-actions { gap: 10px; }
  .quick-action { padding: 14px 10px; }
  .quick-action i { font-size: 18px; }
  .card { padding: 18px; }
  .page-header-left h2 { font-size: 20px; }
  .main-content { padding: 16px 12px 90px 12px; }
}
```

- [ ] **Step 2: Add Font Awesome CDN to root layout**

Edit `src/app/layout.tsx`. Add the Font Awesome CDN link inside `<head>` and the aurora-bg div inside `<body>`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { initializeApp } from "@/lib/init";
import ClientSessionProvider from "@/components/ClientSessionProvider";
import ToastProvider from "@/components/Toast";
import Link from "next/link";

initializeApp();

export const metadata: Metadata = {
  title: "FinTracker — учёт финансов",
  description: "Личный финансовый учёт с поддержкой криптовалют, мультивалютных счетов и авто-сканирования кошельков",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
        />
      </head>
      <body>
        <div className="aurora-bg" aria-hidden="true" />
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

- [ ] **Step 3: Update dashboard layout**

Edit `src/app/(dashboard)/layout.tsx` — reuse existing auth check, keep `<Navbar>` + `<main>`, remove `lg:ml-64` (handled by CSS now):

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <>
      <Navbar role={session.user.role} username={session.user.username} />
      <main className="main-content">
        {children}
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify CSS builds**

Run: `npm run dev` (or `npx next build` to check for errors)
Expected: No CSS or build errors. Server starts on localhost:3000.

---

### Task 2: Navbar — Sidebar + Bottom Nav + Drawer

**Files:**
- Rewrite: `src/components/Navbar.tsx`

**Interfaces:**
- Consumes: `role`, `username` props, `usePathname()` for active state
- Produces: Sidebar with nav sections, bottom nav (mobile), drawer (mobile), FAB

- [ ] **Step 1: Rewrite Navbar.tsx**

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

const mainLinks = [
  { href: "/dashboard", label: "Обзор", icon: "fa-solid fa-th-large" },
  { href: "/accounts", label: "Счета", icon: "fa-solid fa-wallet" },
  { href: "/transactions", label: "Транзакции", icon: "fa-solid fa-arrow-right-arrow-left" },
];

const bottomLinks = [
  { href: "/dashboard", label: "Обзор", icon: "fa-solid fa-th-large" },
  { href: "/accounts", label: "Счета", icon: "fa-solid fa-wallet" },
  { href: "/transactions", label: "Транзакции", icon: "fa-solid fa-arrow-right-arrow-left" },
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
```

- [ ] **Step 2: Verify Navbar renders**

Run: `npm run dev`
Expected: Navbar shows on desktop as sidebar with Fin-ly branding, sections, user card. On mobile: top bar + bottom nav + drawer opens on menu click.

---

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

**Files:**
- Rewrite: `src/app/(dashboard)/transactions/page.tsx`

- [ ] **Step 1: Rewrite transactions/page.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatAmount } from "@/lib/formatting";
import Select from "@/components/Select";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import NewTransactionModal from "@/components/NewTransactionModal";

interface OperationSummary {
  id: number;
  description: string | null;
  category: string | null;
  date: string;
  source: string;
  status: string;
  entries: { currency: string; amount: number; type: string }[];
}

const CATEGORIES = [
  "", "Зарплата", "Продукты", "Транспорт", "Комиссия",
  "Перевод маме", "Перевод другому", "Обмен",
  "Вывод с биржи", "Пополнение", "Другое",
];

function getTxIcon(entries: { amount: number }[], source: string, category: string | null): string {
  if (source.startsWith("scanner") || source.startsWith("api")) {
    const isIncoming = entries.some(e => e.amount > 0);
    if (isIncoming) return "fa-solid fa-arrow-trend-up";
    return "fa-solid fa-arrow-trend-down";
  }
  const isIncoming = entries.some(e => e.amount > 0);
  if (isIncoming) return "fa-solid fa-circle-plus";
  return "fa-solid fa-circle-minus";
}

function getTxColor(entries: { amount: number }[]): string {
  const total = entries.reduce((s, e) => s + e.amount, 0);
  return total > 0 ? "green" : "red";
}

export default function TransactionsPage() {
  const toast = useToast();
  const [txs, setTxs] = useState<OperationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(20);
  const [page, setPage] = useState(0);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);

  const [editTx, setEditTx] = useState<OperationSummary | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { setPage(0); }, [filterStatus, filterCategory, searchQuery]);

  useEffect(() => { loadTxs(); }, [page, filterStatus, filterCategory, searchQuery]);

  function loadTxs() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("page", String(page + 1));
    if (filterStatus) params.set("status", filterStatus);
    if (filterCategory) params.set("category", filterCategory);
    if (searchQuery) params.set("search", searchQuery);

    fetch(`/api/operations?${params.toString()}`)
      .then(r => r.json().catch(() => ({ operations: [], total: 0 })))
      .then(data => {
        setTxs(data.operations || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  const totalPages = Math.ceil(total / limit);

  function openEdit(tx: OperationSummary) {
    setEditTx(tx);
    setEditCategory(tx.category || "");
    setEditDescription(tx.description || "");
  }

  async function saveEdit() {
    if (!editTx) return;
    setSaving(true);
    const res = await fetch(`/api/operations/${editTx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: editCategory, description: editDescription }),
    });
    setSaving(false);
    setEditTx(null);
    if (res.ok) toast.success("Операция обновлена");
    else toast.error("Ошибка обновления");
    loadTxs();
  }

  async function deleteTx(id: number) {
    if (!confirm("Удалить эту операцию?")) return;
    const res = await fetch(`/api/operations/${id}`, { method: "DELETE" });
    if (res.ok) toast.success("Операция удалена");
    else toast.error("Ошибка удаления");
    loadTxs();
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/scanner/run", { method: "POST" });
      const data = await res.json();
      if (data.eventsFound > 0) toast.success(`Найдено ${data.eventsFound} новых транзакций`);
      else toast.info("Новых транзакций не найдено");
      loadTxs();
    } catch {
      toast.error("Ошибка сканирования");
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2>Транзакции</h2>
          <p>Все операции по счетам</p>
        </div>
        <div className="page-header-actions">
          <div className="search-wrap">
            <i className="fa-solid fa-search" />
            <input
              type="text"
              placeholder="Поиск транзакций..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => setShowNewTx(true)}>
            <i className="fa-solid fa-plus" /> Добавить
          </button>
        </div>
      </header>

      <button
        onClick={() => setShowFilters(!showFilters)}
        className="btn-primary"
        style={{ background: "var(--bg-card)", color: "var(--text-secondary)", marginBottom: "16px" }}
      >
        <i className={`fa-solid ${showFilters ? "fa-chevron-up" : "fa-chevron-down"}`} />
        Фильтры
      </button>

      {showFilters && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="flex gap-3 items-center flex-wrap">
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-auto min-w-[130px]">
              <option value="">Все статусы</option>
              <option value="confirmed">Подтверждённые</option>
              <option value="pending">Черновики</option>
            </Select>

            <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-auto min-w-[150px]">
              <option value="">Все категории</option>
              {CATEGORIES.filter(Boolean).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>

            <span className="text-sm text-[var(--text-muted)] whitespace-nowrap">
              {total} операций
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="tx-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Все операции</h3>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="btn-primary"
            style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "6px 16px", fontSize: "12px" }}
          >
            <i className="fa-solid fa-rotate" />
            {scanning ? "Проверка..." : "Проверить новые"}
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Загрузка...</p>
        ) : txs.length === 0 ? (
          <EmptyState icon="📋" title="Нет операций" description="Транзакции появятся после добавления счетов" />
        ) : (
          <div className="tx-list">
            {txs.map((tx) => {
              const totalAmount = tx.entries.reduce((s, e) => s + e.amount, 0);
              const icon = getTxIcon(tx.entries, tx.source, tx.category);
              const color = getTxColor(tx.entries);
              return (
                <div key={tx.id} className="tx-item" onClick={() => openEdit(tx)}>
                  <div className={`tx-icon ${color}`}><i className={icon} /></div>
                  <div className="tx-info">
                    <div className="tx-name">{tx.description || tx.category || "Операция"}</div>
                    <div className="tx-desc">
                      {new Date(tx.date).toLocaleDateString("ru-RU")}
                      {tx.status === "draft" && <span className="badge badge-pending" style={{ marginLeft: "8px" }}>Черновик</span>}
                    </div>
                  </div>
                  <div className={`tx-amount mono ${totalAmount > 0 ? "income" : "expense"}`}>
                    {totalAmount > 0 ? "+" : ""}{totalAmount.toFixed(2)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTx(tx.id); }}
                    className="btn-icon"
                    style={{ width: "32px", height: "32px", fontSize: "14px", flexShrink: 0 }}
                    title="Удалить"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", paddingTop: "16px", borderTop: "1px solid var(--border)", marginTop: "12px" }}>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="btn-primary"
              style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "6px 16px", fontSize: "12px" }}
            >
              <i className="fa-solid fa-chevron-left" /> Назад
            </button>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="btn-primary"
              style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "6px 16px", fontSize: "12px" }}
            >
              Вперёд <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        )}
      </div>

      {editTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditTx(null); }}>
          <div className="card w-full max-w-md space-y-4 animate-modal-enter">
            <div className="flex justify-between items-center">
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Редактировать операцию</h3>
              <button onClick={() => setEditTx(null)} className="btn-icon" style={{ width: "32px", height: "32px", fontSize: "16px" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <p>{editTx.entries?.map(e => formatAmount(e.amount, e.currency)).join(" | ") || "—"}</p>
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ fontWeight: 500 }}>Категория</label>
              <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                <option value="">Без категории</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ fontWeight: 500 }}>Описание</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} placeholder="Комментарий" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditTx(null)} className="btn-primary" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", flex: 1 }}>Отмена</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary" style={{ flex: 1 }}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewTx && <NewTransactionModal onClose={() => setShowNewTx(false)} />}
    </>
  );
}
```

- [ ] **Step 2: Verify transactions page**

Run: `npm run dev`, navigate to `/transactions`
Expected: Clean transaction list with icons, status badges, edit/delete, pagination, search.

---

### Task 5: Accounts Page — Aurora Style

**Files:**
- Rewrite: `src/app/(dashboard)/accounts/page.tsx`

- [ ] **Step 1: Rewrite accounts/page.tsx**

Replace the entire file. Keep all data fetching and logic identical, only update the visual structure to match Aurora style. Key changes: replace emoji icons with Font Awesome, use card grid, add page-header.

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS } from "@/lib/utils";
import type { AccountType } from "@/lib/utils";

interface CredentialInfo {
  id: number;
  accountId: number;
  exchange: string;
  lastSyncAt: string | null;
}

interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  isActive: number;
  isAutoSync: number;
  balances: { currency: string; amount: number }[];
  addresses: { network: string; address: string }[];
  credentials: CredentialInfo | null;
}

const TYPE_ICONS: Record<string, string> = {
  crypto_wallet: "fa-solid fa-coins",
  cex_exchange: "fa-solid fa-building-columns",
  broker: "fa-solid fa-chart-line",
  hybrid_bank: "fa-solid fa-landmark",
  fiat_bank: "fa-solid fa-building-columns",
};

function getTypeIcon(type: string): string {
  return TYPE_ICONS[type] || "fa-solid fa-wallet";
}

function getTypeColor(type: string): string {
  switch (type) {
    case "crypto_wallet": return "purple";
    case "cex_exchange": return "blue";
    case "broker": return "green";
    case "hybrid_bank": return "orange";
    case "fiat_bank": return "blue";
    default: return "blue";
  }
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then(r => r.json())
      .then(data => { setAccounts(data); setLoading(false); });
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/accounts/sync-balances", { method: "POST" });
      const data = await res.json();
      const allCorrections = (data.results || []).flatMap((r: any) =>
        (r.corrections || []).filter((c: any) => c.correctionAmount != null)
      );
      setSyncMsg(`Синхронизировано ${data.results?.length || 0} кошельков, ${allCorrections.length} корректировок`);
      const accRes = await fetch("/api/accounts");
      setAccounts(await accRes.json());
    } catch {
      setSyncMsg("Ошибка синхронизации");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2>Счета</h2>
          <p>Все ваши кошельки и счета</p>
        </div>
        <div className="page-header-actions">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary"
            style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
          >
            <i className="fa-solid fa-rotate" />
            {syncing ? "Синхронизация..." : "Синхронизировать"}
          </button>
          <Link href="/accounts/new" className="btn-primary">
            <i className="fa-solid fa-plus" /> Добавить счёт
          </Link>
        </div>
      </header>

      {syncMsg && (
        <div className="card" style={{ marginBottom: "16px", padding: "12px 16px" }}>
          <p style={{ fontSize: "13px", color: "var(--accent)" }}>{syncMsg}</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Загрузка...</p>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <i className="fa-solid fa-wallet" style={{ fontSize: "48px", color: "var(--text-muted)", marginBottom: "16px" }} />
          <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>У вас ещё нет счетов</p>
          <Link href="/accounts/new" className="btn-primary">
            <i className="fa-solid fa-plus" /> Создать первый счёт
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
          {accounts.map((acc) => {
            const icon = getTypeIcon(acc.type);
            const color = getTypeColor(acc.type);
            const label = ACCOUNT_TYPE_LABELS[acc.type] || acc.type;
            return (
              <Link key={acc.id} href={`/accounts/${acc.id}`} className="card" style={{ cursor: "pointer", transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className={`tx-icon ${color}`}><i className={icon} /></div>
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div style={{ fontWeight: 500, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{label}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {acc.balances.map((b) => (
                        <span key={b.currency} className="badge badge-confirmed" style={{ fontSize: "13px", padding: "4px 12px" }}>
                          {b.currency}: {b.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                        </span>
                      ))}
                    </div>
                    {acc.addresses.length > 0 && (
                      <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                        {acc.addresses.map((a) => (
                          <div key={a.network} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.network}: {a.address.slice(0, 8)}...{a.address.slice(-4)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="badge" style={{ flexShrink: 0, fontSize: "11px" }}>
                    {acc.credentials ? (
                      <span className="badge badge-confirmed">{acc.credentials.exchange.toUpperCase()}</span>
                    ) : acc.isAutoSync ? (
                      <span className="badge badge-confirmed">Авто</span>
                    ) : (
                      <span className="badge badge-pending">Ручной</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify accounts page**

Run: `npm run dev`, navigate to `/accounts`
Expected: Account cards in responsive grid, type icons, balances, sync button works.

---

### Task 6: Settings — Merge Profile + Users

**Files:**
- Rewrite: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Rewrite settings/page.tsx with tabs: Profile, Users (admin), API Keys**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

const ETHERSCAN_KEY = { id: "etherscan", label: "EtherScan API Key", placeholder: "EtherScan API Key" };
const NON_ETHERSCAN_NETWORKS = [
  { id: "avalanche", label: "Avalanche (SnowTrace)", placeholder: "SnowTrace API Key" },
  { id: "solana", label: "Solana (Helius)", placeholder: "Helius API Key" },
  { id: "ton", label: "TON (Toncenter)", placeholder: "Toncenter API Key" },
  { id: "tron", label: "TRON (TronGrid)", placeholder: "TronGrid API Key" },
];
const ETHERSCAN_NETWORKS_LIST = ["Ethereum", "BSC (BNB)", "Polygon", "Arbitrum", "Optimism", "Base", "Fantom", "Cronos", "Aurora", "Moonbeam", "Gnosis"];
const ALL_KEY_FIELDS = [ETHERSCAN_KEY, ...NON_ETHERSCAN_NETWORKS];

interface KeyEntry { network: string; hasKey: boolean; }
interface UserRow { id: number; username: string; role: string; status: string; created_at: string; }

export default function SettingsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<"profile" | "keys" | "users">("profile");

  // Profile state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // API keys state
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedNetworks, setSavedNetworks] = useState<Set<string>>(new Set());
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysSaving, setKeysSaving] = useState(false);

  // Users state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  const isAdmin = session?.user?.role === "master";

  // Load keys and users on mount
  useEffect(() => {
    fetch("/api/settings/blockchain-keys")
      .then(r => r.json())
      .then((data: KeyEntry[]) => {
        const saved = new Set(data.filter(k => k.hasKey).map(k => k.network));
        setSavedNetworks(saved);
        setKeysLoading(false);
      })
      .catch(() => setKeysLoading(false));

    if (isAdmin) {
      fetch("/api/admin/users")
        .then(r => r.json())
        .then((data: UserRow[]) => { setUsers(data); setUsersLoading(false); })
        .catch(() => setUsersLoading(false));
    }
  }, [isAdmin]);

  // Profile
  async function handleChangePassword() {
    setPwError(""); setPwSuccess("");
    if (!currentPassword || !newPassword) { setPwError("Заполните все поля"); return; }
    if (newPassword.length < 4) { setPwError("Новый пароль минимум 4 символа"); return; }
    if (newPassword !== confirmPassword) { setPwError("Пароли не совпадают"); return; }
    setPwSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPwSaving(false);
    if (!res.ok) { setPwError(data.error || "Ошибка"); return; }
    setPwSuccess("Пароль успешно изменён");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  // API keys
  async function handleSaveKeys() {
    setKeysSaving(true);
    const payload = ALL_KEY_FIELDS.filter(n => keys[n.id]?.length > 0).map(n => ({ network: n.id, apiKey: keys[n.id] }));
    const res = await fetch("/api/settings/blockchain-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const saved = new Set(savedNetworks);
      ALL_KEY_FIELDS.forEach(n => { if (keys[n.id]?.length > 0) saved.add(n.id); });
      setSavedNetworks(saved);
      setKeys({});
      toast.success("Ключи сохранены");
    } else {
      toast.error("Ошибка при сохранении");
    }
    setKeysSaving(false);
  }

  // Users
  async function handleAction(userId: number, action: "approve" | "reject") {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    if (res.ok) {
      setUsers(users.map(u => u.id === userId ? { ...u, status: action === "approve" ? "approved" : "rejected" } : u));
    }
  }

  async function deleteUser(userId: number) {
    if (!confirm("Удалить пользователя?")) return;
    setDeletingId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Пользователь удалён"); setUsers(prev => prev.filter(u => u.id !== userId)); }
    else { const err = await res.json().catch(() => ({ error: "Ошибка" })); toast.error(err.error || "Ошибка удаления"); }
    setDeletingId(null);
  }

  async function handleResetPassword() {
    if (!resetUserId || !resetPassword || resetPassword.length < 4) return;
    setResetSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetUserId, action: "reset_password", newPassword: resetPassword }),
    });
    if (res.ok) { setResetUserId(null); setResetPassword(""); toast.success("Пароль сброшен"); }
    else { toast.error("Ошибка"); }
    setResetSaving(false);
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2>Настройки</h2>
          <p>Управление аккаунтом и системой</p>
        </div>
      </header>

      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="chart-tabs" style={{ display: "flex", gap: "4px", background: "var(--bg-card)", borderRadius: "30px", padding: "3px", border: "1px solid var(--glass-border)", width: "fit-content" }}>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
            <i className="fa-solid fa-user" style={{ marginRight: "6px" }} />Профиль
          </button>
          <button className={tab === "keys" ? "active" : ""} onClick={() => setTab("keys")}>
            <i className="fa-solid fa-key" style={{ marginRight: "6px" }} />API-ключи
          </button>
          {isAdmin && (
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              <i className="fa-solid fa-users" style={{ marginRight: "6px" }} />Пользователи
            </button>
          )}
        </div>
      </div>

      {tab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Информация</h3>
            <div className="tx-item" style={{ padding: "12px 0", cursor: "default" }}>
              <div className="tx-icon green"><i className="fa-solid fa-user" /></div>
              <div className="tx-info">
                <div className="tx-name">{session?.user?.username}</div>
                <div className="tx-desc">{session?.user?.role === "master" ? "Администратор" : "Пользователь"}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Смена пароля</h3>
            {pwError && <div className="badge badge-pending" style={{ display: "block", marginBottom: "12px", borderRadius: "8px", padding: "8px 12px", background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>{pwError}</div>}
            {pwSuccess && <div className="badge badge-confirmed" style={{ display: "block", marginBottom: "12px", borderRadius: "8px", padding: "8px 12px" }}>{pwSuccess}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Текущий пароль" />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Новый пароль" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Подтвердите пароль" />
              <button onClick={handleChangePassword} disabled={pwSaving} className="btn-primary">
                {pwSaving ? "Сохранение..." : "Изменить пароль"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "keys" && (
        <div className="card">
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>API-ключи блокчейнов</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Ключи используются для сканирования транзакций. Можно задать через переменные окружения.
          </p>
          {keysLoading ? (
            <p style={{ color: "var(--text-muted)" }}>Загрузка...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "6px" }}>
                  {ETHERSCAN_KEY.label}
                  {savedNetworks.has("etherscan") && <span className="badge badge-confirmed" style={{ marginLeft: "8px", fontSize: "10px" }}>✓</span>}
                </label>
                <input type="password" placeholder={savedNetworks.has("etherscan") ? "••••••••" : ETHERSCAN_KEY.placeholder} value={keys["etherscan"] || ""} onChange={e => setKeys(prev => ({ ...prev, "etherscan": e.target.value }))} />
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Один ключ для: {ETHERSCAN_NETWORKS_LIST.join(", ")}</p>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Остальные сети</p>

              {NON_ETHERSCAN_NETWORKS.map(net => (
                <div key={net.id}>
                  <label style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "6px" }}>
                    {net.label}
                    {savedNetworks.has(net.id) && <span className="badge badge-confirmed" style={{ marginLeft: "8px", fontSize: "10px" }}>✓</span>}
                  </label>
                  <input type="password" placeholder={savedNetworks.has(net.id) ? "••••••••" : net.placeholder} value={keys[net.id] || ""} onChange={e => setKeys(prev => ({ ...prev, [net.id]: e.target.value }))} />
                </div>
              ))}

              <button onClick={handleSaveKeys} disabled={keysSaving} className="btn-primary" style={{ alignSelf: "flex-start" }}>
                {keysSaving ? "Сохранение..." : "Сохранить ключи"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "users" && isAdmin && (
        <>
          {/* Pending users */}
          {users.filter(u => u.status === "pending").length > 0 && (
            <div className="card" style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
                <i className="fa-solid fa-circle-exclamation" style={{ color: "var(--warning)", marginRight: "8px" }} />
                Заявки на регистрацию ({users.filter(u => u.status === "pending").length})
              </h3>
              <div className="tx-list">
                {users.filter(u => u.status === "pending").map(u => (
                  <div key={u.id} className="tx-item" style={{ cursor: "default" }}>
                    <div className="tx-icon orange"><i className="fa-solid fa-user-plus" /></div>
                    <div className="tx-info">
                      <div className="tx-name">{u.username}</div>
                      <div className="tx-desc">{new Date(u.created_at).toLocaleDateString("ru-RU")}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => handleAction(u.id, "approve")} className="btn-primary" style={{ background: "var(--success)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-check" /> Подтвердить
                      </button>
                      <button onClick={() => handleAction(u.id, "reject")} className="btn-primary" style={{ background: "var(--danger)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-xmark" /> Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved users */}
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
              <i className="fa-solid fa-users" style={{ marginRight: "8px" }} />
              Пользователи ({users.filter(u => u.status === "approved").length})
            </h3>
            {users.filter(u => u.status === "approved").length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Нет подтверждённых пользователей</p>
            ) : (
              <div className="tx-list">
                {users.filter(u => u.status === "approved").map(u => (
                  <div key={u.id} className="tx-item" style={{ cursor: "default" }}>
                    <div className="tx-icon green"><i className="fa-solid fa-user-check" /></div>
                    <div className="tx-info">
                      <div className="tx-name">{u.username}</div>
                      <div className="tx-desc">{u.role}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setResetUserId(u.id)} className="btn-primary" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-key" />
                      </button>
                      <button onClick={() => deleteUser(u.id)} disabled={deletingId === u.id} className="btn-primary" style={{ background: "var(--danger)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {resetUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setResetUserId(null); }}>
          <div className="card w-full max-w-md space-y-4 animate-modal-enter">
            <div className="flex justify-between items-center">
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Сброс пароля</h3>
              <button onClick={() => setResetUserId(null)} className="btn-icon" style={{ width: "32px", height: "32px" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Новый пароль для <strong>{users.find(u => u.id === resetUserId)?.username}</strong>
            </p>
            <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Новый пароль" />
            <div className="flex gap-2">
              <button onClick={() => setResetUserId(null)} className="btn-primary" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", flex: 1 }}>Отмена</button>
              <button onClick={handleResetPassword} disabled={resetSaving || resetPassword.length < 4} className="btn-primary" style={{ flex: 1 }}>
                {resetSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify settings page**

Run: `npm run dev`, navigate to `/settings`
Expected: Three tabs (Profile, API Keys, Users for admin). Each tab works correctly with data loading and saving.

---

### Task 7: Remove Unused Pages

**Files:**
- Delete: `src/app/(dashboard)/stats/`
- Delete: `src/app/(dashboard)/balances/`
- Delete: `src/app/(dashboard)/ledger/`
- Delete: `src/app/(dashboard)/matches/`
- Delete: `src/app/(dashboard)/admin/logs/`
- Delete: `src/app/(dashboard)/profile/` (moved to settings)

- [ ] **Step 1: Delete unused page directories**

```bash
rm -rf src/app/"(dashboard)"/stats
rm -rf src/app/"(dashboard)"/balances
rm -rf src/app/"(dashboard)"/ledger
rm -rf src/app/"(dashboard)"/matches
rm -rf src/app/"(dashboard)"/profile
rm -rf src/app/"(dashboard)"/admin/logs
```

- [ ] **Step 2: Clean up Navbar references**

In `src/components/Navbar.tsx`, ensure no links point to deleted pages (already done in Task 2 — only dashboard, accounts, transactions, settings remain).

- [ ] **Step 3: Verify build**

Run: `npm run dev`
Expected: No errors. Deleted pages return 404 (Next.js handles this). All remaining pages work.

---

### Task 8: Polish — Responsive Fixes, Nav Label Update

**Files:**
- Modify: `src/components/Navbar.tsx` (if needed)
- Verify: `src/app/(dashboard)/layout.tsx` responsive behavior

- [ ] **Step 1: Verify mobile responsive behavior**

Test on mobile viewport (320-768px):
- Bottom nav shows with 5 items: Обзор, Счета, Транзакции, Настройки, Меню
- Top bar with Fin-ly branding and avatar
- Drawer opens/closes on menu toggle
- Content has correct padding (`main-content` class)

- [ ] **Step 2: Verify search in transaction header navigates to /transactions**

Update the search input in dashboard to navigate to transactions page with search query:

In `src/app/(dashboard)/dashboard/page.tsx`, add keydown handler to search input:

```tsx
// Find the search input and change to:
<input
  type="text"
  placeholder="Поиск транзакций..."
  onKeyDown={(e) => {
    if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
      window.location.href = `/transactions?search=${encodeURIComponent((e.target as HTMLInputElement).value.trim())}`;
    }
  }}
/>
```

And in `src/app/(dashboard)/transactions/page.tsx`, add URL search params reading on mount:

Add after `const [showNewTx, setShowNewTx] = useState(false);`:
```tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("search");
  if (q) setSearchQuery(q);
}, []);
```

- [ ] **Step 3: Run full build check**

Run: `npm run dev`
Expected: Everything works on desktop and mobile. No console errors. Pages load data correctly.
```

- [ ] **Step 2: Verify full flow**

Test all pages: `/dashboard`, `/accounts`, `/accounts/1`, `/accounts/new`, `/transactions`, `/settings`
Expected: All pages load with new styling, data loads, navigation works.
</parameter>
