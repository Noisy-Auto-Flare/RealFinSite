# Check New Transactions Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Проверить новые транзакции" button to the history page that triggers the blockchain scanner and shows results via toast.

**Architecture:** Modify `runScannerCycle()` to return stats, expose via `POST /api/scanner/run`, add button on transactions page.

**Tech Stack:** Next.js App Router, Drizzle ORM, SQLite

## Global Constraints

- No new dependencies
- `npm run typecheck && npm test` before every commit
- Tests use in-memory SQLite (`:memory:`)
- All text in Russian on the transactions page

---

### Task 1: Modify `runScannerCycle()` to return stats

**Files:**
- Modify: `src/lib/scanners/runner.ts:17-67`
- No test changes needed (no tests reference `runScannerCycle()`)

**Interfaces:**
- Produces: `runScannerCycle(): Promise<{ eventsFound: number; addressesScanned: number }>`

- [ ] **Add return type and counter, update return statement**

Change signature and add tracking inside the loop. After processing all addresses, return the stats.

```typescript
export async function runScannerCycle(): Promise<{ eventsFound: number; addressesScanned: number }> {
  const allAddresses = db.select({
    addr: accountAddresses,
    account: accounts,
  })
    .from(accountAddresses)
    .innerJoin(accounts, eq(accountAddresses.accountId, accounts.id))
    .where(eq(accounts.isAutoSync, 1))
    .all();

  if (allAddresses.length === 0) {
    console.log(`[scanner] ${new Date().toISOString()} no addresses to scan (is_auto_sync=1)`);
    return { eventsFound: 0, addressesScanned: 0 };
  }

  console.log(`[scanner] ${new Date().toISOString()} scanning ${allAddresses.length} address(es)...`);

  let eventsFound = 0;

  for (const row of allAddresses) {
    const scanner = await getScanner(row.addr.network);
    if (!scanner) {
      continue;
    }

    console.log(`[scanner]   → ${row.addr.network}: ${row.addr.address.slice(0, 12)}... (from block ${row.addr.lastSyncBlock ?? 0})`);

    const events = await scanner.fetchNewTransactions(
      row.addr.address,
      row.addr.lastSyncBlock ?? 0
    );

    if (events.length === 0) {
      console.log(`[scanner]     no new transactions found`);
      continue;
    }

    console.log(`[scanner]     found ${events.length} new transaction(s)`);
    eventsFound += events.length;

    for (const evt of events) {
      await processEvent(evt, row.addr.address, row.addr.network, row.account.id, row.account.userId);
    }

    recalculateAllBalances();
    markDirty();

    const maxBlock = Math.max(...events.map((e) => e.blockNumber), row.addr.lastSyncBlock ?? 0);
    db.update(accountAddresses)
      .set({ lastSyncBlock: maxBlock })
      .where(eq(accountAddresses.id, row.addr.id))
      .run();
  }

  return { eventsFound, addressesScanned: allAddresses.length };
}
```

- [ ] **Commit**

```bash
git add src/lib/scanners/runner.ts
git commit -m "feat: runScannerCycle() returns eventsFound/addressesScanned stats"
```

---

### Task 2: Create `POST /api/scanner/run` endpoint

**Files:**
- Create: `src/app/api/scanner/run/route.ts`

**Interfaces:**
- Consumes: `runScannerCycle(): Promise<{ eventsFound: number; addressesScanned: number }>`
- Produces: `POST /api/scanner/run` returns `{ success: true, eventsFound: number, addressesScanned: number }`

- [ ] **Create the API route file**

```typescript
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { runScannerCycle } from "@/lib/scanners/runner";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runScannerCycle();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[api/scanner/run] Scanner cycle failed:", e);
    return NextResponse.json({ error: "Scanner cycle failed" }, { status: 500 });
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/scanner/run/route.ts
git commit -m "feat: add POST /api/scanner/run endpoint"
```

---

### Task 3: Add button to transactions page

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`

- [ ] **Add scanning state and handler function**

Add after line 42 (`const [saving, setSaving] = useState(false);`):
```typescript
const [scanning, setScanning] = useState(false);

async function handleScan() {
  setScanning(true);
  try {
    const res = await fetch("/api/scanner/run", { method: "POST" });
    const data = await res.json();
    if (data.eventsFound > 0) {
      toast.success(`Найдено ${data.eventsFound} новых транзакций`);
    } else {
      toast.info("Новых транзакций не найдено");
    }
    loadTxs();
  } catch {
    toast.error("Ошибка сканирования");
  } finally {
    setScanning(false);
  }
}
```

- [ ] **Add the button before the card div**

After line 150 (after the `</div>` closing filters) and before line 153 (`<div className="card">`):
```tsx
      <button onClick={handleScan} disabled={scanning} className="btn btn-ghost text-sm w-full md:w-auto">
        {scanning ? "Проверка..." : "Проверить новые транзакции"}
      </button>
```

- [ ] **Commit**

```bash
git add src/app/(dashboard)/transactions/page.tsx
git commit -m "feat: add check new transactions button to history page"
```

---

### Task 4: Verify

- [ ] **Run typecheck + tests**

```bash
npm run typecheck && npm test
```

Expected: typecheck clean, all tests passing.
