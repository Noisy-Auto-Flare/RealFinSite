
### Task 3: Add button to transactions page

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`

- [ ] **Add scanning state and handler function after the saving state** (after line 42: `const [saving, setSaving] = useState(false);`)

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

- [ ] **Add the button before the card div** (before line 153: `<div className="card">`)

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
