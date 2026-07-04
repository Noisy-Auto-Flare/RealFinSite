# EVM Scanner Universal Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-network EVM scanner with a config-driven universal scanner supporting 12+ Etherscan‑compatible networks (Ethereum, BSC, Avalanche, Polygon, Base, Arbitrum, Optimism, Fantom, Cronos, Aurora, Moonbeam, Gnosis), add a `tokens` metadata cache table, and register all networks in `getScanner()`.

**Architecture:** Config-driven approach — `EvmNetworkConfig[]` in `evm/config.ts` defines all supported EVM networks. The `EvmScanner` class reads from config, no per‑network if/switch logic. Token metadata is cached in a new `tokens` SQLite table with lazy fetch (check cache → DB → explorer API). `getScanner()` in `interface.ts` uses a `Set` for EVM network matching instead of individual `case` statements.

**Tech Stack:** TypeScript, drizzle-orm, better-sqlite3, REST explorer APIs (Etherscan‑compatible JSON)

## Global Constraints
- All DDL operations must be idempotent via `createTable()` in migrate.ts
- Schema version must be bumped to 2 to trigger migration for `tokens` table
- Follow existing patterns: `sqliteTable` in schema.ts, `createTable` in migrate.ts, `IScanner` interface
- HMR-safe: no `let` module guards outside `globalThis`
- No external dependencies beyond what's already in package.json

---

### Task 1: Create `evm/config.ts` — EVM network configuration

**Files:**
- Create: `src/lib/scanners/evm/config.ts`

**Interfaces:**
- Produces: `EvmNetworkConfig` interface, `EVM_NETWORKS` Record export

- [ ] **Step 1: Write config.ts**

```typescript
export interface EvmNetworkConfig {
  name: string;
  apiUrl: string;
  envKey: string;
  nativeSymbol: string;
  nativeDecimals: number;
}

export const EVM_NETWORKS: Record<string, EvmNetworkConfig> = {
  ethereum: {
    name: "ethereum",
    apiUrl: "https://api.etherscan.io/api",
    envKey: "ETHERSCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  bsc: {
    name: "bsc",
    apiUrl: "https://api.bscscan.com/api",
    envKey: "BSCSCAN_API_KEY",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
  },
  avalanche: {
    name: "avalanche",
    apiUrl: "https://api.snowtrace.io/api",
    envKey: "SNOWTRACE_API_KEY",
    nativeSymbol: "AVAX",
    nativeDecimals: 18,
  },
  polygon: {
    name: "polygon",
    apiUrl: "https://api.polygonscan.com/api",
    envKey: "POLYGONSCAN_API_KEY",
    nativeSymbol: "POL",
    nativeDecimals: 18,
  },
  base: {
    name: "base",
    apiUrl: "https://api.basescan.org/api",
    envKey: "BASESCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  arbitrum: {
    name: "arbitrum",
    apiUrl: "https://api.arbiscan.io/api",
    envKey: "ARBISCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  optimism: {
    name: "optimism",
    apiUrl: "https://api-optimistic.etherscan.io/api",
    envKey: "OPTIMISM_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  fantom: {
    name: "fantom",
    apiUrl: "https://api.ftmscan.com/api",
    envKey: "FANTOM_API_KEY",
    nativeSymbol: "FTM",
    nativeDecimals: 18,
  },
  cronos: {
    name: "cronos",
    apiUrl: "https://api.cronoscan.com/api",
    envKey: "CRONOS_API_KEY",
    nativeSymbol: "CRO",
    nativeDecimals: 18,
  },
  aurora: {
    name: "aurora",
    apiUrl: "https://api.aurorascan.dev/api",
    envKey: "AURORA_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
  },
  moonbeam: {
    name: "moonbeam",
    apiUrl: "https://api.moonbeam.moonscan.io/api",
    envKey: "MOONBEAM_API_KEY",
    nativeSymbol: "GLMR",
    nativeDecimals: 18,
  },
  gnosis: {
    name: "gnosis",
    apiUrl: "https://api.gnosisscan.io/api",
    envKey: "GNOSIS_API_KEY",
    nativeSymbol: "xDAI",
    nativeDecimals: 18,
  },
};
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit`
Expected: no errors

---

### Task 2: Add `tokens` table to schema and migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrate.ts`

**Interfaces:**
- Consumes: `EVM_NETWORKS` (Task 1)
- Produces: `tokens` table definition in schema, migration step

- [ ] **Step 1: Add `tokens` table to schema.ts**

Add after `blockchainApiKeys`:

