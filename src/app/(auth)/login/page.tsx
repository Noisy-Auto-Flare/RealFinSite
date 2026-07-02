"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      username: form.get("username") as string,
      password: form.get("password") as string,
      redirect: false,
    });

    if (res?.error) {
      setError("Неверное имя пользователя или пароль");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">FinTracker</h1>
        <p className="text-center text-[var(--text-secondary)] mb-6">
          Войдите в систему учёта финансов
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm mb-1">Имя пользователя</label>
            <input id="username" name="username" type="text" required autoFocus />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm mb-1">Пароль</label>
            <input id="password" name="password" type="password" required />
          </div>

          {error && (
            <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--text-muted)] mt-4">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-[var(--accent)] hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
