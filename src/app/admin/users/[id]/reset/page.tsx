"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import type { StaffUser } from "@/components/admin/staff/types";

export default function StaffPasswordResetPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${id}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Load failed");
        const json = (await res.json()) as { user: StaffUser };
        setUsername(json.user.username);
      } catch {
        setFormError("Unable to load staff member information.");
      } finally {
        setLoading(false);
      }
    }
    void loadUser();
  }, [id]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!newPassword) {
      errs.password = "New password is required.";
    } else if (newPassword.length < 12) {
      errs.password = "Passwords need at least 12 characters.";
    }

    if (newPassword !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      setFormError("Please fix the validation errors before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setSuccess(true);
      } else {
        setFormError(data?.error || "Failed to reset password.");
      }
    } catch {
      setFormError("Network error resetting password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
        Loading staff details...
      </div>
    );
  }

  return (
    <div className="staff-reset-password-page" style={{ maxWidth: "640px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href={`/admin/users/${id}`}
          className="text-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
        >
          <ArrowLeft size={14} /> Back to Staff Dossier
        </Link>
        <h1 style={{ margin: "4px 0", fontSize: "28px", fontWeight: 700 }}>
          Reset Password: <span style={{ fontFamily: "monospace" }}>{username}</span>
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Dedicated full-page password reset form replacing browser dialog prompts.
        </p>
      </div>

      {formError && (
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
          <span>{formError}</span>
        </div>
      )}

      {success ? (
        <div
          style={{
            background: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
            border: "1px solid #23483a",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <CheckCircle2 size={44} color="#23483a" />
          <h2 style={{ margin: 0, fontSize: "22px", color: "#1d2a24", fontWeight: 700 }}>
            Password Successfully Updated
          </h2>
          <p style={{ margin: 0, color: "#555850", fontSize: "14px", maxWidth: "460px", lineHeight: 1.5 }}>
            The password for staff account <strong>{username}</strong> has been hashed and updated. All active sessions across all devices have been immediately revoked.
          </p>
          <div style={{ marginTop: "12px" }}>
            <Link href={`/admin/users/${id}`} className="button button-primary">
              Return to Staff Dossier
            </Link>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#ffffff",
            padding: "28px",
            borderRadius: "8px",
            border: "1px solid #d9d4c8",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Security Banner */}
          <div
            style={{
              background: "rgba(179, 145, 86, 0.1)",
              border: "1px solid #b39156",
              borderRadius: "6px",
              padding: "14px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            <ShieldAlert size={20} color="#b39156" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div style={{ fontSize: "13px", color: "#6d531d", lineHeight: 1.45 }}>
              <strong>Immediate Session Revocation:</strong> Resetting this staff member&apos;s password will immediately terminate all active sessions in <code>admin_sessions</code>. The user must sign in anew with their updated password.
            </div>
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="reset-new-password" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              New Password (≥ 12 characters) *
            </label>
            <input
              id="reset-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              placeholder="Enter new secure password..."
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.password ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>
              Minimum 12 characters. Use a combination of letters, numbers, and symbols.
            </p>
            {errors.password && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="reset-confirm-password" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Confirm New Password *
            </label>
            <input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              placeholder="Re-type new password to confirm..."
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.confirmPassword ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            {errors.confirmPassword && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.confirmPassword}</p>}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #ede9df" }}>
            <Link href={`/admin/users/${id}`} className="button button-outline" style={{ fontSize: "13px" }}>
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="button button-primary"
              style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <KeyRound size={15} /> {submitting ? "Resetting Password..." : "Reset Password & Revoke Sessions"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
