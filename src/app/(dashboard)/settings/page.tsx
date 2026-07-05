"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/Toast";

const ETHERSCAN_KEY = { id: "etherscan", label: "EtherScan API Key", placeholder: "EtherScan API Key" };
const NON_ETHERSCAN_NETWORKS = [
  { id: "avalanche", label: "Avalanche (SnowTrace)", placeholder: "SnowTrace API Key" },
  { id: "solana", label: "Solana (Helius)", placeholder: "Helius API Key" },
  { id: "ton", label: "TON (Toncenter)", placeholder: "Toncenter API Key" },
  { id: "tron", label: "TRON (TronGrid)", placeholder: "TronGrid API Key" },
];
const ETHERSCAN_NETWORKS_LIST = ["Ethereum", "BSC (BNB)", "Polygon", "Arbitrum", "Optimism", "Base", "Fantom", "Cronos", "Aurora", "Moonbeam", "Gnosis"];
const ALL_KEY_FIELDS = [ETHERSCAN_KEY, ...NON_ETHERSCAN_NETWORKS];

interface KeyEntry { network: string; hasKey: boolean; }
interface UserRow { id: number; username: string; role: string; status: string; created_at: string; }

export default function SettingsPage() {
  const { data: session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<"profile" | "keys" | "users">("profile");

  // Profile state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  // API keys state
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedNetworks, setSavedNetworks] = useState<Set<string>>(new Set());
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysSaving, setKeysSaving] = useState(false);

  // Users state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  const isAdmin = session?.user?.role === "master";

  // Load keys and users on mount
  useEffect(() => {
    fetch("/api/settings/blockchain-keys")
      .then(r => r.json())
      .then((data: KeyEntry[]) => {
        const saved = new Set(data.filter(k => k.hasKey).map(k => k.network));
        setSavedNetworks(saved);
        setKeysLoading(false);
      })
      .catch(() => setKeysLoading(false));

    if (isAdmin) {
      fetch("/api/admin/users")
        .then(r => r.json())
        .then((data: UserRow[]) => { setUsers(data); setUsersLoading(false); })
        .catch(() => setUsersLoading(false));
    }
  }, [isAdmin]);

  // Profile
  async function handleChangePassword() {
    setPwError(""); setPwSuccess("");
    if (!currentPassword || !newPassword) { setPwError("Заполните все поля"); return; }
    if (newPassword.length < 4) { setPwError("Новый пароль минимум 4 символа"); return; }
    if (newPassword !== confirmPassword) { setPwError("Пароли не совпадают"); return; }
    setPwSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPwSaving(false);
    if (!res.ok) { setPwError(data.error || "Ошибка"); return; }
    setPwSuccess("Пароль успешно изменён");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  // API keys
  async function handleSaveKeys() {
    setKeysSaving(true);
    const payload = ALL_KEY_FIELDS.filter(n => keys[n.id]?.length > 0).map(n => ({ network: n.id, apiKey: keys[n.id] }));
    const res = await fetch("/api/settings/blockchain-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const saved = new Set(savedNetworks);
      ALL_KEY_FIELDS.forEach(n => { if (keys[n.id]?.length > 0) saved.add(n.id); });
      setSavedNetworks(saved);
      setKeys({});
      toast.success("Ключи сохранены");
    } else {
      toast.error("Ошибка при сохранении");
    }
    setKeysSaving(false);
  }

  // Users
  async function handleAction(userId: number, action: "approve" | "reject") {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    if (res.ok) {
      setUsers(users.map(u => u.id === userId ? { ...u, status: action === "approve" ? "approved" : "rejected" } : u));
    }
  }

  async function deleteUser(userId: number) {
    if (!confirm("Удалить пользователя?")) return;
    setDeletingId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Пользователь удалён"); setUsers(prev => prev.filter(u => u.id !== userId)); }
    else { const err = await res.json().catch(() => ({ error: "Ошибка" })); toast.error(err.error || "Ошибка удаления"); }
    setDeletingId(null);
  }

  async function handleResetPassword() {
    if (!resetUserId || !resetPassword || resetPassword.length < 4) return;
    setResetSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetUserId, action: "reset_password", newPassword: resetPassword }),
    });
    if (res.ok) { setResetUserId(null); setResetPassword(""); toast.success("Пароль сброшен"); }
    else { toast.error("Ошибка"); }
    setResetSaving(false);
  }

  return (
    <>
      <header className="page-header">
        <div className="page-header-left">
          <h2>Настройки</h2>
          <p>Управление аккаунтом и системой</p>
        </div>
      </header>

      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="chart-tabs" style={{ display: "flex", gap: "4px", background: "var(--bg-card)", borderRadius: "30px", padding: "3px", border: "1px solid var(--glass-border)", width: "fit-content" }}>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
            <i className="fa-solid fa-user" style={{ marginRight: "6px" }} />Профиль
          </button>
          <button className={tab === "keys" ? "active" : ""} onClick={() => setTab("keys")}>
            <i className="fa-solid fa-key" style={{ marginRight: "6px" }} />API-ключи
          </button>
          {isAdmin && (
            <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
              <i className="fa-solid fa-users" style={{ marginRight: "6px" }} />Пользователи
            </button>
          )}
        </div>
      </div>

      {tab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Информация</h3>
            <div className="tx-item" style={{ padding: "12px 0", cursor: "default" }}>
              <div className="tx-icon green"><i className="fa-solid fa-user" /></div>
              <div className="tx-info">
                <div className="tx-name">{session?.user?.username}</div>
                <div className="tx-desc">{session?.user?.role === "master" ? "Администратор" : "Пользователь"}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Смена пароля</h3>
            {pwError && <div className="badge badge-pending" style={{ display: "block", marginBottom: "12px", borderRadius: "8px", padding: "8px 12px", background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>{pwError}</div>}
            {pwSuccess && <div className="badge badge-confirmed" style={{ display: "block", marginBottom: "12px", borderRadius: "8px", padding: "8px 12px" }}>{pwSuccess}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Текущий пароль" />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Новый пароль" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Подтвердите пароль" />
              <button onClick={handleChangePassword} disabled={pwSaving} className="btn-primary">
                {pwSaving ? "Сохранение..." : "Изменить пароль"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "keys" && (
        <div className="card">
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>API-ключи блокчейнов</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Ключи используются для сканирования транзакций. Можно задать через переменные окружения.
          </p>
          {keysLoading ? (
            <p style={{ color: "var(--text-muted)" }}>Загрузка...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "6px" }}>
                  {ETHERSCAN_KEY.label}
                  {savedNetworks.has("etherscan") && <span className="badge badge-confirmed" style={{ marginLeft: "8px", fontSize: "10px" }}>✓</span>}
                </label>
                <input type="password" placeholder={savedNetworks.has("etherscan") ? "••••••••" : ETHERSCAN_KEY.placeholder} value={keys["etherscan"] || ""} onChange={e => setKeys(prev => ({ ...prev, "etherscan": e.target.value }))} />
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Один ключ для: {ETHERSCAN_NETWORKS_LIST.join(", ")}</p>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Остальные сети</p>

              {NON_ETHERSCAN_NETWORKS.map(net => (
                <div key={net.id}>
                  <label style={{ fontSize: "13px", fontWeight: 500, display: "block", marginBottom: "6px" }}>
                    {net.label}
                    {savedNetworks.has(net.id) && <span className="badge badge-confirmed" style={{ marginLeft: "8px", fontSize: "10px" }}>✓</span>}
                  </label>
                  <input type="password" placeholder={savedNetworks.has(net.id) ? "••••••••" : net.placeholder} value={keys[net.id] || ""} onChange={e => setKeys(prev => ({ ...prev, [net.id]: e.target.value }))} />
                </div>
              ))}

              <button onClick={handleSaveKeys} disabled={keysSaving} className="btn-primary" style={{ alignSelf: "flex-start" }}>
                {keysSaving ? "Сохранение..." : "Сохранить ключи"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "users" && isAdmin && (
        <>
          {/* Pending users */}
          {users.filter(u => u.status === "pending").length > 0 && (
            <div className="card" style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
                <i className="fa-solid fa-circle-exclamation" style={{ color: "var(--warning)", marginRight: "8px" }} />
                Заявки на регистрацию ({users.filter(u => u.status === "pending").length})
              </h3>
              <div className="tx-list">
                {users.filter(u => u.status === "pending").map(u => (
                  <div key={u.id} className="tx-item" style={{ cursor: "default" }}>
                    <div className="tx-icon orange"><i className="fa-solid fa-user-plus" /></div>
                    <div className="tx-info">
                      <div className="tx-name">{u.username}</div>
                      <div className="tx-desc">{new Date(u.created_at).toLocaleDateString("ru-RU")}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => handleAction(u.id, "approve")} className="btn-primary" style={{ background: "var(--success)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-check" /> Подтвердить
                      </button>
                      <button onClick={() => handleAction(u.id, "reject")} className="btn-primary" style={{ background: "var(--danger)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-xmark" /> Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved users */}
          <div className="card">
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>
              <i className="fa-solid fa-users" style={{ marginRight: "8px" }} />
              Пользователи ({users.filter(u => u.status === "approved").length})
            </h3>
            {users.filter(u => u.status === "approved").length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Нет подтверждённых пользователей</p>
            ) : (
              <div className="tx-list">
                {users.filter(u => u.status === "approved").map(u => (
                  <div key={u.id} className="tx-item" style={{ cursor: "default" }}>
                    <div className="tx-icon green"><i className="fa-solid fa-user-check" /></div>
                    <div className="tx-info">
                      <div className="tx-name">{u.username}</div>
                      <div className="tx-desc">{u.role}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setResetUserId(u.id)} className="btn-primary" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-key" />
                      </button>
                      <button onClick={() => deleteUser(u.id)} disabled={deletingId === u.id} className="btn-primary" style={{ background: "var(--danger)", padding: "4px 12px", fontSize: "12px" }}>
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {resetUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setResetUserId(null); }}>
          <div className="card w-full max-w-md space-y-4 animate-modal-enter">
            <div className="flex justify-between items-center">
              <h3 style={{ fontSize: "16px", fontWeight: 600 }}>Сброс пароля</h3>
              <button onClick={() => setResetUserId(null)} className="btn-icon" style={{ width: "32px", height: "32px" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Новый пароль для <strong>{users.find(u => u.id === resetUserId)?.username}</strong>
            </p>
            <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Новый пароль" />
            <div className="flex gap-2">
              <button onClick={() => setResetUserId(null)} className="btn-primary" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", flex: 1 }}>Отмена</button>
              <button onClick={handleResetPassword} disabled={resetSaving || resetPassword.length < 4} className="btn-primary" style={{ flex: 1 }}>
                {resetSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
