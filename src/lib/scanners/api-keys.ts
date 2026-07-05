import { db } from "@/db";
import { blockchainApiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ETHERSCAN_NETWORKS } from "./evm/config";

const ENV_MAP: Record<string, string> = {
  etherscan: "ETHERSCAN_API_KEY",
  arbitrum: "ARBISCAN_API_KEY",
  aurora: "AURORA_API_KEY",
  avalanche: "SNOWTRACE_API_KEY",
  base: "BASESCAN_API_KEY",
  bsc: "BSCSCAN_API_KEY",
  cronos: "CRONOS_API_KEY",
  ethereum: "ETHERSCAN_API_KEY",
  fantom: "FANTOM_API_KEY",
  gnosis: "GNOSIS_API_KEY",
  moonbeam: "MOONBEAM_API_KEY",
  optimism: "OPTIMISM_API_KEY",
  polygon: "POLYGONSCAN_API_KEY",
  solana: "HELIUS_API_KEY",
  ton: "TONCENTER_API_KEY",
  tron: "TRONGRID_API_KEY",
};

function getDbKey(network: string): string {
  try {
    const row = db
      .select()
      .from(blockchainApiKeys)
      .where(eq(blockchainApiKeys.network, network))
      .get();
    if (row?.apiKey) return row.apiKey;
  } catch {}
  return "";
}

export function getNetworkApiKey(network: string): string {
  const envVar = ENV_MAP[network];
  if (envVar) {
    const envVal = process.env[envVar];
    if (envVal) return envVal;
  }

  const dbKey = getDbKey(network);
  if (dbKey) return dbKey;

  if (ETHERSCAN_NETWORKS.includes(network)) {
    const globalEnv = process.env["ETHERSCAN_API_KEY"];
    if (globalEnv) return globalEnv;

    const globalDb = getDbKey("etherscan");
    if (globalDb) return globalDb;
  }

  return "";
}
