import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'master' | 'user'
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

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
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
}, (table) => ({
  accountCurrencyUnique: uniqueIndex("account_currency_unique").on(table.accountId, table.currency),
}));

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  counterpartyAccountId: integer("counterparty_account_id").references(() => accounts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // income | expense | transfer | exchange
  status: text("status").notNull().default("confirmed"), // confirmed | pending | matched_candidate
  source: text("source").notNull().default("manual"), // manual | scanner_evm | scanner_solana | scanner_ton | api_bybit

  amountFrom: real("amount_from"),
  currencyFrom: text("currency_from"),

  amountTo: real("amount_to"),
  currencyTo: text("currency_to"),

  amount: real("amount").notNull(),
  currency: text("currency").notNull(),

  txHash: text("tx_hash"),
  externalId: text("external_id"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  blockTimestamp: integer("block_timestamp"),

  category: text("category"),
  description: text("description"),
  operationDate: text("operation_date").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const matchedTransactions = sqliteTable("matched_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transactionAId: integer("transaction_a_id").notNull().references(() => transactions.id),
  transactionBId: integer("transaction_b_id").notNull().references(() => transactions.id),
  matchType: text("match_type").notNull(), // internal_transfer | exchange_pair | auto_suggested
  status: text("status").notNull().default("suggested"), // suggested | confirmed | rejected
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const exchangeRates = sqliteTable("exchange_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  baseCurrency: text("base_currency").notNull(),
  quoteCurrency: text("quote_currency").notNull(),
  rate: real("rate").notNull(),
  source: text("source").default("coingecko"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
}, (table) => ({
  pairUnique: uniqueIndex("pair_unique").on(table.baseCurrency, table.quoteCurrency),
}));

export const apiCredentials = sqliteTable("api_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  exchange: text("exchange").notNull(), // bybit
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
});
