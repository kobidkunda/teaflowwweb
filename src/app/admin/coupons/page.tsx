"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Ticket, Search, CheckCircle2, XCircle, Eye, Edit, Trash2, RefreshCw } from "lucide-react";
import type { Coupon } from "@/lib/coupons";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export default function CouponsListPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load coupons");
      const data = (await res.json()) as { coupons: Coupon[] };
      setCoupons(data.coupons || []);
    } catch {
      setError("Unable to retrieve coupon list. Check network connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const filteredCoupons = coupons.filter((c) => {
    if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
    if (kindFilter !== "all" && c.kind !== kindFilter) return false;
    if (statusFilter === "active" && c.is_active !== 1) return false;
    if (statusFilter === "inactive" && c.is_active === 1) return false;
    return true;
  });

  const formatValue = (c: Coupon) => {
    if (c.kind === "percent") return `${c.value}% OFF`;
    return `₹${(c.value / 100).toFixed(2)} OFF`;
  };

  const formatMinSubtotal = (paise: number) => {
    if (!paise || paise <= 0) return "No minimum";
    return `₹${(paise / 100).toFixed(0)}`;
  };

  const formatDates = (startsAt: string | null, endsAt: string | null) => {
    if (!startsAt && !endsAt) return "Permanent";
    const start = startsAt ? new Date(startsAt).toLocaleDateString() : "Immediate";
    const end = endsAt ? new Date(endsAt).toLocaleDateString() : "Open";
    return `${start} – ${end}`;
  };

  return (
    <AdminAuthGate>
      <div className="coupons-list-page" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: 700 }}>Coupons & Promotions</h1>
          <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
            Create and manage promotional discount codes, subtotal requirements, and validity windows.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void fetchCoupons()}
            className="button button-outline"
            style={{ minHeight: "38px", padding: "6px 12px", fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <Link
            href="/admin/coupons/new"
            className="button button-primary"
            style={{ minHeight: "38px", padding: "6px 16px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={15} /> Create Coupon
          </Link>
        </div>
      </div>

      {/* Advanced Coupon Logic Guide & Architecture */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #d9d4c8",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1d2a24", display: "flex", alignItems: "center", gap: "8px" }}>
            <Ticket size={18} style={{ color: "#2c4e38" }} /> Advanced Promotion & Customer Limits Engine
          </h2>
          <span style={{ fontSize: "12px", background: "#f6f3ea", padding: "3px 8px", borderRadius: "12px", color: "#63665e", fontWeight: 600 }}>
            Active Database Fencing (019)
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", fontSize: "12px" }}>
          <div style={{ background: "#fbf8f1", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e9e4d8" }}>
            <div style={{ fontWeight: 700, color: "#2c4e38", marginBottom: "4px" }}>Single-Use per Customer</div>
            <p style={{ margin: 0, color: "#555850" }}>
              Restricts coupon redemption to 1 order per unique phone number or email address. Enforced via atomic <code>coupon_redemptions</code> check.
            </p>
          </div>

          <div style={{ background: "#fbf8f1", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e9e4d8" }}>
            <div style={{ fontWeight: 700, color: "#2c4e38", marginBottom: "4px" }}>Multi-Use per User Limit</div>
            <p style={{ margin: 0, color: "#555850" }}>
              Allows a customer to reuse a promo code up to N times (e.g. 2 or 3 orders) before expiring for their phone/email.
            </p>
          </div>

          <div style={{ background: "#fbf8f1", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e9e4d8" }}>
            <div style={{ fontWeight: 700, color: "#2c4e38", marginBottom: "4px" }}>Lead Capture Incentives</div>
            <p style={{ margin: 0, color: "#555850" }}>
              Auto-provisioned discount codes unlocked when visitors submit their phone number on the exit-intent or cart incentive hook (<code>COMEBACK10</code>).
            </p>
          </div>

          <div style={{ background: "#fbf8f1", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e9e4d8" }}>
            <div style={{ fontWeight: 700, color: "#2c4e38", marginBottom: "4px" }}>Maximum Discount Cap</div>
            <p style={{ margin: 0, color: "#555850" }}>
              Capped rupee amount (e.g. max ₹500 off) preventing percentage runaway discounts on high-ticket estate batches.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          background: "#ffffff",
          padding: "14px 18px",
          borderRadius: "8px",
          border: "1px solid #d9d4c8",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search size={16} color="#8c9b88" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search coupon code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              borderRadius: "6px",
              border: "1px solid #d9d4c8",
              fontSize: "13px",
              background: "#fbf8f1",
              boxSizing: "border-box",
            }}
          />
        </div>

        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", background: "#fbf8f1" }}
        >
          <option value="all">All Discount Types</option>
          <option value="percent">Percentage Discount</option>
          <option value="flat">Flat Amount (Paise)</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", background: "#fbf8f1" }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Error Notice */}
      {error && (
        <div style={{ padding: "12px", background: "rgba(143, 47, 42, 0.08)", border: "1px solid #8f2f2a", borderRadius: "6px", color: "#8f2f2a", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Coupons Table */}
      <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
            Loading coupons...
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Ticket size={36} color="#8c9b88" style={{ marginBottom: "12px" }} />
            <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#1d2a24" }}>No coupons found</h3>
            <p style={{ margin: "0 0 16px 0", color: "#63665e", fontSize: "13px" }}>
              {search || kindFilter !== "all" || statusFilter !== "all"
                ? "No promotional codes matched your search filters."
                : "Create promotional codes to offer customers seasonal discounts."}
            </p>
            <Link href="/admin/coupons/new" className="button button-primary" style={{ fontSize: "13px" }}>
              Create First Coupon
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <caption className="sr-only">Store Coupon List</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: "160px" }}>Code</th>
                  <th scope="col" style={{ width: "130px" }}>Discount</th>
                  <th scope="col" style={{ width: "130px" }}>Min Subtotal</th>
                  <th scope="col" style={{ width: "130px" }}>Usage / Cap</th>
                  <th scope="col" style={{ width: "180px" }}>Active Dates</th>
                  <th scope="col" style={{ width: "100px" }}>Status</th>
                  <th scope="col" style={{ width: "180px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon) => {
                  const isActive = coupon.is_active === 1;
                  return (
                    <tr key={coupon.code}>
                      <td>
                        <Link
                          href={`/admin/coupons/${coupon.code}`}
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "14px",
                            color: "#1d2a24",
                            letterSpacing: "0.05em",
                            background: "rgba(179, 145, 86, 0.15)",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            display: "inline-block",
                          }}
                        >
                        </Link>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {coupon.single_use_per_customer === 1 && (
                            <span style={{ fontSize: 10, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                              1-Use/Customer
                            </span>
                          )}
                          {coupon.max_discount_paise ? (
                            <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                              Cap: ₹{(coupon.max_discount_paise / 100).toFixed(0)}
                            </span>
                          ) : null}
                          {coupon.rule_type === "lead_incentive" && (
                            <span style={{ fontSize: 10, background: "#f5f3ff", color: "#5b21b6", border: "1px solid #ddd6fe", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                              Lead Incentive
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: "#23483a" }}>
                        {formatValue(coupon)}
                      </td>
                      <td style={{ fontSize: "13px", color: "#555850" }}>
                        {formatMinSubtotal(coupon.min_subtotal_paise)}
                      </td>
                      <td style={{ fontSize: "13px", color: "#555850" }}>
                        {coupon.used_count} / {coupon.max_uses != null ? coupon.max_uses : "∞"}
                      </td>
                      <td style={{ fontSize: "12px", color: "#63665e" }}>
                        {formatDates(coupon.starts_at, coupon.ends_at)}
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
                            background: isActive ? "rgba(35, 72, 58, 0.1)" : "rgba(99, 102, 94, 0.15)",
                            color: isActive ? "#23483a" : "#63665e",
                          }}
                        >
                          {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
                          <Link
                            href={`/admin/coupons/${coupon.code}`}
                            title="Inspect Coupon"
                            style={{ color: "#23483a", display: "inline-flex", alignItems: "center", padding: "4px" }}
                          >
                            <Eye size={16} />
                          </Link>
                          <Link
                            href={`/admin/coupons/${coupon.code}/edit`}
                            title="Edit Coupon"
                            style={{ color: "#b36b3d", display: "inline-flex", alignItems: "center", padding: "4px" }}
                          >
                            <Edit size={16} />
                          </Link>
                          <Link
                            href={`/admin/coupons/${coupon.code}/delete`}
                            title="Delete Coupon"
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
