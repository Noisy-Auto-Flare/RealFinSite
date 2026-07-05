# Real-World Scenarios Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add operation groups, debts, tag system, and external account type to support real-world financial scenarios.

**Architecture:** Extend existing schema (operations) with new columns; add 3 new tables (operation_groups, debts, tags, operation_tags). New API routes for CRUD on groups, debts, tags. UI changes to NewTransactionModal, Transactions page, new Debts page, Dashboard debt integration.

**Tech Stack:** Next.js 16, SQLite + Drizzle ORM, NextAuth.js

## Global Constraints

- All migrations go through `src/db/migrate.ts` with `SCHEMA_VERSION` bump
- Drizzle schema in `src/db/schema.ts` must match migration DDL
- API routes use `getCurrentUserId()` for auth
- All pages are `"use client"`
- `npm run dev` must compile without errors after each task
- Commit after each task with conventional commit prefix

---

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

### Task 2: Tags API — CRUD + Seed

**Files:**
- Create: `src/app/api/tags/route.ts`
- Create: `src/app/api/tags/[id]/route.ts`
- Verify: `src/db/schema.ts`

**Interfaces:**
- Consumes: `tags`, `operationTags` from schema
- Produces: `GET /api/tags`, `POST /api/tags`, `DELETE /api/tags/[id]`

- [ ] **Step 1: Create `src/app/api/tags/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

const DEFAULT_TAGS = [
  { name: "еда", color: "#22c55e", description: "Продукты, кафе, доставка, рестораны" },
  { name: "транспорт", color: "#3b82f6", description: "Такси, автобус, метро, бензин, билеты" },
  { name: "связь", color: "#8b5cf6", description: "Мобильная связь, домашний интернет" },
  { name: "жильё", color: "#f59e0b", description: "Коммуналка, аренда, ремонт, ЖКХ" },
  { name: "развлечения", color: "#ec4899", description: "Игры, кино, хобби, подписки" },
  { name: "p2p", color: "#06b6d4", description: "Обмен валюты с человеком (P2P)" },
  { name: "инвестиции", color: "#10b981", description: "Пополнение брокера, покупка активов" },
  { name: "комиссия", color: "#ef4444", description: "Любая комиссия (банк, биржа, сеть)" },
  { name: "подарок", color: "#f472b6", description: "Подарки полученные или сделанные" },
  { name: "семья", color: "#e9b1a3", description: "Переводы родственникам, семейные расходы" },
  { name: "здоровье", color: "#34d399", description: "Лекарства, врачи, спорт" },
  { name: "бизнес", color: "#6366f1", description: "Доходы/расходы по фрилансу, работе" },
  { name: "зарплата", color: "#a3e635", description: "Основной доход от работы" },
];

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = db.select().from(tags).all();
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Seed default tags on first use if table empty
  const count = db.select({ count: sql<number>`count(*)` }).from(tags).get()?.count || 0;
  if (count === 0) {
    for (const t of DEFAULT_TAGS) {
      db.insert(tags).values(t).run();
    }
  }

  const existing = db.select().from(tags).where(eq(tags.name, body.name)).get();
  if (existing) {
    return NextResponse.json(existing);
  }

  const created = db.insert(tags).values({
    name: body.name,
    color: body.color || null,
    description: body.description || null,
  }).returning().get();

  return NextResponse.json(created, { status: 201 });
}
```

Add import at top: `import { sql } from "drizzle-orm";`

- [ ] **Step 2: Create `src/app/api/tags/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tagId = parseInt(id, 10);

  db.delete(tags).where(eq(tags.id, tagId)).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run dev
# Visit http://localhost:3000/api/tags — should return seeded tags or []
git add src/app/api/tags/
git commit -m "feat: tags API with auto-seed of default tags"
```

---

### Task 3: Debts API + Groups API

**Files:**
- Create: `src/app/api/debts/route.ts`
- Create: `src/app/api/debts/[id]/route.ts`
- Create: `src/app/api/groups/route.ts`
- Create: `src/app/api/groups/[id]/route.ts`

**Interfaces:**
- Produces: Full CRUD for debts and operation groups

