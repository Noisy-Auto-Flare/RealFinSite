# Interactive Transaction Linking Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement task-by-task.

**Goal:** Fix Solana fee recording, add interactive selection/linking UI, add color-coded groups

**Architecture:** Backend changes to `runner.ts` (fee), `POST /api/groups` (batch link), frontend changes to `transactions/page.tsx` (selection mode, checkboxes, link bar, color coding)

**Tech Stack:** Next.js 16, SQLite + Drizzle ORM, TypeScript

## Global Constraints

- All existing tests must pass
- `npm run dev` must compile without errors
- Follow existing code conventions in each file

---

### Task 1: Fee as Separate Operation

**Files:**
- Modify: `src/lib/scanners/runner.ts:178-191`

**Interfaces:**
- Consumes: `RawBlockchainEvent.fee` (already emitted by all scanners)
- Produces: Separate `operations` row for fee

- [ ] **Step 1: Replace fee entry with separate operation**

Replace the fee entry insertion block with a new operation creation:

```typescript
  // Attach network fee as a separate operation (outgoing only — user pays the fee)
  if (evt.fee && isOutgoing) {
    const feeAmount = parseFloat(evt.fee.amount) / Math.pow(10, evt.fee.decimals);
    if (feeAmount > 0) {
      const feeOp = db.insert(operations).values({
        userId,
        description: `Fee (${currency})`,
        date: new Date(evt.timestamp * 1000).toISOString().split("T")[0],
        source: `scanner_${network}`,
        txHash: evt.txHash,
        fromAddress: evt.fromAddress,
        toAddress: evt.toAddress,
        blockTimestamp: evt.timestamp,
        status: "confirmed",
      }).returning().get();
      db.insert(operationEntries).values({
        operationId: feeOp.id,
        accountId,
        currency: evt.fee.currency || currency,
        amount: -feeAmount,
        type: "principal",
        isVerified: 1,
      }).run();
    }
  }
```

- [ ] **Step 2: Run tests to verify nothing broke**

```bash
npm test
```
Expected: All tests pass (95 tests)

- [ ] **Step 3: Commit**

```bash
git add src/lib/scanners/runner.ts
git commit -m "fix: record scanner fees as separate operations, not entries"
```

---

### Task 2: POST /api/groups — Batch Link Operations

**Files:**
- Modify: `src/app/api/groups/route.ts:28-34`

**Interfaces:**
- Produces: `POST /api/groups` accepts `{ operationIds: number[] }`, creates group, links operations

- [ ] **Step 1: Modify POST handler to accept operationIds**

```typescript
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const operationIds: number[] = body.operationIds || [];

  const created = db.insert(operationGroups).values({ userId }).returning().get();

  if (operationIds.length > 0) {
    // Verify all operations belong to this user
    const validOps = db.select({ id: operations.id }).from(operations)
      .where(and(
        eq(operations.userId, userId),
        inArray(operations.id, operationIds)
      )).all();
    const validIds = validOps.map(o => o.id);
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?");
      db.run(sql.raw(`UPDATE operations SET group_id = ${created.id} WHERE id IN (${placeholders})`), ...validIds);
    }
  }

  return NextResponse.json({ ...created, colorIndex: created.id % 6 }, { status: 201 });
}
```

Need to add `inArray` to imports.

- [ ] **Step 2: Run tests**

```bash
npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/groups/route.ts
git commit -m "feat: POST /api/groups accepts operationIds for batch linking"
```

---

### Task 3: Selection Mode + Checkboxes + Link Bar

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `GET /api/groups` (list groups), `POST /api/groups` (create + link)

- [ ] **Step 1: Add selection state and toggle logic**

Add to component state:
```typescript
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
```

Change the tab button logic. Replace the existing tab buttons block with:

```tsx
<div className="flex gap-1 mb-4 items-center">
  {[
    { key: false, label: "Все" },
    { key: true, label: "Связанные" },
  ].map(tab => (
    <button
      key={String(tab.key)}
      onClick={() => {
        if (tab.key) {
          setSelectMode(!selectMode);
          if (selectMode) {
            setSelectedIds(new Set());
          }
        } else {
          setRelatedOnly(false);
          setSelectMode(false);
          setSelectedIds(new Set());
        }
      }}
      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
        (tab.key && selectMode) || (relatedOnly === tab.key && !tab.key)
          ? "bg-[var(--accent)] text-white"
          : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {tab.key && selectMode ? "Отмена" : tab.label}
    </button>
  ))}
  {selectMode && (
    <button
      onClick={async () => {
        if (selectedIds.size < 2) return;
        const res = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationIds: [...selectedIds] }),
        });
        if (res.ok) {
          setSelectMode(false);
          setSelectedIds(new Set());
          loadTxs();
          // Reload groups
          fetch("/api/groups").then(r => r.json()).then(setGroups);
        }
      }}
      disabled={selectedIds.size < 2}
      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
        selectedIds.size >= 2
          ? "bg-[var(--accent)] text-white"
          : "bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed"
      }`}
    >
      <i className="fa-solid fa-link mr-1" />
      Связать ({selectedIds.size})
    </button>
  )}
  {selectMode && (
    <span className="text-xs text-[var(--text-muted)]">
      Выбрано: {selectedIds.size}
    </span>
  )}
