"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Copy,
  Check,
  Banknote,
  Sliders,
  Globe,
  Lock,
  Percent,
  Zap,
  Sparkles,
} from "lucide-react";
import type { PaymentSettings } from "@/lib/paymentSettings";

export function PaymentSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Environment Mode: test vs production
  const [paymentMode, setPaymentMode] = useState<"test" | "production">("test");

  // Active/Legacy
  const [rzpEnabled, setRzpEnabled] = useState(true);
  const [rzpKeyId, setRzpKeyId] = useState("");
  const [rzpSecret, setRzpSecret] = useState("");
  const [rzpWebhookSecret, setRzpWebhookSecret] = useState("");

  // Test Mode Specific Credentials
  const [rzpTestKeyId, setRzpTestKeyId] = useState("");
  const [rzpTestSecret, setRzpTestSecret] = useState("");
  const [rzpTestWebhookSecret, setRzpTestWebhookSecret] = useState("");
  const [rzpTestSecretConfigured, setRzpTestSecretConfigured] = useState(false);
  const [rzpTestWebhookConfigured, setRzpTestWebhookConfigured] = useState(false);

  // Production Mode Specific Credentials
  const [rzpProdKeyId, setRzpProdKeyId] = useState("");
  const [rzpProdSecret, setRzpProdSecret] = useState("");
  const [rzpProdWebhookSecret, setRzpProdWebhookSecret] = useState("");
  const [rzpProdSecretConfigured, setRzpProdSecretConfigured] = useState(false);
  const [rzpProdWebhookConfigured, setRzpProdWebhookConfigured] = useState(false);

  // Active status
  const [activeKeyId, setActiveKeyId] = useState("");
  const [activeSecretConfigured, setActiveSecretConfigured] = useState(false);
  const [activeWebhookConfigured, setActiveWebhookConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://teafloww.com/api/webhooks/razorpay");

  // COD Fields
  const [codEnabled, setCodEnabled] = useState(true);
  const [codFeeRupees, setCodFeeRupees] = useState(0);
  const [codMinRupees, setCodMinRupees] = useState(0);
  const [codMaxRupees, setCodMaxRupees] = useState(1000);

  // Payment Method Discounts & Incentives
  const [upiDiscountEnabled, setUpiDiscountEnabled] = useState(true);
  const [upiDiscountType, setUpiDiscountType] = useState<"percentage" | "flat">("percentage");
  const [upiDiscountValue, setUpiDiscountValue] = useState(2);
  const [upiDiscountMaxRupees, setUpiDiscountMaxRupees] = useState(150);

  const [cardDiscountEnabled, setCardDiscountEnabled] = useState(true);
  const [cardDiscountType, setCardDiscountType] = useState<"percentage" | "flat">("percentage");
  const [cardDiscountValue, setCardDiscountValue] = useState(1);
  const [cardDiscountMaxRupees, setCardDiscountMaxRupees] = useState(100);

  const [netbankingDiscountEnabled, setNetbankingDiscountEnabled] = useState(true);
  const [netbankingDiscountType, setNetbankingDiscountType] = useState<"percentage" | "flat">("percentage");
  const [netbankingDiscountValue, setNetbankingDiscountValue] = useState(1);
  const [netbankingDiscountMaxRupees, setNetbankingDiscountMaxRupees] = useState(100);

  const [minOrderForDiscountRupees, setMinOrderForDiscountRupees] = useState(0);
  const [paymentDiscountBadgeText, setPaymentDiscountBadgeText] = useState("⚡ Instant 2% Off with UPI · 1% Off on Cards");

  const fetchSettings = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/settings/payment", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load payment settings.");
      const data = (await res.json()) as { settings: PaymentSettings };
      if (data.settings) {
        setPaymentMode(data.settings.payment_mode || "test");
        setRzpEnabled(data.settings.razorpay_enabled ?? true);

        setRzpKeyId(data.settings.razorpay_key_id || "");
        setRzpSecret(data.settings.razorpay_key_secret || "");
        setRzpWebhookSecret(data.settings.razorpay_webhook_secret || "");

        setRzpTestKeyId(data.settings.razorpay_test_key_id || "");
        setRzpTestSecret(data.settings.razorpay_test_key_secret || "");
        setRzpTestWebhookSecret(data.settings.razorpay_test_webhook_secret || "");
        setRzpTestSecretConfigured(Boolean(data.settings.razorpay_test_secret_configured));
        setRzpTestWebhookConfigured(Boolean(data.settings.razorpay_test_webhook_configured));

        setRzpProdKeyId(data.settings.razorpay_prod_key_id || "");
        setRzpProdSecret(data.settings.razorpay_prod_key_secret || "");
        setRzpProdWebhookSecret(data.settings.razorpay_prod_webhook_secret || "");
        setRzpProdSecretConfigured(Boolean(data.settings.razorpay_prod_secret_configured));
        setRzpProdWebhookConfigured(Boolean(data.settings.razorpay_prod_webhook_configured));

        setActiveKeyId(data.settings.active_key_id || "");
        setActiveSecretConfigured(Boolean(data.settings.active_secret_configured));
        setActiveWebhookConfigured(Boolean(data.settings.active_webhook_configured));

        if (data.settings.webhook_url) setWebhookUrl(data.settings.webhook_url);

        setCodEnabled(data.settings.cod_enabled ?? true);
        setCodFeeRupees(data.settings.cod_fee_rupees ?? 0);
        setCodMinRupees(data.settings.cod_min_rupees ?? 0);
        setCodMaxRupees(data.settings.cod_max_rupees ?? 1000);

        // Discounts
        setUpiDiscountEnabled(data.settings.upi_discount_enabled ?? true);
        setUpiDiscountType(data.settings.upi_discount_type || "percentage");
        setUpiDiscountValue(Number(data.settings.upi_discount_value ?? 2));
        setUpiDiscountMaxRupees(Number(data.settings.upi_discount_max_rupees ?? 150));

        setCardDiscountEnabled(data.settings.card_discount_enabled ?? true);
        setCardDiscountType(data.settings.card_discount_type || "percentage");
        setCardDiscountValue(Number(data.settings.card_discount_value ?? 1));
        setCardDiscountMaxRupees(Number(data.settings.card_discount_max_rupees ?? 100));

        setNetbankingDiscountEnabled(data.settings.netbanking_discount_enabled ?? true);
        setNetbankingDiscountType(data.settings.netbanking_discount_type || "percentage");
        setNetbankingDiscountValue(Number(data.settings.netbanking_discount_value ?? 1));
        setNetbankingDiscountMaxRupees(Number(data.settings.netbanking_discount_max_rupees ?? 100));

        setMinOrderForDiscountRupees(Number(data.settings.min_order_for_discount_rupees ?? 0));
        setPaymentDiscountBadgeText(data.settings.payment_discount_badge_text || "⚡ Instant 2% Off with UPI · 1% Off on Cards");
      }
    } catch {
      setStatusMessage({ type: "error", text: "Unable to load payment settings from database." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const handleCopyWebhook = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(webhookUrl).then(() => {
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setSaving(true);

    try {
      const payload = {
        payment_mode: paymentMode,
        razorpay_enabled: rzpEnabled,
        // Legacy active
        razorpay_key_id: (paymentMode === "test" ? rzpTestKeyId : rzpProdKeyId) || rzpKeyId,
        razorpay_key_secret: (paymentMode === "test" ? rzpTestSecret : rzpProdSecret)?.startsWith("•••") ? undefined : (paymentMode === "test" ? rzpTestSecret : rzpProdSecret),
        razorpay_webhook_secret: (paymentMode === "test" ? rzpTestWebhookSecret : rzpProdWebhookSecret)?.startsWith("•••") ? undefined : (paymentMode === "test" ? rzpTestWebhookSecret : rzpProdWebhookSecret),
        // Test slots
        razorpay_test_key_id: rzpTestKeyId.trim(),
        razorpay_test_key_secret: rzpTestSecret.startsWith("•••") ? undefined : rzpTestSecret,
        razorpay_test_webhook_secret: rzpTestWebhookSecret.startsWith("•••") ? undefined : rzpTestWebhookSecret,
        // Prod slots
        razorpay_prod_key_id: rzpProdKeyId.trim(),
        razorpay_prod_key_secret: rzpProdSecret.startsWith("•••") ? undefined : rzpProdSecret,
        razorpay_prod_webhook_secret: rzpProdWebhookSecret.startsWith("•••") ? undefined : rzpProdWebhookSecret,
        // COD
        cod_enabled: codEnabled,
        cod_fee_rupees: Number(codFeeRupees),
        cod_min_rupees: Number(codMinRupees),
        cod_max_rupees: Number(codMaxRupees),
        // Payment Method Discounts & Incentives
        upi_discount_enabled: upiDiscountEnabled,
        upi_discount_type: upiDiscountType,
        upi_discount_value: Number(upiDiscountValue),
        upi_discount_max_rupees: Number(upiDiscountMaxRupees),
        card_discount_enabled: cardDiscountEnabled,
        card_discount_type: cardDiscountType,
        card_discount_value: Number(cardDiscountValue),
        card_discount_max_rupees: Number(cardDiscountMaxRupees),
        netbanking_discount_enabled: netbankingDiscountEnabled,
        netbanking_discount_type: netbankingDiscountType,
        netbanking_discount_value: Number(netbankingDiscountValue),
        netbanking_discount_max_rupees: Number(netbankingDiscountMaxRupees),
        prepaid_discount_enabled: upiDiscountEnabled || cardDiscountEnabled,
        prepaid_discount_type: "percentage",
        prepaid_discount_value: Number(upiDiscountValue),
        prepaid_discount_max_rupees: Number(upiDiscountMaxRupees),
        min_order_for_discount_rupees: Number(minOrderForDiscountRupees),
        payment_discount_badge_text: paymentDiscountBadgeText.trim(),
      };

      const res = await fetch("/api/admin/settings/payment", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (res.ok) {
        setStatusMessage({ type: "success", text: "Payment gateway settings saved successfully." });
        await fetchSettings();
      } else {
        setStatusMessage({
          type: "error",
          text: data?.error || "Failed to update payment settings.",
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
        <p style={{ margin: 0, color: "#666" }}>Loading payment gateway settings...</p>
      </div>
    );
  }

  return (
    <div className="payment-settings-page" style={{ maxWidth: "940px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <p className="eyebrow" style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-primary, #23483a)", margin: "0 0 4px" }}>
          Payment Gateways & Checkout
        </p>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "32px", fontWeight: 700, color: "#1d2a24" }}>
          Payment Settings
        </h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: "14px", lineHeight: "1.5" }}>
          Manage Razorpay online checkout environments (Test vs Production) and Cash on Delivery (COD) policies.
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
        {/* CARD 1: Gateway Environment & Razorpay Configuration */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
                <CreditCard size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Razorpay Payment Gateway</h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                  Primary online checkout processor for UPI, Credit/Debit cards, and Indian Netbanking.
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
                background: paymentMode === "production" ? "#eef6f0" : "#fff8e6",
                color: paymentMode === "production" ? "#1e5e34" : "#92400e",
                border: `1px solid ${paymentMode === "production" ? "#c7e6d0" : "#fde68a"}`,
              }}
            >
              <ShieldCheck size={14} />
              <span>{paymentMode === "production" ? "LIVE PRODUCTION" : "TEST SANDBOX"}</span>
            </span>
          </div>

          {/* ENVIRONMENT TOGGLE */}
          <div style={{ background: "#f8f7f2", border: "1px solid #e7e5dc", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#333" }}>
              Active Gateway Environment
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
                  border: `2px solid ${paymentMode === "test" ? "#b45309" : "#d1d5db"}`,
                  background: paymentMode === "test" ? "#fffbeb" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value="test"
                  checked={paymentMode === "test"}
                  onChange={() => setPaymentMode("test")}
                  style={{ width: "16px", height: "16px", accentColor: "#b45309" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: paymentMode === "test" ? "#92400e" : "#111" }}>
                    Test Mode (Sandbox)
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Use dummy test cards (e.g. <code>rzp_test_...</code>). No real money charged.
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
                  border: `2px solid ${paymentMode === "production" ? "#23483a" : "#d1d5db"}`,
                  background: paymentMode === "production" ? "#f2f7f4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value="production"
                  checked={paymentMode === "production"}
                  onChange={() => setPaymentMode("production")}
                  style={{ width: "16px", height: "16px", accentColor: "#23483a" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "13px", color: paymentMode === "production" ? "#1e5e34" : "#111" }}>
                    Production Mode (Live)
                  </strong>
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    Live payments via real UPI, Cards & Netbanking (e.g. <code>rzp_live_...</code>).
                  </span>
                </div>
              </label>
            </div>

            {/* Mode Banner */}
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                lineHeight: "1.5",
                background: paymentMode === "production" ? "#eef6f0" : "#fef3c7",
                color: paymentMode === "production" ? "#166534" : "#92400e",
                border: `1px solid ${paymentMode === "production" ? "#bbf7d0" : "#fde68a"}`,
              }}
            >
              {paymentMode === "production" ? (
                <span>🛡️ <strong>Live Mode Active:</strong> Storefront checkout uses production credentials. Active Key ID: <code>{activeKeyId || rzpProdKeyId || "Not set"}</code></span>
              ) : (
                <span>⚠️ <strong>Test Mode Active:</strong> Storefront checkout uses sandbox credentials for risk-free testing. Active Key ID: <code>{activeKeyId || rzpTestKeyId || "Not set"}</code></span>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={rzpEnabled}
                onChange={(e) => setRzpEnabled(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#23483a" }}
              />
              <span><strong>Enable Razorpay Online Checkout</strong></span>
            </label>
          </div>

          {/* SECTION: TEST CREDENTIALS */}
          <div style={{ border: "1px solid #e5e2d9", borderRadius: "8px", padding: "18px", marginBottom: "20px", background: paymentMode === "test" ? "#fffcf4" : "#faf9f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#b45309" }} />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Test Mode Credentials (<code>rzp_test_...</code>)
                </h3>
              </div>
              <span style={{ fontSize: "12px", color: rzpTestKeyId && rzpTestSecretConfigured ? "#1e5e34" : "#666" }}>
                {rzpTestKeyId && rzpTestSecretConfigured ? "✓ Ready for test orders" : "Incomplete test keys"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Key ID
                </label>
                <input
                  type="text"
                  value={rzpTestKeyId}
                  onChange={(e) => setRzpTestKeyId(e.target.value)}
                  placeholder="rzp_test_..."
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Key Secret {rzpTestSecretConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpTestSecret}
                  onChange={(e) => setRzpTestSecret(e.target.value)}
                  placeholder={rzpTestSecretConfigured ? "•••••••••••• (Unchanged)" : "Enter test secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Test Webhook Secret {rzpTestWebhookConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpTestWebhookSecret}
                  onChange={(e) => setRzpTestWebhookSecret(e.target.value)}
                  placeholder={rzpTestWebhookConfigured ? "•••••••••••• (Unchanged)" : "Enter test webhook secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>
              Defaults to <code>RAZORPAY_TEST_KEY_ID</code> and <code>RAZORPAY_TEST_KEY_SECRET</code> from environment variables.
            </p>
          </div>

          {/* SECTION: PRODUCTION CREDENTIALS */}
          <div style={{ border: "1px solid #e5e2d9", borderRadius: "8px", padding: "18px", marginBottom: "20px", background: paymentMode === "production" ? "#f4faf6" : "#faf9f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#166534" }} />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Production Mode Credentials (<code>rzp_live_...</code>)
                </h3>
              </div>
              <span style={{ fontSize: "12px", color: rzpProdKeyId && rzpProdSecretConfigured ? "#1e5e34" : "#666" }}>
                {rzpProdKeyId && rzpProdSecretConfigured ? "✓ Ready for live customers" : "Incomplete production keys"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Production Key ID
                </label>
                <input
                  type="text"
                  value={rzpProdKeyId}
                  onChange={(e) => setRzpProdKeyId(e.target.value)}
                  placeholder="rzp_live_..."
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Production Key Secret {rzpProdSecretConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpProdSecret}
                  onChange={(e) => setRzpProdSecret(e.target.value)}
                  placeholder={rzpProdSecretConfigured ? "•••••••••••• (Unchanged)" : "Enter live secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Production Webhook Secret {rzpProdWebhookConfigured && <span style={{ color: "#23483a", fontWeight: "normal" }}>(Configured)</span>}
                </label>
                <input
                  type="password"
                  value={rzpProdWebhookSecret}
                  onChange={(e) => setRzpProdWebhookSecret(e.target.value)}
                  placeholder={rzpProdWebhookConfigured ? "•••••••••••• (Unchanged)" : "Enter live webhook secret"}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "11px", color: "#666" }}>
              Defaults to <code>RAZORPAY_PROD_KEY_ID</code> and <code>RAZORPAY_PROD_KEY_SECRET</code> from environment variables.
            </p>
          </div>

          {/* Webhook Endpoint Display */}
          <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "6px", padding: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#495057", marginBottom: "6px" }}>
              Razorpay Webhook URL (Paste into Razorpay Dashboard &gt; Settings &gt; Webhooks)
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                readOnly
                value={webhookUrl}
                style={{ flex: 1, padding: "8px 10px", background: "#fff", border: "1px solid #ced4da", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace" }}
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="button button-outline"
                style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}
              >
                {copiedWebhook ? <Check size={14} color="green" /> : <Copy size={14} />}
                <span>{copiedWebhook ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#6c757d" }}>
              Subscribed events: <code>payment.captured</code>, <code>payment.failed</code>, <code>refund.processed</code>.
            </p>
          </div>
        </div>

        {/* CARD 2: Cash on Delivery (COD) Policies */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ background: "rgba(35, 72, 58, 0.08)", padding: "8px", borderRadius: "8px", color: "#23483a" }}>
              <Banknote size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Cash on Delivery (COD) Rules</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                Enable or restrict cash payments upon courier doorstep arrival in India. Synced with <a href="/admin/shipping-settings" style={{ color: "#23483a", fontWeight: 600, textDecoration: "underline" }}>Shipping &amp; Delivery Settings</a>.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
              <input
                type="checkbox"
                checked={codEnabled}
                onChange={(e) => setCodEnabled(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#23483a" }}
              />
              <span><strong>Enable Cash on Delivery (COD) Option</strong></span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                COD Convenience Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={codFeeRupees}
                onChange={(e) => setCodFeeRupees(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>Set 0 for free COD handling.</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={codMinRupees}
                onChange={(e) => setCodMinRupees(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>Orders below this cannot use COD.</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Maximum Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={codMaxRupees}
                onChange={(e) => setCodMaxRupees(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
              />
              <span style={{ fontSize: "12px", color: "#666" }}>High-value orders require online payment.</span>
            </div>
          </div>
        </div>

        {/* CARD 3: Payment Method Discounts & Prepaid Incentives */}
        <div className="tf-ops-card" style={{ background: "#fff", border: "1px solid #e5e2d9", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.12)", padding: "8px", borderRadius: "8px", color: "#059669" }}>
              <Zap size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Payment Method Discounts & Prepaid Incentives</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                Incentivize digital prepaid orders over Cash on Delivery by offering instant discounts on UPI and cards.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Promotional Banner & Badge Text
            </label>
            <input
              type="text"
              maxLength={100}
              value={paymentDiscountBadgeText}
              onChange={(e) => setPaymentDiscountBadgeText(e.target.value)}
              placeholder="e.g. ⚡ Instant 2% Off with UPI · 1% Off on Cards"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
            />
            <span style={{ fontSize: "12px", color: "#666" }}>Appears on product pages, cart, and checkout headers.</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "20px" }}>
            {/* UPI Section */}
            <div style={{ background: "#f8faf9", border: "1px solid #d1e7dd", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#0f5132", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles size={16} /> UPI & QR Code
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={upiDiscountEnabled}
                    onChange={(e) => setUpiDiscountEnabled(e.target.checked)}
                    style={{ accentColor: "#059669" }}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Discount Type</label>
                  <select
                    value={upiDiscountType}
                    onChange={(e) => setUpiDiscountType(e.target.value as "percentage" | "flat")}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>
                    {upiDiscountType === "percentage" ? "Percentage (%)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={upiDiscountType === "percentage" ? "0.5" : "1"}
                    value={upiDiscountValue}
                    onChange={(e) => setUpiDiscountValue(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Max Discount Cap (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={upiDiscountMaxRupees}
                  onChange={(e) => setUpiDiscountMaxRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#777" }}>Set 0 for unlimited cap.</span>
              </div>
            </div>

            {/* Cards Section */}
            <div style={{ background: "#fbfbfb", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#333", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CreditCard size={16} /> Credit & Debit Cards
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={cardDiscountEnabled}
                    onChange={(e) => setCardDiscountEnabled(e.target.checked)}
                    style={{ accentColor: "#23483a" }}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Discount Type</label>
                  <select
                    value={cardDiscountType}
                    onChange={(e) => setCardDiscountType(e.target.value as "percentage" | "flat")}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>
                    {cardDiscountType === "percentage" ? "Percentage (%)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={cardDiscountType === "percentage" ? "0.5" : "1"}
                    value={cardDiscountValue}
                    onChange={(e) => setCardDiscountValue(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Max Discount Cap (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={cardDiscountMaxRupees}
                  onChange={(e) => setCardDiscountMaxRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#777" }}>Set 0 for unlimited cap.</span>
              </div>
            </div>

            {/* Net Banking Section */}
            <div style={{ background: "#fbfbfb", border: "1px solid #e0e0e0", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#333", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Banknote size={16} /> Net Banking & Wallets
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={netbankingDiscountEnabled}
                    onChange={(e) => setNetbankingDiscountEnabled(e.target.checked)}
                    style={{ accentColor: "#23483a" }}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Discount Type</label>
                  <select
                    value={netbankingDiscountType}
                    onChange={(e) => setNetbankingDiscountType(e.target.value as "percentage" | "flat")}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>
                    {netbankingDiscountType === "percentage" ? "Percentage (%)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={netbankingDiscountType === "percentage" ? "0.5" : "1"}
                    value={netbankingDiscountValue}
                    onChange={(e) => setNetbankingDiscountValue(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#555", marginBottom: "4px" }}>Max Discount Cap (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={netbankingDiscountMaxRupees}
                  onChange={(e) => setNetbankingDiscountMaxRupees(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
                />
                <span style={{ fontSize: "11px", color: "#777" }}>Set 0 for unlimited cap.</span>
              </div>
            </div>
          </div>

          {/* Min Order & Simulation Summary */}
          <div style={{ background: "#edf4f0", border: "1px solid #bce1ce", borderRadius: "8px", padding: "16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#14452f", marginBottom: "4px" }}>
                  Minimum Order Value for Discounts (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minOrderForDiscountRupees}
                  onChange={(e) => setMinOrderForDiscountRupees(Number(e.target.value))}
                  style={{ width: "100%", maxWidth: "200px", padding: "8px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                />
                <span style={{ fontSize: "12px", color: "#447055", display: "block", marginTop: "2px" }}>Set 0 to offer discounts on all orders.</span>
              </div>

              <div style={{ flex: "2 1 300px", background: "#fff", padding: "12px 16px", borderRadius: "6px", border: "1px solid #c7e0d3" }}>
                <strong style={{ fontSize: "13px", color: "#14452f", display: "block", marginBottom: "6px" }}>
                  💡 Live Simulation on a ₹1,000 Order:
                </strong>
                <div style={{ fontSize: "12px", color: "#333", lineHeight: 1.6 }}>
                  <div>• <strong>UPI:</strong> Saves ₹{upiDiscountEnabled ? (upiDiscountType === "percentage" ? Math.min(1000 * upiDiscountValue / 100, upiDiscountMaxRupees || Infinity) : Math.min(upiDiscountValue, upiDiscountMaxRupees || Infinity)) : 0} (Customer pays ₹{1000 - (upiDiscountEnabled ? (upiDiscountType === "percentage" ? Math.min(1000 * upiDiscountValue / 100, upiDiscountMaxRupees || Infinity) : Math.min(upiDiscountValue, upiDiscountMaxRupees || Infinity)) : 0)})</div>
                  <div>• <strong>Card:</strong> Saves ₹{cardDiscountEnabled ? (cardDiscountType === "percentage" ? Math.min(1000 * cardDiscountValue / 100, cardDiscountMaxRupees || Infinity) : Math.min(cardDiscountValue, cardDiscountMaxRupees || Infinity)) : 0} (Customer pays ₹{1000 - (cardDiscountEnabled ? (cardDiscountType === "percentage" ? Math.min(1000 * cardDiscountValue / 100, cardDiscountMaxRupees || Infinity) : Math.min(cardDiscountValue, cardDiscountMaxRupees || Infinity)) : 0)})</div>
                  <div>• <strong>Cash on Delivery:</strong> No discount + ₹{codFeeRupees} fee (Customer pays ₹{1000 + codFeeRupees})</div>
                </div>
              </div>
            </div>
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
            <span>{saving ? "Saving Settings..." : "Save Payment Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
