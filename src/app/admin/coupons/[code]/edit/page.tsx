"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import type { Coupon } from "@/lib/coupons";

export default function EditCouponPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = decodeURIComponent(resolvedParams.code);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState<number>(10);
  const [minSubtotalRupees, setMinSubtotalRupees] = useState<number>(0);
  const [maxUses, setMaxUses] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Load failed");
        const json = (await res.json()) as { coupon: Coupon };
        const c = json.coupon;
        setKind(c.kind as "percent" | "flat");
        setValue(c.value);
        setMinSubtotalRupees(c.min_subtotal_paise ? Math.round(c.min_subtotal_paise / 100) : 0);
        setMaxUses(c.max_uses != null ? String(c.max_uses) : "");
        setStartsAt(c.starts_at ? c.starts_at.slice(0, 16) : "");
        setEndsAt(c.ends_at ? c.ends_at.slice(0, 16) : "");
        setIsActive(c.is_active === 1);
      } catch {
        setFormError("Unable to load current coupon data.");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [code]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

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
        kind,
        value: Number(value),
        min_subtotal_paise: Math.round(Number(minSubtotalRupees) * 100),
        max_uses: maxUses.trim() ? parseInt(maxUses, 10) : null,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        is_active: isActive ? 1 : 0,
      };

      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        router.push(`/admin/coupons/${encodeURIComponent(code)}`);
      } else {
        setFormError(data?.error || "Failed to update coupon.");
      }
    } catch {
      setFormError("Network error updating coupon.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
        Loading coupon details...
      </div>
    );
  }

  return (
    <div className="edit-coupon-page" style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href={`/admin/coupons/${encodeURIComponent(code)}`}
          className="text-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
        >
          <ArrowLeft size={14} /> Back to Coupon Dossier
        </Link>
        <h1 style={{ margin: "4px 0", fontSize: "28px", fontWeight: 700 }}>
          Edit Coupon: <span style={{ fontFamily: "monospace" }}>{code}</span>
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Update promotional discount rates, minimum thresholds, or active state.
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
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: `1px solid ${errors.minSubtotal ? "#8f2f2a" : "#d9d4c8"}`,
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
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
            {errors.maxUses && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.maxUses}</p>}
          </div>
        </div>

        {/* Date Window */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label htmlFor="coupon-starts-at" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Active From
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
          </div>

          <div>
            <label htmlFor="coupon-ends-at" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
              Expires At
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
          <Link href={`/admin/coupons/${encodeURIComponent(code)}`} className="button button-outline" style={{ fontSize: "13px" }}>
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
