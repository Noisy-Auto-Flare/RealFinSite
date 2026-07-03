import { fetchAndStoreRates } from "@/lib/rates/coingecko";
import { runScannerCycle } from "./runner";

export async function runRateUpdate(): Promise<void> {
  try {
    await fetchAndStoreRates();
    console.log(`[scheduler] Rates updated at ${new Date().toISOString()}`);
  } catch (e) {
    console.error("[scheduler] Rate update failed:", e);
  }
}

export async function runScannerCycleFull(): Promise<void> {
  try {
    console.log(`[scheduler] Scanner cycle starting at ${new Date().toISOString()}`);
    await runScannerCycle();
    console.log(`[scheduler] Scanner cycle done at ${new Date().toISOString()}`);
  } catch (e) {
    console.error("[scheduler] Scanner cycle failed:", e);
  }
}

export function startBackgroundJobs(): void {
  if (typeof window !== "undefined") return;

  try {
    const cron = require("node-cron");

    // Update rates every 10 minutes
    cron.schedule("*/10 * * * *", () => {
      runRateUpdate();
    });

    // Run scanner + matcher every 30 minutes
    cron.schedule("*/30 * * * *", () => {
      runScannerCycleFull();
    });

    console.log("[scheduler] Background jobs started");
  } catch (e) {
    console.warn("[scheduler] node-cron not available, skipping background jobs");
  }
}
