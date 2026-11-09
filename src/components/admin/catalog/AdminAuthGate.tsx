"use client";

import React, { useState, useEffect } from "react";
import { useAdminAuth } from "@/components/admin/layout/AdminAuthContext";

export interface AdminAuthGateProps {
  children: React.ReactNode;
}

type AuthStatus = { kind: "idle" | "loading" | "error" | "success"; message?: string };

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const auth = useAdminAuth();
  const [localStatus, setLocalStatus] = useState<AuthStatus>({ kind: "idle" });

  // Standalone fallback when used outside AdminAuthProvider (e.g. in isolated test or widget)
  const [standaloneUser, setStandaloneUser] = useState<{ username: string; role?: string } | null>(null);
  const [standaloneChecking, setStandaloneChecking] = useState(false);

  useEffect(() => {
    if (auth.isProviderReady) return;

    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/me", { credentials: "same-origin" });
        if (!mounted) return;
        if (res.ok) {
          const data = (await res.json()) as { user?: { username?: string; role?: string } };
          setStandaloneUser(
            data.user
              ? { username: String(data.user.username || "admin"), role: String(data.user.role || "admin") }
              : null
          );
        } else {
          setStandaloneUser(null);
        }
      } catch {
        if (mounted) setStandaloneUser(null);
      } finally {
        if (mounted) setStandaloneChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [auth.isProviderReady]);

  const checking = auth.isProviderReady ? auth.checking : standaloneChecking;
  const user = auth.isProviderReady ? auth.user : standaloneUser;
  const unlocked = !!user;
  const who = user?.username || "";
  const status = localStatus.kind !== "idle" ? localStatus : auth.status;

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    if (!username || !password) {
      setLocalStatus({ kind: "error", message: "Enter your username and password to continue." });
      return;
    }

    setLocalStatus({ kind: "loading", message: "Signing in…" });
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.status === 401) {
        setLocalStatus({ kind: "error", message: "Invalid username or password." });
        return;
      }
      if (res.status === 429) {
        setLocalStatus({ kind: "error", message: "Too many attempts. Wait a minute and retry." });
        return;
      }
      if (!res.ok) {
        setLocalStatus({ kind: "error", message: "Sign-in failed. Check the connection and retry." });
        return;
      }

      const data = (await res.json()) as { user?: { username?: string; role?: string } };
      const authUser = {
        username: String(data.user?.username || username),
        role: String(data.user?.role || "admin"),
      };

      setLocalStatus({ kind: "success", message: "" });
      if (auth.isProviderReady) {
        auth.setUser(authUser);
      } else {
        setStandaloneUser(authUser);
      }
    } catch {
      setLocalStatus({ kind: "error", message: "Sign-in failed. Check the connection and retry." });
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Best-effort logout
    }

    setLocalStatus({ kind: "success", message: "Signed out." });
    if (auth.isProviderReady) {
      auth.setUser(null);
    } else {
      setStandaloneUser(null);
    }
  }

  if (checking) {
    return (
      <div className="container page-shell" style={{ maxWidth: 560, margin: "40px auto" }}>
        <p className="eyebrow">Store administration</p>
        <h1>Admin sign-in</h1>
        <p role="status">Checking your session…</p>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="container page-shell" style={{ maxWidth: 560, margin: "40px auto" }}>
        <p className="eyebrow">Store administration</p>
        <h1>Admin sign-in</h1>
        <p className="page-intro">
          Sign in with your admin account to manage the store. Sessions last 8 hours and are forgotten when you sign out.
        </p>
        <form className="checkout-form" onSubmit={handleLogin} role="form" aria-label="Admin sign-in">
          <label>
            <span>Username</span>
            <input name="username" type="text" autoComplete="username" required aria-describedby="login-help" />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required aria-describedby="login-help" />
          </label>
          <p className="micro-note" id="login-help">
            Ask the store owner for an account. Five wrong tries lock the account for 15 minutes.
          </p>
          <button className="button button-primary" type="submit">
            Sign in
          </button>
        </form>
        {status.kind === "loading" ? <p role="status">{status.message}</p> : null}
        {status.kind === "error" ? (
          <p className="error-message" role="alert" style={{ marginTop: 12 }}>
            {status.message}
          </p>
        ) : null}
        {status.kind === "success" && status.message ? (
          <p role="status" style={{ marginTop: 12 }}>
            {status.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="admin-authenticated-scope">
      {/* Session status banner matching test assertions */}
      <div className="admin-auth-header-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="micro-note" role="status">
          Signed in{who ? ` as ${who}.` : "."}
        </span>
        <button className="button button-outline" type="button" onClick={handleSignOut} style={{ fontSize: 12, padding: "4px 10px" }}>
          Sign out
        </button>
      </div>
      <main id="admin-main-view">{children}</main>
    </div>
  );
}
