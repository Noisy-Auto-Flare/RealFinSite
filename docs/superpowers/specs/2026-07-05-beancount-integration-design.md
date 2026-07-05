# Beancount Integration Design

**Goal:** Integrate Beancount double-entry accounting into FinTracker — all operations are recorded in a `.beancount` ledger file, validated by Beancount's engine, and served via Fava HTTP API for balances, reports, and transaction views — while keeping SQLite as the primary operational database for the UI.

## Architecture Overview

```
                    ┌────────────────────────────────┐
                    │     FinTracker (Next.js)         │
                    │  ┌──────────┐  ┌──────────────┐ │
                    │  │ Frontend  │  │  API Routes  │ │
                    │  └─────┬────┘  └───────┬──────┘ │
                    │        │               │        │
                    │        ▼               ▼        │
                    │  ┌──────────────────────────┐   │
                    │  │     Beancount Layer       │   │
                    │  │  ┌────────────────────┐   │   │
                    │  │  │ fava-api.ts        │   │   │
                    │  │  │ (Fava HTTP client) │   │   │
                    │  │  └────────┬───────────┘   │   │
                    │  │  ┌────────┴───────────┐   │   │
                    │  │  │ regenerate.ts       │   │   │
                    │  │  │ (SQLite → .beancount)│   │   │
                    │  │  └────────────────────┘   │   │
                    │  └──────────────────────────┘   │
                    └────────────────┬───────────────┘
                                     │
              ┌──────────────────────┼──────────────────┐
              │                      │                  │
              ▼                      ▼                  ▼
     ┌──────────────┐    ┌──────────────────┐   ┌──────────────┐
     │    SQLite     │    │ ledger.beancount │   │  Fava (Python)│
     │ (операции,    │◄──►│ (генерируется    │◄──►│  порт 5000    │
     │  счета,       │    │  на лету)        │   │  read-only    │
     │  пользователи)│    └──────────────────┘   └──────────────┘
     └──────────────┘
```

### Key Decisions

- **Primary query layer:** SQLite for writes and fast UI, Fava API for Beancount-verified data (balances, reports)
- **Fava deployment:** Same container as Next.js, managed by supervisord
- **Generation strategy:** Full regeneration from SQLite on demand. Start simple; optimize with incremental approach if 10k+ operations become slow
- **Dirty flag:** Timestamp-based flag to track when regeneration is needed
- **Multi-user:** Single `.beancount` file, userId included in account paths for isolation
- **Fallback:** If Fava is unavailable, gracefully fall back to SQLite data

## Directory Structure

```
data/
  ledger.beancount          — generated Beancount ledger file

src/lib/beancount/
  generate.ts               — operation + entries → Beancount transaction string
  accounts.ts               — accountId → Beancount account path mapping + open directives
  regenerate.ts             — full SQLite → ledger.beancount regeneration
  fava-api.ts               — Fava HTTP API client with graceful fallback
  dirty-flag.ts             — check/reset dirty flag

supervisord.conf            — manages both Next.js and Fava processes

src/app/api/beancount/
  balances/route.ts         — GET /api/beancount/balances
  accounts/route.ts         — GET /api/beancount/accounts
  transactions/route.ts     — GET /api/beancount/transactions
  income-statement/route.ts — GET /api/beancount/income-statement
  balance-sheet/route.ts    — GET /api/beancount/balance-sheet
  holdings/route.ts         — GET /api/beancount/holdings
  check/route.ts            — GET /api/beancount/check
  errors/route.ts           — GET /api/beancount/errors
  export/route.ts           — GET /api/beancount/export (download .beancount)
  reconcile/route.ts        — GET /api/beancount/reconcile (SQLite vs Beancount)
```

## Beancount Account Mapping

| FinTracker Entity | Beancount Account |
|---|---|
| Account (id=N, name=X, userId=U) | `Assets:FinTracker:User{U}:{accountId}:{currency}` |
| Income category | `Income:{category}` |
| Expense category | `Expenses:{category}` |
| Fees / rounding | `Expenses:Fees` |

All accounts are opened with the date of the first operation referencing them, or `2024-01-01` if no operations exist.

The userId is embedded in the account path so each user's data is isolated within the shared ledger file.

### Transaction Generation Logic

One FinTracker operation = one Beancount transaction.

Each `OperationEntry` becomes a Beancount posting with its amount and currency as-is. The sign convention is:

- `amount > 0` on an asset account → Beancount's normal debit balance
- `amount < 0` on an asset account → credit
- Beancount handles the account-type-aware sign display automatically

If postings don't sum to zero (due to decimal rounding), the remainder is posted to `Expenses:Fees`.

### Commodity Directives

Every unique currency used in operations gets a commodity directive in the file header:

```
commodity RUB
commodity USD
commodity USDT
commodity ETH
...
```

## Data Flow

