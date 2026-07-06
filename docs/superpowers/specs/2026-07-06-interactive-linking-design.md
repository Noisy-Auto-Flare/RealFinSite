# Interactive Transaction Linking Design

## Overview

Three changes to the transactions page:
1. Scanner fee entries become separate operations (bug fix)
2. Interactive selection mode for linking transactions into groups
3. Color-coded visual grouping

---

## 1. Fee as Separate Operation

**Current:** `runner.ts:178-191` — fee is inserted as `operationEntries` row (`type: "fee"`) on the same operation.

**Fix:** Create a separate `operations` row for the fee:

```typescript
const feeOp = db.insert(operations).values({
  userId, description: `Fee (${currency})`,
  date: ..., source: `scanner_${network}`,
  txHash: evt.txHash, blockTimestamp: evt.timestamp,
  status: "confirmed",
}).returning().get();

db.insert(operationEntries).values({
  operationId: feeOp.id, accountId,
  currency: evt.fee.currency || currency,
  amount: -feeAmount, type: "principal", isVerified: 1,
}).run();
```

**Impact:** Old fee entries (`type: "fee"`) remain in DB unused — harmless. No migration needed.

---

## 2. Interactive Linking UI

### State

- `selectMode: boolean` — toggled by the «Связанные» tab button
- `selectedIds: Set<number>` — selected operation IDs while in selectMode
- `groupColors: Record<number, string>` — group ID → color hex, fetched from `GET /api/groups`

### Tab button behavior

| State | Button label | Action |
|-------|-------------|--------|
| `selectMode === false` | «Связанные» | Enter selectMode, show checkboxes |
| `selectMode === true, selectedIds.size < 2` | «Отмена» | Exit selectMode, clear selection |
| `selectMode === true, selectedIds.size >= 2` | «Связать (N)» | Create group, link ops, exit selectMode |

### Selection UX

- Each `tx-item` in selectMode gets a checkbox column on the left (before icon)
- Clicking the item toggles checkbox (does NOT open edit)
- Selected items get a highlighted background (`bg-[var(--accent)]/5` + left border `3px solid <groupColor>` if already in a group)
- «Связать (N)» button appears in a floating bar at the bottom of the tx-list
- Tap outside or press Escape exits selectMode

### API flow

1. `POST /api/groups` `{ name: "Linked group", operationIds: [1,2,3] }` — creates group, links operations in one request
2. Response returns `{ id: number, color: string }`

### Group color palette

6 colors cycled by `groupId % 6`:

```typescript
const GROUP_COLORS = [
  '#E9B1A3', // accent pink
  '#60A5FA', // blue
  '#34D399', // green
  '#FBBF24', // amber
  '#A78BFA', // violet
  '#F472B6', // pink
];
```

- Existing groups get colors assigned on first load
- New groups get color = `GROUP_COLORS[groupId % 6]`

---

## 3. Color-Coded Group Display

### Border highlight

Each `tx-item` with a `groupId` gets:

```
border-left: 3px solid <GROUP_COLORS[groupId % 6]>
border-radius: var(--radius-sm)
padding-left: 11px  /* 14px - 3px to compensate for border */
```

### Group badge in tx-desc

The group badge in `tx-desc` gets the group's color as background tint:

```
bg: <color>/15
text: <color>
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/scanners/runner.ts` | Fee as separate operation |
| `src/app/api/groups/route.ts` | `POST` — accept `operationIds`, return group + color |
| `src/app/(dashboard)/transactions/page.tsx` | selectMode, checkboxes, link bar, color coding |
| `src/app/api/operations/route.ts` | `GET` — return `groupId` in operations list |
| `src/app/globals.css` | `.tx-item.selected` style, `.tx-checkbox` style |

---

## Out of Scope

- Unlinking operations from a group (not requested)
- Deleting groups from the transactions page (use groups page)
- Drag & drop reordering within groups
