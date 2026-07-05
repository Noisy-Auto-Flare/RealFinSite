import { NextResponse } from "next/server";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth";

const DEFAULT_TAGS = [
  { name: "еда", color: "#22c55e", description: "Продукты, кафе, доставка, рестораны" },
  { name: "транспорт", color: "#3b82f6", description: "Такси, автобус, метро, бензин, билеты" },
  { name: "связь", color: "#8b5cf6", description: "Мобильная связь, домашний интернет" },
  { name: "жильё", color: "#f59e0b", description: "Коммуналка, аренда, ремонт, ЖКХ" },
  { name: "развлечения", color: "#ec4899", description: "Игры, кино, хобби, подписки" },
  { name: "p2p", color: "#06b6d4", description: "Обмен валюты с человеком (P2P)" },
  { name: "инвестиции", color: "#10b981", description: "Пополнение брокера, покупка активов" },
  { name: "комиссия", color: "#ef4444", description: "Любая комиссия (банк, биржа, сеть)" },
  { name: "подарок", color: "#f472b6", description: "Подарки полученные или сделанные" },
  { name: "семья", color: "#e9b1a3", description: "Переводы родственникам, семейные расходы" },
  { name: "здоровье", color: "#34d399", description: "Лекарства, врачи, спорт" },
  { name: "бизнес", color: "#6366f1", description: "Доходы/расходы по фрилансу, работе" },
  { name: "зарплата", color: "#a3e635", description: "Основной доход от работы" },
];

function seedDefaultTags() {
  const count = db.select({ count: sql<number>`count(*)` }).from(tags).get()?.count || 0;
  if (count === 0) {
    for (const t of DEFAULT_TAGS) {
      db.insert(tags).values(t).run();
    }
  }
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  seedDefaultTags();

  const list = db.select().from(tags).all();
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  seedDefaultTags();

  const existing = db.select().from(tags).where(eq(tags.name, body.name)).get();
  if (existing) {
    return NextResponse.json(existing);
  }

  const created = db.insert(tags).values({
    name: body.name,
    color: body.color || null,
    description: body.description || null,
  }).returning().get();

  return NextResponse.json(created, { status: 201 });
}
