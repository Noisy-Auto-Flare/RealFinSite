import { fetchAndStoreRates } from "@/lib/rates/coingecko";
import { runScannerCycle } from "./runner";

function logSchedulerEvent(action: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[scheduler] ${timestamp} ${action}: ${details}`);
}

export async function runRateUpdate(): Promise<void> {
  try {
    await fetchAndStoreRates();
    logSchedulerEvent("Rates updated", "");
  } catch (e) {
    console.error(`[scheduler] ${new Date().toISOString()} Rate update failed:`, e);
  }
}

export async function runScannerCycleFull(): Promise<void> {
  try {
    logSchedulerEvent("Scanner cycle starting", "");
    await runScannerCycle();
    logSchedulerEvent("Scanner cycle done", "");
  } catch (e) {
    console.error(`[scheduler] ${new Date().toISOString()} Scanner cycle failed:`, e);
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

    logSchedulerEvent("Background jobs started", "");
  } catch (e) {
    console.warn(`[scheduler] ${new Date().toISOString()} node-cron not available, skipping background jobs`);
  }
}
