"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { collectAttribution } from "@/lib/business/attribution";
import { trackBusinessEvent } from "@/lib/business/events";
import {
  businessLeadSchema,
  type BusinessInterest,
  type BusinessLocale,
  type OfferCode,
  type QuantityBand,
  type Segment,
} from "@/lib/business/schema";
import { buildWhatsAppLink } from "@/lib/business/whatsapp";

type Draft = {
  segment: Segment;
  interest: BusinessInterest;
  quantityBand: QuantityBand;
  pincode: string;
  name: string;
  phone: string;
  company: string;
  note: string;
  contactConsent: boolean;
  marketingConsent: boolean;
  honeypot: string;
};

export function BusinessLeadForm({
  segment,
  locale,
  selectedOffer,
  leadsEnabled,
  whatsappE164,
  onFocusChange,
}: {
  segment: Segment;
  locale: BusinessLocale;
  selectedOffer?: OfferCode;
  leadsEnabled: boolean;
  whatsappE164?: string | null;
  onFocusChange?: (focused: boolean) => void;
}) {
  const isHi = locale === "hi";
  const [form, setForm] = useState<Draft>({
    segment,
    interest: selectedOffer ?? "unsure",
    quantityBand: "unsure",
    pincode: "",
    name: "",
    phone: "",
    company: "",
    note: "",
    contactConsent: false,
    marketingConsent: false,
    honeypot: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [reference, setReference] = useState("");
  const [hasTrackedStart, setHasTrackedStart] = useState(false);

  const idempotencyRef = useRef<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedOffer) {
      setForm((curr) => ({ ...curr, interest: selectedOffer }));
    }
  }, [selectedOffer]);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    };
  }, []);

  function buildPayload(draft: Draft) {
    return {
      segment: draft.segment,
      interest: draft.interest,
      quantityBand: draft.quantityBand,
      pincode: draft.pincode.trim(),
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      ...(draft.company.trim() ? { company: draft.company.trim() } : {}),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      locale,
      contactConsent: draft.contactConsent,
      marketingConsent: draft.marketingConsent,
      attribution: collectAttribution(typeof window !== "undefined" ? window.location.search : ""),
      honeypot: draft.honeypot,
    };
  }

  function validateSingleField(key: keyof Draft, draft: Draft, announce: boolean) {
    const parsed = businessLeadSchema.safeParse(buildPayload(draft));
    let nextMessage: string | null = null;
    if (!parsed.success) {
      const issue = parsed.error.issues.find((item) => item.path[0] === key);
      if (issue) nextMessage = issue.message;
    }

    setFieldErrors((curr) => {
      const next = { ...curr };
      if (nextMessage) {
        next[key] = nextMessage;
      } else {
        delete next[key];
      }
      return next;
    });

    if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
    if (nextMessage && announce) {
      announceTimerRef.current = setTimeout(() => {
        setLiveAnnouncement(nextMessage ?? "");
      }, 450);
    } else if (!nextMessage) {
      setLiveAnnouncement("");
    }
  }

  function updateField<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (!hasTrackedStart) {
      setHasTrackedStart(true);
      trackBusinessEvent("business_quote_start", { segment, locale });
    }
    const nextDraft = { ...form, [key]: value };
    setForm(nextDraft);
    if (touchedFields[key] || fieldErrors[key]) {
      validateSingleField(key, nextDraft, false);
    }
  }

  function handleFieldBlur(key: keyof Draft) {
    setTouchedFields((curr) => ({ ...curr, [key]: true }));
    validateSingleField(key, form, true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || status === "success") return;

    setServerError("");
    const payload = buildPayload(form);

    const parsed = businessLeadSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] ? String(issue.path[0]) : "_form";
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setTouchedFields((curr) => ({
        ...curr,
        pincode: true,
        name: true,
        phone: true,
        contactConsent: true,
      }));
      setStatus("error");
      setTimeout(() => errorSummaryRef.current?.focus(), 20);
      return;
    }

    setFieldErrors({});
    setStatus("submitting");
    idempotencyRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/business-leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyRef.current,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        reference?: string;
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!response.ok || !data.reference) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(
          data.error ||
            (isHi ? "आपकी जानकारी सहेजी नहीं जा सकी। कृपया पुनः प्रयास करें।" : "We could not submit your enquiry.")
        );
      }

      setReference(data.reference);
      setStatus("success");
      trackBusinessEvent("business_quote_submit", {
        segment: form.segment,
        interest: form.interest,
        quantity_band: form.quantityBand,
        locale,
      });
    } catch (err) {
      setStatus("error");
      setServerError(
        err instanceof Error
          ? err.message
          : isHi
            ? "कनेक्शन में समस्या है। कृपया दोबारा प्रयास करें।"
            : "Connection error. Please try again."
      );
    }
  }

  if (!leadsEnabled) {
    return (
      <div className="tf-success-box" role="status">
        <h3>{isHi ? "कोटेशन फॉर्म अस्थायी रूप से बंद है" : "Quotation intake paused"}</h3>
        <p className="tf-note">
          {isHi
            ? "कृपया थोड़ी देर बाद पुनः प्रयास करें या हमारे संपर्क पृष्ठ पर जाएं।"
            : "Please retry shortly or reach out through our contact page."}
        </p>
      </div>
    );
  }

  if (status === "success") {
    const waUrl = buildWhatsAppLink(whatsappE164, {
      segment: form.segment,
      interest: form.interest,
      reference,
      locale,
    });

    return (
      <div className="tf-success-box" role="status" aria-live="polite">
        <h3>{isHi ? "आपकी पूछताछ प्राप्त हुई।" : "Enquiry received."}</h3>
        <p className="tf-note" style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
          {isHi ? "धन्यवाद। आपकी संदर्भ संख्या: " : "Thank you. Your reference is "}
          <strong style={{ color: "#fffbf3" }}>{reference}</strong>
        </p>
        <p className="tf-note" style={{ marginBottom: "1rem" }}>
          {isHi
            ? "हमारी टीम आपकी आवश्यकता की समीक्षा कर आपसे संपर्क करेगी। MOQ, कीमत, टैक्स, भाड़ा और समय की पुष्टि लिखित कोटेशन में की जाएगी।"
            : "We will review your requirements and contact you. MOQ, pricing, taxes, freight and timings are confirmed in your written quotation."}
        </p>
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tf-button tf-button--gold"
            onClick={() =>
              trackBusinessEvent("business_whatsapp_click", {
                segment: form.segment,
                interest: form.interest,
                reference,
              })
            }
          >
            {isHi ? "WhatsApp पर संदर्भ साझा करें ↗" : "Continue on WhatsApp ↗"}
          </a>
        ) : null}
      </div>
    );
  }

  const errorEntries = Object.entries(fieldErrors);
  const fieldAnchorMap: Record<string, string> = {
    pincode: "tf-pincode",
    name: "tf-name",
    phone: "tf-phone",
    contactConsent: "tf-consent",
  };

  return (
    <form
      className="tf-form-stack"
      onSubmit={handleSubmit}
      onFocus={() => onFocusChange?.(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onFocusChange?.(false);
        }
      }}
      noValidate
    >
      <div aria-live="polite" className="tf-sr-only">
        {liveAnnouncement}
      </div>

      {errorEntries.length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="tf-error-summary"
        >
          <strong>
            {isHi ? "कृपया निम्नलिखित विवरण जांचें:" : "Please check the highlighted fields:"}
          </strong>
          <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
            {errorEntries.map(([field, msg]) => {
              const targetId = fieldAnchorMap[field];
              return (
                <li key={field}>
                  {targetId ? (
                    <a
                      href={`#${targetId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(targetId)?.focus();
                      }}
                    >
                      {msg}
                    </a>
                  ) : (
                    msg
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="tf-field">
        <label htmlFor="tf-stage">{isHi ? "आपका बिज़नेस चरण" : "Your business stage"}</label>
        <select
          id="tf-stage"
          value={form.segment}
          onChange={(e) => updateField("segment", e.target.value as Segment)}
        >
          <option value="starter">
            {isHi ? "मैं नया चाय बिज़नेस शुरू करना चाहता हूँ" : "I want to start a business"}
          </option>
          <option value="trader">
            {isHi ? "मैं पहले से चाय का व्यापार करता हूँ" : "I already trade tea"}
          </option>
        </select>
      </div>

      <div className="tf-field">
        <label htmlFor="tf-interest">
          {isHi ? "आप किस विकल्प में रुचि रखते हैं?" : "What are you interested in?"}
        </label>
        <select
          id="tf-interest"
          value={form.interest}
          onChange={(e) => updateField("interest", e.target.value as BusinessInterest)}
        >
          <option value="unsure">{isHi ? "सही विकल्प चुनने में मदद करें" : "Help me choose"}</option>
          <option value="bulk_supply">{isHi ? "थोक चाय / 25kg बोरी" : "Bulk tea / 25kg sacks"}</option>
          <option value="ready_retail">
            {isHi ? "250g–1kg तैयार रिटेल पैक" : "250g–1kg ready retail packs"}
          </option>
          <option value="private_label">
            {isHi ? "मेरा अपना चाय ब्रांड / प्राइवेट लेबल" : "My own tea brand / private label"}
          </option>
        </select>
      </div>

      <div className="tf-field">
        <label htmlFor="tf-quantity">
          {isHi ? "पहले ऑर्डर की अनुमानित मात्रा" : "Your planned first-order quantity"}
        </label>
        <select
          id="tf-quantity"
          value={form.quantityBand}
          onChange={(e) => updateField("quantityBand", e.target.value as QuantityBand)}
        >
          <option value="unsure">{isHi ? "अभी तय नहीं है" : "Not sure yet"}</option>
          <option value="25-49">25–49 kg</option>
          <option value="50-99">50–99 kg</option>
          <option value="100-249">100–249 kg</option>
          <option value="250-plus">{isHi ? "250 kg या अधिक" : "250 kg or more"}</option>
        </select>
        <small className="tf-note">
          {isHi
            ? "यह केवल अनुमान के लिए है, निश्चित MOQ कोटेशन में तय होता है।"
            : "This is a planning range, not a guaranteed MOQ."}
        </small>
      </div>

      <div className="tf-field">
        <label htmlFor="tf-pincode">{isHi ? "डिलीवरी पिन कोड *" : "Delivery pincode *"}</label>
        <span id="tf-pincode-hint" className="tf-field-hint">
          {isHi ? "6 अंकों का भारतीय पिन कोड, जैसे 734001" : "6-digit Indian pincode, e.g. 734001"}
        </span>
        <input
          id="tf-pincode"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={form.pincode}
          aria-invalid={fieldErrors.pincode ? "true" : "false"}
          aria-describedby={fieldErrors.pincode ? "tf-pincode-hint tf-pincode-err" : "tf-pincode-hint"}
          onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
          onBlur={() => handleFieldBlur("pincode")}
          placeholder="734001"
        />
        {fieldErrors.pincode ? (
          <p id="tf-pincode-err" className="tf-error">
            <span role="img" aria-label="Error">⚠</span> {fieldErrors.pincode}
          </p>
        ) : null}
      </div>

      <div className="tf-form-row">
        <div className="tf-field">
          <label htmlFor="tf-name">{isHi ? "आपका नाम *" : "Your name *"}</label>
          <input
            id="tf-name"
            type="text"
            autoComplete="name"
            minLength={2}
            required
            value={form.name}
            aria-invalid={fieldErrors.name ? "true" : "false"}
            aria-describedby={fieldErrors.name ? "tf-name-err" : undefined}
            onChange={(e) => updateField("name", e.target.value)}
            onBlur={() => handleFieldBlur("name")}
          />
          {fieldErrors.name ? (
            <p id="tf-name-err" className="tf-error">
              <span role="img" aria-label="Error">⚠</span> {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className="tf-field">
          <label htmlFor="tf-phone">{isHi ? "मोबाइल नंबर *" : "Mobile number *"}</label>
          <span id="tf-phone-hint" className="tf-field-hint">
            {isHi ? "10 अंकों का मोबाइल नंबर, जैसे 9876543210" : "10-digit Indian mobile, e.g. 9876543210"}
          </span>
          <input
            id="tf-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            pattern="[6-9]\d{9}"
            required
            value={form.phone}
            aria-invalid={fieldErrors.phone ? "true" : "false"}
            aria-describedby={fieldErrors.phone ? "tf-phone-hint tf-phone-err" : "tf-phone-hint"}
            onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
            onBlur={() => handleFieldBlur("phone")}
            placeholder="9876543210"
          />
          {fieldErrors.phone ? (
            <p id="tf-phone-err" className="tf-error">
              <span role="img" aria-label="Error">⚠</span> {fieldErrors.phone}
            </p>
          ) : null}
        </div>
      </div>

      {form.segment === "trader" ? (
        <div className="tf-field">
          <label htmlFor="tf-note">
            {isHi ? "चाय ग्रेड या पैकिंग नोट्स (वैकल्पिक)" : "Target tea grade or notes (optional)"}
          </label>
          <input
            id="tf-note"
            type="text"
            maxLength={500}
            value={form.note}
            onChange={(e) => updateField("note", e.target.value)}
            placeholder={isHi ? "जैसे: असम CTC BP/OF, मासिक आवश्यकता" : "e.g. Assam CTC BP/OF, monthly requirement"}
          />
        </div>
      ) : null}

      <label className="tf-form-checkbox">
        <input
          id="tf-consent"
          type="checkbox"
          required
          checked={form.contactConsent}
          aria-invalid={fieldErrors.contactConsent ? "true" : "false"}
          aria-describedby={fieldErrors.contactConsent ? "tf-consent-err" : undefined}
          onChange={(e) => updateField("contactConsent", e.target.checked)}
        />
        <span>
          {isHi
            ? "मैं सहमत हूँ कि TeaFloww इस कोटेशन पूछताछ के लिए मुझसे संपर्क कर सकता है। *"
            : "I agree TeaFloww may contact me about this enquiry. *"}
        </span>
      </label>
      {fieldErrors.contactConsent ? (
        <p id="tf-consent-err" className="tf-error">
          <span role="img" aria-label="Error">⚠</span> {fieldErrors.contactConsent}
        </p>
      ) : null}

      <label className="tf-form-checkbox">
        <input
          type="checkbox"
          checked={form.marketingConsent}
          onChange={(e) => updateField("marketingConsent", e.target.checked)}
        />
        <span>
          {isHi
            ? "वैकल्पिक: मुझे भविष्य के बिज़नेस ऑफर और अपडेट भेजें।"
            : "Optional: send me relevant future business offers."}
        </span>
      </label>

      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="tf-company-site">Leave this blank</label>
        <input
          id="tf-company-site"
          tabIndex={-1}
          autoComplete="off"
          value={form.honeypot}
          onChange={(e) => updateField("honeypot", e.target.value)}
        />
      </div>

      <button
        className="tf-button tf-button--gold"
        type="submit"
        disabled={status === "submitting"}
      >
        {status === "submitting"
          ? isHi
            ? "भेजा जा रहा है…"
            : "Submitting…"
          : isHi
            ? "मेरा कोटेशन प्राप्त करें →"
            : "Request My Quote →"}
      </button>

      {serverError ? (
        <p role="alert" className="tf-error">
          {serverError}
        </p>
      ) : null}

      <p className="tf-note">
        {isHi ? "यह पूछताछ कोई ऑर्डर नहीं है। हमारी " : "Your enquiry is not an order. See our "}
        <Link href="/privacy">{isHi ? "गोपनीयता नीति" : "Privacy Policy"}</Link>
        {isHi
          ? " देखें। व्यावसायिक शर्तें अलग से कन्फर्म की जाती हैं।"
          : ". Commercial terms are confirmed separately."}
      </p>
    </form>
  );
}
