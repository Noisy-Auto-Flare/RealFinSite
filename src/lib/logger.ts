const LOG_DIR = process.env.LOG_DIR || "./logs";

export function ensureLogDir() {
  const fs = require("fs");
  const path = require("path");
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function logToFile(level: string, message: string, meta?: Record<string, unknown>) {
  try {
    ensureLogDir();
    const fs = require("fs");
    const path = require("path");
    const timestamp = new Date().toISOString();
    const line = JSON.stringify({ timestamp, level, message, ...meta }) + "\n";
    const logFile = path.join(LOG_DIR, `app-${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, line);
  } catch {
    // silently fail — don't crash for logging
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${msg}`);
    logToFile("INFO", msg, meta);
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${msg}`);
    logToFile("WARN", msg, meta);
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${msg}`);
    logToFile("ERROR", msg, meta);
  },
};
