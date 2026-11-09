"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface AdminUser {
  username: string;
  role: string;
}

export type AdminAuthStatus = {
  kind: "idle" | "loading" | "error" | "success";
  message?: string;
};

export interface AdminAuthContextValue {
  isProviderReady: boolean;
  user: AdminUser | null;
  checking: boolean;
  unlocked: boolean;
  status: AdminAuthStatus;
  setStatus: React.Dispatch<React.SetStateAction<AdminAuthStatus>>;
  setUser: (user: AdminUser | null) => void;
  checkAuth: () => Promise<AdminUser | null>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const defaultContextValue: AdminAuthContextValue = {
  isProviderReady: false,
  user: null,
  checking: false,
  unlocked: false,
  status: { kind: "idle" },
  setStatus: () => {},
  setUser: () => {},
  checkAuth: async () => null,
  login: async () => ({ success: false, error: "Auth provider unavailable" }),
  signOut: async () => {},
};

const AdminAuthContext = createContext<AdminAuthContextValue>(defaultContextValue);

export function AdminAuthProvider({
  children,
  initialUser = null,
  initialChecking,
}: {
  children?: React.ReactNode;
  initialUser?: AdminUser | null;
  initialChecking?: boolean;
}) {
  const [user, setUser] = useState<AdminUser | null>(initialUser);
  const [checking, setChecking] = useState<boolean>(
    initialChecking !== undefined ? initialChecking : !initialUser
  );
  const [status, setStatus] = useState<AdminAuthStatus>({ kind: "idle" });

  const checkAuth = useCallback(async (): Promise<AdminUser | null> => {
    try {
      const res = await fetch("/api/admin/me", { credentials: "same-origin" });
      if (res.ok) {
        const data = (await res.json()) as { user?: { username?: string; role?: string } };
        if (data.user) {
          const authUser: AdminUser = {
            username: String(data.user.username || "admin"),
            role: String(data.user.role || "admin"),
          };
          setUser(authUser);
          return authUser;
        }
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser || initialChecking === false) {
      setChecking(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/me", { credentials: "same-origin" });
        if (!mounted) return;
        if (res.ok) {
          const data = (await res.json()) as { user?: { username?: string; role?: string } };
          if (data.user) {
            setUser({
              username: String(data.user.username || "admin"),
              role: String(data.user.role || "admin"),
            });
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [initialUser, initialChecking]);

  const login = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
      const trimmedUser = username.trim();
      if (!trimmedUser || !password) {
        const err = "Enter your username and password to continue.";
        setStatus({ kind: "error", message: err });
        return { success: false, error: err };
      }

      setStatus({ kind: "loading", message: "Signing in…" });
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: trimmedUser, password }),
        });

        if (res.status === 401) {
          const err = "Invalid username or password.";
          setStatus({ kind: "error", message: err });
          return { success: false, error: err };
        }
        if (res.status === 429) {
          const err = "Too many attempts. Wait a minute and retry.";
          setStatus({ kind: "error", message: err });
          return { success: false, error: err };
        }
        if (!res.ok) {
          const err = "Sign-in failed. Check the connection and retry.";
          setStatus({ kind: "error", message: err });
          return { success: false, error: err };
        }

        const data = (await res.json()) as { user?: { username?: string; role?: string } };
        const authUser: AdminUser = {
          username: String(data.user?.username || trimmedUser),
          role: String(data.user?.role || "admin"),
        };
        setUser(authUser);
        setStatus({ kind: "success", message: "" });
        return { success: true };
      } catch {
        const err = "Sign-in failed. Check the connection and retry.";
        setStatus({ kind: "error", message: err });
        return { success: false, error: err };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Best-effort logout
    }
    setUser(null);
    setStatus({ kind: "success", message: "Signed out." });
  }, []);

  const value: AdminAuthContextValue = {
    isProviderReady: true,
    user,
    checking,
    unlocked: !!user,
    status,
    setStatus,
    setUser,
    checkAuth,
    login,
    signOut,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  return useContext(AdminAuthContext);
}
