# Task 2: Tags API — CRUD + Seed

**Status:** DONE

**Created files:**
- `src/app/api/tags/route.ts` — GET (list all), POST (create + auto-seed on empty table)
- `src/app/api/tags/[id]/route.ts` — DELETE by id

**Verification:**
- `npm run build` — compiled successfully, both routes registered:
  - `ƒ /api/tags`
  - `ƒ /api/tags/[id]`

**Commit:**
- `7915dc6` feat: tags API with auto-seed of default tags

**Summary:** Two route files created per brief spec. GET returns all tags, POST creates a tag (auto-seeds 13 default tags if table is empty), DELETE removes by id. Auth guard via `getCurrentUserId` on all endpoints.
