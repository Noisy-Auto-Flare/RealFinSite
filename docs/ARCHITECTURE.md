# Architecture

## Data Model

### Operations

The core entity. One operation = one real-world event.

```
operations
├── id            INTEGER PRIMARY KEY
├── user_id       INTEGER → users(id)
├── description   TEXT (optional)
├── category      TEXT (optional) — Зарплата, Продукты, etc.
├── date          TEXT — YYYY-MM-DD
├── source        TEXT — "manual" | "scanner_*" | "api_bybit" | "api_okx"
├── tx_hash       TEXT (optional) — blockchain tx hash
├── status        TEXT — "draft" | "confirmed"
└── created_at    TEXT
```

### Operation Entries

Each operation has 1+ entries (legs). Each entry records movement on one account in one currency.

```
operation_entries
├── id              INTEGER PRIMARY KEY
├── operation_id    INTEGER → operations(id) ON DELETE CASCADE
├── account_id      INTEGER → accounts(id)
├── currency        TEXT — RUB, USD, USDT, CNY, SOL, BNB, TON
├── amount          REAL — positive = inflow, negative = outflow
├── type            TEXT — "principal" | "fee" | "discount" | "interest" | "coupon"
└── is_verified     INTEGER — 0 | 1
```

### Balances (materialized cache)

Computed as SUM of confirmed entry amounts per (account, currency).

```
balances
├── account_id   INTEGER → accounts(id)
├── currency     TEXT
└── amount       REAL
```

## Business Logic

### Fee Detection

When an operation is created, the system checks if the sum of `principal` entries per (account, currency) creates a deficit vs expected. A detected deficit is split into a reduced principal + a fee entry. Fees start as `is_verified = 0` and must be confirmed by the user.

### Balance Recalculation

Triggered on:
- Operation confirmation (status → "confirmed")
- Operation deletion
- Manual via `/api/balances` GET with `?recalculate=true`

Runs: `DELETE FROM balances` → `INSERT INTO balances SELECT ... SUM(oe.amount) FROM operation_entries oe JOIN operations o ON oe.operation_id = o.id WHERE o.status = 'confirmed'`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/operations | List operations (paginated, filterable) |
| POST | /api/operations | Create operation (with fee detection) |
| GET | /api/operations/[id] | Get operation with entries |
| PATCH | /api/operations/[id] | Update operation |
| DELETE | /api/operations/[id] | Delete operation |
| GET | /api/operations/unverified | List operations with unverified fees |
| PATCH | /api/entries/[id]/verify | Verify a specific entry |
| GET | /api/accounts | List accounts |
| POST | /api/accounts | Create account |
| GET | /api/balances | Get current balances |
| GET | /api/balances/history | Balance history |
| GET | /api/snapshots | Balance snapshots |
| POST | /api/snapshots | Create snapshot |
| GET | /api/stats/summary | Dashboard statistics |
| GET | /api/exchange/credentials | Exchange API credentials |
| POST | /api/exchange/sync | Trigger exchange sync |
| GET | /api/rates | Exchange rates |
| GET | /api/admin/logs | Admin action logs |
| GET | /api/admin/users | Admin user management |
| GET | /api/profile | Current user profile |
| GET | /api/health | Health check |

## Design Decisions

1. **Multi-leg operations** over single-row transactions. Enables: fees, coupons, interest per entry; exchange sync with native fees; balance reconciliation per (account, currency).
2. **Materialized balances** over live SUM queries. Better read performance at the cost of write overhead during confirmation.
3. **SQLite** over Postgres. Zero setup, file-based backup, sufficient for single-user/small-team usage.
4. **Implicit fees** over explicit fee input. System detects deficits automatically; user only confirms.