- [ ] **Step 1: Create `src/app/api/debts/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { debts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = db.select().from(debts)
    .where(eq(debts.userId, userId))
    .orderBy(desc(debts.createdAt))
    .all();

  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.personName || body.amount === undefined) {
    return NextResponse.json({ error: "personName and amount are required" }, { status: 400 });
  }

  const created = db.insert(debts).values({
    userId,
    personName: body.personName,
    description: body.description || null,
    amount: body.amount,
    currency: body.currency || "RUB",
    status: "active",
  }).returning().get();

  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: Create `src/app/api/debts/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { debts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const debtId = parseInt(id, 10);

  const existing = db.select().from(debts)
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId))).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  const allowed = ["personName", "description", "amount", "currency", "status", "settledAt"];
  for (const f of allowed) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  if (Object.keys(updates).length > 0) {
    db.update(debts).set(updates).where(eq(debts.id, debtId)).run();
  }

  const updated = db.select().from(debts).where(eq(debts.id, debtId)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const debtId = parseInt(id, 10);

  db.delete(debts).where(and(eq(debts.id, debtId), eq(debts.userId, userId))).run();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create `src/app/api/groups/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { operationGroups, operations } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // List groups with first operation description and operation count
  const list = db.select({
    id: operationGroups.id,
    userId: operationGroups.userId,
    createdAt: operationGroups.createdAt,
    opCount: sql<number>`count(${operations.id})`,
    firstOpDescription: sql<string>`min(${operations.description})`,
  }).from(operationGroups)
    .leftJoin(operations, eq(operations.groupId, operationGroups.id))
    .where(eq(operationGroups.userId, userId))
    .groupBy(operationGroups.id)
    .orderBy(desc(operationGroups.createdAt))
    .all();

  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const created = db.insert(operationGroups).values({ userId }).returning().get();
  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 4: Create `src/app/api/groups/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { operationGroups, operations, operationEntries } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id, 10);

  const group = db.select().from(operationGroups)
    .where(and(eq(operationGroups.id, groupId), eq(operationGroups.userId, userId)))
    .get();

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ops = db.select().from(operations)
    .where(and(eq(operations.groupId, groupId), eq(operations.userId, userId)))
    .orderBy(operations.date)
    .all();

  const opIds = ops.map((o) => o.id);
  const allEntries = opIds.length > 0
    ? db.select().from(operationEntries)
        .where(inArray(operationEntries.operationId, opIds)).all()
    : [];

  const entriesByOpId: Record<number, typeof allEntries> = {};
  for (const e of allEntries) {
    if (!entriesByOpId[e.operationId]) entriesByOpId[e.operationId] = [];
    entriesByOpId[e.operationId].push(e);
  }

  return NextResponse.json({
    ...group,
    operations: ops.map((o) => ({ ...o, entries: entriesByOpId[o.id] || [] })),
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id, 10);

  // Unlink operations from the group, don't delete them
  db.update(operations).set({ groupId: null })
    .where(and(eq(operations.groupId, groupId), eq(operations.userId, userId)))
    .run();

  db.delete(operationGroups)
    .where(and(eq(operationGroups.id, groupId), eq(operationGroups.userId, userId)))
    .run();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Verify and commit**

```bash
npm run dev
# Quick smoke test: GET /api/debts, GET /api/groups
git add src/app/api/debts/ src/app/api/groups/
git commit -m "feat: debts and groups CRUD API"
```

---

### Task 4: Operations API — Extended Fields

**Files:**
- Modify: `src/app/api/operations/route.ts`
- Modify: `src/app/api/operations/[id]/route.ts`

**Interfaces:**
- Consumes: new columns on operations table
- Produces: accept/serve tags, groupId, debtId, customRate, customRateLabel

- [ ] **Step 1: Modify POST /api/operations**

In `src/app/api/operations/route.ts`:

Change line 18 from:
```typescript
const { description, category, date, entries, status } = body;
```
to:
```typescript
const { description, category, date, entries, status, groupId, debtId, customRate, customRateLabel, tags: tagNames } = body;
```

After inserting the operation (after line 43), add tag linking and group/debt fields:

Change the insert values (around line 36-43) to:
```typescript
const op = db.insert(operations).values({
  userId,
  description: description || null,
  category: category || null,
  groupId: groupId || null,
  customRate: customRate || null,
  customRateLabel: customRateLabel || null,
  debtId: debtId || null,
  date,
  source: "manual",
  status: status || "draft",
}).returning().get();
```

After the entries insertion (after line 94), add tag linking:
```typescript
// Link tags
if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
  for (const name of tagNames) {
    const tag = db.select().from(tags).where(eq(tags.name, name)).get();
    if (tag) {
      db.insert(operationTags).values({ operationId: op.id, tagId: tag.id }).run();
    }
  }
}
```

Add imports for `tags` and `operationTags` at top.

Also update the log action line to include tag info:
```typescript
details: `${category || "uncategorized"} operation with ${finalEntries.length} entries${tagNames?.length ? `, tags: ${tagNames.join(", ")}` : ""}`,
```

Update the response to include tags. After line 113 (get createdEntries), add:
```typescript
const createdTags = db.select({ name: tags.name }).from(operationTags)
  .innerJoin(tags, eq(tags.id, operationTags.tagId))
  .where(eq(operationTags.operationId, op.id)).all();
```

And include in response (line 117-120):
```typescript
return NextResponse.json({
  operation: { ...created, entries: createdEntries, tags: createdTags.map(t => t.name) },
  unverifiedFees: unverifiedFees.length > 0 ? unverifiedFees : undefined,
}, { status: 201 });
```

- [ ] **Step 2: Modify GET /api/operations to include tags + group info**

After fetching entries (after line 158), add tag loading:
```typescript
// Also load tags for operations
const allTags = opIds.length > 0
  ? db.select({
      operationId: operationTags.operationId,
      name: tags.name,
    }).from(operationTags)
      .innerJoin(tags, eq(tags.id, operationTags.tagId))
      .where(inArray(operationTags.operationId, opIds)).all()
  : [];
const tagsByOpId: Record<number, string[]> = {};
for (const t of allTags) {
  if (!tagsByOpId[t.operationId]) tagsByOpId[t.operationId] = [];
  tagsByOpId[t.operationId].push(t.name);
}
```

Update the result mapping:
```typescript
const result = list.map((o) => ({
  ...o,
  entries: entriesByOpId[o.id] || [],
  tags: tagsByOpId[o.id] || [],
}));
```

- [ ] **Step 3: Modify PATCH /api/operations/[id] to update new fields**

In `src/app/api/operations/[id]/route.ts`, change allowedFields to include new ones:
```typescript
const allowedFields = ["description", "category", "date", "status", "groupId", "debtId", "customRate", "customRateLabel"] as const;
```

Also add tag update logic after the main update:
```typescript
if (body.tags && Array.isArray(body.tags)) {
  // Remove existing tag links
  db.delete(operationTags).where(eq(operationTags.operationId, opId)).run();
  // Re-add
  for (const name of body.tags) {
    const tag = db.select().from(tags).where(eq(tags.name, name)).get();
    if (tag) {
      db.insert(operationTags).values({ operationId: opId, tagId: tag.id }).run();
    }
  }
}
```

Add imports for `tags`, `operationTags` at top.

Update response to include tags:
After fetching entries (after line 72-73), add:
```typescript
const updatedTags = db.select({ name: tags.name }).from(operationTags)
  .innerJoin(tags, eq(tags.id, operationTags.tagId))
  .where(eq(operationTags.operationId, opId)).all();

return NextResponse.json({ ...updated, entries, tags: updatedTags.map(t => t.name) });
```

- [ ] **Step 4: Modify GET /api/operations/[id] to include tags**

After line 25 (fetching entries), add:
```typescript
const opTags = db.select({ name: tags.name }).from(operationTags)
  .innerJoin(tags, eq(tags.id, operationTags.tagId))
  .where(eq(operationTags.operationId, opId)).all();

return NextResponse.json({ ...op, entries, tags: opTags.map(t => t.name) });
```

- [ ] **Step 5: Verify and commit**

```bash
npm run dev
git add src/app/api/operations/
git commit -m "feat: operations API extended with groups, debts, tags, custom rates"
```

---

### Task 5: NewTransactionModal — Tags Picker

**Files:**
- Modify: `src/components/NewTransactionModal.tsx`

- [ ] **Step 1: Load tags on mount**

Add a `tags` state and fetch on mount:
```typescript
const [allTags, setAllTags] = useState<{ id: number; name: string; color: string | null }[]>([]);
const [selectedTags, setSelectedTags] = useState<string[]>([]);

useEffect(() => {
  fetch("/api/tags").then(r => r.json()).then(setAllTags).catch(() => {});
}, []);
```

- [ ] **Step 2: Replace category dropdown with tag multi-select**

Replace the "Основное" step section that has the category `Select` with a tag picker:

Find the category select and replace with:
```tsx
<div className="form-group">
  <label className="form-label">Теги</label>
  <div className="flex flex-wrap gap-1.5">
    {allTags.map((tag) => (
      <button
        key={tag.id}
        type="button"
        onClick={() => {
          setSelectedTags((prev) =>
            prev.includes(tag.name)
              ? prev.filter((t) => t !== tag.name)
              : [...prev, tag.name]
          );
        }}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
          selectedTags.includes(tag.name)
            ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]"
            : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
        }`}
        style={selectedTags.includes(tag.name) ? { borderColor: tag.color || undefined, color: tag.color || undefined } : undefined}
      >
        {tag.name}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Pass tags in submit**