```typescript
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
  chainContractUnique: uniqueIndex("chain_contract_idx").on(table.chain, table.contractAddress),
}));
```

- [ ] **Step 2: Bump SCHEMA_VERSION to 2 in migrate.ts**

Change `const SCHEMA_VERSION = 1;` to `const SCHEMA_VERSION = 2;`

- [ ] **Step 3: Add tokens table creation to runMigrations**

Before `console.log("\n[indexes]");`, add:

```typescript
console.log("\n[tokens]");
createTable(s, "tokens", `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  decimals INTEGER NOT NULL DEFAULT 18,
  logo_url TEXT,
  metadata_source TEXT DEFAULT 'explorer',
  last_metadata_fetch TEXT DEFAULT CURRENT_TIMESTAMP
)`);
createIndex(s, "chain_contract_idx", "tokens", "chain, contract_address", true);
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`

Expected: clean exit

---

### Task 3: Rewrite `evm.ts` into modular `evm/scanner.ts`

**Files:**
- Replace: `src/lib/scanners/evm.ts` → `src/lib/scanners/evm/scanner.ts`

**Interfaces:**
- Consumes: `EVM_NETWORKS` (Task 1), `IScanner` interface, `getNetworkApiKey`
- Produces: `EvmScanner` class implementing `IScanner`

- [ ] **Step 1: Create evm/ directory and write scanner.ts**

```typescript
import { IScanner, NativeBalanceResult, RawBlockchainEvent, BalanceEntry, AllBalancesResult } from "../interface";
import { getNetworkApiKey } from "../api-keys";
import { EVM_NETWORKS, EvmNetworkConfig } from "./config";

interface ExplorerTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
  contractAddress?: string;
  tokenDecimal?: string;
  tokenSymbol?: string;
  gasPrice?: string;
  gasUsed?: string;
}

interface ExplorerResponse {
  status: string;
  message: string;
  result: ExplorerTx[];
}

export class EvmScanner implements IScanner {
  network: string;
  private config: EvmNetworkConfig;

  constructor(network: string) {
    this.network = network;
    this.config = EVM_NETWORKS[network];
    if (!this.config) throw new Error(`Unsupported EVM network: ${network}`);
  }

  private getApiKey(): string {
    return process.env[this.config.envKey] || getNetworkApiKey(this.network) || "";
  }

  private async fetchExplorer(
    action: string,
    address: string,
    fromBlock: number,
    page = 1
  ): Promise<ExplorerTx[]> {
    const apiKey = this.getApiKey();
    const url =
      `${this.config.apiUrl}?module=account&action=${action}` +
      `&address=${address}&startblock=${fromBlock}&endblock=99999999&sort=asc` +
      `&page=${page}&offset=10000&apikey=${apiKey}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      const data: ExplorerResponse = await res.json();
      if (data.status !== "1" || !Array.isArray(data.result)) return [];
      if (data.result.length >= 10000) {
        const next = await this.fetchExplorer(action, address, fromBlock, page + 1);
        return [...data.result, ...next];
      }
      return data.result;
    } catch {
      return [];
    }
  }

  async fetchNewTransactions(address: string, fromBlock: number): Promise<RawBlockchainEvent[]> {
    const events: RawBlockchainEvent[] = [];

    const normalTxs = await this.fetchExplorer("txlist", address, fromBlock);
    for (const tx of normalTxs) {
      if (tx.value === "0") continue;
      events.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: tx.value,
        tokenContract: null,
        decimals: this.config.nativeDecimals,
        timestamp: parseInt(tx.timeStamp, 10),
        blockNumber: parseInt(tx.blockNumber, 10),
        tokenSymbol: this.config.nativeSymbol,
      });
    }

    const tokenTxs = await this.fetchExplorer("tokentx", address, fromBlock);
    for (const tx of tokenTxs) {
      const decimals = parseInt(tx.tokenDecimal || "18", 10);
      events.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: tx.value,
        tokenContract: tx.contractAddress || null,
        decimals,
        timestamp: parseInt(tx.timeStamp, 10),
        blockNumber: parseInt(tx.blockNumber, 10),
        tokenSymbol: tx.tokenSymbol || undefined,
      });
    }

    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }

  async fetchNativeBalance(address: string): Promise<NativeBalanceResult | null> {
    const apiKey = this.getApiKey();
    try {
      const balanceRes = await fetch(
        `${this.config.apiUrl}?module=account&action=balance&address=${address}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!balanceRes.ok) return null;
      const balanceData: { status: string; result: string } = await balanceRes.json();
      if (balanceData.status !== "1") return null;

      const blockRes = await fetch(
        `${this.config.apiUrl}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!blockRes.ok) return null;
      const blockData: { result: string } = await blockRes.json();

      return {
        balance: balanceData.result,
        decimals: this.config.nativeDecimals,
        blockNumber: parseInt(blockData.result, 16),
      };
    } catch {
      return null;
    }
  }

  async fetchAllBalances(address: string): Promise<AllBalancesResult | null> {
    const native = await this.fetchNativeBalance(address);
    if (!native) return null;

    return {
      balances: [{
        currency: this.config.nativeSymbol,
        balance: native.balance,
        decimals: native.decimals,
      }],
      blockNumber: native.blockNumber,
    };
  }
}
```

- [ ] **Step 2: Delete old `src/lib/scanners/evm.ts`**

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`

