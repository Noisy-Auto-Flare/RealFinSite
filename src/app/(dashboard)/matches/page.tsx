"use client";

import Link from "next/link";
import EmptyState from "@/components/EmptyState";

export default function MatchesPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl md:text-2xl font-bold truncate min-w-0">Связи транзакций</h1>
      <div className="card">
        <EmptyState
          icon="🔗"
          title="Функция объединена"
          description="Связи между операциями теперь определяются автоматически через мульти-записную модель. Перейдите в историю операций для просмотра."
        />
        <div className="text-center mt-4">
          <Link href="/transactions" className="btn btn-primary">
            Перейти к операциям
          </Link>
        </div>
      </div>
    </div>
  );
}
