"use client";
import { trackLead } from "@/lib/seo/tracking";

import React, { useState } from "react";
import { MessageCircle, ExternalLink } from "lucide-react";
import styles from "../styles/PrivateLabel.module.css";
import { SectionHeading } from "../shared/StudioPrimitives";
import { formatWhatsAppDigits, formatWhatsAppDisplay } from "@/lib/private-label/whatsapp";

export interface ConsultationLeadFormProps {
  initialNotes?: string;
  whatsappNumber?: string;
}

export function ConsultationLeadForm({
  initialNotes = "",
  whatsappNumber = "+91 7001304853",
}: ConsultationLeadFormProps = {}) {
  const cleanDigits = formatWhatsAppDigits(whatsappNumber);
  const displayPhone = formatWhatsAppDisplay(whatsappNumber);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    brandName: "",
    estimatedUnits: "500",
    notes: initialNotes,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(), email: formData.email.trim(),
          topic: "wholesale",
          message: `Private-label consultation and samples enquiry. Brand: ${formData.brandName.trim() || "Not specified"}. Planned run: ${formData.estimatedUnits} units. ${formData.notes.trim()}`,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to submit your enquiry. Please try again.");
      setReference(data.referenceCode);
      trackLead("private_label_consultation");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your enquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.stepperSection} aria-label="Order Sample Kit & Consultation">
      <div className={styles.contentContainer} style={{ maxWidth: "760px" }}>
        <SectionHeading
          title="Order a Tasting Sample Kit or Request Consultation"
          subtitle="Tell our team what you need. We will confirm sample options and a suitable production configuration."
          align="center"
        />

        <div className={styles.teaserCard}>
          {submitted ? (
            <div role="status" style={{ textAlign: "center", padding: "32px 16px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(20, 60, 49, 0.1)",
                  color: "#143C31",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  fontSize: "1.75rem",
                }}
              >
                &#10003;
              </div>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", color: "#143C31", margin: "0 0 8px" }}>
                Enquiry Received
              </h3>
              <p style={{ color: "#65746D", fontSize: "1rem", lineHeight: 1.5, margin: "0 0 20px" }}>
                Your enquiry has been saved. Reference: {reference}. Our team will review your requirements and contact you. Sample availability, pricing and delivery will be confirmed separately.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", marginBottom: "8px" }}>
                <a
                  href={`https://wa.me/${cleanDigits}?text=${encodeURIComponent(
                    `Hello TeaFloww! I just submitted a Private Label consultation enquiry (Ref: ${reference}). Could we connect regarding samples and run minimums?\n\nURL: https://teafloww.com/private-label`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.primaryCta}
                  style={{
                    backgroundColor: "#25D366",
                    color: "#092B23",
                    minHeight: "44px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 700,
                  }}
                >
                  <MessageCircle size={18} fill="#092B23" />
                  <span>Open in WhatsApp with Ticket</span>
                  <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className={styles.secondaryCta}
                  style={{ color: "#143C31", borderColor: "#143C31", minHeight: "44px" }}
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {error && <p role="alert" style={{ color: "#A32121" }}>{error}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "16px" }}>
                  <div>
                    <label
                      htmlFor="lead-name"
                      style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#171713", marginBottom: "6px" }}
                    >
                      Your Name *
                    </label>
                    <input
                      id="lead-name"
                      minLength={2} maxLength={100} autoComplete="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Vikram Sen"
                      style={{
                        width: "100%",
                        minHeight: "44px",
                        padding: "10px 14px",
                        border: "1.5px solid #DDE4DC",
                        borderRadius: "6px",
                        fontSize: "0.9375rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lead-email"
                      style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#171713", marginBottom: "6px" }}
                    >
                      Work Email *
                    </label>
                    <input
                      id="lead-email"
                      maxLength={100} autoComplete="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vikram@brand.com"
                      style={{
                        width: "100%",
                        minHeight: "44px",
                        padding: "10px 14px",
                        border: "1.5px solid #DDE4DC",
                        borderRadius: "6px",
                        fontSize: "0.9375rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "16px" }}>
                  <div>
                    <label
                      htmlFor="lead-brand"
                      style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#171713", marginBottom: "6px" }}
                    >
                      Brand / Company Name
                    </label>
                    <input
                      id="lead-brand"
                      maxLength={100} autoComplete="organization"
                      type="text"
                      value={formData.brandName}
                      onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                      placeholder="e.g. Himalayan Botanicals"
                      style={{
                        width: "100%",
                        minHeight: "44px",
                        padding: "10px 14px",
                        border: "1.5px solid #DDE4DC",
                        borderRadius: "6px",
                        fontSize: "0.9375rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lead-units"
                      style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#171713", marginBottom: "6px" }}
                    >
                      Planned First Run Quantity
                    </label>
                    <select
                      id="lead-units"
                      value={formData.estimatedUnits}
                      onChange={(e) => setFormData({ ...formData, estimatedUnits: e.target.value })}
                      style={{
                        width: "100%",
                        minHeight: "44px",
                        padding: "10px 14px",
                        border: "1.5px solid #DDE4DC",
                        borderRadius: "6px",
                        fontSize: "0.9375rem",
                        backgroundColor: "#FFFCF7",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="100">Trial Batch (100–250 units)</option>
                      <option value="500">Standard Run (500–1,000 units)</option>
                      <option value="2500">Commercial Run (2,500–5,000 units)</option>
                      <option value="10000">Enterprise Bulk (10,000+ units)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="lead-notes"
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#171713", marginBottom: "6px" }}
                  >
                    Project Details & Target Launch Timeline
                  </label>
                  <textarea
                    id="lead-notes"
                    maxLength={1500}
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Tell us about your packaging preferences, tea blend requirements, or custom questions..."
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "1.5px solid #DDE4DC",
                      borderRadius: "6px",
                      fontSize: "0.9375rem",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={styles.cardActionLink}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  fontSize: "1rem",
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Submitting Request..." : "Request Consultation & Samples \u2192"}
              </button>

              <div
                style={{
                  marginTop: "8px",
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: "#65746D",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  flexWrap: "wrap",
                }}
              >
                <span>Stuck or need an instant answer?</span>
                <a
                  href={`https://wa.me/${cleanDigits}?text=${encodeURIComponent(
                    "Hello TeaFloww! I'm on the Private Label page and have a quick question before submitting my consultation form.\n\nURL: https://teafloww.com/private-label"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#143C31",
                    fontWeight: 600,
                    textDecoration: "underline",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  aria-label="Direct WhatsApp consultation"
                >
                  <MessageCircle size={14} color="#25D366" fill="#25D366" />
                  <span>Chat directly on WhatsApp ({displayPhone}) &rarr;</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