Expected: clean exit

---

### Task 4: Update `interface.ts` `getScanner()` to use EVM set

**Files:**
- Modify: `src/lib/scanners/interface.ts`

**Interfaces:**
- Consumes: `EvmScanner` (Task 3), `EVM_NETWORKS` (Task 1)
- Produces: Updated `getScanner()` that registers all 12 EVM networks

- [ ] **Step 1: Replace switch with set-based dispatch**

```typescript
import { EVM_NETWORKS } from "./evm/config";

export async function getScanner(network: string): Promise<IScanner | null> {
  if (EVM_NETWORKS[network]) {
    const { EvmScanner } = await import("./evm/scanner");
    return new EvmScanner(network);
  }

  switch (network) {
    case "solana": {
      const { SolanaScanner } = await import("./solana");
      return new SolanaScanner();
    }
    case "ton": {
      const { TonScanner } = await import("./ton");
      return new TonScanner();
    }
    default:
      return null;
  }
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`

Expected: clean exit

---

### Task 5: Create `token-metadata.ts` — universal cached metadata service

**Files:**
- Create: `src/lib/token-metadata.ts`
- Modify: `src/db/schema.ts` (if `tokens` not yet imported — already done in Task 2)

**Interfaces:**
- Consumes: `tokens` table (Task 2), `getNetworkApiKey`
- Produces: `getTokenMetadata(chain, contractAddress)` returning `TokenMetadata | null`

- [ ] **Step 1: Write token-metadata.ts**

