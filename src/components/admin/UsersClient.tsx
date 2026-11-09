"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
type UserRow = { id: number; username: string; email: string | null; role: string; is_active: number; created_at: string };
type Status = { kind: "idle" | "loading" | "error" | "success"; message?: string };
// Root-only staff management. Same state/a11y contract as AdminClient:
// empty, loading, error and success states with role=status/alert regions.
export function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "loading", message: "Loading staff accounts…" });
  const load = useCallback(async () => {
    setStatus({ kind: "loading", message: "Loading staff accounts…" });
    try {
      const res = await fetch("/api/admin/users", { credentials: "same-origin" });
      if (res.status === 401) { setStatus({ kind: "error", message: "Your session expired. Sign in again." }); return; }
      if (res.status === 403) { setStatus({ kind: "error", message: "Only the root account manages staff." }); return; }
      if (!res.ok) throw new Error("load");
      const data = await res.json() as { users: UserRow[] };
      setUsers(data.users || []);
      setStatus({ kind: "success", message: "" });
    } catch {
      setStatus({ kind: "error", message: "Could not load staff accounts. Check the connection and retry." });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function create(form: FormData) {
    const payload = {
      username: String(form.get("username") || ""),
      email: String(form.get("email") || "") || undefined,
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "admin"),
    };
    setStatus({ kind: "loading", message: "Creating…" });
    const res = await fetch("/api/admin/users", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null) as { error?: string } | null;
    if (res.ok) { setStatus({ kind: "success", message: "Account created." }); void load(); }
    else setStatus({ kind: "error", message: data?.error || "Could not create the account." });
  }
  async function toggle(id: number, active: boolean) {
    setStatus({ kind: "loading", message: active ? "Enabling…" : "Disabling…" });
    const res = await fetch("/api/admin/users/" + id, {
      method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: active ? 1 : 0 }),
    });
    const data = await res.json().catch(() => null) as { error?: string } | null;
    if (res.ok) { setStatus({ kind: "success", message: active ? "Enabled." : "Disabled." }); void load(); }
    else setStatus({ kind: "error", message: data?.error || "Update failed." });
  }
  return <div aria-live="polite">
    <div className="button-row" style={{ marginBottom: 18 }}>
      <button className="button button-outline" type="button" onClick={() => void load()}>Refresh</button>
    </div>
    {status.kind === "loading" ? <p role="status">{status.message}</p> : null}
    {status.kind === "error" ? <p className="error-message" role="alert">{status.message}</p> : null}
    {status.kind === "success" && status.message ? <p role="status">{status.message}</p> : null}
    {users.length === 0 && status.kind !== "loading" ? (
      <div className="empty-state"><h2>No staff accounts yet.</h2><p>Use the form below to create the first one.</p></div>
    ) : (
      <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <caption className="micro-note">{users.length} staff accounts</caption>
        <thead><tr><th scope="col">Username</th><th scope="col">Role</th><th scope="col">Active</th><th scope="col"><span className="micro-note">Actions</span></th></tr></thead>
        <tbody>
          {users.map((u) => <tr key={u.id}>
            <td>{u.username}</td><td>{u.role}</td><td>{u.is_active === 1 ? "Yes" : "No"}</td>
            <td><div className="button-row" style={{ gap: 8 }}>
              <button type="button" className="text-link" onClick={() => void toggle(u.id, u.is_active !== 1)}>
                {u.is_active === 1 ? "Disable" : "Enable"}
              </button>
              <Link href={"/admin/users/" + u.id + "/reset"} className="text-link">Reset password</Link>
            </div></td>
          </tr>)}
        </tbody>
      </table>
      </div>
    )}
    <form className="checkout-form" style={{ marginTop: 28 }} action={create} aria-label="Create staff account">
      <h2>New staff account</h2>
      <label><span>Username *</span><input name="username" type="text" autoComplete="off" required minLength={3} maxLength={32} aria-describedby="users-help" /></label>
      <label><span>Email (for password resets)</span><input name="email" type="email" autoComplete="off" /></label>
      <label><span>Password (at least 12 characters) *</span><input name="password" type="password" autoComplete="new-password" required minLength={12} /></label>
      <label><span>Role</span><select name="role" defaultValue="admin"><option value="admin">admin</option><option value="root">root</option></select></label>
      <p className="micro-note" id="users-help">Usernames use lowercase letters, numbers, hyphens and underscores. Only root sees this page.</p>
      <div className="button-row"><button className="button button-primary" type="submit">Create account</button></div>
    </form>
  </div>;
}
