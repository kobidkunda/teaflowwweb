"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Users, Shield, ShieldCheck, KeyRound, Edit, Trash2, Eye, RefreshCw, AlertCircle, Lock } from "lucide-react";
import type { StaffUser } from "@/components/admin/staff/types";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export type { StaffUser };

export default function StaffUsersListPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const res = await fetch("/api/admin/users", { credentials: "same-origin" });
      if (res.status === 403) {
        setIsForbidden(true);
        return;
      }
      if (res.status === 401) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load staff list.");
      const data = (await res.json()) as { users: StaffUser[] };
      setUsers(data.users || []);
    } catch {
      setError("Unable to load staff accounts. Check connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  if (isForbidden) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <Shield size={48} color="#8f2f2a" style={{ marginBottom: "16px" }} />
        <h2 style={{ fontSize: "24px", margin: "0 0 8px 0" }}>Root Access Required</h2>
        <p style={{ color: "#63665e", lineHeight: 1.5, marginBottom: "20px" }}>
          Only root administrator accounts have permission to inspect or manage staff accounts, roles, and security credentials.
        </p>
        <Link href="/admin" className="button button-primary">
          Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  return (
    <AdminAuthGate>
      <div className="staff-users-page" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: 700 }}>Staff Accounts</h1>
          <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
            Root-only administration of store operators, roles, security lockouts, and credential resets.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void fetchUsers()}
            className="button button-outline"
            style={{ minHeight: "38px", padding: "6px 14px", fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <Link
            href="/admin/users/new"
            className="button button-primary"
            style={{ minHeight: "38px", padding: "6px 16px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={15} /> New Staff Account
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            borderRadius: "6px",
            background: "rgba(143, 47, 42, 0.08)",
            border: "1px solid #8f2f2a",
            color: "#8f2f2a",
            fontSize: "14px",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
            Loading staff accounts...
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Users size={36} color="#8c9b88" style={{ marginBottom: "12px" }} />
            <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#1d2a24" }}>No staff accounts found</h3>
            <p style={{ margin: "0 0 16px 0", color: "#63665e", fontSize: "13px" }}>
              Create a staff account to grant access to store administration.
            </p>
            <Link href="/admin/users/new" className="button button-primary">
              Create First Account
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <caption className="sr-only">Staff User Accounts</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: "160px" }}>Username</th>
                  <th scope="col" style={{ width: "220px" }}>Email</th>
                  <th scope="col" style={{ width: "110px" }}>Role</th>
                  <th scope="col" style={{ width: "110px" }}>Status</th>
                  <th scope="col" style={{ width: "140px" }}>Security & Lockout</th>
                  <th scope="col" style={{ width: "150px" }}>Created</th>
                  <th scope="col" style={{ width: "200px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isRoot = u.role === "root";
                  const isActive = u.is_active === 1;
                  const isLocked = u.locked_until && new Date(u.locked_until).getTime() > Date.now();

                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: "#1d2a24" }}>
                        <Link href={`/admin/users/${u.id}`} className="text-link" style={{ borderBottom: "none" }}>
                          {u.username}
                        </Link>
                      </td>
                      <td style={{ fontSize: "13px", color: "#555850" }}>
                        {u.email || <span style={{ color: "#9ea399", fontStyle: "italic" }}>None configured</span>}
                      </td>
                      <td>
                        <span
                          className={`admin-role-badge ${isRoot ? "role-root" : ""}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {isRoot ? <ShieldCheck size={12} color="#b39156" /> : <Shield size={12} />}
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: isActive ? "rgba(35, 72, 58, 0.1)" : "rgba(143, 47, 42, 0.1)",
                            color: isActive ? "#23483a" : "#8f2f2a",
                          }}
                        >
                          {isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        {isLocked ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "rgba(143, 47, 42, 0.15)",
                              color: "#8f2f2a",
                            }}
                          >
                            <Lock size={12} /> Locked (15m)
                          </span>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#63665e" }}>
                            Attempts: {u.failed_attempts ?? 0} / 5
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: "12px", color: "#63665e" }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
                          <Link
                            href={`/admin/users/${u.id}`}
                            title="View Staff Details"
                            style={{ color: "#23483a", display: "inline-flex", alignItems: "center", padding: "4px" }}
                          >
                            <Eye size={16} />
                          </Link>
                          <Link
                            href={`/admin/users/${u.id}/edit`}
                            title="Edit Role & Status"
                            style={{ color: "#b36b3d", display: "inline-flex", alignItems: "center", padding: "4px" }}
                          >
                            <Edit size={16} />
                          </Link>
                          <Link
                            href={`/admin/users/${u.id}/reset`}
                            title="Reset Password (Full-Page)"
                            style={{ color: "#1d2a24", display: "inline-flex", alignItems: "center", padding: "4px" }}
                          >
                            <KeyRound size={16} />
                          </Link>
                          <Link
                            href={`/admin/users/${u.id}/delete`}
                            title="Deactivate Account"
                            style={{ color: "#8f2f2a", display: "inline-flex", alignItems: "center", padding: "4px" }}
                          >
                            <Trash2 size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </AdminAuthGate>
  );
}