In the submit handler, where the POST body is built, add:
```typescript
const body = {
  ...existingBody,
  tags: selectedTags,
};
```

- [ ] **Step 4: Remove the category import**

Remove the `CATEGORIES` constant if no longer used anywhere. Remove `category` from form state if it was separate.

- [ ] **Step 5: Verify and commit**

```bash
npm run dev
git add src/components/NewTransactionModal.tsx
git commit -m "feat: tag multi-select picker in NewTransactionModal"
```

---

### Task 6: NewTransactionModal — Group + Debt Selectors

**Files:**
- Modify: `src/components/NewTransactionModal.tsx`

- [ ] **Step 1: Add group selector**

Add state:
```typescript
const [groups, setGroups] = useState<{ id: number; firstOpDescription: string | null; opCount: number }[]>([]);
const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
const [createNewGroup, setCreateNewGroup] = useState(false);
```

Fetch groups on mount:
```typescript
fetch("/api/groups").then(r => r.json()).then(setGroups).catch(() => {});
```

Add in the "Основное" step UI (after tags):
```tsx
<div className="form-group">
  <label className="form-label">Группа</label>
  <div className="flex items-center gap-2">
    <select
      className="form-input flex-1"
      value={selectedGroupId ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "__new__") {
          setCreateNewGroup(true);
          setSelectedGroupId(null);
        } else {
          setSelectedGroupId(val ? Number(val) : null);
          setCreateNewGroup(false);
        }
      }}
    >
      <option value="">— Без группы —</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.firstOpDescription || `Группа #${g.id}`} ({g.opCount} оп.)
        </option>
      ))}
      <option value="__new__">+ Новая группа</option>
    </select>
  </div>
