"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";

export default function CreateCouponPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState<number>(10);
  const [minSubtotalRupees, setMinSubtotalRupees] = useState<number>(0);
  const [maxUses, setMaxUses] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  // Field errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      errs.code = "Coupon code is required.";
    } else if (!/^[A-Z0-9_-]{2,24}$/.test(cleanCode)) {
      errs.code = "Code must be 2-24 alphanumeric characters (A-Z, 0-9, -, _).";
    }

    if (kind === "percent") {
      if (isNaN(value) || value < 1 || value > 50) {
        errs.value = "Percentage discount must be between 1% and 50% (system safety cap).";
      }
    } else {
      if (isNaN(value) || value <= 0) {
        errs.value = "Flat discount value must be greater than 0 paise.";
      }
    }

    if (isNaN(minSubtotalRupees) || minSubtotalRupees < 0) {
      errs.minSubtotal = "Minimum subtotal cannot be negative.";
    }

    if (maxUses.trim() !== "") {
      const usesNum = parseInt(maxUses, 10);
      if (isNaN(usesNum) || usesNum <= 0) {
        errs.maxUses = "Maximum usage cap must be at least 1.";
      }
    }

    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      errs.endsAt = "Expiration date must be after start date.";
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
        code: code.trim().toUpperCase(),
        kind,
        value: Number(value),
        min_subtotal_paise: Math.round(Number(minSubtotalRupees) * 100),
        max_uses: maxUses.trim() ? parseInt(maxUses, 10) : null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        is_active: isActive ? 1 : 0,
      };

      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        router.push("/admin/coupons");
      } else {
        setFormError(data?.error || "Failed to create coupon.");
      }
    } catch {
      setFormError("Network error creating coupon. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-coupon-page" style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/admin/coupons"
          className="text-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
        >
          <ArrowLeft size={14} /> Back to Coupons List
        </Link>
        <h1 style={{ margin: "4px 0", fontSize: "28px", fontWeight: 700 }}>Create New Coupon</h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Define promotional discount rates, minimum thresholds, and active dates.
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
        {/* Code Input */}
        <div>
          <label htmlFor="coupon-code" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
            Coupon Code *
          </label>
          <input
            id="coupon-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. HARVEST20"
            required
            maxLength={24}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "6px",
              border: `1px solid ${errors.code ? "#8f2f2a" : "#d9d4c8"}`,
              fontSize: "14px",
              fontFamily: "monospace",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>Uppercase letters, numbers, hyphens, and underscores.</p>
          {errors.code && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.code}</p>}
        </div>

        {/* Kind & Value Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label htmlFor="coupon-kind" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Discount Type *
            </label>
            <select
              id="coupon-kind"
              value={kind}
              onChange={(e) => {
                const nextKind = e.target.value as "percent" | "flat";
                setKind(nextKind);
                if (nextKind === "percent" && value > 50) setValue(10);
                if (nextKind === "flat" && value <= 50) setValue(25000);
              }}
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
              <option value="percent">Percentage (%)</option>
              <option value="flat">Flat Amount (Paise)</option>
            </select>
          </div>

          <div>
            <label htmlFor="coupon-value" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              {kind === "percent" ? "Percentage Discount (1–50%) *" : "Discount Value (Paise) *"}
            </label>
            <input
              id="coupon-value"
              type="number"
              min={1}
              max={kind === "percent" ? 50 : undefined}
              step={1}
              value={value}
              onChange={(e) => setValue(parseInt(e.target.value, 10))}
              required
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.value ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>
              {kind === "percent" ? "Capped at 50% max discount." : `e.g. 25000 paise = ₹250.00`}
            </p>
            {errors.value && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.value}</p>}
          </div>
        </div>

        {/* Min Subtotal & Max Uses */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label htmlFor="coupon-min-subtotal" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Minimum Cart Subtotal (₹)
            </label>
            <input
              id="coupon-min-subtotal"
              type="number"
              min={0}
              step={1}
              value={minSubtotalRupees}
              onChange={(e) => setMinSubtotalRupees(parseFloat(e.target.value))}
              placeholder="0 for no minimum"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.minSubtotal ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>0 means no minimum required.</p>
            {errors.minSubtotal && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.minSubtotal}</p>}
          </div>

          <div>
            <label htmlFor="coupon-max-uses" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Maximum Usage Limit
            </label>
            <input
              id="coupon-max-uses"
              type="number"
              min={1}
              step={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Blank for unlimited"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.maxUses ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>Leave empty for unlimited redemptions.</p>
            {errors.maxUses && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.maxUses}</p>}
          </div>
        </div>

        {/* Date Window */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label htmlFor="coupon-starts-at" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Active From (Start Date)
            </label>
            <input
              id="coupon-starts-at"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: "1px solid #d9d4c8",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>Optional: immediate if left blank.</p>
          </div>

          <div>
            <label htmlFor="coupon-ends-at" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Expires At (End Date)
            </label>
            <input
              id="coupon-ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.endsAt ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>Optional: never expires if left blank.</p>
            {errors.endsAt && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.endsAt}</p>}
          </div>
        </div>

        {/* Active Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            id="coupon-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#23483a", cursor: "pointer" }}
          />
          <label htmlFor="coupon-active" style={{ fontSize: "14px", fontWeight: 600, color: "#1d2a24", cursor: "pointer" }}>
            Enable Coupon (Active on Storefront)
          </label>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #ede9df" }}>
          <Link href="/admin/coupons" className="button button-outline" style={{ fontSize: "13px" }}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="button button-primary"
            style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Save size={15} /> {submitting ? "Saving Coupon..." : "Create Coupon"}
          </button>
        </div>
      </form>
    </div>
  );
}
