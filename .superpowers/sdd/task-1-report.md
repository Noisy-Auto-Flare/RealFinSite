# Task 1: Schema Migrations — Report

## What was implemented

- **New tables** in `src/db/schema.ts`: `debts`, `operationGroups`, `tags`, `operationTags` (with unique composite index)
- **New columns** on `operations` table: `group_id`, `custom_rate`, `custom_rate_label`, `debt_id` (with FK to debts)
- **Migration v4** in `src/db/migrate.ts`: creates new tables, adds new columns via ALTER TABLE, bumps SCHEMA_VERSION from 3 to 4
- **External account type** support:
  - `src/lib/utils.ts`: union type, label ("Внешний счёт"), icon (🫴)
  - `src/app/(dashboard)/accounts/page.tsx`: icon (`fa-hand-holding-dollar`), color (`amber`)
  - `src/app/(dashboard)/accounts/new/page.tsx`: added `"external"` to the type list

## Test results

`npm run dev` compiled without errors. Migration ran successfully:
- All 4 new tables created (operation_groups, debts, tags, operation_tags)
- Unique index on operation_tags created (operation_tag_pk)
- All 4 new columns added to operations table
- App pages served with 200 status

## Files changed

- `src/db/schema.ts` — +4 tables, +4 columns on operations
- `src/db/migrate.ts` — SCHEMA_VERSION 3→4, migration code for new tables + columns
- `src/lib/utils.ts` — added `"external"` to AccountType union, label, and icon maps
- `src/app/(dashboard)/accounts/page.tsx` — added external icon and color
- `src/app/(dashboard)/accounts/new/page.tsx` — added `"external"` to account types list

## Concerns

None.