### Write Path (operation mutation)

```
User action → API Route (POST/PUT/DELETE /api/operations)
  → SQLite write (existing flow)
  → Set dirty flag (update timestamp in beancount_dirty table)
  → Return success
```

Same for:
- POST /api/accounts/sync-balances (balance correction → SQLite write → dirty flag)
- Scanner transactions (confirmed ops → SQLite write → dirty flag)

### Read Path (Beancount data)

```
User visits /balances, /ledger, /dashboard
  → Next.js API Route (/api/beancount/*)
  → Check dirty flag
  → If dirty: run regenerate.ts
  → Try Fava API (http://localhost:5000/api/...)
  → If Fava fails → return SQLite fallback data
  → Return JSON to client
```

### Regenerate.ts Flow

```
1. Check dirty flag
2. Query all operations (sorted by date, id) for all users
3. Query all operation_entries
4. Query all accounts (id → name, userId mapping)
5. Generate Beancount file with header:
   - option "title" "FinTracker Ledger"
   - option "operating_currency" "RUB", "USD", "EUR"
   - commodity directives for all currencies used
   - open directives for each account+currency (dated to first operation)
   - balance directive (0) at the date of first operation for each account
   - Transactions sorted by date, each:
     * date, payee (category), narration (description)
     * posting per operation_entry
     * auto-balance to Expenses:Fees if not zero
6. Write file atomically: write to .tmp, then rename to ledger.beancount
7. Reset dirty flag
```

## Cache Table

```sql
CREATE TABLE beancount_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

Cache is invalidated by the dirty flag check (if dirty after cache was written → skip cache). TTL 30s for balances/transactions, 60s for accounts tree, no cache for income-statement/balance-sheet.

## Fava API Error Handling

If Fava is unreachable (container not started, file error, etc.), each proxy route returns data from SQLite directly as fallback. The client never sees a 500 error for Beancount pages — just slightly stale or simplified data with a subtle indicator that Beancount sync is pending.

## Docker Changes

### Dockerfile (additions to runner stage)

```dockerfile
# Install Python, Beancount, Fava, and supervisord
RUN apk add --no-cache python3 py3-pip supervisor && \
    pip3 install --break-system-packages beancount fava

# Copy supervisord config
COPY supervisord.conf /etc/supervisord.conf

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
```

### supervisord.conf

```ini
[supervisord]
nodaemon=true
logfile=/dev/null
pidfile=/tmp/supervisord.pid

[program:nextjs]
command=node server.js
directory=/app
user=nextjs
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:fava]
command=fava /data/ledger.beancount --host 0.0.0.0 --port 5000
user=nextjs
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
autorestart=true
```

### docker-compose.yml

```yaml
ports:
  - "127.0.0.1:${APP_PORT:-3000}:3000"
  - "127.0.0.1:5000:5000"
```

Also mount the data volume so Fava can read the ledger file.

## New Pages

- `/ledger` — table of all transactions from Beancount (date, payee, narration, postings per account) with date filtering and search
- `/balances` — hierarchical tree of accounts with balances, expandable by account path segment

Changes to existing pages:
- `/dashboard` — add total capital widget (Assets - Liabilities) from Beancount
- `/transactions` — optional toggle between SQLite-sourced and Beancount-sourced view

## Task List

1. Install beancount/fava/supervisord in Docker, create supervisord.conf
2. Create `src/lib/beancount/dirty-flag.ts`
3. Create `src/lib/beancount/accounts.ts` — account hierarchy mapping and open directive generation
4. Create `src/lib/beancount/generate.ts` — single operation → Beancount transaction string
5. Create `src/lib/beancount/regenerate.ts` — full .beancount generation from SQLite
6. Create `src/lib/beancount/fava-api.ts` — Fava HTTP client with SQLite fallback
7. Create `beancount_cache` table in schema + migration
8. Create all 10 `/api/beancount/*` proxy routes (balances, accounts, transactions, income-statement, balance-sheet, holdings, check, errors, export, reconcile)
9. Add dirty-flag calls to operation CRUD routes (POST/PUT/DELETE /api/operations)
10. Add dirty-flag calls to syncAddressBalance and scanner runner
11. Create `/ledger` page with transaction table
12. Create `/balances` page with hierarchical tree
13. Update dashboard with Beancount total capital
14. Full-cycle test: create operation → ledger.beancount generated → Fava serves → UI displays

## Rollout

- No migration needed: first visit to any Beancount page triggers regeneration from existing SQLite data
- All existing operations are transcribed to Beancount format
- If Fava starts before the file exists, it creates an empty ledger automatically
- Docker rebuild required to add Python/Fava/supervisord

## Future Optimizations (not in initial scope)

- Incremental generation (append new transactions instead of full rebuild)
- Separate Fava service in docker-compose for independent scaling
- Per-user ledger files for full isolation
