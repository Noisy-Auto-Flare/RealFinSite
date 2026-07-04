import { NextResponse } from "next/server";
import { db } from "@/db";
import { blockchainApiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/server-utils";

function maskKey(key: string): string {
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = db.select().from(blockchainApiKeys).all();
  const masked = keys.map((k) => ({
    id: k.id,
    network: k.network,
    apiKey: maskKey(k.apiKey),
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  }));

  return NextResponse.json(masked);
}

export async function PUT(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body)) {
    return NextResponse.json({ error: "Expected array of { network, apiKey }" }, { status: 400 });
  }

  for (const item of body) {
    if (!item.network || typeof item.apiKey !== "string") {
      return NextResponse.json(
        { error: "Each item must have network (string) and apiKey (string)" },
        { status: 400 }
      );
    }
  }

  for (const item of body) {
    const existing = db
      .select()
      .from(blockchainApiKeys)
      .where(eq(blockchainApiKeys.network, item.network))
      .get();

    if (existing) {
      db.update(blockchainApiKeys)
        .set({ apiKey: item.apiKey, updatedAt: new Date().toISOString() })
        .where(eq(blockchainApiKeys.id, existing.id))
        .run();
    } else {
      db.insert(blockchainApiKeys)
        .values({ network: item.network, apiKey: item.apiKey })
        .run();
    }
  }

  return NextResponse.json({ success: true });
}
