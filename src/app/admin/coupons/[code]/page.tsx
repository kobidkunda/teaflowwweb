"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Edit, Trash2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { Coupon } from "@/lib/coupons";

interface CouponInspectData {
  coupon: Coupon;
  usage: {
    used_count: number;
    order_count: number;
    total_revenue_paise: number;
  };
}

export default function CouponDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = decodeURIComponent(resolvedParams.code);

  const [data, setData] = useState<CouponInspectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoupon() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { credentials: "same-origin" });
        if (res.status === 404) {
          setError("Coupon not found.");
          return;
        }
        if (!res.ok) throw new Error("Load failed");
        const json = (await res.json()) as CouponInspectData;
        setData(json);
      } catch {
        setError("Unable to load coupon details.");
      } finally {
        setLoading(false);
      }
    }
    void loadCoupon();
  }, [code]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
        Loading coupon dossier...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <AlertCircle size={40} color="#8f2f2a" style={{ marginBottom: "12px" }} />
        <h2 style={{ fontSize: "22px", margin: "0 0 8px 0" }}>{error || "Coupon not found"}</h2>
        <p style={{ color: "#63665e", marginBottom: "20px" }}>The requested promotional code could not be loaded.</p>
        <Link href="/admin/coupons" className="button button-primary">
          Back to Coupons List
        </Link>
      </div>
    );
  }

  const { coupon, usage } = data;
  const isActive = coupon.is_active === 1;

  return (
    <div className="coupon-detail-page" style={{ maxWidth: "860px" }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <Link
            href="/admin/coupons"
            className="text-link"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
          >
            <ArrowLeft size={14} /> Back to Coupons
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700, fontFamily: "monospace" }}>
              {coupon.code}
            </h1>
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
                background: isActive ? "rgba(35, 72, 58, 0.1)" : "rgba(99, 102, 94, 0.15)",
                color: isActive ? "#23483a" : "#63665e",
              }}
            >
              {isActive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            href={`/admin/coupons/${coupon.code}/edit`}
            className="button button-outline"
            style={{ minHeight: "38px", padding: "6px 14px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Edit size={14} /> Edit Coupon
          </Link>
          <Link
            href={`/admin/coupons/${coupon.code}/delete`}
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
            <Trash2 size={14} /> Delete
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ fontSize: "12px", color: "#63665e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Discount Value
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#23483a", marginTop: "8px" }}>
            {coupon.kind === "percent" ? `${coupon.value}% OFF` : `₹${(coupon.value / 100).toFixed(2)} OFF`}
          </div>
          <div style={{ fontSize: "12px", color: "#63665e", marginTop: "4px" }}>
            {coupon.kind === "percent" ? "Percentage reduction" : "Flat discount"}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ fontSize: "12px", color: "#63665e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Orders Redeemed
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#1d2a24", marginTop: "8px" }}>
            {usage.order_count} orders
          </div>
          <div style={{ fontSize: "12px", color: "#63665e", marginTop: "4px" }}>
            Usage count: {coupon.used_count} / {coupon.max_uses != null ? coupon.max_uses : "∞"}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ fontSize: "12px", color: "#63665e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Order Volume Generated
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#1d2a24", marginTop: "8px" }}>
            ₹{(usage.total_revenue_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "12px", color: "#63665e", marginTop: "4px" }}>
            Total subtotal from applied orders
          </div>
        </div>
      </div>

      {/* Detailed Parameters Card */}
      <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "24px", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 700 }}>Coupon Rules & Constraints</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Minimum Required Subtotal</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {coupon.min_subtotal_paise > 0 ? `₹${(coupon.min_subtotal_paise / 100).toFixed(2)}` : "None (applies to any subtotal)"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Usage Cap Limit</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {coupon.max_uses != null ? `${coupon.max_uses} maximum redemptions` : "Unlimited redemptions"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Valid From</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {coupon.starts_at ? new Date(coupon.starts_at).toLocaleString() : "Immediate upon creation"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Expires At</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {coupon.ends_at ? new Date(coupon.ends_at).toLocaleString() : "Never expires (permanent)"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: "#63665e", fontWeight: 600 }}>Creation Timestamp</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1d2a24", marginTop: "4px" }}>
              {new Date(coupon.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
