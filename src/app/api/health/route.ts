import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { initializeApp } from "@/lib/init";

const startTime = Date.now();

export const dynamic = "force-dynamic";

export async function GET() {
  initializeApp();
  const dbPath = process.env.DATABASE_URL || "./data/fintracker.db";
  let dbOk = false;
  let dbSize = 0;
  let backupCount = 0;

  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    const row = sqlite.prepare("SELECT COUNT(*) as count FROM operations").get() as { count: number };
    dbOk = true;
    dbSize = fs.statSync(dbPath).size;
    const backupDir = path.join(dir, "backups");
    if (fs.existsSync(backupDir)) {
      backupCount = fs.readdirSync(backupDir).filter(f => f.endsWith(".db") || f.endsWith(".db.gz")).length;
    }
    sqlite.close();
    return NextResponse.json({
      status: "ok",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || "0.1.0",
      database: { connected: dbOk, size: dbSize, backupCount },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: { connected: false, error: String(error) },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
