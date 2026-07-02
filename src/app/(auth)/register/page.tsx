"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const form = new FormData(e.currentTarget);
    const username = form.get("username") as string;
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password !== confirm) {
      setError("Пароли не совпадают");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Ошибка регистрации");
      setLoading(false);
      return;
    }

    setSuccess("Регистрация успешна! Ожидайте подтверждения администратором.");
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card w-full max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">Заявка отправлена</h1>
          <p className="text-[var(--text-secondary)] mb-6">{success}</p>
          <Link href="/login" className="btn btn-primary">
            Перейти ко входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Регистрация</h1>
        <p className="text-center text-[var(--text-secondary)] mb-6">
          Создайте аккаунт для доступа к системе
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm mb-1">Имя пользователя</label>
            <input id="username" name="username" type="text" required minLength={3} autoFocus />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm mb-1">Пароль</label>
            <input id="password" name="password" type="password" required minLength={6} />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm mb-1">Подтвердите пароль</label>
            <input id="confirm" name="confirm" type="password" required minLength={6} />
          </div>

          {error && (
            <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? "Отправка..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)] mt-4">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
