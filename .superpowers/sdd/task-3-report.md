# Task 3 Report: Debts API + Groups API

**Status:** DONE

## Deliverables

### Files created
| File | Lines | Endpoints |
|------|-------|-----------|
| `src/app/api/debts/route.ts` | 52 | `GET /api/debts`, `POST /api/debts` |
| `src/app/api/debts/[id]/route.ts` | 48 | `PATCH /api/debts/[id]`, `DELETE /api/debts/[id]` |
| `src/app/api/groups/route.ts` | 33 | `GET /api/groups`, `POST /api/groups` |
| `src/app/api/groups/[id]/route.ts` | 80 | `GET /api/groups/[id]`, `DELETE /api/groups/[id]` |

### Commit
`f406096` — `feat: debts and groups CRUD API`

### Verification
- `npm run build` — compiled with 0 errors (1 pre-existing warning in health route)
- All 4 routes registered in Next.js route table (`/api/debts`, `/api/debts/[id]`, `/api/groups`, `/api/groups/[id]`)
