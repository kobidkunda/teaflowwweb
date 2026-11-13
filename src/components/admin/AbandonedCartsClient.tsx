"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  Phone,
  MessageCircle,
  MapPin,
  Laptop,
  Smartphone,
  Cpu,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  X,
  Sparkles,
} from "lucide-react";

export type CartItem = {
  variant_id: number;
  quantity: number;
  unit_price_paise: number;
  grams: number;
  sku: string;
  product_name: string;
  product_slug: string;
};

export type AbandonedCart = {
  id: string;
  session_id: string;
  status: "active" | "abandoned" | "contacted" | "converted" | "ignored";
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postcode?: string | null;
  shipping_address?: string | null;
  item_count: number;
  subtotal_paise: number;
  applied_coupon_code: string | null;
  recovery_token: string;
  recovery_url: string;
  whatsapp_url: string | null;
  admin_notes: string;
  last_active_at: string;
  created_at: string;
  ip_address?: string;
  ip_city?: string;
  ip_region?: string;
  ip_country?: string;
  user_agent?: string;
  fingerprint_hash?: string;
  screen_resolution?: string;
  timezone?: string;
  items?: CartItem[];
};

export type Metrics = {
  total_carts: number;
  total_abandoned: number;
  total_recoverable_revenue_paise: number;
  total_leads_with_phone: number;
  total_converted: number;
  recovery_rate_percent: number;
};

function formatRupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function timeAgo(dateString: string): string {
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return dateString;
  }
}

function getDeviceIcon(userAgent?: string) {
  if (!userAgent) return <Laptop className="w-3.5 h-3.5" />;
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone className="w-3.5 h-3.5 text-amber-700" />;
  }
  return <Laptop className="w-3.5 h-3.5 text-stone-600" />;
}

