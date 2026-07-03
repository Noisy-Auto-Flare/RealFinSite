# Task 1: Schema — add new tables, update balances, define relations

**Files:**
- Modify: `src/db/schema.ts` (entire file)
- Modify: `src/db/index.ts` (add new relations if any)
- Modify: `src/lib/init.ts` (register new migration)
- Modify: `src/test/schema.test.ts` (update for new tables)

**Interfaces:**
- Consumes: existing `users`, `accounts` table definitions
- Produces: `operations`, `operationEntries`, `balanceSnapshots` Drizzle tables; `balances` with `updatedAt` removed; `transactions` and `matchedTransactions` removed

## Steps

### Step 1: Add `operations` table

Insert after `accounts` block:

```typescript
export const operations = sqliteTable("operations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description"),
  category: text("category"),
  date: text("date").notNull(),
  source: text("source").notNull().default("manual"),
  txHash: text("tx_hash"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  blockTimestamp: integer("block_timestamp"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
```

### Step 2: Add `operationEntries` table

```typescript
export const operationEntries = sqliteTable("operation_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operationId: integer("operation_id").notNull()
    .references(() => operations.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull()
    .references(() => accounts.id),
  currency: text("currency").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull().default("principal"),
  isVerified: integer("is_verified").notNull().default(0),
});
```

### Step 3: Add `balanceSnapshots` table

```typescript
export const balanceSnapshots = sqliteTable("balance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
```

### Step 4: Remove `updatedAt` from `balances`

Change `balances` to:
```typescript
export const balances = sqliteTable("balances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amount: real("amount").notNull().default(0),
}, (table) => ({
  accountCurrencyUnique: uniqueIndex("account_currency_unique").on(table.accountId, table.currency),
}));
```

### Step 5: Remove `transactions` and `matchedTransactions` table definitions

Delete the entire `transactions` and `matchedTransactions` table definitions from `schema.ts`.

### Step 6: Remove `matched_candidate` status and unused transaction references from codebase

Search for all references to `matched_candidate` and `matchedTransactions`/`matched_transactions` in non-test files and remove/update them.

Run: `rg "matched_candidate|matched_transactions|matchedTransactions" src/`

### Step 7: Build test

Run: `npx vitest run`
Expected: compilation errors due to removed exports in schema.ts

### Step 8: Commit

```bash
git add src/db/schema.ts
git commit -m "feat: add operations, operation_entries, balance_snapshots tables; drop transactions, matched_transactions"
```
