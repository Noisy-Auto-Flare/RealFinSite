### Task 1: Global CSS Foundation — fonts, variables, glass cards, animations

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nothing
- Produces: CSS variables `--bg-primary`, `--accent`, etc.; `.card` glass styles; `@keyframes` animations; updated media queries

**Details:**

Replace Lilex/Martian Mono imports with Onest + DM Mono via @fontsource.

Update `:root` CSS variables:
```css
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
```

Body: font-family Onest, keep existing 12-layer radial gradient on `#0f0f13` base, remove old text-shadow, add `-webkit-font-smoothing: antialiased`.

Headings: remove text-shadow, change font-family to Onest.

Card: glass styles — `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255,255,255,0.08)`, `border-radius: 16px`, `box-shadow: 0 2px 20px rgba(0,0,0,0.2)`, `overflow: hidden`, `min-width: 0`. Plus `card > * { min-width: 0 }`.

Buttons: Onest font, border-radius 10px, new colors matching palette. btn-primary: bg var(--accent), btn-secondary: `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.08)`.

Input/textarea: Onest font, `background: rgba(255,255,255,0.04)`, border-radius 10px, focus with accent glow.

Keyframes:
- `fade-in`: opacity 0→1
- `slide-up`: opacity 0→1, translateY 20px→0
- `pulse-glow`: scale 1→1.08→1 with box-shadow glow
- `spin-in`: scale 0.95→1, rotate -3deg→0
- Plus utility classes `.animate-fade-in`, `.animate-slide-up`, `.animate-spin-in`

Bottom nav: glass background (`rgba(21,21,30,0.92)` + `backdrop-filter: blur(16px)`), active item with accent underline (2px), hover scale(1.1).

Drawer: overlay with `backdrop-filter: blur(4px)`, panel with `backdrop-filter: blur(20px)`, `border-radius: 0 16px 16px 0`, `box-shadow: 4px 0 24px rgba(0,0,0,0.4)`.

FAB: add `.pulse` class with `pulse-glow` animation, `.active` class with `rotate(45deg)`.

Global `* { transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s; }`.

Media queries unchanged from current code (768px and 400px).

Install: `npm install @fontsource/onest @fontsource/dm-mono`
