# Task 2: POST /api/groups — Batch Link Operations

**Files:**
- Modify: `src/app/api/groups/route.ts`

**What to do:**

Modify the `POST` handler in `src/app/api/groups/route.ts` to accept `operationIds` and link them to the created group.

Current code:
```typescript
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const created = db.insert(operationGroups).values({ userId }).returning().get();
  return NextResponse.json(created, { status: 201 });
}
```

Replace with:
```typescript
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const operationIds: number[] = body.operationIds || [];

  const created = db.insert(operationGroups).values({ userId }).returning().get();

  if (operationIds.length > 0) {
    const validOps = db.select({ id: operations.id }).from(operations)
      .where(and(
        eq(operations.userId, userId),
        inArray(operations.id, operationIds)
      )).all();
    const validIds = validOps.map(o => o.id);
    if (validIds.length > 0) {
      // Use raw SQL for batch update since Drizzle doesn't have a simple batch update
      const placeholders = validIds.map(() => "?").join(",");
      db.run(sql.raw(`UPDATE operations SET group_id = ${created.id} WHERE id IN (${placeholders})`), ...validIds);
    }
  }

  return NextResponse.json({ id: created.id, colorIndex: created.id % 6 }, { status: 201 });
}
```

**Important:** Add `inArray` to the drizzle-orm import at the top of the file. The current import is:
```typescript
import { eq, desc, sql } from "drizzle-orm";
```
It already has `sql` — you need to add `and`, `inArray`:
```typescript
import { eq, and, inArray, sql } from "drizzle-orm";
```

Also ensure `operations` is imported:
```typescript
import { operationGroups, operations } from "@/db/schema";
```
The current import has both already.

**Test:** Run `npm test` — all tests should pass.

**Commit:**
```bash
git add src/app/api/groups/route.ts
git commit -m "feat: POST /api/groups accepts operationIds for batch linking"
```
