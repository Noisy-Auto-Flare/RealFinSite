# Multi-Leg Transaction Model — Design Doc

## Problem

Current schema uses a single-row transaction model (`income | expense | transfer | exchange`) that cannot represent:

- Multi-hop exchange chains (USDT→SOL→USDT with fees)
- Fees/costs associated with a transaction
- Coupons, dividends, interest as typed income
- Deposit principal + interest as one event
- P2P swaps between different currencies
- Balance reconciliation with discrepancy tracking

## Solution: Multi-Leg Operations

An **operation** represents one real-world event. Each operation has **N entries** (legs), each recording a movement on one account in one currency.

Core principle: **one operation = one event in life**, regardless of how many accounts or currencies are involved.

---

## Schema Changes

### NEW: `operations`

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | autoincrement |
| user_id | int FK→users | owner |
| description | text nullable | "Купон ОФЗ", "Обмен с Васей" |
| category | text nullable | Еда, Инвестиции, P2P... |
| date | text NOT NULL | event date |
| source | text NOT NULL | `manual`, `scanner_evm`, `scanner_solana`, etc. |
| tx_hash | text nullable | blockchain tx hash |
| from_address | text nullable | |
| to_address | text nullable | |
| block_timestamp | int nullable | |
| status | text NOT NULL DEFAULT 'draft' | `draft` (needs verification) / `confirmed` |
| created_at | text DEFAULT CURRENT_TIMESTAMP | |

### NEW: `operation_entries`

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | autoincrement |
| operation_id | int FK→operations ON DELETE CASCADE | parent operation |
| account_id | int FK→accounts | affected account |
| currency | text NOT NULL | currency of movement |
| amount | real NOT NULL | **positive = inflow, negative = outflow** |
| type | text NOT NULL DEFAULT 'principal' | `principal`, `fee`, `interest`, `coupon`, `dividend`, `correction` |
| is_verified | int NOT NULL DEFAULT 0 | 0 = unconfirmed fee/discrepancy |

**Constraints:** No unique constraint on `(operation_id, account_id, currency, type)` — there can be multiple fee entries of different origins in one operation.

### NEW: `balance_snapshots`

| Column | Type | Description |
|--------|------|-------------|
| id | int PK | autoincrement |
| account_id | int FK→accounts ON DELETE CASCADE | |
| currency | text NOT NULL | |
| amount | real NOT NULL | stated balance from statement |
| date | text NOT NULL | as-of date |
| comment | text nullable | "Сверка за июнь" |
| created_at | text DEFAULT CURRENT_TIMESTAMP | |

### DEPRECATED: `transactions` → removed after migration

### REMOVED: `matched_transactions` — no replacement needed (operation entries serve as the link)

---

## Balance Calculation

Balance is **computed**, never stored via delta-updates:

```sql
SELECT COALESCE(SUM(oe.amount), 0)
FROM operation_entries oe
JOIN operations o ON oe.operation_id = o.id
WHERE oe.account_id = ? AND oe.currency = ? AND o.status = 'confirmed'
```

The `balances` table stays as a **materialized cache** (`recalculateAllBalances()`). The `updatedAt` field is removed (meaningless for computed values). No more `upsertBalance()` with deltas.

---

## Implicit Fee Detection

When entries within an operation don't sum to zero per `(account_id, currency)`, the remainder is an **implicit fee**. The server auto-creates an entry `type=fee, amount=<remainder>, isVerified=0`. User confirms via UI.

Example — 100 USDT left account, 95 arrived:
```
Entry: Account X, USDT, -100, principal, verified=1
Entry: Account X, USDT,  +95, principal, verified=1
→ System: -100 + 95 = -5 → auto-creates:
Entry: Account X, USDT, -5, fee, verified=0
```

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/operations | List, filter by date/category/status, pagination |
| POST | /api/operations | Create operation + entries, auto-suggest fees |
| GET | /api/operations/[id] | Operation with entries |
| PATCH | /api/operations/[id] | Update description, category, date |
| DELETE | /api/operations/[id] | Delete (cascade entries, recalculate balances) |
| PATCH | /api/entries/[id]/verify | Confirm fee entry (set is_verified=1) |
| GET | /api/operations/unverified | All draft ops with unverified fees |
| POST | /api/snapshots | Create balance snapshot |
| GET | /api/snapshots/[accountId] | Snapshot history for account |
| GET | /api/balances | Current computed balances |
| GET | /api/balances/history?date= | Balance at point in time |

---

## Migration Path

1. Add new tables (`operations`, `operation_entries`, `balance_snapshots`)
2. Script: for each row in `transactions`, create `operation` + entries
3. Delete `matched_transactions` and `transactions`
4. Remove `matched_transactions` and old transaction fields from schema
5. Rewrite `POST /api/operations` with fee-detection logic
6. Update frontend: new transaction modal now creates operation with dynamic entry list
7. Update scanner runners to create operations instead of transactions
8. Update exchange syncers (Bybit, OKX) to create operations
