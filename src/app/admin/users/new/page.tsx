"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, AlertCircle } from "lucide-react";

export default function NewStaffUserPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"admin" | "root">("admin");

  // Field validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      errs.username = "Username is required.";
    } else if (!/^[a-z0-9_-]{3,32}$/.test(cleanUser)) {
      errs.username = "Username must be 3-32 lowercase letters, numbers, hyphens or underscores.";
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
    }

    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 12) {
      errs.password = "Passwords need at least 12 characters.";
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      setFormError("Please fix the validation errors before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase() || undefined,
        password,
        role,
      };

      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        router.push("/admin/users");
      } else {
        setFormError(data?.error || "Failed to create staff account.");
      }
    } catch {
      setFormError("Network error creating staff account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="new-staff-page" style={{ maxWidth: "680px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/admin/users"
          className="text-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
        >
          <ArrowLeft size={14} /> Back to Staff Accounts
        </Link>
        <h1 style={{ margin: "4px 0", fontSize: "28px", fontWeight: 700 }}>New Staff Account</h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Create an administrator or root account with role assignment and credentials.
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
        {/* Username */}
        <div>
          <label htmlFor="staff-username" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
            Username *
          </label>
          <input
            id="staff-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            minLength={3}
            maxLength={32}
            autoComplete="off"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "6px",
              border: `1px solid ${errors.username ? "#8f2f2a" : "#d9d4c8"}`,
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>
            Lowercase letters, numbers, hyphens and underscores only (3–32 chars).
          </p>
          {errors.username && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.username}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="staff-email" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
            Email Address (Optional)
          </label>
          <input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "6px",
              border: `1px solid ${errors.email ? "#8f2f2a" : "#d9d4c8"}`,
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>
            Used for official communications and password recovery tokens.
          </p>
          {errors.email && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.email}</p>}
        </div>

        {/* Role Selection */}
        <div>
          <label htmlFor="staff-role" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
            Role Assignment *
          </label>
          <select
            id="staff-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "root")}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "6px",
              border: "1px solid #d9d4c8",
              fontSize: "14px",
              background: "#fbf8f1",
              boxSizing: "border-box",
            }}
          >
            <option value="admin">admin — Standard store administration</option>
            <option value="root">root — Full system control & staff management</option>
          </select>
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>
            Only root accounts can create or modify staff credentials.
          </p>
        </div>

        {/* Password & Confirmation */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label htmlFor="staff-password" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Initial Password (≥ 12 chars) *
            </label>
            <input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.password ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            {errors.password && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="staff-confirm-password" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Confirm Password *
            </label>
            <input
              id="staff-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
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
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #ede9df" }}>
          <Link href="/admin/users" className="button button-outline" style={{ fontSize: "13px" }}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="button button-primary"
            style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <UserPlus size={15} /> {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
