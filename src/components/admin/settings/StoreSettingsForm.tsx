"use client";

import React, { useState, useEffect } from "react";
import { Save, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import type { StoreSettingsPayload } from "@/app/api/admin/settings/route";

export function StoreSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form fields
  const [storeName, setStoreName] = useState("Himalayan Tea House");
  const [currency, setCurrency] = useState("INR");
  const [taxRatePercent, setTaxRatePercent] = useState<number>(5);
  const [shippingFeeRupees, setShippingFeeRupees] = useState<number>(99);
  const [freeShippingRupees, setFreeShippingRupees] = useState<number>(1500);
  const [contactEmail, setContactEmail] = useState("concierge@himalayanteahouse.com");
  const [whatsappNumber, setWhatsappNumber] = useState("+91 98320 12345");

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchSettings = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load settings.");
      const data = (await res.json()) as { settings: StoreSettingsPayload };
      if (data.settings) {
        setStoreName(data.settings.store_name || "Himalayan Tea House");
        setCurrency(data.settings.currency || "INR");
        setTaxRatePercent(data.settings.tax_rate_percent ?? 5);
        setShippingFeeRupees(Math.round((data.settings.shipping_flat_fee_paise ?? 9900) / 100));
        setFreeShippingRupees(Math.round((data.settings.free_shipping_threshold_paise ?? 150000) / 100));
        setContactEmail(data.settings.contact_email || "concierge@himalayanteahouse.com");
        setWhatsappNumber(data.settings.whatsapp_number || "+91 98320 12345");
      }
    } catch {
      setStatusMessage({ type: "error", text: "Unable to load store settings from database." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!storeName.trim()) {
      errs.storeName = "Store name is required.";
    }

    if (!currency.trim()) {
      errs.currency = "Currency code is required.";
    }

    if (isNaN(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
      errs.taxRate = "Tax rate must be between 0% and 100%.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!contactEmail.trim() || !emailRegex.test(contactEmail.trim())) {
      errs.contactEmail = "A valid contact email address is required.";
    }

    if (!whatsappNumber.trim()) {
      errs.whatsappNumber = "WhatsApp helpline number is required for wholesale & customer inquiries.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validate()) {
      setStatusMessage({ type: "error", text: "Please correct the highlighted form errors." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        store_name: storeName.trim(),
        currency: currency.trim().toUpperCase(),
        tax_rate_percent: Number(taxRatePercent),
        contact_email: contactEmail.trim().toLowerCase(),
        whatsapp_number: whatsappNumber.trim(),
      };

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setStatusMessage({ type: "success", text: "Store operational settings successfully saved." });
      } else {
        setStatusMessage({
          type: "error",
          text: data?.error || "Failed to update store settings.",
        });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving settings. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="store-settings-container" style={{ maxWidth: "800px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: 700 }}>Store Operational Settings</h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
          Configure currency codes, tax rates, flat delivery rules, free shipping thresholds, and store concierge contact.
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
            borderRadius: "6px",
            marginBottom: "20px",
            fontSize: "14px",
            fontWeight: 500,
            background: statusMessage.type === "success" ? "rgba(35, 72, 58, 0.08)" : "rgba(143, 47, 42, 0.08)",
            border: `1px solid ${statusMessage.type === "success" ? "#23483a" : "#8f2f2a"}`,
            color: statusMessage.type === "success" ? "#23483a" : "#8f2f2a",
          }}
        >
          {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#63665e" }}>
          Loading operational settings...
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: "#ffffff", padding: "28px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Store Name */}
            <div>
              <label htmlFor="store_name" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
                Store Brand Name *
              </label>
              <input
                id="store_name"
                name="store_name"
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${errors.storeName ? "#8f2f2a" : "#d9d4c8"}`,
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              {errors.storeName && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.storeName}</p>}
            </div>

            {/* Currency Code & Contact Email Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label htmlFor="currency" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
                  Storefront Currency *
                </label>
                <select
                  id="currency"
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${errors.currency ? "#8f2f2a" : "#d9d4c8"}`,
                    fontSize: "14px",
                    background: "#fbf8f1",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="INR">INR (₹ Indian Rupee)</option>
                  <option value="USD">USD ($ US Dollar)</option>
                  <option value="EUR">EUR (€ Euro)</option>
                  <option value="GBP">GBP (£ British Pound)</option>
                </select>
                {errors.currency && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.currency}</p>}
              </div>

              <div>
                <label htmlFor="contact_email" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
                  Store Contact Email *
                </label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${errors.contactEmail ? "#8f2f2a" : "#d9d4c8"}`,
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.contactEmail && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.contactEmail}</p>}
              </div>
            </div>

            {/* WhatsApp Helpline for Wholesale & Bulk */}
            <div>
              <label htmlFor="whatsapp_number" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
                WhatsApp Number for Wholesale &amp; Bulk Enquiries *
              </label>
              <input
                id="whatsapp_number"
                name="whatsapp_number"
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+91 98320 12345"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${errors.whatsappNumber ? "#8f2f2a" : "#d9d4c8"}`,
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>
                Used when wholesale/bulk purchasers submit inquiries on the website. Include country code (e.g. +91 98320 12345).
              </p>
              {errors.whatsappNumber && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.whatsappNumber}</p>}
            </div>

            {/* Tax Rate & Shipping Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <label htmlFor="tax_rate_percent" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px", color: "#1d2a24" }}>
                  GST Tax Rate (%) *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="tax_rate_percent"
                    name="tax_rate_percent"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${errors.taxRate ? "#8f2f2a" : "#d9d4c8"}`,
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#63665e" }}>Default Indian tea GST is 5%</p>
                {errors.taxRate && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{errors.taxRate}</p>}
              </div>

              <div style={{ gridColumn: "span 2", background: "#f4f7f4", padding: "16px", borderRadius: "8px", border: "1px solid #c9dec9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 700, color: "#1d2a24" }}>
                    Delivery Fees, Free Shipping &amp; COD Rules
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#46524a" }}>
                    Standard delivery fee, free delivery threshold (₹599), minimum delivery orders, and Cash on Delivery rules are managed centrally.
                  </p>
                </div>
                <a href="/admin/shipping-settings" className="button button-outline" style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "12px", fontWeight: 600 }}>
                  Manage Delivery Settings →
                </a>
              </div>

              <div style={{ gridColumn: "span 2", background: "#fdf8f0", padding: "16px", borderRadius: "8px", border: "1px solid #e2d2ba", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 700, color: "#1d2a24" }}>
                    Brochure &amp; Product Catalogue (PDF)
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#61523c" }}>
                    Upload your official tea catalogue document and enable instant PDF downloads across the header, footer, and wholesale pages.
                  </p>
                </div>
                <a href="/admin/brochure" className="button button-outline" style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "12px", fontWeight: 600 }}>
                  Manage Brochure Catalog →
                </a>
              </div>
            </div>

            {/* Security Notice */}
            <div style={{ background: "#fbf8f1", padding: "14px", borderRadius: "6px", border: "1px solid #ede9df", display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <ShieldCheck size={20} color="#23483a" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div style={{ fontSize: "12px", color: "#555850", lineHeight: 1.5 }}>
                All mutations are validated with strict server schemas before persisting into the <code>store_settings</code> SQLite table.
                Changes affect checkout total calculation and tax receipts in real-time.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #ede9df" }}>
              <button
                type="button"
                onClick={() => void fetchSettings()}
                className="button button-outline"
                style={{ fontSize: "13px" }}
              >
                <RefreshCw size={14} /> Reset to Saved
              </button>

              <button
                type="submit"
                disabled={saving}
                className="button button-primary"
                style={{ fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <Save size={15} /> {saving ? "Saving Changes..." : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
