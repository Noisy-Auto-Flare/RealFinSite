# Transactions Overhaul — Design Spec

## 1. Timestamps for Manual Operations
- `POST /api/operations`: if `source === "manual"` and no `blockTimestamp` in body, set `blockTimestamp = Math.floor(Date.now() / 1000)`
- All operations sorted by `date DESC, blockTimestamp DESC, createdAt DESC`
- Group detail displays `blockTimestamp` formatted as `DD.MM.YYYY HH:mm:ss`

## 2. from/to + Account Names
- `GET /api/operations`: JOIN `operationEntries.accountId` → `accounts.name`, include `accountName` in each entry
- `OperationSummary.entries` gains `accountName: string`
- UI: `fromAddress`/`toAddress` shown for scanner ops (shortened addr); `accountName` shown for manual ops
- If both exist, show both: "7RTD...rCJT (Кошелек 1)"

## 3. Fees
- `RawBlockchainEvent` gains `fee?: { amount: string; decimals: number; currency: string }`
- Solana scanner: extract `fee` from Helius response
- TRON scanner: extract `net_fee` from `getTransactionInfoById` response
- TON scanner: storage fee (skip if unavailable)
- EVM scanner: extract `gasUsed * gasPrice * effectiveGasPrice` from tx receipt
- `processEvent`: if `evt.fee` exists, add a second `operationEntries` row with `type: "fee"` and `isVerified: 0`

## 4. Group Detail Panel
- Clicking group badge opens a modal panel (not inline expansion)
- Shows: operation list with columns: Account, Currency, Amount, Type (principal/fee)
- Shows: `blockTimestamp` formatted with seconds, exchange rate if multi-currency
- API: `GET /api/groups/:id` returns `{ group, operations: full ops with entries }`

## 5. «Связанные» Tab
- New filter tab in `/transactions` alongside «Все» and «Фильтры»
- `GET /api/operations?related=true` returns ops grouped by `groupId` OR `txHash` (same txHash = same on-chain tx)
- Each group shows: total amount, accounts involved, link to expand
- Tab label: «Связанные»

## 6. NewTransactionModal Redesign
- Move group selector + debt selector into a collapsible «Доп. опции» section (chevron toggle)
- Add inline tag creation: text input + color picker + «+» button → `POST /api/tags` → refresh tag list
- Default collapsed state

## Files Changed
- `src/lib/scanners/interface.ts` — fee field
- `src/lib/scanners/runner.ts` — fee processing
- `src/lib/scanners/solana.ts` — fee extraction
- `src/lib/scanners/tron.ts` — fee extraction
- `src/lib/scanners/evm/scanner.ts` — fee extraction
- `src/app/api/operations/route.ts` — blockTimestamp on POST, accountName on GET
- `src/app/api/groups/[id]/route.ts` — detail endpoint
- `src/app/(dashboard)/transactions/page.tsx` — tabs, group detail, account display
- `src/components/NewTransactionModal.tsx` — collapsible options, inline tags
- `src/components/TransactionRow.tsx` — account display
