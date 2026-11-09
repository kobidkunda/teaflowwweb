"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Package,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Check,
  ShieldCheck,
  Zap,
  MapPin,
  ExternalLink,
  Search,
  Clock,
  Layers,
} from "lucide-react";
import type { ShippingSettings } from "@/lib/shippingSettings";

export function ShippingSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Fields
  const [minDeliveryOrderRupees, setMinDeliveryOrderRupees] = useState<number>(0);
  const [freeShippingRupees, setFreeShippingRupees] = useState<number>(599);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState<boolean>(true);
  const [shippingFeeRupees, setShippingFeeRupees] = useState<number>(99);
  const [calculationMode, setCalculationMode] = useState<"flat" | "live">("flat");
  const [dispatchCommitment, setDispatchCommitment] = useState("24-48 hours from Siliguri hub");
  const [announcementAutoSync, setAnnouncementAutoSync] = useState(true);

  // Cash on Delivery (COD) Rules
  const [codEnabled, setCodEnabled] = useState<boolean>(true);
  const [codFeeRupees, setCodFeeRupees] = useState<number>(50);
  const [codMinRupees, setCodMinRupees] = useState<number>(100);
  const [codMaxRupees, setCodMaxRupees] = useState<number>(5000);
  const [codPostcodes, setCodPostcodes] = useState<string>("");

  // Environment & Dispatch Mode
  const [shiprocketMode, setShiprocketMode] = useState<"test" | "production">("test");
  const [orderCreationMode, setOrderCreationMode] = useState<"manual" | "auto">("manual");

  // Shiprocket Legacy/Active
  const [srEnabled, setSrEnabled] = useState(true);
  const [srEmail, setSrEmail] = useState("");
  const [srPassword, setSrPassword] = useState("");
  const [srPasswordConfigured, setSrPasswordConfigured] = useState(false);

  // Test Mode Specific
  const [srTestEmail, setSrTestEmail] = useState("");
  const [srTestPassword, setSrTestPassword] = useState("");
  const [srTestPasswordConfigured, setSrTestPasswordConfigured] = useState(false);

  // Prod Mode Specific
  const [srProdEmail, setSrProdEmail] = useState("");
  const [srProdPassword, setSrProdPassword] = useState("");
  const [srProdPasswordConfigured, setSrProdPasswordConfigured] = useState(false);

  // Active Resolved
  const [activeEmail, setActiveEmail] = useState("");
  const [activePasswordConfigured, setActivePasswordConfigured] = useState(false);

  // Warehouse & Dimensions
  const [srPickupLocation, setSrPickupLocation] = useState("Primary");
  const [srPickupPostcode, setSrPickupPostcode] = useState("734015");
  const [srLength, setSrLength] = useState(10);
  const [srBreadth, setSrBreadth] = useState(10);
  const [srHeight, setSrHeight] = useState(10);
  const [srTareGrams, setSrTareGrams] = useState(100);
  const [srHsn, setSrHsn] = useState("090230");

  // Connection testing state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Serviceability check state
  const [testPincode, setTestPincode] = useState("700001");
  const [checkingServiceability, setCheckingServiceability] = useState(false);
  const [serviceabilityResult, setServiceabilityResult] = useState<{
    serviceable: boolean;
    couriers: Array<{ id: number; name: string; rate: number; cod: boolean; etd: string }>;
  } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/settings/shipping", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load shipping settings.");
      const data = (await res.json()) as { settings: ShippingSettings };
      if (data.settings) {
        setMinDeliveryOrderRupees(data.settings.min_delivery_order_rupees ?? 0);
        setFreeShippingRupees(data.settings.free_shipping_threshold_rupees ?? 599);
        setFreeShippingEnabled(data.settings.free_shipping_enabled ?? true);
        setShippingFeeRupees(data.settings.shipping_flat_fee_rupees ?? 99);
        setCalculationMode(data.settings.shipping_calculation_mode ?? "flat");
        setDispatchCommitment(data.settings.dispatch_commitment || "24-48 hours from Siliguri hub");
        setAnnouncementAutoSync(data.settings.announcement_auto_sync ?? true);

        // Cash on Delivery
        setCodEnabled(data.settings.cod_enabled ?? true);
        setCodFeeRupees(data.settings.cod_fee_rupees ?? 50);
        setCodMinRupees(data.settings.cod_min_rupees ?? 100);
        setCodMaxRupees(data.settings.cod_max_rupees ?? 5000);
        setCodPostcodes(Array.isArray(data.settings.cod_postcodes) ? data.settings.cod_postcodes.join(", ") : "");

        setShiprocketMode(data.settings.shiprocket_mode || "test");
        setOrderCreationMode(data.settings.shiprocket_order_creation_mode || "manual");

        setSrEnabled(data.settings.shiprocket_enabled ?? true);
        setSrEmail(data.settings.shiprocket_email || "");
        setSrPassword(data.settings.shiprocket_password || "");
        setSrPasswordConfigured(Boolean(data.settings.shiprocket_password_configured));

        setSrTestEmail(data.settings.shiprocket_test_email || "");
        setSrTestPassword(data.settings.shiprocket_test_password || "");
        setSrTestPasswordConfigured(Boolean(data.settings.shiprocket_test_password_configured));

        setSrProdEmail(data.settings.shiprocket_prod_email || "");
        setSrProdPassword(data.settings.shiprocket_prod_password || "");
        setSrProdPasswordConfigured(Boolean(data.settings.shiprocket_prod_password_configured));

        setActiveEmail(data.settings.active_email || "");
        setActivePasswordConfigured(Boolean(data.settings.active_password_configured));

        setSrPickupLocation(data.settings.shiprocket_pickup_location || "Primary");
        setSrPickupPostcode(data.settings.shiprocket_pickup_postcode || "734015");
        setSrLength(data.settings.shiprocket_default_length || 10);
        setSrBreadth(data.settings.shiprocket_default_breadth || 10);
        setSrHeight(data.settings.shiprocket_default_height || 10);
        setSrTareGrams(data.settings.shiprocket_default_tare_grams || 100);
        setSrHsn(data.settings.shiprocket_default_hsn || "090230");
      }
    } catch {
      setStatusMessage({ type: "error", text: "Unable to load shipping settings from database." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const emailToTest = (shiprocketMode === "test" ? srTestEmail : srProdEmail) || srEmail;
      const passToTest = (shiprocketMode === "test" ? srTestPassword : srProdPassword) || srPassword;

      const res = await fetch("/api/admin/settings/shipping/verify-connection", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToTest || undefined,
          password: passToTest && !passToTest.startsWith("•••") ? passToTest : undefined,
        }),
      });
      const data = await res.json();
      setConnectionResult(data);
    } catch {
      setConnectionResult({ success: false, message: "Network error testing Shiprocket connection." });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCheckServiceability = async () => {
    if (!testPincode || testPincode.length !== 6) {
      alert("Please enter a valid 6-digit Indian PIN code.");
      return;
    }
    setCheckingServiceability(true);
    setServiceabilityResult(null);
    try {
      const res = await fetch("/api/admin/settings/shipping/check-serviceability", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pincode: testPincode }),
      });
      const data = await res.json();
      setServiceabilityResult(data);
    } catch {
      setServiceabilityResult({ serviceable: false, couriers: [] });
    } finally {
      setCheckingServiceability(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setSaving(true);

    try {
      const payload = {
        min_delivery_order_rupees: Number(minDeliveryOrderRupees),
        free_shipping_threshold_rupees: Number(freeShippingRupees),
        free_shipping_enabled: freeShippingEnabled,
        shipping_flat_fee_rupees: Number(shippingFeeRupees),
        shipping_calculation_mode: calculationMode,
        dispatch_commitment: dispatchCommitment.trim(),
        announcement_auto_sync: announcementAutoSync,

        // Cash on Delivery
        cod_enabled: codEnabled,
        cod_fee_rupees: Number(codFeeRupees),
        cod_min_rupees: Number(codMinRupees),
        cod_max_rupees: Number(codMaxRupees),
        cod_postcodes: codPostcodes
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^\d{6}$/.test(s)),

        shiprocket_mode: shiprocketMode,
        shiprocket_order_creation_mode: orderCreationMode,
        shiprocket_enabled: srEnabled,

        // Legacy / active sync
        shiprocket_email: (shiprocketMode === "test" ? srTestEmail : srProdEmail) || srEmail,
        shiprocket_password: (shiprocketMode === "test" ? srTestPassword : srProdPassword)?.startsWith("•••") ? undefined : (shiprocketMode === "test" ? srTestPassword : srProdPassword),

        // Dedicated Test slots
        shiprocket_test_email: srTestEmail.trim(),
        shiprocket_test_password: srTestPassword.startsWith("•••") ? undefined : srTestPassword,

        // Dedicated Prod slots
        shiprocket_prod_email: srProdEmail.trim(),
        shiprocket_prod_password: srProdPassword.startsWith("•••") ? undefined : srProdPassword,

        shiprocket_pickup_location: srPickupLocation.trim(),
        shiprocket_pickup_postcode: srPickupPostcode.trim(),
        shiprocket_default_length: Number(srLength),
        shiprocket_default_breadth: Number(srBreadth),
        shiprocket_default_height: Number(srHeight),
        shiprocket_default_tare_grams: Number(srTareGrams),
        shiprocket_default_hsn: srHsn.trim(),
      };

      const res = await fetch("/api/admin/settings/shipping", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Shipping settings saved! Free delivery active above ₹${freeShippingRupees}.`,
        });
        await fetchSettings();
      } else {
        setStatusMessage({
          type: "error",
          text: data?.error || "Failed to update shipping settings.",
        });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="state-card" role="status" style={{ padding: "40px 20px", textAlign: "center" }}>
        <RefreshCw className="spin" size={24} style={{ margin: "0 auto 12px" }} aria-hidden="true" />
        <p style={{ margin: 0, color: "#666" }}>Loading shipping & logistics settings...</p>
      </div>
    );
  }

  return (
    <div className="shipping-settings-page" style={{ maxWidth: "940px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <p className="eyebrow" style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-primary, #23483a)", margin: "0 0 4px" }}>
          Logistics & Fulfillment
        </p>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "32px", fontWeight: 700, color: "#1d2a24" }}>
          Shipping & Delivery Settings
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px", lineHeight: "1.5" }}>
          Configure free delivery thresholds, flat shipping charges, top announcement banner sync, and 100% Shiprocket courier automation.
        </p>
      </div>

      {statusMessage && (
        <div
          role={statusMessage.type === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "14px",
            background: statusMessage.type === "success" ? "#eef6f0" : "#fdf2f2",
            color: statusMessage.type === "success" ? "#1e5e34" : "#b91c1c",
            border: `1px solid ${statusMessage.type === "success" ? "#c7e6d0" : "#fecaca"}`,
          }}
        >
          {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* CARD 1: Free Shipping Threshold & Standard Delivery Rates */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
              <Truck size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Delivery Thresholds & Shipping Rates</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                Controls how delivery charges are computed for customers in the bag and checkout.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px", marginBottom: "20px" }}>
            {/* Minimum Delivery Order Value */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Minimum Delivery Order Value (₹)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#666" }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minDeliveryOrderRupees}
                  onChange={(e) => setMinDeliveryOrderRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                />
              </div>
              <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
                Minimum bag subtotal required to place a delivery order. Set to <strong>0</strong> to allow any order amount.
              </span>
            </div>

            {/* Free Shipping Threshold */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Free Shipping Threshold (₹)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#666" }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={freeShippingRupees}
                  onChange={(e) => setFreeShippingRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                />
              </div>
              <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
                Orders equal to or above this subtotal receive free delivery (defaults to <strong>₹599</strong>).
              </span>
            </div>

            {/* Standard Flat Shipping Charge */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Standard Flat Shipping Fee (₹)
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#666" }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={shippingFeeRupees}
                  onChange={(e) => setShippingFeeRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                />
              </div>
              <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
                Standard shipping charge applied when subtotal is below the free threshold (defaults to <strong>₹99</strong>).
              </span>
            </div>
          </div>

          {/* Dispatch Commitment */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Storefront Dispatch Commitment
            </label>
            <input
              type="text"
              value={dispatchCommitment}
              onChange={(e) => setDispatchCommitment(e.target.value)}
              placeholder="e.g. 24-48 hours from Siliguri hub"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
            />
            <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
              Displayed on product pages, bag, and checkout trust badges.
            </span>
          </div>

          {/* Announcement Bar Auto-Sync */}
          <div style={{ padding: "14px 16px", background: "#fbf8f1", border: "1px solid #e7e5dc", borderRadius: "8px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={announcementAutoSync}
                onChange={(e) => setAnnouncementAutoSync(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#23483a" }}
              />
              <span>
                <strong>Auto-sync Top Announcement Banner</strong> (Automatically displays <em>&ldquo;FREE SHIPPING ON ORDERS ABOVE ₹{freeShippingRupees}&rdquo;</em> site-wide).
              </span>
            </label>
          </div>
        </div>

        {/* CARD 2: Cash on Delivery (COD) Rules & Eligibility */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(133, 77, 14, 0.08)", padding: "8px", borderRadius: "8px", color: "#854d0e" }}>
                <Layers size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Cash on Delivery (COD) Rules &amp; Eligibility</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Configure domestic COD availability, handling surcharge, and order value boundaries.
                </p>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={codEnabled}
                onChange={(e) => setCodEnabled(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#854d0e" }}
              />
              <span>{codEnabled ? "COD Enabled" : "COD Disabled"}</span>
            </label>
          </div>

          {codEnabled && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                    COD Handling Surcharge (₹)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#666" }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={codFeeRupees}
                      onChange={(e) => setCodFeeRupees(Number(e.target.value))}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                    />
                  </div>
                  <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
                    Additional carrier surcharge for physical cash collection (defaults to <strong>₹50</strong>).
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                    Minimum Order for COD (₹)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#666" }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={codMinRupees}
                      onChange={(e) => setCodMinRupees(Number(e.target.value))}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                    />
                  </div>
                  <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
                    Orders below this subtotal cannot use COD (defaults to <strong>₹100</strong>).
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                    Maximum Order for COD (₹)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#666" }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={codMaxRupees}
                      onChange={(e) => setCodMaxRupees(Number(e.target.value))}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                    />
                  </div>
                  <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
                    Orders above this subtotal must use online payment to reduce RTO risk (defaults to <strong>₹5,000</strong>).
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                  Eligible PIN Codes for COD (Optional)
                </label>
                <input
                  type="text"
                  value={codPostcodes}
                  onChange={(e) => setCodPostcodes(e.target.value)}
                  placeholder="e.g. 700001, 734001, 110001 (leave blank to allow all serviceable PIN codes)"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                />
                <span style={{ fontSize: "12px", color: "#666", display: "block", marginTop: "4px" }}>
                  Comma-separated list of 6-digit PIN codes. Leave blank to allow COD anywhere in India.
                </span>
              </div>
            </>
          )}
        </div>

        {/* CARD 3: Shiprocket Integration, Environment & Dispatch Mode */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
                <Package size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Shiprocket Logistics Automation</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Automates order push, courier AWB assignment, official shipping labels (PDF), and warehouse pickups.
                </p>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                background: shiprocketMode === "production" ? "#eef6f0" : "#fff8e6",
                color: shiprocketMode === "production" ? "#1e5e34" : "#92400e",
                border: `1px solid ${shiprocketMode === "production" ? "#c7e6d0" : "#fde68a"}`,
              }}
            >
              <ShieldCheck size={14} />
              <span>{shiprocketMode === "production" ? "LIVE SHIPROCKET" : "TEST SANDBOX"}</span>
            </span>
          </div>

          {/* ENVIRONMENT TOGGLE: TEST VS PRODUCTION */}
          <div style={{ background: "#f8f7f2", border: "1px solid #e7e5dc", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#333" }}>
              Shiprocket Logistics Environment
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <label
                style={{
                  flex: "1 1 200px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  border: `2px solid ${shiprocketMode === "test" ? "#b45309" : "#d1d5db"}`,
                  background: shiprocketMode === "test" ? "#fffbeb" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="shiprocketMode"
                  value="test"
                  checked={shiprocketMode === "test"}
                  onChange={() => setShiprocketMode("test")}
                  style={{ width: "16px", height: "16px", accentColor: "#b45309" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: shiprocketMode === "test" ? "#92400e" : "#111" }}>
                    Test Mode (Sandbox / Mock)
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Generates simulated labels & AWBs. Safe for testing fulfillment flows.
                  </span>
                </div>
              </label>

              <label
                style={{
                  flex: "1 1 200px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  border: `2px solid ${shiprocketMode === "production" ? "#23483a" : "#d1d5db"}`,
                  background: shiprocketMode === "production" ? "#f2f7f4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="shiprocketMode"
                  value="production"
                  checked={shiprocketMode === "production"}
                  onChange={() => setShiprocketMode("production")}
                  style={{ width: "16px", height: "16px", accentColor: "#23483a" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: shiprocketMode === "production" ? "#1e5e34" : "#111" }}>
                    Production Mode (Live Shiprocket)
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Connects to <code>apiv2.shiprocket.in</code> for real courier manifests and pickups.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* DISPATCH TRIGGER: MANUAL VS AUTO */}
          <div style={{ background: "#fcfbf9", border: "1px solid #e7e5dc", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#333" }}>
              Shipping Order Creation Trigger
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <label
                style={{
                  flex: "1 1 220px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  border: `2px solid ${orderCreationMode === "manual" ? "#23483a" : "#d1d5db"}`,
                  background: orderCreationMode === "manual" ? "#f2f7f4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="orderCreationMode"
                  value="manual"
                  checked={orderCreationMode === "manual"}
                  onChange={() => setOrderCreationMode("manual")}
                  style={{ width: "16px", height: "16px", accentColor: "#23483a" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: orderCreationMode === "manual" ? "#1e5e34" : "#111" }}>
                    Manual Operator Dispatch (Recommended)
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Order & label are generated only when admin manually reviews order in <code>/admin/orders/[id]</code> and clicks &ldquo;Prepare Order & Shipping Label&rdquo;.
                  </span>
                </div>
              </label>

              <label
                style={{
                  flex: "1 1 220px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "6px",
                  border: `2px solid ${orderCreationMode === "auto" ? "#23483a" : "#d1d5db"}`,
                  background: orderCreationMode === "auto" ? "#f2f7f4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="orderCreationMode"
                  value="auto"
                  checked={orderCreationMode === "auto"}
                  onChange={() => setOrderCreationMode("auto")}
                  style={{ width: "16px", height: "16px", accentColor: "#23483a" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: orderCreationMode === "auto" ? "#1e5e34" : "#111" }}>
                    Automatic Instant Dispatch
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Immediately creates Shiprocket order, assigns courier, generates label, and schedules pickup as soon as order is paid or confirmed as COD.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* TEST CREDENTIALS SLOT */}
          <div style={{ border: "1px solid #e5e2d9", borderRadius: "8px", padding: "18px", marginBottom: "20px", background: shiprocketMode === "test" ? "#fffcf4" : "#faf9f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#b45309" }} />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Test Mode Credentials
                </h3>
              </div>
              <span style={{ fontSize: "12px", color: srTestEmail && srTestPasswordConfigured ? "#1e5e34" : "#666" }}>
                {srTestEmail && srTestPasswordConfigured ? "✓ Configured" : "Defaults to mock simulator"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Shiprocket Email
                </label>
                <input
                  type="text"
                  value={srTestEmail}
                  onChange={(e) => setSrTestEmail(e.target.value)}
                  placeholder="test@teafloww.com"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Password {srTestPasswordConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={srTestPassword}
                  onChange={(e) => setSrTestPassword(e.target.value)}
                  placeholder={srTestPasswordConfigured ? "•••••••••••• (Unchanged)" : "Enter test password"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>
            </div>
          </div>

          {/* PRODUCTION CREDENTIALS SLOT */}
          <div style={{ border: "1px solid #e5e2d9", borderRadius: "8px", padding: "18px", marginBottom: "20px", background: shiprocketMode === "production" ? "#f4faf6" : "#faf9f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#166534" }} />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Production Mode Credentials
                </h3>
              </div>
              <span style={{ fontSize: "12px", color: srProdEmail && srProdPasswordConfigured ? "#1e5e34" : "#666" }}>
                {srProdEmail && srProdPasswordConfigured ? "✓ Ready for live dispatch" : "Awaiting production credentials"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Live Shiprocket Email
                </label>
                <input
                  type="text"
                  value={srProdEmail}
                  onChange={(e) => setSrProdEmail(e.target.value)}
                  placeholder="logistics@teafloww.com"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Live Password {srProdPasswordConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={srProdPassword}
                  onChange={(e) => setSrProdPassword(e.target.value)}
                  placeholder={srProdPasswordConfigured ? "•••••••••••• (Unchanged)" : "Enter live account password"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>
            </div>
          </div>

          {/* Test Shiprocket Connection Button */}
          <div style={{ marginBottom: "24px" }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="button button-outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                cursor: testingConnection ? "wait" : "pointer",
              }}
            >
              {testingConnection ? <RefreshCw className="spin" size={14} /> : <Zap size={14} />}
              <span>{testingConnection ? "Verifying..." : `Verify ${shiprocketMode === "production" ? "Production" : "Test"} Shiprocket Connection`}</span>
            </button>

            {connectionResult && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  background: connectionResult.success ? "#eef6f0" : "#fdf2f2",
                  color: connectionResult.success ? "#1e5e34" : "#b91c1c",
                  border: `1px solid ${connectionResult.success ? "#c7e6d0" : "#fecaca"}`,
                }}
              >
                {connectionResult.message}
              </div>
            )}
          </div>

          {/* Warehouse Pickup & Package Defaults */}
          <h3 style={{ fontSize: "15px", fontWeight: 600, margin: "20px 0 12px", borderTop: "1px solid #eee", paddingTop: "16px" }}>
            Warehouse Pickup & Default Tea Package Dimensions
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                Pickup Location Name
              </label>
              <input
                type="text"
                value={srPickupLocation}
                onChange={(e) => setSrPickupLocation(e.target.value)}
                placeholder="Primary"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
              <span style={{ fontSize: "11px", color: "#666" }}>Must match registered pickup address in Shiprocket.</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                Pickup PIN Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={srPickupPostcode}
                onChange={(e) => setSrPickupPostcode(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
              <span style={{ fontSize: "11px", color: "#666" }}>Siliguri warehouse: 734015.</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                Default Tea HSN Code
              </label>
              <input
                type="text"
                value={srHsn}
                onChange={(e) => setSrHsn(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
              <span style={{ fontSize: "11px", color: "#666" }}>Black tea HSN: 090230.</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Length (cm)</label>
              <input
                type="number"
                min="1"
                value={srLength}
                onChange={(e) => setSrLength(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Breadth (cm)</label>
              <input
                type="number"
                min="1"
                value={srBreadth}
                onChange={(e) => setSrBreadth(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Height (cm)</label>
              <input
                type="number"
                min="1"
                value={srHeight}
                onChange={(e) => setSrHeight(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Tare (grams)</label>
              <input
                type="number"
                min="0"
                value={srTareGrams}
                onChange={(e) => setSrTareGrams(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
            </div>
          </div>

          {/* PINCODE SERVICEABILITY CHECKER */}
          <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={16} />
              <span>Test Indian PIN Code Courier Serviceability</span>
            </h4>
            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#666" }}>
              Query live courier rates and delivery timelines from Siliguri to any destination pin code.
            </p>
            <div style={{ display: "flex", gap: "8px", maxWidth: "400px" }}>
              <input
                type="text"
                maxLength={6}
                value={testPincode}
                onChange={(e) => setTestPincode(e.target.value)}
                placeholder="e.g. 110001"
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
              />
              <button
                type="button"
                onClick={handleCheckServiceability}
                disabled={checkingServiceability}
                className="button button-outline"
                style={{ padding: "8px 14px", fontSize: "13px", cursor: checkingServiceability ? "wait" : "pointer" }}
              >
                {checkingServiceability ? "Checking..." : "Check PIN"}
              </button>
            </div>

            {serviceabilityResult && (
              <div style={{ marginTop: "14px" }}>
                {serviceabilityResult.serviceable ? (
                  <div>
                    <span style={{ fontSize: "12px", color: "#1e5e34", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                      ✓ Serviceable by {serviceabilityResult.couriers.length} couriers:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {serviceabilityResult.couriers.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            background: "#fff",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "12px",
                          }}
                        >
                          <strong>{c.name}</strong> · ₹{c.rate} · {c.etd} {c.cod && "· COD ✓"}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: "12px", color: "#b91c1c", fontWeight: 600 }}>
                    ✗ PIN code not serviceable by active courier contracts.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="submit"
            disabled={saving}
            className="button button-primary"
            style={{
              padding: "12px 24px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
            <span>{saving ? "Saving Settings..." : "Save Shipping Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