export function AbandonedCartsClient() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Inspect drawer
  const [inspectCart, setInspectCart] = useState<AbandonedCart | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (hasPhoneOnly) params.set("has_phone", "true");
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/abandoned-carts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load abandoned carts.");
      const data = await res.json();
      setCarts(data.carts || []);
      setMetrics(data.metrics || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching carts.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, hasPhoneOnly, debouncedSearch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleStatusChange(cartId: string, newStatus: AbandonedCart["status"], note?: string) {
    setUpdatingId(cartId);
    try {
      const res = await fetch(`/api/admin/abandoned-carts/${cartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: note }),
      });
      if (!res.ok) throw new Error("Update failed.");

      // Optimistic update
      setCarts((prev) =>
        prev.map((c) =>
          c.id === cartId
            ? {
                ...c,
                status: newStatus,
                admin_notes: note ? `${c.admin_notes}\n${note}`.trim() : c.admin_notes,
              }
            : c
        )
      );

      if (inspectCart && inspectCart.id === cartId) {
        setInspectCart((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch {
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  function copyToClipboard(text: string) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  return (
    <div className="abandoned-carts-root" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Metrics Row */}
      <section className="kpi-grid" aria-label="Abandoned cart KPIs" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="kpi-card" style={{ background: "#fff", padding: "16px 20px", borderRadius: 8, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Total Carts</span>
            <ShoppingCart size={18} style={{ color: "#2c4e38" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1d2a24" }}>{metrics?.total_carts ?? 0}</div>
          <span style={{ fontSize: 12, color: "#777" }}>All recorded bag sessions</span>
        </div>

        <div className="kpi-card" style={{ background: "#fff", padding: "16px 20px", borderRadius: 8, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Abandoned</span>
            <AlertTriangle size={18} style={{ color: "#b45309" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#b45309" }}>{metrics?.total_abandoned ?? 0}</div>
          <span style={{ fontSize: 12, color: "#777" }}>Unfinished checkout bags</span>
        </div>

        <div className="kpi-card" style={{ background: "#fff", padding: "16px 20px", borderRadius: 8, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Phone Leads</span>
            <Phone size={18} style={{ color: "#166534" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#166534" }}>{metrics?.total_leads_with_phone ?? 0}</div>
          <span style={{ fontSize: 12, color: "#777" }}>Mobile captured via modal</span>
        </div>

        <div className="kpi-card" style={{ background: "#fff", padding: "16px 20px", borderRadius: 8, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Recoverable Revenue</span>
            <Sparkles size={18} style={{ color: "#2c4e38" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#1d2a24" }}>{formatRupees(metrics?.total_recoverable_revenue_paise ?? 0)}</div>
          <span style={{ fontSize: 12, color: "#777" }}>Potential order pipeline</span>
        </div>

        <div className="kpi-card" style={{ background: "#fff", padding: "16px 20px", borderRadius: 8, border: "1px solid #e2ddd0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#666" }}>Recovery Rate</span>
            <CheckCircle2 size={18} style={{ color: "#059669" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#059669" }}>{metrics?.recovery_rate_percent ?? 0}%</div>
          <span style={{ fontSize: 12, color: "#777" }}>{metrics?.total_converted ?? 0} converted to paid</span>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div style={{ background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #e2ddd0", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1, minWidth: 280 }}>
          <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#888" }} />
            <input
              type="text"
              placeholder="Search phone, name, city, or session..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 32px", fontSize: 13, borderRadius: 6, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={15} style={{ color: "#666" }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #ccc", background: "#fff" }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="abandoned">Abandoned</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#333", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={hasPhoneOnly}
              onChange={(e) => setHasPhoneOnly(e.target.checked)}
              style={{ accentColor: "#2c4e38" }}
            />
            Has Phone Lead Only
          </label>
        </div>

        <button
          onClick={() => void loadData()}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, background: "#f6f3ea", border: "1px solid #e2ddd0", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}
        >
          <RotateCcw size={14} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Main Table */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2ddd0", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#fbf9f4", borderBottom: "1px solid #e2ddd0", color: "#555" }}>
              <th style={{ padding: "12px 16px" }}>Customer / Lead</th>
              <th style={{ padding: "12px 16px" }}>Bag Items</th>
              <th style={{ padding: "12px 16px" }}>Subtotal</th>
              <th style={{ padding: "12px 16px" }}>Device & Location</th>
              <th style={{ padding: "12px 16px" }}>Activity</th>
              <th style={{ padding: "12px 16px" }}>Status</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Outreach</th>
            </tr>
          </thead>
          <tbody>
            {loading && carts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#777" }}>
                  <Clock className="spin" size={20} style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
                  Loading abandoned carts...
                </td>
              </tr>
            ) : carts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#777" }}>
                  No carts found matching your criteria.
                </td>
              </tr>
            ) : (
              carts.map((cart) => {
                const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
                  active: { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
                  abandoned: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
                  contacted: { bg: "#f5f3ff", color: "#5b21b6", border: "#ddd6fe" },
                  converted: { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
                  ignored: { bg: "#f3f4f6", color: "#4b5563", border: "#e5e7eb" },
                };
                const currentStyle = statusStyles[cart.status] || statusStyles.abandoned;

                return (
                  <tr key={cart.id} style={{ borderBottom: "1px solid #f0ece1" }}>
                    {/* Customer */}
                    <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                      {cart.customer_phone || cart.customer_name || cart.customer_email ? (
                        <div>
                          {cart.customer_phone && (
                            <div style={{ fontWeight: 600, color: "#1d2a24", display: "flex", alignItems: "center", gap: 6 }}>
                              <Phone size={13} style={{ color: "#166534" }} />
                              <span>{cart.customer_phone}</span>
                            </div>
                          )}
                          {cart.customer_name && (
                            <div style={{ fontSize: 12, fontWeight: cart.customer_phone ? 400 : 600, color: cart.customer_phone ? "#555" : "#1d2a24", marginTop: cart.customer_phone ? 2 : 0 }}>
                              {cart.customer_name}
                            </div>
                          )}
                          {cart.customer_email && (
                            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{cart.customer_email}</div>
                          )}
                          {(cart.shipping_city || cart.shipping_state || cart.shipping_postcode) && (
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                              {[cart.shipping_city, cart.shipping_state, cart.shipping_postcode].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: "#888", fontStyle: "italic" }}>
                          Anonymous Visitor
                        </div>
                      )}
                    </td>

                    {/* Items */}
                    <td style={{ padding: "14px 16px", verticalAlign: "top", maxWidth: 260 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {cart.items && cart.items.length > 0 ? (
                          cart.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} style={{ fontSize: 12, color: "#333" }}>
                              <span style={{ fontWeight: 500 }}>{item.quantity}×</span> {item.product_name} ({item.grams}g)
                            </div>
                          ))
                        ) : (
                          <span style={{ color: "#777", fontSize: 12 }}>{cart.item_count} items</span>
                        )}
                        {cart.items && cart.items.length > 3 && (
                          <span style={{ fontSize: 11, color: "#888" }}>+{cart.items.length - 3} more items</span>
                        )}
                      </div>
                    </td>

                    {/* Subtotal */}
                    <td style={{ padding: "14px 16px", verticalAlign: "top", fontWeight: 600, color: "#1d2a24" }}>
                      {formatRupees(cart.subtotal_paise)}
                    </td>

                    {/* Device & Location */}
                    <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#333" }}>
                        <MapPin size={13} style={{ color: "#2c4e38" }} />
                        <span>{cart.ip_city || "Siliguri"}, {cart.ip_country || "India"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#777", marginTop: 3 }}>
                        {getDeviceIcon(cart.user_agent)}
                        <span style={{ fontFamily: "monospace" }}>{cart.ip_address || "local"}</span>
                      </div>
                    </td>

                    {/* Activity */}
                    <td style={{ padding: "14px 16px", verticalAlign: "top", fontSize: 12 }}>
                      <div style={{ color: "#1d2a24" }}>{timeAgo(cart.last_active_at)}</div>
                      <div style={{ color: "#888", fontSize: 11 }}>{new Date(cart.last_active_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                      <select
                        value={cart.status}
                        disabled={updatingId === cart.id}
                        onChange={(e) => void handleStatusChange(cart.id, e.target.value as AbandonedCart["status"])}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          backgroundColor: currentStyle.bg,
                          color: currentStyle.color,
                          border: `1px solid ${currentStyle.border}`,
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="abandoned">Abandoned</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="ignored">Ignored</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px 16px", verticalAlign: "top", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        {cart.whatsapp_url ? (
                          <a
                            href={cart.whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              if (cart.status === "abandoned" || cart.status === "active") {
                                void handleStatusChange(cart.id, "contacted", "Initiated WhatsApp recovery outreach.");
                              }
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 10px",
                              backgroundColor: "#25d366",
                              color: "#fff",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <MessageCircle size={14} />
                            WhatsApp
                          </a>
                        ) : null}

                        <button
                          onClick={() => {
                            setInspectCart(cart);
                            setNoteDraft("");
                          }}
                          style={{
                            padding: "6px 10px",
                            backgroundColor: "#f6f3ea",
                            border: "1px solid #e2ddd0",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                            color: "#1d2a24",
                          }}
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Technical Details Drawer / Modal */}
      {inspectCart && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 9999,
          }}
          onClick={() => setInspectCart(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              height: "100%",
              backgroundColor: "#fff",
              padding: 24,
              overflowY: "auto",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#1d2a24", fontWeight: 700 }}>Cart & Visitor Dossier</h3>
                <span style={{ fontSize: 12, color: "#777", fontFamily: "monospace" }}>ID: {inspectCart.id}</span>
              </div>
              <button
                onClick={() => setInspectCart(null)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Direct Recovery Link Card */}
            <div style={{ background: "#fbf9f4", padding: 14, borderRadius: 8, border: "1px solid #e2ddd0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Direct Cart Recovery Link</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={inspectCart.recovery_url}
                  style={{ flex: 1, padding: "6px 10px", fontSize: 12, fontFamily: "monospace", borderRadius: 4, border: "1px solid #ccc", background: "#fff" }}
                />
                <button
                  onClick={() => copyToClipboard(inspectCart.recovery_url)}
                  style={{ padding: "6px 10px", fontSize: 12, background: "#2c4e38", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  {copiedHash ? <Check size={14} /> : <Copy size={14} />}
                  Copy
                </button>
              </div>
            </div>

            {/* Bag Lines */}
            <div>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#1d2a24" }}>Items in Shopping Bag</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {inspectCart.items && inspectCart.items.length > 0 ? (
                  inspectCart.items.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: 10, background: "#fafafa", borderRadius: 6, border: "1px solid #eee", fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1d2a24" }}>{item.product_name}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{item.grams}g • SKU: {item.sku}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600 }}>{formatRupees(item.unit_price_paise * item.quantity)}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>Qty: {item.quantity} × {formatRupees(item.unit_price_paise)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: "#888" }}>No line items recorded.</div>
                )}
              </div>
            </div>

            {/* Advanced Visitor & Fingerprint Dossier */}
            <div>
              <h4 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#1d2a24", display: "flex", alignItems: "center", gap: 6 }}>
                <Cpu size={16} style={{ color: "#2c4e38" }} />
                Advanced Device & Network Fingerprint
              </h4>
              <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2ddd0", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                <div>
                  <div style={{ color: "#888", fontSize: 11 }}>Client IP Address</div>
                  <div style={{ fontWeight: 600, fontFamily: "monospace" }}>{inspectCart.ip_address || "Unavailable"}</div>
                </div>

                <div>
                  <div style={{ color: "#888", fontSize: 11 }}>Estimated Location</div>
                  <div style={{ fontWeight: 600 }}>{inspectCart.ip_city || "Siliguri"}, {inspectCart.ip_country || "India"}</div>
                </div>

                <div>
                  <div style={{ color: "#888", fontSize: 11 }}>Screen Resolution</div>
                  <div style={{ fontWeight: 600 }}>{inspectCart.screen_resolution || "1920x1080"}</div>
                </div>

                <div>
                  <div style={{ color: "#888", fontSize: 11 }}>Browser Timezone</div>
                  <div style={{ fontWeight: 600 }}>{inspectCart.timezone || "Asia/Kolkata"}</div>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ color: "#888", fontSize: 11 }}>Fingerprint Hash</div>
                  <div style={{ fontWeight: 600, fontFamily: "monospace", wordBreak: "break-all", background: "#f5f5f5", padding: "4px 8px", borderRadius: 4 }}>
                    {inspectCart.fingerprint_hash || "fp_anonymous"}
                  </div>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ color: "#888", fontSize: 11 }}>User Agent</div>
                  <div style={{ fontSize: 11, color: "#555", wordBreak: "break-all" }}>
                    {inspectCart.user_agent || "Standard Browser"}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Notes */}
            <div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 14, color: "#1d2a24" }}>Admin Outreach Notes</h4>
              {inspectCart.admin_notes ? (
                <div style={{ background: "#f8f9fa", border: "1px solid #e5e7eb", borderRadius: 6, padding: 10, fontSize: 12, whiteSpace: "pre-wrap", color: "#374151", marginBottom: 10 }}>
                  {inspectCart.admin_notes}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Add follow-up note (e.g. Sent WhatsApp reminder)..."
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  style={{ flex: 1, padding: "8px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #ccc" }}
                />
                <button
                  disabled={!noteDraft.trim()}
                  onClick={() => {
                    if (noteDraft.trim()) {
                      void handleStatusChange(inspectCart.id, inspectCart.status, noteDraft.trim());
                      setNoteDraft("");
                    }
                  }}
                  style={{ padding: "8px 12px", fontSize: 12, background: "#2c4e38", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
