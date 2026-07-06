# Task 1: Fee as Separate Operation

**Files:**
- Modify: `src/lib/scanners/runner.ts:178-191`

**What to do:**

Replace the fee entry insertion block (lines 178-191) with a new operation creation. Currently fee is added as an `operationEntries` row with `type: "fee"`. Instead, create a separate `operations` row for the fee.

Current code (lines 178-191):
```typescript
  // Attach network fee as a separate entry (outgoing only — user pays the fee)
  if (evt.fee && isOutgoing) {
    const feeAmount = parseFloat(evt.fee.amount) / Math.pow(10, evt.fee.decimals);
    if (feeAmount > 0) {
      db.insert(operationEntries).values({
        operationId: op.id,
        accountId,
        currency: evt.fee.currency || currency,
        amount: -feeAmount,
        type: "fee",
        isVerified: 0,
      }).run();
    }
  }
```

Replace with:
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

**Test:** Run `npm test` — all 95 tests should pass (Task 1 doesn't add new tests, just changes behavior).

**Commit:**
```bash
git add src/lib/scanners/runner.ts
git commit -m "fix: record scanner fees as separate operations, not entries"
```
