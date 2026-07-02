"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  username: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => {
        if (r.status === 403) { router.push("/dashboard"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setUsers(data);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setError("Ошибка загрузки"); });
  }, [router]);

  async function handleAction(userId: number, action: "approve" | "reject") {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });

    if (res.ok) {
      setUsers(users.map((u) =>
        u.id === userId
          ? { ...u, status: action === "approve" ? "approved" : "rejected" }
          : u
      ));
    }
  }

  async function handleResetPassword() {
    if (!resetUserId || !newPassword || newPassword.length < 4) return;
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetUserId, action: "reset_password", newPassword }),
    });

    if (res.ok) {
      setResetUserId(null);
      setNewPassword("");
    }
    setSaving(false);
  }

  if (loading) return <p className="text-[var(--text-muted)]">Загрузка...</p>;
  if (error) return <p className="text-[var(--danger)]">{error}</p>;

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Управление пользователями</h1>

      {pending.length > 0 && (
        <div className="card">
          <h2 className="font-medium mb-3">Заявки на регистрацию ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div>
                  <span className="font-medium">{u.username}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">{new Date(u.createdAt).toLocaleDateString("ru-RU")}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(u.id, "approve")} className="btn btn-success text-sm px-3 py-1">
                    ✅ Подтвердить
                  </button>
                  <button onClick={() => handleAction(u.id, "reject")} className="btn btn-danger text-sm px-3 py-1">
                    ❌ Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="card text-center py-8">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-[var(--text-secondary)]">Нет новых заявок</p>
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium">Подтверждённые пользователи</h2>
          <span className="text-xs text-[var(--text-muted)]">{approved.length}</span>
        </div>
        {approved.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">Нет подтверждённых пользователей</p>
        ) : (
          <div className="space-y-1">
            {approved.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-1.5 text-sm">
                <div>
                  <span>{u.username}</span>
                  <span className="text-[var(--text-muted)] text-xs ml-2">{u.role}</span>
                </div>
                <button
                  onClick={() => setResetUserId(u.id)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  🔑 Сбросить пароль
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset password modal */}
      {resetUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setResetUserId(null); }}>
          <div className="bg-[var(--bg-secondary)] rounded-xl w-full max-w-md p-4 border border-[var(--border)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Сброс пароля</h3>
              <button onClick={() => setResetUserId(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl">✕</button>
            </div>

            <p className="text-sm text-[var(--text-secondary)]">
              Введите новый пароль для пользователя <strong>{users.find((u) => u.id === resetUserId)?.username}</strong>
            </p>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Новый пароль (мин. 4 символа)"
            />

            <div className="flex gap-2">
              <button onClick={() => setResetUserId(null)} className="btn btn-secondary flex-1">Отмена</button>
              <button
                onClick={handleResetPassword}
                disabled={saving || newPassword.length < 4}
                className="btn btn-primary flex-1"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