```typescript
import { db } from "@/db";
import { tokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface TokenMetadata {
  chain: string;
  contractAddress: string;
  symbol: string;
  name?: string;
  decimals: number;
  source: string;
}

const metadataCache = new Map<string, TokenMetadata>();

export async function getTokenMetadata(
  chain: string,
  contractAddress: string
): Promise<TokenMetadata | null> {
  const key = `${chain}:${contractAddress.toLowerCase()}`;

  if (metadataCache.has(key)) {
    return metadataCache.get(key)!;
  }

  // Check DB
  try {
    const cached = db.select().from(tokens)
      .where(and(
        eq(tokens.chain, chain),
        eq(tokens.contractAddress, contractAddress)
      ))
      .get();

    if (cached) {
      const meta: TokenMetadata = {
        chain: cached.chain,
        contractAddress: cached.contractAddress,
        symbol: cached.symbol,
        name: cached.name || undefined,
        decimals: cached.decimals,
        source: cached.metadataSource || "db",
      };
      metadataCache.set(key, meta);
      return meta;
    }
  } catch {
    // DB not ready yet
  }

  // Fetch from external API
  const meta = await fetchExternalMetadata(chain, contractAddress);
  if (meta) {
    try {
      db.insert(tokens).values({
        chain: meta.chain,
        contractAddress: meta.contractAddress,
        symbol: meta.symbol,
        name: meta.name || null,
        decimals: meta.decimals,
        metadataSource: meta.source,
      }).run();
    } catch {
      // race condition on insert, ignore
    }
    metadataCache.set(key, meta);
  }
  return meta;
}

async function fetchExternalMetadata(
  chain: string,
  contractAddress: string
): Promise<TokenMetadata | null> {
  // For EVM: use tokentx data or tokeninfo (Pro feature)
  // For now, we only cache what tokentx already provides.
  // The tokentx endpoint returns symbol+decimals inline in each tx,
  // so this is just a cache for future lookups.
  const evmNetworks = new Set([
    "bsc", "avalanche", "ethereum", "polygon", "base",
    "arbitrum", "optimism", "fantom", "cronos", "aurora",
    "moonbeam", "gnosis",
  ]);

  if (evmNetworks.has(chain)) {
    // Use tokeninfo if available (Pro feature, may fail)
    try {
      const { EVM_NETWORKS } = await import("./scanners/evm/config");
      const { getNetworkApiKey } = await import("./scanners/api-keys");
      const cfg = EVM_NETWORKS[chain];
      if (!cfg) return null;
      const apiKey = process.env[cfg.envKey] || getNetworkApiKey(chain) || "";
      const url = `${cfg.apiUrl}?module=token&action=tokeninfo&contractaddress=${contractAddress}&apikey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data: { status: string; result: { symbol: string; name: string; decimals: string }[] } = await res.json();
        if (data.status === "1" && data.result?.length > 0) {
          const info = data.result[0];
          return {
            chain,
            contractAddress,
            symbol: info.symbol,
            name: info.name,
            decimals: parseInt(info.decimals, 10) || 18,
            source: "explorer",
          };
        }
      }
    } catch {
      // tokeninfo not available (Pro-only), fall through
    }
  }

  // For Solana: use Helius token metadata
  if (chain === "solana") {
    try {
      const apiKey = process.env.HELIUS_API_KEY || (await import("./scanners/api-keys")).getNetworkApiKey("solana");
      if (apiKey) {
        const url = `https://api.helius.xyz/v0/token-metadata?apiKey=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mintAccounts: [contractAddress] }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const data: any[] = await res.json();
          if (data.length > 0 && data[0].symbol) {
            return {
              chain: "solana",
              contractAddress,
              symbol: data[0].symbol,
              name: data[0].name,
              decimals: data[0].decimals ?? 6,
              source: "helius",
            };
          }
        }
      }
    } catch {}
  }

  return null;
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`

Expected: clean exit

---

### Task 6: Update `api-keys.ts` ENV_MAP for new networks

**Files:**
- Modify: `src/lib/scanners/api-keys.ts`

- [ ] **Step 1: Add new env vars to ENV_MAP**

```typescript
const ENV_MAP: Record<string, string> = {
  bsc: "BSCSCAN_API_KEY",
  avalanche: "SNOWTRACE_API_KEY",
  ethereum: "ETHERSCAN_API_KEY",
  polygon: "POLYGONSCAN_API_KEY",
  base: "BASESCAN_API_KEY",
  arbitrum: "ARBISCAN_API_KEY",
  optimism: "OPTIMISM_API_KEY",
  fantom: "FANTOM_API_KEY",
  cronos: "CRONOS_API_KEY",
  aurora: "AURORA_API_KEY",
  moonbeam: "MOONBEAM_API_KEY",
  gnosis: "GNOSIS_API_KEY",
  solana: "HELIUS_API_KEY",
  ton: "TONCENTER_API_KEY",
};
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`

Expected: clean exit

---

### Task 7: Update `runner.ts` to use `getTokenMetadata` in `processEvent`

**Files:**
- Modify: `src/lib/scanners/runner.ts`

- [ ] **Step 1: Add import and use getTokenMetadata for token symbols**

```typescript
import { getTokenMetadata } from "@/lib/token-metadata";
```

In `processEvent`, replace the currency computation line:

```typescript
const nativeSymbol = NATIVE_CURRENCIES[network] || "ETH";
let currency: string;
if (evt.tokenSymbol) {
  currency = evt.tokenSymbol;
} else if (evt.tokenContract) {
  const meta = await getTokenMetadata(network, evt.tokenContract);
  currency = meta?.symbol || "TOKEN";
} else {
  currency = nativeSymbol;
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`

Expected: clean exit

---

### Task 8: Update `.env.example` with new API keys

**Files:**
- Modify: `.env.example` (create if missing)

- [ ] **Step 1: Write/update .env.example**

```
# Explorer API keys (EVM networks)
ETHERSCAN_API_KEY=
BSCSCAN_API_KEY=
SNOWTRACE_API_KEY=
POLYGONSCAN_API_KEY=
BASESCAN_API_KEY=
ARBISCAN_API_KEY=
OPTIMISM_API_KEY=
FANTOM_API_KEY=
CRONOS_API_KEY=
AURORA_API_KEY=
MOONBEAM_API_KEY=
GNOSIS_API_KEY=

# Non-EVM
HELIUS_API_KEY=
TONCENTER_API_KEY=
```

- [ ] **Step 2: Commit**

---

### Task 9: Final verification

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: success, no errors

- [ ] **Step 3: Verify all new networks register in getScanner**

Check `src/lib/scanners/interface.ts` — all 12 EVM networks should match the `EVM_NETWORKS` set.

- [ ] **Step 4: Verify migration safety**

Check `src/db/migrate.ts` — `SCHEMA_VERSION` is 2, `tokens` table creation exists in migration.
