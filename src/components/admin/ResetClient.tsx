"use client";
import { useState } from "react";
type Status = { kind: "idle" | "loading" | "error" | "success"; message?: string };
// Public password-reset console: forgot (always the same success message so
// emails cannot be probed) and reset (single-use token link from the email).
export function ResetClient({ initialToken }: { initialToken: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  async function forgot(form: FormData) {
    const email = String(form.get("email") || "").trim();
    if (!email) { setStatus({ kind: "error", message: "Enter your account email." }); return; }
    setStatus({ kind: "loading", message: "Sending reset link…" });
    try {
      const res = await fetch("/api/admin/forgot", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      if (res.status === 429) { setStatus({ kind: "error", message: "Too many attempts. Wait a minute and retry." }); return; }
      setStatus({ kind: "success", message: "If an account uses that email, a reset link is on its way. It expires in 60 minutes." });
    } catch {
      setStatus({ kind: "error", message: "Could not send the link. Check the connection and retry." });
    }
  }
  async function reset(form: FormData) {
    const token = String(form.get("token") || "").trim();
    const password = String(form.get("password") || "");
    if (!token || password.length < 12) { setStatus({ kind: "error", message: "Enter the reset token and a password of at least 12 characters." }); return; }
    setStatus({ kind: "loading", message: "Setting new password…" });
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
      });
      if (res.status === 429) { setStatus({ kind: "error", message: "Too many attempts. Wait a minute and retry." }); return; }
      if (!res.ok) { setStatus({ kind: "error", message: "That link is invalid or expired. Request a fresh one." }); return; }
      setStatus({ kind: "success", message: "Password updated. Sign in with the new password." });
    } catch {
      setStatus({ kind: "error", message: "Could not update the password. Check the connection and retry." });
    }
  }
  return <div aria-live="polite">
    <form className="checkout-form" action={forgot} aria-label="Request password reset">
      <h2>Forgot password</h2>
      <label><span>Account email</span><input name="email" type="email" autoComplete="email" required /></label>
      <button className="button button-outline" type="submit">Email reset link</button>
    </form>
    <form className="checkout-form" style={{ marginTop: 28 }} action={reset} aria-label="Set new password">
      <h2>Set new password</h2>
      <label><span>Reset token</span><input name="token" type="text" autoComplete="off" required defaultValue={initialToken} aria-describedby="reset-help" /></label>
      <label><span>New password (at least 12 characters)</span><input name="password" type="password" autoComplete="new-password" required minLength={12} /></label>
      <p className="micro-note" id="reset-help">Paste the token from the reset link, or open the link directly — it fills this in.</p>
      <button className="button button-primary" type="submit">Set password</button>
    </form>
    {status.kind === "loading" ? <p role="status">{status.message}</p> : null}
    {status.kind === "error" ? <p className="error-message" role="alert">{status.message}</p> : null}
    {status.kind === "success" && status.message ? <p role="status">{status.message}</p> : null}
  </div>;
}
