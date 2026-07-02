import { startBackgroundJobs } from "@/lib/scanners/scheduler";

let initialized = false;

export function initializeApp(): void {
  if (initialized) return;
  initialized = true;

  // Don't start background jobs during build
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Start background jobs (rate fetching, scanning, matching)
  startBackgroundJobs();
}