</div>
```

- [ ] **Step 2: Add debt selector**

Add state:
```typescript
const [debts, setDebts] = useState<{ id: number; personName: string; amount: number; currency: string; status: string }[]>([]);
const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);
const [isLoanGiven, setIsLoanGiven] = useState(false);
const [loanPersonName, setLoanPersonName] = useState("");
const [loanDescription, setLoanDescription] = useState("");
```

Fetch debts on mount:
```typescript
fetch("/api/debts").then(r => r.json()).then(setDebts).catch(() => {});
```

Add in UI (after group):
```tsx
<div className="form-group">
  <label className="form-label">
    <input type="checkbox" checked={isLoanGiven} onChange={(e) => setIsLoanGiven(e.target.checked)} className="mr-2" />
    Операция с долгом
  </label>
  {isLoanGiven && (
    <div className="mt-2 space-y-2 pl-4 border-l-2 border-[var(--accent)]/30">
      {selectedDebtId === null && (
        <>
          <input
            type="text"
            className="form-input"
            placeholder="Имя человека"
            value={loanPersonName}
            onChange={(e) => setLoanPersonName(e.target.value)}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Заметка (необязательно)"
            value={loanDescription}
            onChange={(e) => setLoanDescription(e.target.value)}
          />
        </>
      )}
      {debts.filter(d => d.status === "active").length > 0 && (
        <select
          className="form-input"
          value={selectedDebtId ?? ""}
          onChange={(e) => setSelectedDebtId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Создать новый долг —</option>
          {debts.filter(d => d.status === "active").map((d) => (
            <option key={d.id} value={d.id}>
              {d.personName} — {d.amount} {d.currency}
            </option>
          ))}
        </select>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: Handle groups and debts in submit handler**

In the POST body construction:
```typescript
const body: Record<string, unknown> = {
  description,
  date,
  entries: finalEntries,
  status: "confirmed",
  tags: selectedTags,
};

if (selectedGroupId) body.groupId = selectedGroupId;
if (createNewGroup) {
  // Create group first, then link
  const groupRes = await fetch("/api/groups", { method: "POST" });
  const groupData = await groupRes.json();
  body.groupId = groupData.id;
}
if (selectedDebtId) {
  body.debtId = selectedDebtId;
} else if (isLoanGiven && loanPersonName) {
  // Create debt first
  const totalAmount = Math.abs(entries.reduce((s: number, e: Entry) => s + Number(e.amount || 0), 0));
  const debtRes = await fetch("/api/debts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personName: loanPersonName,
      description: loanDescription || `${description || "Долг"}`,
      amount: totalAmount,
      currency: entries[0]?.currency || "RUB",
    }),
  });
  const debtData = await debtRes.json();
  body.debtId = debtData.id;
}
```

- [ ] **Step 4: Verify and commit**

```bash
npm run dev
git add src/components/NewTransactionModal.tsx
git commit -m "feat: group and debt selectors in NewTransactionModal"
```

---

### Task 7: Transactions Page — Group Indicators

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx`

- [ ] **Step 1: Load groups data and show group badge**

Add state:
```typescript
const [groups, setGroups] = useState<Record<number, { firstOpDescription: string | null; opCount: number }>>({});
const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
const [groupOperations, setGroupOperations] = useState<any[]>([]);
```

Fetch groups on mount:
```typescript
useEffect(() => {
  fetch("/api/groups").then(r => r.json()).then((list) => {
    const map: Record<number, { firstOpDescription: string | null; opCount: number }> = {};
    for (const g of list) map[g.id] = g;
    setGroups(map);
  });
}, []);
```

- [ ] **Step 2: Show group badge on each tx item**

Find where each transaction is rendered (the tx-item div). After the description/category area, add:
```tsx
{(op as any).groupId && groups[(op as any).groupId] && (
  <button
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 mt-1 hover:bg-[var(--accent)]/20 transition-colors"
    onClick={(e) => {
      e.stopPropagation();
      setExpandedGroupId(expandedGroupId === (op as any).groupId ? null : (op as any).groupId);
    }}
  >
    <i className="fa-solid fa-layer-group text-[9px]" />
    Группа ({groups[(op as any).groupId].opCount})
  </button>
)}
```

- [ ] **Step 3: Group expansion panel**

After the tx list, if `expandedGroupId` is set, show inline group detail below the active item:
```tsx
{expandedGroupId && (
  <div className="col-span-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mt-2">
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
        Группа: {groups[expandedGroupId]?.firstOpDescription || `Группа #${expandedGroupId}`}
      </h4>
      <button
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        onClick={() => setExpandedGroupId(null)}
      >
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
    {groupOperations.map((gop: any) => (
      <div key={gop.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
        <div className="flex items-center gap-2">
          <i className={`fa-solid ${getTxIcon(gop.entries, gop.source, null)} ${getTxColor(gop.entries) === "green" ? "text-green-400" : "text-red-400"} text-sm`} />
          <div>
            <p className="text-sm text-[var(--text-primary)]">{gop.description || "—"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{gop.date}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold ${getTxColor(gop.entries) === "green" ? "text-green-400" : "text-red-400"}`}>
            {formatAmount(gop.entries.reduce((s: number, e: any) => s + e.amount, 0))}
          </p>
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Load group operations on expand**

Add effect to load group operations:
```typescript
useEffect(() => {
  if (!expandedGroupId) { setGroupOperations([]); return; }
  fetch(`/api/groups/${expandedGroupId}`)
    .then(r => r.json())
    .then(data => setGroupOperations(data.operations || []))
    .catch(() => {});
}, [expandedGroupId]);
```

- [ ] **Step 5: Verify and commit**

```bash
npm run dev
git add src/app/\(dashboard\)/transactions/page.tsx
git commit -m "feat: group indicators and inline group expansion on transactions page"
```

---

### Task 8: Debts Page (New Route)

**Files:**
- Create: `src/app/(dashboard)/debts/page.tsx`

- [ ] **Step 1: Create the debts page**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Debt {
  id: number;
  personName: string;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  settledAt: string | null;
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("RUB");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);

  function loadDebts() {
    setLoading(true);
    fetch("/api/debts")
      .then(r => r.json())
      .then(setDebts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDebts(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personName: newName,
        amount: parseFloat(newAmount),
        currency: newCurrency,
        description: newDesc || null,
      }),
    });
    setNewName(""); setNewAmount(""); setNewDesc("");
    setShowForm(false);
    loadDebts();
  }

  async function handleSettle(id: number) {
    await fetch(`/api/debts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "settled",
        settledAt: new Date().toISOString().split("T")[0],
      }),
    });
    loadDebts();
  }

  async function handleDelete(id: number) {
    if (!confirm("Удалить долг?")) return;
    await fetch(`/api/debts/${id}`, { method: "DELETE" });
    loadDebts();
  }

  const active = debts.filter(d => d.status === "active");
  const settled = debts.filter(d => d.status !== "active");

  if (loading) return <div className="p-8 text-center text-[var(--text-muted)]">Загрузка...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Долги</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {active.length > 0
              ? `${active.length} активных, общая сумма: ${active.reduce((s, d) => s + d.amount, 0).toLocaleString()} ${active[0]?.currency || "RUB"}`
              : "Нет активных долгов"}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="fa-solid fa-plus mr-1.5" />
          Новый долг
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input className="form-input" placeholder="Имя" value={newName} onChange={e => setNewName(e.target.value)} required />
            <input className="form-input" type="number" step="0.01" placeholder="Сумма" value={newAmount} onChange={e => setNewAmount(e.target.value)} required />
            <select className="form-input" value={newCurrency} onChange={e => setNewCurrency(e.target.value)}>
              {["RUB", "USD", "USDT", "CNY"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="form-input" placeholder="Заметка" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">
            <i className="fa-solid fa-check mr-1.5" />
            Создать
          </button>
        </form>
      )}

      {/* Active debts */}
      <div className="space-y-2">
        {active.map((d) => (
          <div key={d.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                <i className="fa-solid fa-user text-[var(--accent)] text-sm" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{d.personName}</p>
                {d.description && <p className="text-xs text-[var(--text-muted)]">{d.description}</p>}
                <p className="text-[11px] text-[var(--text-muted)]">
                  {new Date(d.createdAt).toLocaleDateString("ru-RU")}
                  {" · "}
                  {Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24))} дн.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[var(--text-primary)]">
                +{d.amount.toLocaleString()} {d.currency}
              </span>
              <button className="btn-success text-xs" onClick={() => handleSettle(d.id)}>
                <i className="fa-solid fa-check mr-1" />
                Закрыть
              </button>
              <button className="btn-ghost text-xs text-[var(--text-muted)]" onClick={() => handleDelete(d.id)}>
                <i className="fa-solid fa-trash-can" />
              </button>
            </div>
          </div>
        ))}
        {active.length === 0 && (
          <div className="card p-8 text-center text-[var(--text-muted)]">
            <i className="fa-solid fa-face-smile text-2xl mb-2" />
            <p>Активных долгов нет</p>
          </div>
        )}
      </div>

      {/* Settled debts */}
      {settled.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Закрытые</h3>
          <div className="space-y-1">
            {settled.map((d) => (
              <div key={d.id} className="card p-3 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check-circle text-green-400 text-sm" />
                  <span className="text-sm text-[var(--text-secondary)]">{d.personName}</span>
                  {d.description && <span className="text-xs text-[var(--text-muted)]">— {d.description}</span>}
                </div>
                <span className="text-sm text-[var(--text-muted)]">
                  {d.amount.toLocaleString()} {d.currency}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add debts route to Navbar**

In `src/components/Navbar.tsx`, add a "Долги" link in the "Основное" section after "Транзакции":

```tsx
{ label: "Долги", href: "/debts", icon: "fa-solid fa-hand-holding-dollar" },
```

- [ ] **Step 3: Verify and commit**

```bash
npm run dev
git add src/app/\(dashboard\)/debts/ src/components/Navbar.tsx
git commit -m "feat: debts page with CRUD, new Navbar link"
```

---

### Task 9: Dashboard — Debt Totals

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Fetch debts and include in net worth**

Add state:
```typescript
const [debtTotal, setDebtTotal] = useState(0);
```

Fetch debts after balances load:
```typescript
fetch("/api/debts")
  .then(r => r.json())
  .then((list: any[]) => {
    const active = list.filter((d: any) => d.status === "active");
    const total = active.reduce((s: number, d: any) => s + d.amount, 0);
    setDebtTotal(total);
  })
  .catch(() => {});
```

- [ ] **Step 2: Display debt info**

In the balance grid area, add a line showing debt total:
```tsx
<p className="text-xs text-[var(--text-muted)]">
  Долги: <span className="text-[var(--text-secondary)]">+{debtTotal.toLocaleString()} ₽</span>
</p>
```

Or, if using a separate card, add a 4th card in the balance grid for debts.

- [ ] **Step 3: Verify and commit**

```bash
npm run dev
git add src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: show debt totals on dashboard"
```

---

### Task 10: Migration — Categories to Tags + Remove Category

**Files:**
- Modify: `src/db/migrate.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/app/api/operations/route.ts`
- Modify: `src/app/api/operations/[id]/route.ts`
- Modify: `src/app/(dashboard)/transactions/page.tsx`

- [ ] **Step 1: Add migration to convert existing categories to tags**

In `src/db/migrate.ts`, bump `SCHEMA_VERSION` to 5.

Add migration code after the existing migration sections:
```typescript
console.log("\n[migrate categories to tags]");
// Find all unique non-null categories in operations
const cats = s.prepare(
  "SELECT DISTINCT category FROM operations WHERE category IS NOT NULL AND category != ''"
).all() as { category: string }[];

for (const { category } of cats) {
  // Create a tag for each unique category
  const existing = s.prepare("SELECT id FROM tags WHERE name = ?").get(category);
  if (!existing) {
    s.prepare("INSERT INTO tags (name, color, description) VALUES (?, NULL, ?)")
      .run(category, `Migrated from category "${category}"`);
  }
  const tagId = (s.prepare("SELECT id FROM tags WHERE name = ?").get(category) as any).id;

  // Link all operations with this category to the tag
  const ops = s.prepare("SELECT id FROM operations WHERE category = ?").all(category) as { id: number }[];
  for (const op of ops) {
    s.prepare(
      "INSERT OR IGNORE INTO operation_tags (operation_id, tag_id) VALUES (?, ?)"
    ).run(op.id, tagId);
  }
}

console.log(`  ✓ migrated ${cats.length} categories to tags`);
```

- [ ] **Step 2: Remove category from schema.ts**

In `src/db/schema.ts`, remove the `category` line from the operations definition.

- [ ] **Step 3: Remove category from API routes**

In `src/app/api/operations/route.ts`:
- Remove `category` from destructured body
- Remove `category` from insert values
- Remove `category` from filter conditions (GET handler)
- Update the `logAction` call to not reference category

In `src/app/api/operations/[id]/route.ts`:
- Remove `category` from `allowedFields`

- [ ] **Step 4: Remove category filter from transactions page**

In `src/app/(dashboard)/transactions/page.tsx`:
- Remove `filterCategory` state and related UI
- Remove `category` from the filter API call

- [ ] **Step 5: Verify and commit**

```bash
npm run dev
git add -A
git commit -m "feat: migrate categories to tags, remove category field"
```
