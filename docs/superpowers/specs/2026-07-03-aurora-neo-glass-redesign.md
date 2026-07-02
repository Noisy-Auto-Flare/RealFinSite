# FinTracker Aurora Neo-Glass Redesign

**Date:** 2026-07-03
**Style:** Aurora / Neo-glass with warm glow
**Fonts:** Onest (body/headings) + DM Mono (numbers/code)
**Approach:** Layer-first implementation (CSS → Components → Pages)

---

## Design Decisions

### Visual Style
- **Theme:** Dark, deep-space background (`#0f0f13`) with layered radial gradients (Aurora)
- **Primary accent:** `#E9B1A3` (warm peach)
- **Secondary accent:** `#fbbf24` (gold)
- **Glass intensity:** `backdrop-filter: blur(12px)`, card bg `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`

### Color Palette
```css
--bg-primary: #0f0f13;
--bg-secondary: #15151e;
--bg-card: rgba(255,255,255,0.04);
--glass-border: rgba(255,255,255,0.08);
--glass-blur: 12px;
--accent: #E9B1A3;
--accent-hover: #d49a8a;
--accent-secondary: #fbbf24;
--text-primary: #f1f1f3;
--text-secondary: #9b9ba7;
--text-muted: #5c5c6a;
--border: rgba(255,255,255,0.06);
--danger: #ef4444;
--success: #22c55e;
--warning: #f59e0b;
```

### Fonts
- **Onest** (Google Fonts, 400/500/600/700) — body text, headings, buttons
- **DM Mono** (Google Fonts, 400/500) — numbers, currency amounts, wallet addresses, monospace code

---

## Implementation Phases

### Phase 1: Global CSS Foundation
**Files:** `src/app/globals.css`

1. Replace font imports: remove `@fontsource/lilex` and `@fontsource/martian-mono`, add Onest + DM Mono via `@fontsource/onest` and `@fontsource/dm-mono`
2. Update `:root` CSS variables with new color palette (above)
3. Update `body`: font-family Onest, remove old text-shadow, new Aurora gradient on `#0f0f13` base
4. Update `strong, b, h1-h6, th, label, .font-bold, .font-medium`: font-family Onest, new text-shadow
5. Rewrite `.card`: glass styles with backdrop-filter, box-shadow, border-radius 16px
6. Update `.btn`, `.btn-primary`, `.btn-secondary`: new colors, box-shadows, hover effects
7. Update `.badge-*`: new colors matching new palette
8. Add global `*` transition rule
9. Update `input, textarea, .btn` to use Onest
10. Update bottom nav CSS: active indicator (underline), hover scale, proper spacing
11. Update drawer CSS: backdrop-filter on overlay, border-radius on panel
12. Update FAB CSS: pulse-glow animation, rotate on open
13. Add keyframes: `fade-in`, `slide-up`, `pulse-glow`, `count-up`, `spin-in`
14. Update responsive media queries for new layout (top bar, not sidebar)
15. Keep and adjust `< 400px` icons-only bottom nav rule

### Phase 2: Navigation Rewrite
**Files:** `src/components/Navbar.tsx`, `src/app/(dashboard)/layout.tsx`

1. **Top bar (desktop + mobile):**
   - Fixed `h-14`, glass background, border-bottom
   - Left: app name "FinTracker" (small, bold, Onest)
   - Center: search input (optional, styled as glass)
   - Right: username + avatar circle + dropdown (profile, admin links, logout)
   - `role === "master"` shows shield icon

2. **Bottom nav (mobile only):**
   - 5 items: Dashboard, Accounts, Transactions, Matches, Stats
   - Active: accent color, scale(1.05), underline indicator
   - Inactive: hover scale(1.1)
   - Icons + labels, on <400px icons only

3. **Drawer (mobile):**
   - Triggered by hamburger in top bar (or swipe)
   - Overlay with `backdrop-filter: blur(4px)`
   - Panel: `w-[80vw] max-w-[280px]`, `border-radius: 0 16px 16px 0`, `box-shadow`
   - Items: same as sidebar, active with `border-left: 3px solid var(--accent)`
   - Contains: profile link, admin links, logout button

4. **Layout update:**
   - Remove `flex min-h-screen` wrapper
   - Remove sidebar container
   - Add `padding-top: 56px` for fixed top bar
   - Add `padding-bottom: 80px` on mobile for bottom nav

### Phase 3: Empty States + Toast System
**Files:** Create `src/components/EmptyState.tsx`, `src/components/Toast.tsx`

