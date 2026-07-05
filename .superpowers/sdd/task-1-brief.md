### Task 1: Schema Migrations — New Tables + Columns

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrate.ts`

**Interfaces:**
- Produces: `operationGroups`, `debts`, `tags`, `operationTags` tables; new columns on `operations`

- [ ] **Step 1: Add new tables and modify operations in schema.ts**

Open `src/db/schema.ts`. Add after the `users` table definition (before `accounts`):

```typescript
export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  personName: text("person_name").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("RUB"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  settledAt: text("settled_at"),
});

export const operationGroups = sqliteTable("operation_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color"),
  description: text("description"),
});

export const operationTags = sqliteTable("operation_tags", {
  operationId: integer("operation_id").notNull()
    .references(() => operations.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: uniqueIndex("operation_tag_pk").on(table.operationId, table.tagId),
}));
```

Modify the `operations` table — add new columns after `category`:

```typescript
export const operations = sqliteTable("operations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description"),
  category: text("category"),            // ← keep for now, removed in Task 10
  groupId: integer("group_id"),
  customRate: real("custom_rate"),
  customRateLabel: text("custom_rate_label"),
  debtId: integer("debt_id").references(() => debts.id),
  date: text("date").notNull(),
  // ... keep all existing fields below untouched
  source: text("source").notNull().default("manual"),
  txHash: text("tx_hash"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  blockTimestamp: integer("block_timestamp"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
```

- [ ] **Step 2: Add 'external' account type to accounts page icon/color mappings**

In `src/app/(dashboard)/accounts/page.tsx`, add `external` to icon map (around line 28):

```typescript
const ACCOUNT_ICONS: Record<string, string> = {
  crypto_wallet: "fa-solid fa-coins",
  cex_exchange: "fa-solid fa-building-columns",
  broker: "fa-solid fa-chart-line",
  hybrid_bank: "fa-solid fa-building-columns",
  fiat_bank: "fa-solid fa-building-columns",
  external: "fa-solid fa-hand-holding-dollar",     // ← add
};
```

Add to `getAccountColor` function:
```typescript
case "external": return "amber";
```

In `src/app/(dashboard)/accounts/new/page.tsx`, add `"external"` to the account types list:
```typescript
const types = ["crypto_wallet", "cex_exchange", "broker", "hybrid_bank", "fiat_bank", "external"] as const;
```

- [ ] **Step 3: Add migration code in migrate.ts**

Open `src/db/migrate.ts`. Bump `SCHEMA_VERSION` from 3 to 4.

In the `runMigrations` function, add after the tokens section (before indexes):

```typescript
console.log("\n[operation_groups]");
createTable(s, "operation_groups", `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

console.log("\n[debts]");
createTable(s, "debts", `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  person_name TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT
)`);

console.log("\n[tags]");
createTable(s, "tags", `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  description TEXT
)`);

console.log("\n[operation_tags]");
createTable(s, "operation_tags", `(
  operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
)`);
createIndex(s, "operation_tag_pk", "operation_tags", "operation_id, tag_id", true);

console.log("\n[operations new columns]");
addColumn(s, "operations", "group_id", "INTEGER");
addColumn(s, "operations", "custom_rate", "REAL");
addColumn(s, "operations", "custom_rate_label", "TEXT");
addColumn(s, "operations", "debt_id", "INTEGER");
```

- [ ] **Step 4: Verify and commit**

```bash
npm run dev
# Ctrl+C after it starts
git add src/db/schema.ts src/db/migrate.ts src/app/\(dashboard\)/accounts/page.tsx src/app/\(dashboard\)/accounts/new/page.tsx
git commit -m "feat: add schema for groups, debts, tags, operation_tags + migration v4 + external account type"
```

---


