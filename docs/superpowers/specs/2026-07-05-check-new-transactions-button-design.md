# Check New Transactions Button — Design Spec

## Goal
Add a button to the transactions history page that manually triggers the blockchain scanner and shows how many new transactions were found.

## Changes

### 1. `src/lib/scanners/runner.ts` — return scan stats
- Change `runScannerCycle(): Promise<void>` → `runScannerCycle(): Promise<{ eventsFound: number; addressesScanned: number }>`
- Track `eventsFound` across all addresses; return total
- All callers (`scheduler.ts`) ignore the return value (TS-safe)

### 2. `src/app/api/scanner/run/route.ts` — new API endpoint
- `POST /api/scanner/run` — calls `runScannerCycle()` and returns `{ eventsFound, addressesScanned }`
- Requires auth via `getCurrentUserId()`

### 3. `src/app/(dashboard)/transactions/page.tsx` — button
- State: `[scanning, setScanning]` (boolean)
- Button "Проверить новые транзакции" between filters and transaction list
- On click: `POST /api/scanner/run` → toast with count → reload list
- If >0 events: `toast.success("Найдено {N} новых транзакций")`
- If 0 events: `toast.info("Новых транзакций не найдено")`
- Button disabled while scanning, shows "Проверка..."
- Uses existing `useToast()` hook

### No changes to
- Scanner creates operations as `status: "confirmed"` (existing behavior, user OK'd)
- `scheduler.ts` — only import/export signature update, no logic change

## Edge Cases (user confirmed OK)
- Auto-confirmed: found transactions appear immediately in history
- Unknown addresses OK: outgoing to unknown creates "Sent {currency}"
- Duplicates: skipped by txHash
- Zero/dust: filtered by `humanAmount > 0`

## Files Changed
- `src/lib/scanners/runner.ts` — return type + counter
- `src/app/api/scanner/run/route.ts` — new file
- `src/app/(dashboard)/transactions/page.tsx` — button + handler
- `src/lib/scanners/scheduler.ts` — update call signature (no-op)
