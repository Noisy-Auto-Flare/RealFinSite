# Add Linea Network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Linea (EVM chain 59144) as a supported scanner network.

**Architecture:** Add config entry to `EVM_NETWORKS`, env var mapping to `api-keys.ts`, and UI entries to settings + new-account pages. No new logic — follows the exact pattern of 12 existing EVM networks.

**Tech Stack:** TypeScript, Next.js, SQLite

## Global Constraints

- Follow existing EVM network pattern exactly (12 existing networks: ethereum, bsc, avalanche, polygon, base, arbitrum, optimism, fantom, cronos, aurora, moonbeam, gnosis)
- LineaScan API: `https://api.lineascan.build/api`
- Env var: `LINEASCAN_API_KEY`
- Native currency: ETH

---

### Task 1: Add Linea config + settings UI

**Files:**
- Modify: `src/lib/scanners/evm/config.ts`
- Modify: `src/lib/scanners/api-keys.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/(dashboard)/accounts/new/page.tsx`

- [ ] **Step 1: Add Linea to EVM_NETWORKS**

Edit `src/lib/scanners/evm/config.ts` — add after `gnosis` entry:
```
linea: {
  name: "Linea",
  apiUrl: "https://api.lineascan.build/api",
  envKey: "LINEASCAN_API_KEY",
  nativeSymbol: "ETH",
  nativeDecimals: 18,
},
```

- [ ] **Step 2: Add Linea to ENV_MAP**

Edit `src/lib/scanners/api-keys.ts` — add `"linea"` → `"LINEASCAN_API_KEY"` to `ENV_MAP`.

- [ ] **Step 3: Add Linea to settings page**

Edit `src/app/(dashboard)/settings/page.tsx` — add before Solana entry:
```
{ label: "Linea (LineaScan)", key: "LINEASCAN_API_KEY" },
```

- [ ] **Step 4: Add Linea to new-account network picker**

Check `src/app/(dashboard)/accounts/new/page.tsx` — if network list is hardcoded, add `"linea"` (or `{ value: "linea", label: "Linea" }`).

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Verify dev server works**

Run: `npm run dev` (check port 3000)
Fetch: `curl http://localhost:3000/settings`
Expected: settings page renders with Linea field
