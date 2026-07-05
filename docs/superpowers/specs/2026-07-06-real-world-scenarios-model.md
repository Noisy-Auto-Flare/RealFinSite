# RealFinSite: Data Model for Real-World Scenarios

**Date:** 2026-07-06
**Project:** RealFinSite — Personal finance tracker
**Stack:** Next.js 16, SQLite + Drizzle ORM, NextAuth.js, Vitest

---

## 1. Motivation

The current model (operations + operationEntries) handles multi-leg transactions but misses several real-world requirements:

- **No operation grouping** — A multi-step exchange (RUB → P2P USDT → SOL → back to USDT) is one intent but several operations with no link between them.
- **No debt/loan tracking** — Money lent to friends has no representation.
- **Categories are flat** — One category per operation is insufficient; operations need multiple tags.
- **No custom exchange rates per operation** — Alipay transfers, friend-to-friend exchanges use negotiated rates, not market rates.
- **No "external" account type** — Money held by others (Alipay at mom's, loans given) needs accounts that count toward net worth but aren't directly controlled.

---

## 2. Schema Changes

### 2.1 Operation Groups

Add nullable `groupId` to `operations`. Groups link operations that are part of the same real-world event. A group has no separate name — the earliest operation's description serves as the group label.

```diff
operations: {
  ...existingFields,
+ groupId: integer("group_id"),  // nullable, links related operations
+ customRate: real("custom_rate"),  // nullable, custom exchange rate for this operation
+ customRateLabel: text("custom_rate_label"),  // nullable, "Alipay 11.5", "договорились по 77.92"
}
```

A new table maps users to groups (for the group list view):

```typescript
export const operationGroups = sqliteTable("operation_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
```

Operations within a group are ordered by `date` then `id`.

### 2.2 Debts / Loans

New table for tracking money lent to or borrowed from others:

```typescript
export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  personName: text("person_name").notNull(),     // "Иван", "Мама"
  description: text("description"),               // "На месяц до зарплаты"
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("RUB"),
  status: text("status").notNull().default("active"),  // active | settled | written_off
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  settledAt: text("settled_at"),
});
```

Operations link to debts via optional `debtId`:

```diff
operations: {
  ...existingFields,
+ debtId: integer("debt_id").references(() => debts.id),
}
```

When a debt is repaid in full (sum of linked operation amounts >= debt amount), auto-set `status = 'settled'`.

### 2.3 Tags (Replace Categories)

Remove `operations.category`. New tables:

```typescript
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color"),     // hex color for UI badge
  description: text("description"),  // when to use this tag
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

### 2.4 External Account Type

Add `external` to the `accounts.type` enum. External accounts count toward net worth but are not directly controlled by the user. Used for:

- Money held by family (Alipay at mom's)
- Money lent out (informal loans treated as accounts for tracking)
- Any asset you can't directly access but consider yours

No changes to the `accounts` table schema — just add the type string to the existing enum.

### 2.5 Tag Taxonomy

Predefined tags with usage guidelines:

| Tag | Color | When to use |
|-----|-------|-------------|
| `еда` | `#22c55e` | Продукты, кафе, доставка, рестораны |
| `транспорт` | `#3b82f6` | Такси, автобус, метро, бензин, билеты |
| `связь` | `#8b5cf6` | Мобильная связь, домашний интернет |
| `жильё` | `#f59e0b` | Коммуналка, аренда, ремонт, ЖКХ |
| `развлечения` | `#ec4899` | Игры, кино, хобби, подписки |
| `p2p` | `#06b6d4` | Обмен валюты с человеком (P2P) |
| `инвестиции` | `#10b981` | Пополнение брокера, покупка активов |
| `комиссия` | `#ef4444` | Любая комиссия (банк, биржа, сеть) |
| `подарок` | `#f472b6` | Подарки полученные или сделанные |
| `семья` | `#e9b1a3` | Переводы родственникам, семейные расходы |
| `здоровье` | `#34d399` | Лекарства, врачи, спорт |
| `бизнес` | `#6366f1` | Доходы/расходы по фрилансу, работе |
| `зарплата` | `#a3e635` | Основной доход от работы |
| `прочее` | `#6b7280` | Если ничего не подходит |

---

## 3. Scenario Mapping

Each real-world scenario with model representation:

### 3.1 Salary ("Зарплата июнь")

```
Op: description="Зарплата июнь", status="confirmed"
  Entry: Сбер, RUB, +200000, principal
  Tags: зарплата
  GroupId: null, DebtId: null
```

### 3.2 Purchase ("Пятёрочка 500₽")

```
Op: description="Пятёрочка", status="confirmed"
  Entry: Сбер, RUB, -500, principal
  Tags: еда
```

### 3.3 Internal Transfer ("Пополнение БКС")

```
Op: description="Пополнение БКС", status="confirmed"
  Entry: Сбер, RUB, -50000, principal
  Entry: БКС, RUB, +50000, principal
  Tags: инвестиции
```

Net capital unchanged. The two entries cancel out in net worth calculation.

### 3.4 Multi-step Exchange (Group: "Купил SOL через P2P 15 июня")

```
Group: userId=1, createdAt=...

Op 1: "P2P RUB→USDT Bybit", groupId=G, status="confirmed"
  Entry: Сбер, RUB, -50000, principal
  Entry: Bybit, USDT, +584.8, principal
  customRate: 85.5, customRateLabel: "Bybit P2P курс"
  Tags: p2p

Op 2: "Спот USDT→SOL Bybit", groupId=G, status="confirmed"
  Entry: Bybit, USDT, -580, principal
  Entry: Bybit, SOL, +4.2, principal
  Entry: Bybit, USDT, -4.8, fee
  Tags: p2p

Op 3: "Вывод SOL на Phantom", groupId=G, status="confirmed"
  Entry: Bybit, SOL, -4.2, principal
  Entry: Phantom, SOL, +4.195, principal
  Entry: Phantom, SOL, -0.005, fee
  Tags: p2p
```

### 3.5 Friend Exchange ("Обмен с Васей: 3.85 USDT ↔ 300₽")

```
Op: description="Обмен с Васей", status="confirmed"
  Entry: Phantom, USDT, -3.85, principal
  Entry: Наличные, RUB, +300, principal
  customRate: 77.92, customRateLabel: "Договорились по 77.92"
  Tags: p2p
```

### 3.6 Alipay Transfer ("Перевод маме 50000₽")

```
Op: description="Перевод маме", status="confirmed"
  Entry: Сбер, RUB, -50000, principal
  Entry: Alipay (моё у мамы), CNY, +∠, principal
  customRate: 11.5, customRateLabel: "Alipay rate"
  Tags: семья

Account "Alipay (моё у мамы)": type=external, currency=CNY
```

### 3.7 Loan Given ("Занял Ивану 4000₽")

```
Debt: personName="Иван", amount=4000, currency=RUB, status=active,
      description="На месяц до зарплаты"

Op: description="Занял Ивану", status="confirmed"
  Entry: Наличные, RUB, -4000, principal
  debtId: D
  Tags: прочее
```

When repaid:

```
Op: description="Иван вернул долг", status="confirmed"
  Entry: Наличные, RUB, +4000, principal
  debtId: D
  Tags: прочее

→ System auto-sets debt D.status = 'settled', D.settledAt = now
```

---

## 4. UI Changes

### 4.1 NewTransactionModal — Groups

When creating a new operation, show a "Привязать к группе" toggle:

- If on, show group selector: existing groups list + "Создать новую группу"
- The group list displays `[date] description (N операций)`
- If creating a new group, all operations created within a 5-minute window of the first one are auto-added to the same group

### 4.2 NewTransactionModal — Debts

When the operation is a loan give/take, show debt selector:

- If total entries negative → "Выдать долг" mode (auto-creates debt + links operation)
- If positive → "Возврат долга" mode (select existing active debt)
- Simple UI: pick person name (with autocomplete from existing debts), optionally add note

### 4.3 Tags UI

Category dropdown → tag multi-select with colored badges.

When creating/editing an operation:
- Searchable tag picker with suggested tags based on entry amounts
- Predefined tags shown as colored pills

### 4.4 Debts Page (new route `/debts`)

List view: active debts first, then settled. Each shows:
- Person name, amount, currency +/- converted to base
- Notes
- Age (days since created)
- "Закрыть" button (settle without new operation)
- "Добавить операцию" (quick-add repayment)

### 4.5 Group View on Transactions Page

When viewing transactions, group indicator:
- If operation has `groupId`, show a small `[G]` icon and group highlight
- Clicking the group icon shows all operations in that group (inline expansion or drawer)
- Group header shows "Группа: [description of first op]" and total net effect

---

## 5. API Changes

### 5.1 New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/groups` | List groups for user |
| GET | `/api/groups/[id]` | Get group with all operations |
| POST | `/api/groups` | Create empty group |
| DELETE | `/api/groups/[id]` | Delete group (ungroup operations) |
| GET | `/api/debts` | List debts |
| POST | `/api/debts` | Create debt |
| PATCH | `/api/debts/[id]` | Update debt (settle, edit) |
| DELETE | `/api/debts/[id]` | Delete debt |
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create tag |
| GET | `/api/tags/suggestions` | Get suggested tags for given entries |

### 5.2 Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/operations` | Accept `groupId`, `debtId`, `customRate`, `customRateLabel`, `tags` |
| PATCH | `/api/operations/[id]` | Accept same fields |
| GET | `/api/operations` | Return `tags[]`, `group`, `debt` in response |
| GET | `/api/accounts` | Include `type=external` accounts |

### 5.3 Agent API

Existing operations CRUD is sufficient. The agent calls:
```
POST /api/operations
{ description: "купил продукты",
  entries: [{ accountId: 1, currency: "RUB", amount: -500 }],
  tags: ["еда"] }
```

Future: a `/api/agent/parse` endpoint that takes natural language, uses an LLM parser to structure the call.

---

## 6. Balance Calculation

Balances remain computed from `operationEntries`. Changes:

- `recalculateAllBalances` iterates all confirmed operations and sums entries per `(accountId, currency)`.
- Debts do NOT affect the `balances` table. Debt amounts are summed separately on the dashboard from the `debts` table (active debts only, positive amount = what you're owed).
- Net worth = sum(balances) - sum(liabilities) + sum(debts where you are the lender).

---

## 7. Implementation Order

1. Schema migrations: tags, operation_tags, debts, operation_groups, add fields to operations
2. Seed predefined tags
3. API: tags CRUD, debts CRUD, groups CRUD
4. API: modify operations to accept/serve new fields
5. UI: NewTransactionModal — tags picker (multi-select, colored)
6. UI: NewTransactionModal — debt selector
7. UI: NewTransactionModal — group selector
8. UI: Transactions page — group indicators, group expansion
9. UI: Debts page (new route)
10. UI: Dashboard — include debt totals in net worth
11. Remove `operations.category` (migrate existing data to tags)
12. Agent API: verify agent can create tagged, linked operations

---

## 8. Risks

| Risk | Mitigation |
|------|-----------|
| Migrating existing categories to tags loses data | Create tag per unique category value, auto-link all existing ops |
| Groups UI makes transaction creation too complex | Groups are opt-in; simple create stays one-click |
| Debt auto-settle might fire incorrectly | Only on operations with debtId AND entry sum >= full debt amount |
