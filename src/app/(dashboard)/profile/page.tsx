"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleChangePassword() {
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword) {
      setError("Заполните все поля");
      return;
    }
    if (newPassword.length < 4) {
      setError("Новый пароль должен быть минимум 4 символа");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Ошибка");
      setSaving(false);
      return;
    }

    setSuccess("Пароль успешно изменён");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Профиль</h1>

      <div className="card space-y-2">
        <p><span className="text-[var(--text-secondary)]">Логин:</span> {session?.user?.username}</p>
        <p><span className="text-[var(--text-secondary)]">Роль:</span> {session?.user?.role === "master" ? "Администратор" : "Пользователь"}</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-medium">Смена пароля</h2>

        {error && <div className="text-sm text-[var(--danger)] bg-red-500/10 p-3 rounded-lg">{error}</div>}
        {success && <div className="text-sm text-green-400 bg-green-500/10 p-3 rounded-lg">{success}</div>}

        <div>
          <label className="block text-sm mb-1">Текущий пароль</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm mb-1">Новый пароль</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm mb-1">Подтвердите новый пароль</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>

        <button onClick={handleChangePassword} disabled={saving} className="btn btn-primary">
          {saving ? "Сохранение..." : "Изменить пароль"}
        </button>
      </div>
    </div>
  );
}
