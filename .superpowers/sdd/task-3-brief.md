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


