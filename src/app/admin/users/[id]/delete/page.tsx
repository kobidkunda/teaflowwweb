"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react";
import type { StaffUser } from "@/components/admin/staff/types";

export default function DeleteStaffUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [user, setUser] = useState<StaffUser | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<{ id: number; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [userRes, meRes] = await Promise.all([
          fetch(`/api/admin/users/${id}`, { credentials: "same-origin" }),
          fetch("/api/admin/me", { credentials: "same-origin" }),
        ]);

        if (!userRes.ok) throw new Error("Load failed");
        const userData = (await userRes.json()) as { user: StaffUser };
        setUser(userData.user);

        if (meRes.ok) {
          const meData = (await meRes.json()) as { user: { id: number; username: string } };
          setCurrentAdmin(meData.user);
        }
      } catch {
        setError("Unable to load staff member data.");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [id]);

  const handleDeactivate = async () => {
    setDeactivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (res.ok) {
        router.push("/admin/users");
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Failed to deactivate account.");
      }
    } catch {
      setError("Network error updating account.");
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
        Loading staff details...
      </div>
    );
  }

  if (error && !user) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <AlertCircle size={40} color="#8f2f2a" style={{ marginBottom: "12px" }} />
        <h2 style={{ fontSize: "22px", margin: "0 0 8px 0" }}>{error}</h2>
        <Link href="/admin/users" className="button button-primary">
          Back to Staff Accounts
        </Link>
      </div>
    );
  }

  const isSelf = currentAdmin && user && currentAdmin.id === user.id;

  return (
    <div className="delete-staff-page" style={{ maxWidth: "680px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href={`/admin/users/${id}`}
          className="text-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
        >
          <ArrowLeft size={14} /> Back to Staff Dossier
        </Link>
        <h1 style={{ margin: "4px 0", fontSize: "28px", fontWeight: 700, color: "#8f2f2a" }}>
          Deactivate Staff Account: <span style={{ fontFamily: "monospace" }}>{user?.username}</span>
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Dedicated confirmation screen with self-protection and session revocation guards.
        </p>
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
            marginBottom: "20px",
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

      <div style={{ background: "#ffffff", padding: "28px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
        {isSelf ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <ShieldAlert size={28} color="#8f2f2a" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#8f2f2a", fontWeight: 700 }}>
                  Self-Deactivation Blocked
                </h3>
                <p style={{ margin: 0, color: "#555850", fontSize: "14px", lineHeight: 1.5 }}>
                  You are currently authenticated as <strong>{user?.username}</strong>. You cannot disable or delete your own account to prevent administrative lockout.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "14px", borderTop: "1px solid #ede9df" }}>
              <Link href={`/admin/users/${id}`} className="button button-primary">
                Return to Staff Dossier
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <AlertTriangle size={28} color="#8f2f2a" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#8f2f2a", fontWeight: 700 }}>
                  Are you sure you want to deactivate this account?
                </h3>
                <p style={{ margin: 0, color: "#555850", fontSize: "14px", lineHeight: 1.5 }}>
                  Deactivating staff account <strong>{user?.username}</strong> will immediately revoke all active sessions across all devices and prevent future logins.
                </p>
              </div>
            </div>

            <div style={{ background: "#fbf8f1", padding: "14px", borderRadius: "6px", border: "1px solid #ede9df" }}>
              <div style={{ fontSize: "13px", color: "#1d2a24", fontWeight: 600 }}>Account Audit Safety:</div>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#555850", lineHeight: 1.45 }}>
                In accordance with project security standards, staff accounts are deactivated (soft-disabled) rather than hard-deleted. Historical order dispatches and audit trail references remain intact.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #ede9df" }}>
              <Link href={`/admin/users/${id}`} className="button button-outline" style={{ fontSize: "13px" }}>
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="button"
                style={{
                  background: "#8f2f2a",
                  color: "#ffffff",
                  borderColor: "#8f2f2a",
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Trash2 size={15} /> {deactivating ? "Deactivating..." : "Confirm Deactivation & Revoke Sessions"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