</div>
```

- [ ] **Step 2: Replace the tab imports — add `setGroups` to state**

Change the `setGroups` initialization. Currently `groups` is set but `setGroups` is not used as callback. Fix:

```typescript
// Replace the groups fetch:
useEffect(() => {
  loadGroups();
}, []);

function loadGroups() {
  fetch("/api/groups").then(r => r.json()).then((list) => {
    const map: Record<number, { firstOpDescription: string | null; opCount: number }> = {};
    for (const g of list) map[g.id] = g;
    setGroups(map);
  });
}
```

- [ ] **Step 3: Add checkboxes and selection to tx-item**

Inside the `txs.map` callback, add checkbox at the start of tx-item when `selectMode`:

```tsx
<div key={tx.id} className="tx-item" style={{
  borderLeft: tx.groupId ? `3px solid ${GROUP_COLORS[tx.groupId % 6]}` : undefined,
  paddingLeft: tx.groupId ? "11px" : undefined,
  ...(selectedIds.has(tx.id) ? { background: "rgba(233, 177, 163, 0.06)" } : {}),
}}>
  {selectMode && (
    <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 40 }}
      onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={selectedIds.has(tx.id)}
        onChange={() => {
          const next = new Set(selectedIds);
          if (next.has(tx.id)) next.delete(tx.id);
          else next.add(tx.id);
          setSelectedIds(next);
        }}
        style={{ accentColor: "var(--accent)", cursor: "pointer", width: 16, height: 16 }}
      />
    </div>
  )}
  <div className={`tx-icon ${color}`}><i className={icon} /></div>
  {/* rest of tx-item stays the same except onClick — don't open edit in selectMode */}
```

Change the `onClick` on `tx-item`:
```tsx
onClick={(e) => {
  if (selectMode) {
    const next = new Set(selectedIds);
    if (next.has(tx.id)) next.delete(tx.id);
    else next.add(tx.id);
    setSelectedIds(next);
  } else {
    openEdit(tx);
  }
}}
```

- [ ] **Step 4: Add GROUP_COLORS constant and color for group badge**

Add at top of component (before the component function or inside it):

```typescript
const GROUP_COLORS = ['#E9B1A3', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];
```

Update the group badge in `tx-desc` to use group color:

```tsx
{tx.groupId && groups[tx.groupId] && (
  <button
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ml-2 border transition-colors"
    style={{
      background: `${GROUP_COLORS[tx.groupId % 6]}18`,
      color: GROUP_COLORS[tx.groupId % 6],
      borderColor: `${GROUP_COLORS[tx.groupId % 6]}30`,
    }}
    onClick={(e) => {
      e.stopPropagation();
      setExpandedGroupId(expandedGroupId === tx.groupId ? null : (tx.groupId ?? null));
    }}
  >
    <i className="fa-solid fa-layer-group text-[9px]" />
    {groups[tx.groupId].opCount}
  </button>
)}
```

- [ ] **Step 5: Run build and tests**

```bash
npm test && npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: interactive transaction linking with selection mode and color-coded groups"
```

---

### Task 4: CSS Fine-Tuning

- [ ] **Step 1: Add checkbox and selection styles to globals.css**

Add after existing tx-item styles:

```css
.tx-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

.tx-item.selectable {
  cursor: pointer;
}

.tx-item.selected {
  background: rgba(233, 177, 163, 0.06) !important;
}

.tx-item .tx-group-border {
  border-left: 3px solid var(--accent);
}
```

Already done via inline styles in Task 3, but add fallback class.

- [ ] **Step 2: Verify no visual regressions**

Check that on mobile, the checkbox doesn't cause overflow — it's 32px + 8px gap. The existing 600px media query reduces icon to 34px, so total left side = 32px checkbox + 4px gap + 34px icon = 70px. On a 360px phone that leaves 290px for info + delete. Fine.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add checkbox and selection CSS for transaction linking"
```
