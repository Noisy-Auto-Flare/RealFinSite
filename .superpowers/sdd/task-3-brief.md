# Task 3: Selection Mode + Checkboxes + Link Bar + Color Coding

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`
- Modify: `src/app/globals.css`

**What to do — 5 edits in page.tsx and 1 CSS addition:**

### Edit 1: Add new state and GROUP_COLORS constant

After line 55 (`const [groupOperations, setGroupOperations] = useState...`), add:

```typescript
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
const GROUP_COLORS = ['#E9B1A3', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];
```

### Edit 2: Replace groups fetch with loadGroups function

Replace lines 70-76:
```
  useEffect(() => {
    fetch("/api/groups").then(r => r.json()).then((list) => {
      const map: Record<number, { firstOpDescription: string | null; opCount: number }> = {};
      for (const g of list) map[g.id] = g;
      setGroups(map);
    });
  }, []);
```

With:
```typescript
  function loadGroups() {
    fetch("/api/groups").then(r => r.json()).then((list) => {
      const map: Record<number, { firstOpDescription: string | null; opCount: number }> = {};
      for (const g of list) map[g.id] = g;
      setGroups(map);
    });
  }
  useEffect(() => { loadGroups(); }, []);
```

### Edit 3: Replace the tab buttons section

Replace lines 175-192 (the whole `flex gap-1 mb-4` div):
```
      <div className="flex gap-1 mb-4">
        {[
          { key: false, label: "Все" },
          { key: true, label: "Связанные" },
        ].map(tab => (
          <button
            ...
          </button>
        ))}
      </div>
```

With:
```tsx
      <div className="flex gap-1 mb-4 items-center flex-wrap">
        <button
          onClick={() => {
            setRelatedOnly(false);
            setSelectMode(false);
            setSelectedIds(new Set());
          }}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            !selectMode && !relatedOnly
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Все
        </button>
        <button
          onClick={() => {
            if (selectMode) {
              setSelectMode(false);
              setSelectedIds(new Set());
            } else {
              setSelectMode(true);
            }
          }}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            selectMode
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {selectMode ? "Отмена" : "Связанные"}
        </button>
        {selectMode && selectedIds.size >= 2 && (
          <button
            onClick={async () => {
              const res = await fetch("/api/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ operationIds: [...selectedIds] }),
              });
              if (res.ok) {
                toast.success(`Связано ${selectedIds.size} операций`);
                setSelectMode(false);
                setSelectedIds(new Set());
                loadTxs();
                loadGroups();
              } else {
                toast.error("Ошибка связывания");
              }
            }}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors bg-[var(--accent)] text-white"
          >
            <i className="fa-solid fa-link mr-1" /> Связать ({selectedIds.size})
          </button>
        )}
        {selectMode && (
          <span className="text-xs text-[var(--text-muted)] ml-auto">
            Выбрано: {selectedIds.size}
          </span>
        )}
      </div>
```

### Edit 4: Replace the entire tx-item rendering block

Replace lines 238-289 (from `{txs.map((tx) => {` to the closing `)})}` before `{expandedGroupId &&...`):

The current code starts at `{txs.map((tx) => {` and the map block includes the icon, info, group badge, entries, and delete button.

Replace with:
```tsx
            {txs.map((tx) => {
              const icon = getTxIcon(tx.entries, tx.source);
              const color = getTxColor(tx.entries);
              const isSelected = selectedIds.has(tx.id);
              const groupColor = tx.groupId ? GROUP_COLORS[tx.groupId % 6] : undefined;
              return (
                <div
                  key={tx.id}
                  className="tx-item"
                  style={{
                    borderLeft: groupColor ? `3px solid ${groupColor}` : undefined,
                    paddingLeft: groupColor ? "11px" : undefined,
                    ...(isSelected ? { background: "rgba(233, 177, 163, 0.06)" } : {}),
                  }}
                  onClick={() => {
                    if (selectMode) {
                      const next = new Set(selectedIds);
                      if (next.has(tx.id)) next.delete(tx.id);
                      else next.add(tx.id);
                      setSelectedIds(next);
                    } else {
                      openEdit(tx);
                    }
                  }}
                >
                  {selectMode && (
                    <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 40 }}
                      onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
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
                  <div className="tx-info">
                    <div className="tx-name">{tx.description || "Операция"}</div>
                    <div className="tx-desc">
                      {new Date(tx.date).toLocaleDateString("ru-RU")}
                      {tx.status === "draft" && <span className="badge badge-pending" style={{ marginLeft: "8px" }}>Черновик</span>}
                      {tx.source.startsWith("scanner") && <span style={{ marginLeft: "6px" }}>· авто</span>}
                      {tx.groupId && groups[tx.groupId] && (
                        <button
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ml-2 border transition-colors"
                          style={{
                            background: `${groupColor}18`,
                            color: groupColor,
                            borderColor: `${groupColor}30`,
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
                    </div>
                    {tx.entries.map((e, i) => (
                      <div key={i} className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1 flex-wrap">
                        {e.accountName ? (
                          <span className="truncate max-w-[120px]">{e.accountName}</span>
                        ) : tx.fromAddress || tx.toAddress ? (
                          <>
                            {tx.fromAddress && <span title={tx.fromAddress} className="shrink-0">{tx.fromAddress.slice(0, 4)}..{tx.fromAddress.slice(-4)}</span>}
                            {tx.fromAddress && tx.toAddress && <span className="shrink-0">→</span>}
                            {tx.toAddress && <span title={tx.toAddress} className="shrink-0">{tx.toAddress.slice(0, 4)}..{tx.toAddress.slice(-4)}</span>}
                          </>
                        ) : null}
                        <span className="ml-auto shrink-0">{formatAmount(e.amount, e.currency)}</span>
                      </div>
                    ))}
                  </div>
                  {!selectMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTx(tx.id); }}
                      className="btn-icon"
                      style={{ width: "32px", height: "32px", fontSize: "14px", flexShrink: 0, alignSelf: "center" }}
                      title="Удалить"
                    >
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  )}
                </div>
              );
            })}
```

### Edit 5: Add CSS for mobile checkbox handling

In `src/app/globals.css`, add to the existing `@media (max-width: 600px)` block (after line 920 or wherever the 600px media query is):

```css
  .tx-item .tx-checkbox {
    width: 28px;
  }
```

(Actually, skip this — the checkbox styling is already inline. The mobile CSS in the 600px query already reduces icon to 34px, and checkbox is 32px, so total = 32 + 8gap + 34 = 74px on the left. That's fine.)

**Test:** Run `npm test` — all tests should pass. Then `npm run dev` (timeout 20s) to verify compilation.

**Commit:**
```bash
git add -A
git commit -m "feat: interactive transaction linking with selection mode and color-coded groups"
```
