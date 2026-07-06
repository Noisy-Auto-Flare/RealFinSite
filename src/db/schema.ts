import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'master' | 'user'
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  personName: text("person_name").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("RUB"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  settledAt: text("settled_at"),
});

export const operationGroups = sqliteTable("operation_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color"),
  description: text("description"),
});

export const operationTags = sqliteTable("operation_tags", {
  operationId: integer("operation_id").notNull()
    .references(() => operations.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: uniqueIndex("operation_tag_pk").on(table.operationId, table.tagId),
}));

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // crypto_wallet | cex_exchange | broker | hybrid_bank | fiat_bank
  currency: text("currency").notNull().default("RUB"),
  isActive: integer("is_active").default(1),
  isAutoSync: integer("is_auto_sync").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const accountAddresses = sqliteTable("account_addresses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  network: text("network").notNull(), // solana | bsc | avalanche | ton | ethereum | tron
  address: text("address").notNull(),
  lastSyncBlock: integer("last_sync_block").default(0),
});

export const balances = sqliteTable("balances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amount: real("amount").notNull().default(0),
}, (table) => ({
  accountCurrencyUnique: uniqueIndex("account_currency_unique").on(table.accountId, table.currency),
}));

export const operations = sqliteTable("operations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description"),
  groupId: integer("group_id"),
  customRate: real("custom_rate"),
  customRateLabel: text("custom_rate_label"),
  debtId: integer("debt_id").references(() => debts.id),
  date: text("date").notNull(),
  source: text("source").notNull().default("manual"),
  txHash: text("tx_hash"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  blockTimestamp: integer("block_timestamp"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const operationEntries = sqliteTable("operation_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operationId: integer("operation_id").notNull()
    .references(() => operations.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull()
    .references(() => accounts.id),
  currency: text("currency").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull().default("principal"),
  isVerified: integer("is_verified").notNull().default(0),
});

export const balanceSnapshots = sqliteTable("balance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const exchangeRates = sqliteTable("exchange_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  baseCurrency: text("base_currency").notNull(),
  quoteCurrency: text("quote_currency").notNull(),
  rate: real("rate").notNull(),
  change24h: real("change_24h"),
  source: text("source").default("coingecko"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
}, (table) => ({
  pairUnique: uniqueIndex("pair_unique").on(table.baseCurrency, table.quoteCurrency),
}));

export const apiCredentials = sqliteTable("api_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  exchange: text("exchange").notNull(), // bybit | okx
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  passphrase: text("passphrase"),
  lastSyncAt: text("last_sync_at"),
});

export const blockchainApiKeys = sqliteTable("blockchain_api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  network: text("network").notNull().unique(),
  apiKey: text("api_key").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const tokens = sqliteTable("tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chain: text("chain").notNull(),
  contractAddress: text("contract_address").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name"),
  decimals: integer("decimals").notNull().default(18),
  logoUrl: text("logo_url"),
  metadataSource: text("metadata_source").default("explorer"),
  lastMetadataFetch: text("last_metadata_fetch").default("CURRENT_TIMESTAMP"),
}, (table) => ({
  chainContractIdx: uniqueIndex("chain_contract_idx").on(table.chain, table.contractAddress),
}));

export const actionLogs = sqliteTable("action_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  username: text("username").notNull(),
  action: text("action").notNull(), // create | update | delete | approve | reject | sync
  entityType: text("entity_type").notNull(), // account | transaction | user | credential
  entityId: integer("entity_id"),
  details: text("details"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});
