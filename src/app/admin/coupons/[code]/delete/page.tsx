"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react";
import type { Coupon } from "@/lib/coupons";

interface CouponInspectData {
  coupon: Coupon;
  usage: {
    used_count: number;
    order_count: number;
    total_revenue_paise: number;
  };
}

export default function DeleteCouponPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = decodeURIComponent(resolvedParams.code);
  const router = useRouter();

  const [data, setData] = useState<CouponInspectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoupon() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Load failed");
        const json = (await res.json()) as CouponInspectData;
        setData(json);
      } catch {
        setError("Unable to load coupon information.");
      } finally {
        setLoading(false);
      }
    }
    void loadCoupon();
  }, [code]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (res.status === 204 || res.ok) {
        router.push("/admin/coupons");
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Failed to delete coupon.");
      }
    } catch {
      setError("Network error deleting coupon.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: 0 }),
      });

      if (res.ok) {
        router.push(`/admin/coupons/${encodeURIComponent(code)}`);
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "Failed to deactivate coupon.");
      }
    } catch {
      setError("Network error updating coupon.");
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
        Loading coupon details...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <AlertCircle size={40} color="#8f2f2a" style={{ marginBottom: "12px" }} />
        <h2 style={{ fontSize: "22px", margin: "0 0 8px 0" }}>{error}</h2>
        <Link href="/admin/coupons" className="button button-primary">
          Back to Coupons List
        </Link>
      </div>
    );
  }

  const hasOrders = (data?.usage?.order_count ?? 0) > 0 || (data?.coupon?.used_count ?? 0) > 0;

  return (
    <div className="delete-coupon-page" style={{ maxWidth: "680px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Link
          href={`/admin/coupons/${encodeURIComponent(code)}`}
          className="text-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
        >
          <ArrowLeft size={14} /> Back to Coupon
        </Link>
        <h1 style={{ margin: "4px 0", fontSize: "28px", fontWeight: 700, color: "#8f2f2a" }}>
          Delete Coupon: <span style={{ fontFamily: "monospace" }}>{code}</span>
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Dedicated deletion confirmation screen with order dependency check.
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
        {hasOrders ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <ShieldAlert size={28} color="#b36b3d" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#1d2a24", fontWeight: 700 }}>
                  Deletion Blocked: Historical Orders Reference This Coupon
                </h3>
                <p style={{ margin: 0, color: "#555850", fontSize: "14px", lineHeight: 1.5 }}>
                  This coupon has been redeemed in <strong>{data?.usage.order_count} order(s)</strong>.
                  Hard-deleting this record would break accounting and invoice verification history.
                </p>
              </div>
            </div>

            <div style={{ background: "#fbf8f1", padding: "14px", borderRadius: "6px", border: "1px solid #ede9df", fontSize: "13px", color: "#63665e" }}>
              To prevent customers from redeeming this code in future checkouts without corrupting historical records,
              deactivate the coupon instead.
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #ede9df" }}>
              <Link href={`/admin/coupons/${encodeURIComponent(code)}`} className="button button-outline" style={{ fontSize: "13px" }}>
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivating}
                className="button button-primary"
                style={{ fontSize: "13px", background: "#b36b3d", borderColor: "#b36b3d" }}
              >
                {deactivating ? "Deactivating..." : "Deactivate Coupon Instead"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <AlertTriangle size={28} color="#8f2f2a" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#8f2f2a", fontWeight: 700 }}>
                  Are you sure you want to permanently delete this coupon?
                </h3>
                <p style={{ margin: 0, color: "#555850", fontSize: "14px", lineHeight: 1.5 }}>
                  This action is irreversible. Coupon code <strong>{code}</strong> will be removed from the database and will no longer be valid for customer checkout.
                </p>
              </div>
            </div>

            <div style={{ background: "#fbf8f1", padding: "14px", borderRadius: "6px", border: "1px solid #ede9df" }}>
              <div style={{ fontSize: "13px", color: "#1d2a24", fontWeight: 600 }}>Coupon Details:</div>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px", fontSize: "13px", color: "#555850" }}>
                <li>Code: {data?.coupon.code}</li>
                <li>Discount: {data?.coupon.kind === "percent" ? `${data?.coupon.value}%` : `₹${((data?.coupon.value ?? 0) / 100).toFixed(2)}`}</li>
                <li>Usage Count: {data?.coupon.used_count}</li>
              </ul>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #ede9df" }}>
              <Link href={`/admin/coupons/${encodeURIComponent(code)}`} className="button button-outline" style={{ fontSize: "13px" }}>
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
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
                <Trash2 size={15} /> {deleting ? "Deleting..." : "Confirm Deletion"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
