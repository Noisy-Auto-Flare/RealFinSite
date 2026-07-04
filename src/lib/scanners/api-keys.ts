import { db } from "@/db";
import { blockchainApiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

const ENV_MAP: Record<string, string> = {
  bsc: "BSCSCAN_API_KEY",
  avalanche: "SNOWTRACE_API_KEY",
  ethereum: "ETHERSCAN_API_KEY",
  solana: "HELIUS_API_KEY",
  ton: "TONCENTER_API_KEY",
};

export function getNetworkApiKey(network: string): string {
  const envVar = ENV_MAP[network];
  if (envVar) {
    const envVal = process.env[envVar];
    if (envVal) return envVal;
  }

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
