
### Task 2: Create `POST /api/scanner/run` endpoint

**Files:**
- Create: `src/app/api/scanner/run/route.ts`

**Interfaces:**
- Consumes: `runScannerCycle(): Promise<{ eventsFound: number; addressesScanned: number }>` from `@/lib/scanners/runner`
- Produces: `POST /api/scanner/run` returns `{ success: true, eventsFound: number, addressesScanned: number }`

- [ ] **Create the API route file**

```typescript
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { runScannerCycle } from "@/lib/scanners/runner";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runScannerCycle();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[api/scanner/run] Scanner cycle failed:", e);
    return NextResponse.json({ error: "Scanner cycle failed" }, { status: 500 });
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/scanner/run/route.ts
git commit -m "feat: add POST /api/scanner/run endpoint"
```
