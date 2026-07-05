
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
