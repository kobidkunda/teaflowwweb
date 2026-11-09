"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Edit, KeyRound, Trash2, Shield, ShieldCheck, CheckCircle2, AlertTriangle, AlertCircle, Lock } from "lucide-react";
import type { StaffUser } from "@/components/admin/staff/types";

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${id}`, { credentials: "same-origin" });
        if (res.status === 404) {
          setError("Staff user not found.");
          return;
        }
        if (res.status === 403) {
          setError("Only root accounts have permission to inspect staff accounts.");
          return;
        }
        if (!res.ok) throw new Error("Load failed");
        const json = (await res.json()) as { user: StaffUser };
        setUser(json.user);
      } catch {
        setError("Unable to load staff details.");
      } finally {
        setLoading(false);
      }
    }
    void loadUser();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
        Loading staff details...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <AlertCircle size={40} color="#8f2f2a" style={{ marginBottom: "12px" }} />
        <h2 style={{ fontSize: "22px", margin: "0 0 8px 0" }}>{error || "Staff member not found"}</h2>
        <Link href="/admin/users" className="button button-primary">
          Back to Staff Accounts
        </Link>
      </div>
    );
  }

  const isRoot = user.role === "root";
  const isActive = user.is_active === 1;
  const isLocked = user.locked_until && new Date(user.locked_until).getTime() > Date.now();

  return (
    <div className="staff-detail-page" style={{ maxWidth: "800px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <Link
            href="/admin/users"
            className="text-link"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
          >
            <ArrowLeft size={14} /> Back to Staff Accounts
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>
              {user.username}
            </h1>
            <span
              className={`admin-role-badge ${isRoot ? "role-root" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 10px",
                borderRadius: "14px",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {isRoot ? <ShieldCheck size={13} color="#b39156" /> : <Shield size={13} />}
              {user.role}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 10px",
                borderRadius: "14px",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                background: isActive ? "rgba(35, 72, 58, 0.1)" : "rgba(143, 47, 42, 0.1)",
                color: isActive ? "#23483a" : "#8f2f2a",
              }}
            >
              {isActive ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {isActive ? "Active Account" : "Disabled Account"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            href={`/admin/users/${user.id}/edit`}
            className="button button-outline"
            style={{ minHeight: "38px", padding: "6px 14px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Edit size={14} /> Edit Role
          </Link>
          <Link
            href={`/admin/users/${user.id}/reset`}
            className="button button-outline"
            style={{ minHeight: "38px", padding: "6px 14px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <KeyRound size={14} /> Reset Password
          </Link>
          <Link
            href={`/admin/users/${user.id}/delete`}
            className="button button-outline"
            style={{
              minHeight: "38px",
              padding: "6px 14px",
              fontSize: "13px",
              color: "#8f2f2a",
              borderColor: "rgba(143, 47, 42, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Trash2 size={14} /> Deactivate
          </Link>
        </div>
      </div>

      {/* Account Dossier Details */}
      <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "24px", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 700 }}>Account Dossier & Security Audit</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Staff User ID</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px", fontFamily: "monospace" }}>
              #{user.id}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Registered Email</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {user.email || <span style={{ color: "#9ea399", fontStyle: "italic" }}>None configured</span>}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Failed Consecutive Logins</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {user.failed_attempts ?? 0} / 5 attempts
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Security Lockout Status</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {isLocked ? (
                <span style={{ color: "#8f2f2a", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Lock size={14} /> Locked until {new Date(user.locked_until!).toLocaleTimeString()}
                </span>
              ) : (
                <span style={{ color: "#23483a" }}>Normal (Unlocked)</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Account Created</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {new Date(user.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
