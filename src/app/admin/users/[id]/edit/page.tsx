"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, AlertCircle, ShieldAlert } from "lucide-react";
import type { StaffUser } from "@/components/admin/staff/types";

export default function EditStaffUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "root">("admin");
  const [isActive, setIsActive] = useState<boolean>(true);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${id}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Load failed");
        const json = (await res.json()) as { user: StaffUser };
        const u = json.user;
        setUsername(u.username);
        setEmail(u.email || "");
        setRole(u.role as "admin" | "root");
        setIsActive(u.is_active === 1);
      } catch {
        setFormError("Unable to load staff member data.");
      } finally {
        setLoading(false);
      }
    }
    void loadUser();
  }, [id]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
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
        email: email.trim().toLowerCase() || undefined,
        role,
        is_active: isActive ? 1 : 0,
      };

      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        router.push(`/admin/users/${id}`);
      } else {
        setFormError(data?.error || "Failed to update staff user.");
      }
    } catch {
      setFormError("Network error updating staff member.");
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
    <div className="edit-staff-page" style={{ maxWidth: "680px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href={`/admin/users/${id}`}
          className="text-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
        >
          <ArrowLeft size={14} /> Back to Staff Dossier
        </Link>
        <h1 style={{ margin: "4px 0", fontSize: "28px", fontWeight: 700 }}>
          Edit Staff: <span style={{ fontFamily: "monospace" }}>{username}</span>
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Update role privileges, contact email, or enable/disable account access.
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
        {/* Username (Immutable) */}
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
            Username
          </label>
          <input
            type="text"
            value={username}
            disabled
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "6px",
              border: "1px solid #d9d4c8",
              fontSize: "14px",
              background: "#ede9df",
              color: "#555850",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>Usernames are permanent and cannot be changed.</p>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="staff-email" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
            Contact Email
          </label>
          <input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "6px",
              border: `1px solid ${errors.email ? "#8f2f2a" : "#d9d4c8"}`,
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
          {errors.email && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.email}</p>}
        </div>

        {/* Role Selection */}
        <div>
          <label htmlFor="staff-role" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
            Role Privilege *
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
            <option value="admin">admin — Standard operational access</option>
            <option value="root">root — Full administrative & staff authority</option>
          </select>
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>
            Note: You cannot demote yourself if you are currently logged in as this user, nor remove the last active root.
          </p>
        </div>

        {/* Active Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            id="staff-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#23483a", cursor: "pointer" }}
          />
          <label htmlFor="staff-active" style={{ fontSize: "14px", fontWeight: 600, color: "#1d2a24", cursor: "pointer" }}>
            Account Enabled (Active)
          </label>
        </div>

        {/* Protection Info */}
        <div style={{ background: "#fbf8f1", padding: "12px", borderRadius: "6px", border: "1px solid #ede9df", display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <ShieldAlert size={18} color="#b39156" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "12px", color: "#63665e", lineHeight: 1.4 }}>
            Disabling an account immediately revokes all of that user&apos;s active sessions across all browsers.
          </div>
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
            <Save size={15} /> {submitting ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
