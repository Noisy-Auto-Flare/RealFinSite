# Task 3 Report: Add "Check New Transactions" Button

## What I implemented
- Added `scanning` state variable (`const [scanning, setScanning] = useState(false)`)
- Added `handleScan()` async function that calls `POST /api/scanner/run`, displays toast results based on `data.eventsFound`, and reloads transactions
- Added a "Проверить новые транзакции" button before the transaction list card, disabled while scanning showing "Проверка..."

## What I tested and results
- `npm run typecheck` — passed with no errors

## Files changed
- `src/app/(dashboard)/transactions/page.tsx` — 22 insertions

## Self-review findings
- Button placement matches brief (before the card div)
- State and handler follow existing code patterns (same style as `saving`/`saveEdit`)
- Uses existing `toast` and `loadTxs` from the component scope
- Single concern: the button sits before `<div className="card">` but inside the filters block visually — may want to adjust layout if button needs to be in a specific position relative to filters

## Issues or concerns
None