1. **EmptyState component:**
   - Props: `icon`, `title`, `description`, `action?` (label + href/onClick)
   - Centered layout, icon 64px, animated entrance (fade-in + slide-up via CSS class)
   - Action button styled as `.btn-primary`

2. **Toast system:**
   - `ToastProvider` context + `useToast()` hook
   - Toast types: success, error, info
   - Position: top-right, stackable
   - Animation: slide-in from right, fade-out
   - Auto-dismiss after 3500ms, manual close button
   - Z-index above modals (z-60)

3. **Replace inline empty states:**
   - `accounts/page.tsx`: use `<EmptyState>` instead of manual div
   - `dashboard/page.tsx`: replace "Нет данных" in pie chart section
   - `transactions/page.tsx`: replace "Нет операций"
   - `matches/page.tsx`: replace empty state block

4. **Wire toasts to existing actions:**
   - `matches/page.tsx`: replace `setActionMsg` + setTimeout with toast
   - `accounts/[id]/page.tsx`: toast on sync/credential save/delete
   - `NewTransactionModal.tsx`: toast on error/success

### Phase 4: Micro-interactions
**Files:** `globals.css`, `Select.tsx`, `Navbar.tsx` (FAB), pages

1. **Transaction row hover:**
   - Background `rgba(233,177,163,0.06)` on hover
   - Edit/delete buttons: `translateX(4px→0)` staggered (50ms delay per button)
   - Smooth transition 200ms

2. **Select component update:**
   - Options dropdown: each option with `transition-delay: calc(var(--index) * 30ms)`
   - Entrance: `translateY(-4px→0)`, `opacity 0→1`
   - Currently applied to existing `<Select>`, add to options rendering

3. **FAB:**
   - On first page load: `pulse-glow` animation (keyframes: scale 1→1.1→1, box-shadow glow)
   - When modal open: rotate icon 45° (CSS class `.fab.active`)
   - Clicks outside modal: close with animation

4. **Modal (NewTransactionModal):**
   - Overlay: `backdrop-filter: blur(4px)` (add to existing)
   - Modal panel: entrance `scale(0.95→1)` + `opacity(0→1)` in 250ms
   - Exit: reverse animation (on `onClose`)

### Phase 5: Dashboard + Charts
**Files:** `src/app/(dashboard)/dashboard/page.tsx`, `stats/page.tsx`

1. **Capital card:**
   - Large balance in DM Mono, `text-4xl`
   - Counter animation: number counts from 0 to final value over 600ms
   - Income/expense with `▲`/`▼` indicators, success/danger colors

2. **Pie chart:**
   - Add `isAnimationActive={true}`, `animationBegin={0}`, `animationDuration={1200}`, `animationEasing="ease-out"` on `<Pie>`
   - Responsive: mobile full-width, desktop compact

### Phase 6: Performance
**Files:** `package.json`, component files

1. Install `react-window`, `@types/react-window`
2. Wrap stable components in `React.memo`:
   - `NewTransactionModal`
   - `TransactionRow` (extract from dashboard and transactions pages)
   - Bottom nav items (if extracted)
3. Replace `.map()` on transactions page with `<FixedSizeList>` (height ~600px, itemSize 48)
4. Ensure `useMemo`/`useCallback` where data is derived

---

## Files Changed (Complete List)

| File | Action |
|------|--------|
| `src/app/globals.css` | Rewrite: theme, fonts, glass, animations, nav |
| `src/components/Navbar.tsx` | Rewrite: top bar + bottom nav + drawer |
| `src/app/(dashboard)/layout.tsx` | Update: remove sidebar, add top bar padding |
| `src/components/EmptyState.tsx` | Create |
| `src/components/Toast.tsx` | Create |
| `src/components/Select.tsx` | Update: animated options |
| `src/components/NewTransactionModal.tsx` | Update: entrance/exit animation, toast, React.memo |
| `src/app/(dashboard)/dashboard/page.tsx` | Update: capital card, chart animation, counter |
| `src/app/(dashboard)/stats/page.tsx` | Update: chart animation, capital card |
| `src/app/(dashboard)/accounts/page.tsx` | Update: EmptyState, glass styles |
| `src/app/(dashboard)/accounts/[id]/page.tsx` | Update: toast, glass styles |
| `src/app/(dashboard)/transactions/page.tsx` | Update: EmptyState, virtualized list |
| `src/app/(dashboard)/matches/page.tsx` | Update: EmptyState, toast |
| `package.json` | Add: react-window, @types/react-window |

---

## Non-Goals
- No changes to API routes or database schema
- No changes to authentication flow
- No changes to business logic (validation, calculations, exchange rates)
- No new pages — only visual redesign of existing ones
