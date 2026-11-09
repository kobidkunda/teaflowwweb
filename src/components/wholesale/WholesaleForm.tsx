"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { trackLead } from "@/lib/seo/tracking";

export interface WholesaleFormProps {
  onSuccess?: (whatsappUrl: string) => void;
  className?: string;
  defaultCategory?: string;
}

const TEA_CATEGORIES = [
  "Single-Estate Orthodox Teas (Darjeeling, Assam, Kangra)",
  "Specialty High-Grown Green & White Teas",
  "Premium CTC & Special Masala Chai Blends",
  "Custom Garden Blending & White-Label Packaging",
  "Estate Sample Tasting Kit (5 Selected Grades)",
];

const VOLUME_TIERS = [
  { value: "5 – 25 kg", label: "5 – 25 kg", note: "Trial / Boutique Cafe" },
  { value: "25 – 100 kg", label: "25 – 100 kg", note: "Monthly Commercial" },
  { value: "100 – 500 kg", label: "100 – 500 kg", note: "Distributor / Chain" },
  { value: "500+ kg", label: "500+ kg", note: "Export / Container" },
];

export function WholesaleForm({ onSuccess, className = "", defaultCategory }: WholesaleFormProps) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState(defaultCategory || TEA_CATEGORIES[0]);
  const [estimatedVolume, setEstimatedVolume] = useState(VOLUME_TIERS[0].value);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedData, setSubmittedData] = useState<{
    id: number;
    whatsappUrl: string;
    whatsappNumber: string;
  } | null>(null);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = "Please provide your full contact name.";
    }
    if (!businessName.trim() || businessName.trim().length < 2) {
      errors.businessName = "Please provide your business, cafe, or organization name.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errors.email = "Please provide a valid business email address.";
    }
    if (!phone.trim() || phone.trim().length < 6) {
      errors.phone = "Please provide a valid phone or WhatsApp number with country code.";
    }
    if (!interest) {
      errors.interest = "Please select a tea category.";
    }
    if (!estimatedVolume) {
      errors.estimatedVolume = "Please select an estimated order volume.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!validate()) {
      setErrorMsg("Please fill in the required fields marked below.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/wholesale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          business_name: businessName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          interest,
          estimated_volume: estimatedVolume,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok && data.whatsappUrl) {
        trackLead("wholesale_inquiry", {
          business_name: businessName.trim(),
          interest,
          estimated_volume: estimatedVolume,
        });

        setSubmittedData({
          id: data.id,
          whatsappUrl: data.whatsappUrl,
          whatsappNumber: data.whatsappNumber || "+91 98320 12345",
        });

        // Trigger WhatsApp in a new window/tab
        try {
          window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
        } catch {
          // If popup blocked, user will see the fallback button
        }

        if (onSuccess) {
          onSuccess(data.whatsappUrl);
        }
      } else {
        setErrorMsg(data?.error || "Unable to register wholesale inquiry. Please try again.");
      }
    } catch {
      setErrorMsg("Network error connecting to the wholesale server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName("");
    setBusinessName("");
    setEmail("");
    setPhone("");
    setInterest(TEA_CATEGORIES[0]);
    setEstimatedVolume(VOLUME_TIERS[0].value);
    setLocation("");
    setNotes("");
    setSubmittedData(null);
    setErrorMsg(null);
    setFieldErrors({});
  };

  if (submittedData) {
    return (
      <div
        className={`wholesale-success-card ${className}`}
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "36px 30px",
          border: "1px solid #dcd4c5",
          boxShadow: "0 10px 30px rgba(29, 42, 36, 0.08)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "rgba(37, 211, 102, 0.15)",
            color: "#128c7e",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px",
          }}
        >
          <CheckCircle2 size={36} />
        </div>

        <h3
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "26px",
            color: "#18231c",
            margin: "0 0 10px 0",
            fontWeight: 700,
          }}
        > <StorefrontText id="copy_8af8b26fa9449acc" fallback="Wholesale Inquiry Registered!" /> </h3>

        <p style={{ color: "#555d52", fontSize: "14px", lineHeight: 1.6, maxWidth: "480px", margin: "0 auto 24px" }}> <StorefrontText id="copy_e48556781de96020" fallback="Reference Inquiry" /> <strong>#{submittedData.id}</strong> <StorefrontText id="copy_0d03d6b054f98a0e" fallback="has been saved in our garden dispatch system. WhatsApp should open automatically to connect you with our tea estate desk." /> </p>

        <div style={{ marginBottom: "28px" }}>
          <a
            href={submittedData.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wholesale-wa-direct-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              color: "#ffffff",
              padding: "16px 28px",
              borderRadius: "50px",
              fontSize: "15px",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 6px 20px rgba(37, 211, 102, 0.35)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            <WhatsAppIcon size={20} />
            <span> <StorefrontText id="copy_f5792cc1183dae1b" fallback="Open WhatsApp Chat Directly" /> </span>
            <ExternalLink size={16} />
          </a>
        </div>

        <div
          style={{
            background: "#fbf8f1",
            borderRadius: "12px",
            padding: "18px 20px",
            textAlign: "left",
            fontSize: "13px",
            color: "#464d43",
            lineHeight: 1.6,
            border: "1px solid #ede8de",
            marginBottom: "24px",
          }}
        >
          <div style={{ fontWeight: 700, color: "#18231c", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={15} color="#b36b3d" /> <StorefrontText id="copy_0eb405abf064f18e" fallback="Direct Sourcing Guarantee" /> </div>
          <div> <StorefrontText id="copy_f31f17b9f10bac56" fallback="• Siliguri Central Warehouse Dispatch within 24-48 hours." /> </div>
          <div>• Custom lot cupping notes &amp; ISO lab reports provided.</div>
          <div> <StorefrontText id="copy_51cc3c85279eb9a0" fallback="• Support Helpline:" /> <strong>{submittedData.whatsappNumber}</strong></div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          style={{
            background: "transparent",
            border: "1px solid #d4cdc0",
            color: "#52594e",
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <RefreshCw size={14} /> <StorefrontText id="copy_fc4a0be8327f6ee9" fallback="Submit Another Inquiry" /> </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`wholesale-form ${className}`}
      style={{
        background: "#ffffff",
        borderRadius: "18px",
        padding: "32px 28px",
        border: "1px solid #e2dbcd",
        boxShadow: "0 8px 32px rgba(29, 42, 36, 0.06)",
      }}
    >
      <div style={{ marginBottom: "22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#23483a",
              background: "rgba(35, 72, 58, 0.1)",
              padding: "4px 10px",
              borderRadius: "50px",
            }}
          >
            B2B &amp; Bulk Procurement
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: "#128c7e",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#25D366",
                display: "inline-block",
              }}
            /> <StorefrontText id="copy_a269465d1aef2373" fallback="WhatsApp Concierge Active" /> </span>
        </div>
        <h2
          id="wholesale-form-title"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "26px",
            fontWeight: 700,
            color: "#18231c",
            margin: "4px 0 8px 0",
            lineHeight: 1.2,
          }}
        >
          Wholesale &amp; Bulk Tea Inquiry
        </h2>
        <p style={{ margin: 0, color: "#61685d", fontSize: "14px", lineHeight: 1.5 }}> <StorefrontText id="copy_267c8f619f8b5520" fallback="Fill in your procurement requirements below. Submitting instantly registers your request and opens a direct WhatsApp chat with our Siliguri estate tea master." /> </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "13px",
            background: "rgba(143, 47, 42, 0.08)",
            border: "1px solid #8f2f2a",
            color: "#8f2f2a",
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Name & Business Name Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <div>
            <label
              htmlFor="ws_name"
              style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}
            > <StorefrontText id="copy_6d1f7c679c4aba53" fallback="Contact Person Name *" /> </label>
            <input
              id="ws_name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya Banerjee"
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: `1px solid ${fieldErrors.name ? "#8f2f2a" : "#d3cbbe"}`,
                fontSize: "14px",
                boxSizing: "border-box",
                background: "#fdfcfa",
              }}
            />
            {fieldErrors.name && (
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="ws_business"
              style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}
            > <StorefrontText id="copy_c6366d18127b9645" fallback="Business / Cafe / Company *" /> </label>
            <input
              id="ws_business"
              name="business_name"
              type="text"
              required
              autoComplete="organization"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. High Mountain Brews Cafe"
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: `1px solid ${fieldErrors.businessName ? "#8f2f2a" : "#d3cbbe"}`,
                fontSize: "14px",
                boxSizing: "border-box",
                background: "#fdfcfa",
              }}
            />
            {fieldErrors.businessName && (
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{fieldErrors.businessName}</p>
            )}
          </div>
        </div>

        {/* Email & Phone Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <div>
            <label
              htmlFor="ws_email"
              style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}
            > <StorefrontText id="copy_abc82958356e625f" fallback="Business Email *" /> </label>
            <input
              id="ws_email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="procurement@company.com"
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: `1px solid ${fieldErrors.email ? "#8f2f2a" : "#d3cbbe"}`,
                fontSize: "14px",
                boxSizing: "border-box",
                background: "#fdfcfa",
              }}
            />
            {fieldErrors.email && (
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="ws_phone"
              style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}
            > <StorefrontText id="copy_8fc2ea9291acdc9c" fallback="Phone / WhatsApp Number *" /> </label>
            <input
              id="ws_phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: `1px solid ${fieldErrors.phone ? "#8f2f2a" : "#d3cbbe"}`,
                fontSize: "14px",
                boxSizing: "border-box",
                background: "#fdfcfa",
              }}
            />
            {fieldErrors.phone && (
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{fieldErrors.phone}</p>
            )}
          </div>
        </div>

        {/* Tea Category Interest */}
        <div>
          <label
            htmlFor="ws_interest"
            style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}
          > <StorefrontText id="copy_229ff35f6c5ecb6a" fallback="Tea Category / Procurement Focus *" /> </label>
          <select
            id="ws_interest"
            name="interest"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "8px",
              border: `1px solid ${fieldErrors.interest ? "#8f2f2a" : "#d3cbbe"}`,
              fontSize: "14px",
              boxSizing: "border-box",
              background: "#fdfcfa",
              cursor: "pointer",
            }}
          >
            {TEA_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Estimated Volume Tiers */}
        <div>
          <label
            style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "8px" }}
          > <StorefrontText id="copy_162a2f05692d32a5" fallback="Estimated Order Volume (Per Order / Batch) *" /> </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "10px",
            }}
          >
            {VOLUME_TIERS.map((tier) => {
              const isSelected = estimatedVolume === tier.value;
              return (
                <button
                  key={tier.value}
                  type="button"
                  onClick={() => setEstimatedVolume(tier.value)}
                  style={{
                    border: isSelected ? "2px solid #23483a" : "1px solid #dcd4c6",
                    background: isSelected ? "rgba(35, 72, 58, 0.08)" : "#ffffff",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: isSelected ? "#18231c" : "#3b4237",
                    }}
                  >
                    {tier.label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: isSelected ? "#23483a" : "#767c71",
                      marginTop: "2px",
                    }}
                  >
                    {tier.note}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Location & Delivery City */}
        <div>
          <label
            htmlFor="ws_location"
            style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}
          > <StorefrontText id="copy_e66231d7d2a28dbf" fallback="Destination City / Country (Optional)" /> </label>
          <div style={{ position: "relative" }}>
            <input
              id="ws_location"
              name="location"
              type="text"
              autoComplete="address-level2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Mumbai, Maharashtra or Dubai, UAE"
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #d3cbbe",
                fontSize: "14px",
                boxSizing: "border-box",
                background: "#fdfcfa",
              }}
            />
          </div>
        </div>

        {/* Custom Specifications / Notes */}
        <div>
          <label
            htmlFor="ws_notes"
            style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}
          > <StorefrontText id="copy_a55f97cfc5f2544a" fallback="Specific Leaf Grades or Custom Requirements (Optional)" /> </label>
          <textarea
            id="ws_notes"
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Looking for FTGFOP1 Darjeeling First Flush, sample evaluation required, vacuum foil packs preferred..."
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "8px",
              border: "1px solid #d3cbbe",
              fontSize: "14px",
              boxSizing: "border-box",
              background: "#fdfcfa",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        {/* Submit Button */}
        <div style={{ paddingTop: "8px" }}>
          <button
            type="submit"
            disabled={loading}
            className="wholesale-submit-btn"
            style={{
              width: "100%",
              padding: "16px 24px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxShadow: "0 6px 20px rgba(37, 211, 102, 0.35)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
          >
            <WhatsAppIcon size={22} />
            <span>{loading ? "Registering Inquiry & Generating Chat..." : "Submit Inquiry & Open WhatsApp"}</span>
            <Send size={18} />
          </button>
          <p
            style={{
              margin: "10px 0 0 0",
              fontSize: "12px",
              color: "#6f756b",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          > <StorefrontText id="copy_6399c9d76906440e" fallback="Instant WhatsApp connection with Himalayan Tea House wholesale desk · Mon–Sat 9am–6pm IST" /> </p>
        </div>
      </div>
    </form>
  );
}

export function WhatsAppIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.99c-.002 5.45-4.437 9.886-9.888 9.886m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.481-8.405z" />
    </svg>
  );
}
