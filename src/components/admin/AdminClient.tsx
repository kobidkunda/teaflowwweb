"use client";
import { useCallback, useEffect, useState } from "react";
import { generateUUID } from "@/lib/uuid";
import type { EntityConfig } from "@/components/admin/entityConfig";
type Status = { kind: "idle" | "loading" | "error" | "success"; message?: string };
function coerce(fields: EntityConfig["fields"], raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = raw[f.name];
    if (f.type === "checkbox") { out[f.name] = v === "on"; continue; }
    if (v === "" || v === undefined) continue;
    out[f.name] = f.type === "number" ? Number(v) : v;
  }
  return out;
}
// Session-cookie admin console. Login posts username+password to
// /api/admin/login (HttpOnly cookie, 8h); every data fetch sends
// credentials:same-origin and no Authorization header. Nothing sensitive
// touches Web storage — the session lives in the cookie jar only.
export function AdminClient({ config }: { config: EntityConfig }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [who, setWho] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [dispatchTo, setDispatchTo] = useState("preparing");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const load = useCallback(async () => {
    setStatus({ kind: "loading", message: "Loading " + config.title.toLowerCase() + "…" });
    try {
      const res = await fetch(config.base, { credentials: "same-origin" });
      if (res.status === 401) { setUnlocked(false); setStatus({ kind: "error", message: "Your session expired. Sign in again." }); return; }
      if (res.status === 403) { setStatus({ kind: "error", message: "Your account cannot access this section." }); return; }
      if (!res.ok) throw new Error("List failed.");
      const data = await res.json() as Record<string, unknown[]>;
      setRows((data[config.listKey] as Record<string, unknown>[]) || []);
      setStatus({ kind: "success", message: "" });
    } catch {
      setStatus({ kind: "error", message: "Could not load " + config.title.toLowerCase() + ". Check the connection and retry." });
    }
  }, [config]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/me", { credentials: "same-origin" });
        if (!live) return;
        if (res.ok) {
          const data = await res.json() as { user?: { username?: string } };
          setWho(String(data.user?.username || ""));
          setUnlocked(true);
          await load();
        }
      } catch {
        /* stay on the sign-in form */
      } finally {
        if (live) setChecking(false);
      }
    })();
    return () => { live = false; };
  }, [load]);
  async function unlock(form: FormData) {
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    if (!username || !password) { setStatus({ kind: "error", message: "Enter your username and password to continue." }); return; }
    setStatus({ kind: "loading", message: "Signing in…" });
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 401) { setStatus({ kind: "error", message: "Invalid username or password." }); return; }
      if (res.status === 429) { setStatus({ kind: "error", message: "Too many attempts. Wait a minute and retry." }); return; }
      if (!res.ok) { setStatus({ kind: "error", message: "Sign-in failed. Check the connection and retry." }); return; }
      const data = await res.json() as { user?: { username?: string } };
      setWho(String(data.user?.username || username));
      setUnlocked(true);
      await load();
    } catch {
      setStatus({ kind: "error", message: "Sign-in failed. Check the connection and retry." });
    }
  }
  async function signOut() {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* cookie clears server-side best-effort; still reset UI */
    }
    setUnlocked(false); setWho(""); setRows([]); setEditing(null);
    setStatus({ kind: "success", message: "Signed out." });
  }
  async function executeDelete(id: string | number) {
    setConfirmDeleteId(null);
    setStatus({ kind: "loading", message: "Deleting…" });
    const res = await fetch(config.base + "/" + encodeURIComponent(String(id)), { method: "DELETE", credentials: "same-origin" });
    if (res.status === 204 || res.ok) { setStatus({ kind: "success", message: "Deleted." }); void load(); }
    else setStatus({ kind: "error", message: "Delete failed. It may be referenced by other records." });
  }
  async function save(form: FormData) {
    const raw: Record<string, string> = {};
    for (const [k, v] of form.entries()) raw[k] = String(v);
    const payload = coerce(config.fields, raw);
    setStatus({ kind: "loading", message: "Saving…" });
    const isEdit = editing && editing[config.idField] !== undefined && config.idField !== "code";
    const url = isEdit ? config.base + "/" + encodeURIComponent(String(editing[config.idField])) : config.base;
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setEditing(null); setStatus({ kind: "success", message: isEdit ? "Saved." : "Created." }); void load(); }
    else {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      setStatus({ kind: "error", message: data?.error || "Save failed. Check the highlighted fields." });
    }
  }
  async function transition(orderId: string, to: string) {
    setStatus({ kind: "loading", message: "Updating dispatch…" });
    const res = await fetch(config.base + "/" + encodeURIComponent(orderId) + "/dispatch", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, idempotencyKey: generateUUID() }),
    });
    const data = await res.json().catch(() => null) as { error?: string } | null;
    if (res.ok) { setStatus({ kind: "success", message: "Dispatch updated." }); void load(); }
    else setStatus({ kind: "error", message: data?.error || "Transition not allowed." });
  }
  if (checking) {
    return <div className="container page-shell" style={{ maxWidth: 560 }}>
      <p className="eyebrow">Store administration</p>
      <h1>Admin sign-in</h1>
      <p role="status">Checking your session…</p>
    </div>;
  }
  if (!unlocked) {
    return <div className="container page-shell" style={{ maxWidth: 560 }}>
      <p className="eyebrow">Store administration</p>
      <h1>Admin sign-in</h1>
      <p className="page-intro">Sign in with your admin account to manage {config.title.toLowerCase()}. Sessions last 8 hours and are forgotten when you sign out.</p>
      <form className="checkout-form" action={unlock} aria-label="Admin sign-in">
        <label><span>Username</span><input name="username" type="text" autoComplete="username" required aria-describedby="login-help" /></label>
        <label><span>Password</span><input name="password" type="password" autoComplete="current-password" required aria-describedby="login-help" /></label>
        <p className="micro-note" id="login-help">Ask the store owner for an account. Five wrong tries lock the account for 15 minutes.</p>
        <button className="button button-primary" type="submit">Sign in</button>
      </form>
      {status.kind === "loading" ? <p role="status">{status.message}</p> : null}
      {status.kind === "error" ? <p className="error-message" role="alert">{status.message}</p> : null}
      {status.kind === "success" && status.message ? <p role="status">{status.message}</p> : null}
    </div>;
  }
  return <div aria-live="polite">
    <div className="button-row" style={{ marginBottom: 18 }}>
      <span className="micro-note" role="status">Signed in{who ? " as " + who : ""}.</span>
      <button className="button button-outline" type="button" onClick={() => void load()}>Refresh</button>
      {!config.readOnly ? <button className="button button-primary" type="button" onClick={() => setEditing({})}>New {config.title.slice(0, -1).toLowerCase()}</button> : null}
      <button className="button button-outline" type="button" onClick={() => void signOut()}>Sign out</button>
    </div>
    {status.kind === "loading" ? <p role="status">Loading…</p> : null}
    {status.kind === "error" ? <p className="error-message" role="alert">{status.message}</p> : null}
    {status.kind === "success" && status.message ? <p role="status">{status.message}</p> : null}
    {rows.length === 0 && status.kind !== "loading" ? (
      <div className="empty-state"><h2>No {config.title.toLowerCase()} yet.</h2><p>{config.readOnly ? "New demo orders will appear here." : "Use the button above to create the first one."}</p></div>
    ) : (
      <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <caption className="micro-note">{rows.length} {config.title.toLowerCase()}</caption>
        <thead><tr>{config.columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}<th scope="col"><span className="micro-note">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const id = String(row[config.idField] ?? i);
            return <tr key={id}>
              {config.columns.map((c) => <td key={c.key}>{String(row[c.key] ?? "—").slice(0, 48)}</td>)}
              <td><div className="button-row" style={{ gap: 8 }}>
                {!config.readOnly ? <button type="button" className="text-link" onClick={() => setEditing(row)}>Edit</button> : null}
                {config.entity === "orders" ? <>
                  <label className="micro-note">Dispatch <select value={dispatchTo} onChange={(e) => setDispatchTo(e.target.value)} aria-label={"Dispatch target for order " + id}>
                    {["preparing", "shipped", "delivered", "cancelled", "returned"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></label>
                  <button type="button" className="text-link" onClick={() => void transition(id, dispatchTo)}>Apply</button>
                </> : null}
                {config.deletable === false ? null : config.readOnly ? null : (
                  confirmDeleteId === (row[config.idField] as string | number) ? (
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <span className="micro-note" style={{ color: "#a83232" }}>Delete?</span>
                      <button type="button" className="text-link" style={{ color: "#a83232", fontWeight: 600 }} onClick={() => void executeDelete(row[config.idField] as string | number)}>Confirm</button>
                      <button type="button" className="text-link" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className="text-link" onClick={() => setConfirmDeleteId(row[config.idField] as string | number)}>Delete</button>
                  )
                )}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
      </div>
    )}
    {editing && !config.readOnly ? (
      <form className="checkout-form" style={{ marginTop: 28 }} action={save} aria-label={editing[config.idField] ? "Edit record" : "Create record"}>
        <h2>{editing[config.idField] ? "Edit" : "New " + config.title.slice(0, -1).toLowerCase()}</h2>
        {config.fields.map((f) => (
          <label key={f.name}><span>{f.label}{f.required ? " *" : ""}</span>
            {f.type === "textarea" ? <textarea name={f.name} defaultValue={String(editing[f.name] ?? "")} required={f.required} /> :
              f.type === "select" ? <select name={f.name} defaultValue={String(editing[f.name] ?? f.options?.[0] ?? "")} required={f.required}>{(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}</select> :
              f.type === "checkbox" ? <input name={f.name} type="checkbox" defaultChecked={Boolean(editing[f.name] ?? (config.entity === "categories" || config.entity === "sliders" || config.entity === "coupons"))} /> :
              <input name={f.name} type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                defaultValue={editing[f.name] == null ? "" : String(editing[f.name])} required={f.required} aria-describedby={f.hint ? f.name + "-hint" : undefined} />}
            {f.hint ? <small className="micro-note" id={f.name + "-hint"}>{f.hint}</small> : null}
          </label>
        ))}
        <div className="button-row">
          <button className="button button-primary" type="submit">Save</button>
          <button className="button button-outline" type="button" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </form>
    ) : null}
  </div>;
}
