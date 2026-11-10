"use client";
import { trackLead } from "@/lib/seo/tracking";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useId } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  MessageCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { pushDataLayerEvent } from "@/lib/seo/tracking";
import { TOPIC_LABELS, type ContactInquiryInput, buildContactWhatsAppUrl } from "@/lib/contactTypes";

export interface ContactStudioProps {
  initialTopic?: ContactInquiryInput["topic"];
  className?: string;
}

const TOPICS: Array<{
  id: ContactInquiryInput["topic"];
  label: string;
  icon: string;
  contextHint: string;
  quickAction?: { label: string; href: string };
}> = [
  {
    id: "brewing",
    label: "Brewing Guidance",
    icon: "🍃",
    contextHint:
      "Need precise water temperature, leaf-to-water ratios, or multiple gongfu steepings? Share your tea lot below.",
    quickAction: { label: "Read Brewing Guides", href: "/blog" },
  },
  {
    id: "order",
    label: "Order & Dispatch",
    icon: "📦",
    contextHint:
      "Tracking your courier consignment from Siliguri? Enter your Order ID below or check our live tracker.",
    quickAction: { label: "Track Consignment", href: "/track" },
  },
  {
    id: "cupping",
    label: "Private Tasting Room",
    icon: "🫖",
    contextHint:
      "Visiting Siliguri? Reserve a private sensory cupping flight at our Fulbari works with our licensed tea tasters.",
    quickAction: { label: "Tasting Facility Details", href: "/about" },
  },
  {
    id: "wholesale",
    label: "Wholesale & Gifting",
    icon: "🌿",
    contextHint:
      "Specialty cafes, five-star hospitality, export lots, or luxury corporate tea gifts from origin.",
    quickAction: { label: "Explore Wholesale Portal", href: "/wholesale" },
  },
  {
    id: "gardens",
    label: "Garden Partnerships",
    icon: "🤝",
    contextHint:
      "Direct estate inquiries from Darjeeling, Dooars, Terai, Assam, Kangra, or Nilgiri smallholders.",
    quickAction: { label: "Our Sourcing Model", href: "/about" },
  },
  {
    id: "general",
    label: "General Inquiry",
    icon: "💬",
    contextHint:
      "Questions about TeaFloww provenance, storage tins, freshness guarantees, or gift notes.",
  },
];

export function ContactStudio({ initialTopic = "brewing", className = "" }: ContactStudioProps) {
  const formId = useId();

  const [topic, setTopic] = useState<ContactInquiryInput["topic"]>(initialTopic);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // Interaction tracking per modern-web-guidance
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    referenceCode: string;
    whatsappUrl: string;
    message: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const activeTopicInfo = TOPICS.find((t) => t.id === topic) || TOPICS[0];

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string): boolean => {
    const newErrors = { ...errors };

    if (field === "name") {
      if (!name.trim()) {
        newErrors.name = "Please enter your name.";
      } else if (name.trim().length < 2) {
        newErrors.name = "Name must be at least 2 characters.";
      } else {
        delete newErrors.name;
      }
    }

    if (field === "email") {
      if (!email.trim()) {
        newErrors.email = "Please enter your email address.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        newErrors.email = "Please enter a valid email address (e.g. name@example.com).";
      } else {
        delete newErrors.email;
      }
    }

    if (field === "message") {
      if (!message.trim()) {
        newErrors.message = "Please write your query or message.";
      } else if (message.trim().length < 10) {
        newErrors.message = "Message must be at least 10 characters long.";
      } else if (message.length > 2000) {
        newErrors.message = "Message cannot exceed 2,000 characters.";
      } else {
        delete newErrors.message;
      }
    }

    setErrors(newErrors);
    return !newErrors[field];
  };

  const validateAll = (): boolean => {
    const newTouched = { name: true, email: true, message: true };
    setTouched((prev) => ({ ...prev, ...newTouched }));

    const newErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = "Please enter your full name (at least 2 characters).";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!message.trim() || message.trim().length < 10) {
      newErrors.message = "Please share a few more details (at least 10 characters).";
    }
    if (message.length > 2000) {
      newErrors.message = "Message cannot exceed 2,000 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateAll()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          topic,
          order_id: orderId.trim() || undefined,
          message: message.trim(),
          honeypot,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send message. Please try again.");
      }

      trackLead("contact_inquiry");
      setSuccessData({
        referenceCode: data.referenceCode,
        whatsappUrl: data.whatsappUrl,
        message: data.message,
      });

      pushDataLayerEvent("contact_inquiry_submitted", {
        topic,
        hasPhone: Boolean(phone.trim()),
        hasOrderId: Boolean(orderId.trim()),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!successData?.referenceCode) return;
    navigator.clipboard.writeText(successData.referenceCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleReset = () => {
    setSuccessData(null);
    setName("");
    setEmail("");
    setPhone("");
    setOrderId("");
    setMessage("");
    setTouched({});
    setErrors({});
    setSubmitError(null);
  };

  const directWhatsAppUrl = buildContactWhatsAppUrl({
    name: name.trim() || "Tea Lover",
    topic,
    message: message.trim() || "Hello TeaFloww team, I have an inquiry.",
    orderId: orderId.trim() || null,
  });

  return (
    <div
      className={`rounded-2xl border border-[#e4ded0] bg-[#fbf9f4] p-6 sm:p-8 lg:p-10 shadow-sm transition-all ${className}`}
    >
      {/* Header & Status Indicator */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#ece7dc] pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8eee7] px-3 py-1 text-xs font-semibold text-[#23483a]">
            <Sparkles size={12} className="text-[#3b744d]" /> <StorefrontText id="copy_8df0682c195fabc6" fallback="Direct Sommelier Inquiries" /> </span>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl text-[#171713]"> <StorefrontText id="copy_12f996ac2b07c71d" fallback="Send an Inquiry to Origin" /> </h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#eee9df] px-3 py-1.5 text-xs text-[#52594e]">
          <Clock size={13} className="text-[#23483a]" />
          <span>Average response: &lt; 24h</span>
        </div>
      </div>

      {/* Success View */}
      {successData ? (
        <div className="rounded-xl border border-[#c4d7c7] bg-[#f2f8f3] p-6 sm:p-8 text-[#171713]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#23483a] text-white">
              <CheckCircle2 size={26} />
            </div>
            <div>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#18231c]"> <StorefrontText id="copy_91d3ca9cc6190446" fallback="Inquiry Dispatched to Our Tea Masters" /> </h3>
              <p className="text-xs text-[#52594e]"> <StorefrontText id="copy_261d7c1ef226b531" fallback="We have registered your ticket in our Siliguri headquarters queue." /> </p>
            </div>
          </div>

          <div className="my-6 rounded-lg border border-[#d2e2d5] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6e746a]"> <StorefrontText id="copy_7c067abd69feb4fc" fallback="Reference Ticket ID" /> </span>
                <span className="font-mono text-lg font-bold text-[#23483a]">
                  {successData.referenceCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#c2d3c5] bg-[#f9fbf9] px-3 py-1.5 text-xs font-semibold text-[#23483a] hover:bg-[#ebf4ec] transition-colors"
                aria-label="Copy Reference Ticket ID to clipboard"
              >
                {copiedCode ? (
                  <>
                    <Check size={14} className="text-[#3b744d]" /> <StorefrontText id="copy_ea61bc15688d1e48" fallback="Copied!" /> </>
                ) : (
                  <>
                    <Copy size={14} /> <StorefrontText id="copy_11f12d1614c20097" fallback="Copy Ticket" /> </>
                )}
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f0f4f1] text-xs text-[#52594e] space-y-1">
              <p>
                <strong> <StorefrontText id="copy_f64fbc8a6697d290" fallback="Customer:" /> </strong> {name} · <strong> <StorefrontText id="copy_ce46f520653b1501" fallback="Topic:" /> </strong> {TOPIC_LABELS[topic]}
              </p>
              <p>
                <strong> <StorefrontText id="copy_46040c3ffaaeb084" fallback="Contact Channel:" /> </strong> {email}
                {phone ? ` · WhatsApp: ${phone}` : ""}
              </p>
            </div>
          </div>

          <p className="text-sm text-[#4a5047] leading-relaxed mb-6">
            {successData.message} <StorefrontText id="copy_a68d6463f7cdc864" fallback="If your request is time-sensitive (such as order address updates or sameday transit checks), you can also jump into WhatsApp with this pre-filled ticket." /> </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={successData.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#23483a] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#1a362b] transition-colors shadow-sm"
            >
              <MessageCircle size={15} /> <StorefrontText id="copy_0e6c17c4d8fbf722" fallback="Open In WhatsApp With Ticket" /> </a>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-[#c4d7c7] bg-white px-4 py-3 text-xs font-semibold text-[#18231c] hover:bg-[#f6fbf7] transition-colors"
            > <StorefrontText id="copy_ee2b741e990d3ed8" fallback="Send Another Query" /> </button>
          </div>
        </div>
      ) : (
        /* Form View */
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Topic Selector Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#171713] mb-2.5"> <StorefrontText id="copy_0c4d5181c299b64c" fallback="1. Select Inquiry Topic" /> </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TOPICS.map((item) => {
                const isActive = topic === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTopic(item.id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                      isActive
                        ? "border-[#23483a] bg-[#23483a] text-white shadow-sm ring-2 ring-[#23483a]/20"
                        : "border-[#dfd8ca] bg-white text-[#4a5047] hover:border-[#b8b09f] hover:bg-[#f8f5ed]"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className="text-sm" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Contextual Guidance Callout */}
            <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-[#e2dcd0] bg-[#f4efe4] p-3 text-xs text-[#52594e]">
              <Info size={15} className="mt-0.5 shrink-0 text-[#23483a]" />
              <div className="flex-1">
                <span>{activeTopicInfo.contextHint}</span>
                {activeTopicInfo.quickAction && (
                  <Link
                    href={activeTopicInfo.quickAction.href}
                    className="ml-2 inline-flex items-center gap-0.5 font-bold text-[#23483a] hover:underline"
                  >
                    {activeTopicInfo.quickAction.label}
                    <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields: Dual Columns for Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Name Field */}
            <div className="space-y-1">
              <label
                htmlFor={`${formId}-name`}
                className="block text-xs font-bold uppercase tracking-wider text-[#171713]"
              > <StorefrontText id="copy_6220cd9938aa1b7c" fallback="Your Full Name" /> <span className="text-[#a43831]">*</span>
              </label>
              {/* Format Hint ABOVE input per modern-web-guidance */}
              <span id={`${formId}-name-hint`} className="block text-[11px] text-[#6e746a]">
                First &amp; last name
              </span>
              <input
                id={`${formId}-name`}
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="e.g. Priyanshu Sen"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (touched.name) validateField("name");
                }}
                onBlur={() => handleBlur("name")}
                aria-describedby={`${formId}-name-hint ${errors.name ? `${formId}-name-error` : ""}`}
                aria-invalid={touched.name && Boolean(errors.name)}
                className={`w-full rounded-md border bg-white px-3.5 py-2.5 text-sm text-[#171713] transition-colors focus:outline-none focus:ring-2 focus:ring-[#23483a]/30 ${
                  touched.name && errors.name
                    ? "border-[#a43831] bg-[#fffbfa]"
                    : touched.name && !errors.name && name.trim().length >= 2
                    ? "border-[#3b744d]"
                    : "border-[#cfc8b8] focus:border-[#23483a]"
                }`}
              />
              {touched.name && errors.name && (
                <div
                  id={`${formId}-name-error`}
                  className="flex items-center gap-1 text-xs text-[#a43831] pt-0.5"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  <span>{errors.name}</span>
                </div>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1">
              <label
                htmlFor={`${formId}-email`}
                className="block text-xs font-bold uppercase tracking-wider text-[#171713]"
              > <StorefrontText id="copy_09bf25ef30833633" fallback="Email Address" /> <span className="text-[#a43831]">*</span>
              </label>
              {/* Format Hint ABOVE input per modern-web-guidance */}
              <span id={`${formId}-email-hint`} className="block text-[11px] text-[#6e746a]"> <StorefrontText id="copy_29f00ceceb298d8c" fallback="We reply directly to this inbox" /> </span>
              <input
                id={`${formId}-email`}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) validateField("email");
                }}
                onBlur={() => handleBlur("email")}
                aria-describedby={`${formId}-email-hint ${errors.email ? `${formId}-email-error` : ""}`}
                aria-invalid={touched.email && Boolean(errors.email)}
                className={`w-full rounded-md border bg-white px-3.5 py-2.5 text-sm text-[#171713] transition-colors focus:outline-none focus:ring-2 focus:ring-[#23483a]/30 ${
                  touched.email && errors.email
                    ? "border-[#a43831] bg-[#fffbfa]"
                    : touched.email && !errors.email && email.trim()
                    ? "border-[#3b744d]"
                    : "border-[#cfc8b8] focus:border-[#23483a]"
                }`}
              />
              {touched.email && errors.email && (
                <div
                  id={`${formId}-email-error`}
                  className="flex items-center gap-1 text-xs text-[#a43831] pt-0.5"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Row: Phone & Optional Order ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Phone Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`${formId}-phone`}
                  className="block text-xs font-bold uppercase tracking-wider text-[#171713]"
                > <StorefrontText id="copy_2e2c97ab4237fe1b" fallback="Phone / WhatsApp" /> </label>
                <span className="text-[11px] text-[#868074]"> <StorefrontText id="copy_59be71333c960fd0" fallback="Optional" /> </span>
              </div>
              <span id={`${formId}-phone-hint`} className="block text-[11px] text-[#6e746a]"> <StorefrontText id="copy_a77499e90fcf5af3" fallback="For instant mobile or WhatsApp updates" /> </span>
              <input
                id={`${formId}-phone`}
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 70013 04853"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-describedby={`${formId}-phone-hint`}
                className="w-full rounded-md border border-[#cfc8b8] bg-white px-3.5 py-2.5 text-sm text-[#171713] transition-colors focus:border-[#23483a] focus:outline-none focus:ring-2 focus:ring-[#23483a]/30"
              />
            </div>

            {/* Order Reference Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`${formId}-order-id`}
                  className="block text-xs font-bold uppercase tracking-wider text-[#171713]"
                > <StorefrontText id="copy_9376d9a9bf7b0e1d" fallback="Order / Invoice ID" /> </label>
                <span className="text-[11px] text-[#868074]"> <StorefrontText id="copy_59be71333c960fd0" fallback="Optional" /> </span>
              </div>
              <span id={`${formId}-order-hint`} className="block text-[11px] text-[#6e746a]"> <StorefrontText id="copy_316c9ff17ae05c76" fallback="Found in your dispatch SMS or confirmation" /> </span>
              <input
                id={`${formId}-order-id`}
                name="order_id"
                type="text"
                placeholder="e.g. TF-ORD-8491"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                aria-describedby={`${formId}-order-hint`}
                className="w-full rounded-md border border-[#cfc8b8] bg-white px-3.5 py-2.5 text-sm text-[#171713] transition-colors focus:border-[#23483a] focus:outline-none focus:ring-2 focus:ring-[#23483a]/30"
              />
            </div>
          </div>

          {/* Message Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`${formId}-message`}
                className="block text-xs font-bold uppercase tracking-wider text-[#171713]"
              >
                Inquiry Details &amp; Notes <span className="text-[#a43831]">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  message.length > 1900 ? "text-[#a43831] font-bold" : "text-[#868074]"
                }`}
                aria-live="polite"
              >
                {message.length} / 2,000
              </span>
            </div>
            <span id={`${formId}-message-hint`} className="block text-[11px] text-[#6e746a]"> <StorefrontText id="copy_2155c5c08792debc" fallback="Please describe your question, desired teas, or reservation requirements" /> </span>
            <textarea
              id={`${formId}-message`}
              name="message"
              required
              rows={5}
              minLength={10}
              maxLength={2000}
              placeholder="How can our Siliguri tea sommeliers assist your ritual today?"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (touched.message) validateField("message");
              }}
              onBlur={() => handleBlur("message")}
              aria-describedby={`${formId}-message-hint ${errors.message ? `${formId}-message-error` : ""}`}
              aria-invalid={touched.message && Boolean(errors.message)}
              className={`w-full rounded-md border bg-white px-3.5 py-2.5 text-sm text-[#171713] transition-colors focus:outline-none focus:ring-2 focus:ring-[#23483a]/30 ${
                touched.message && errors.message
                  ? "border-[#a43831] bg-[#fffbfa]"
                  : touched.message && !errors.message && message.trim().length >= 10
                  ? "border-[#3b744d]"
                  : "border-[#cfc8b8] focus:border-[#23483a]"
              }`}
            />
            {touched.message && errors.message && (
              <div
                id={`${formId}-message-error`}
                className="flex items-center gap-1 text-xs text-[#a43831] pt-0.5"
              >
                <AlertCircle size={12} aria-hidden="true" />
                <span>{errors.message}</span>
              </div>
            )}
          </div>

          {/* Spam Prevention Honeypot Field (Hidden) */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor={`${formId}-hp`}> <StorefrontText id="copy_d076cfad7715f92e" fallback="Leave this empty" /> </label>
            <input
              id={`${formId}-hp`}
              name="website_hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Live Alert Region for Server Errors */}
          {submitError && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-lg border border-[#f1c3be] bg-[#fdf2f1] p-3.5 text-xs text-[#a43831]"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#18231c] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-[#fbf9f4] hover:bg-[#2c4e38] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
            >
              {loading ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> <StorefrontText id="copy_e416c64587d39e6d" fallback="Dispatching to Tea Masters…" /> </>
              ) : (
                <>
                  <Send size={14} /> <StorefrontText id="copy_942821724cf9e240" fallback="Send Inquiry" /> </>
              )}
            </button>

            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#c5d8ca] bg-[#eef6f0] px-4 py-3 text-xs font-bold text-[#23483a] hover:bg-[#e1f0e4] transition-colors"
            >
              <MessageCircle size={15} className="text-[#25d366]" /> <StorefrontText id="copy_75982335ddb80142" fallback="Chat on WhatsApp Directly" /> </a>
          </div>

          <p className="text-[11px] text-[#787265] leading-relaxed">
            🌿 <strong> <StorefrontText id="copy_d5b7c58a79b63777" fallback="Privacy Promise:" /> </strong> <StorefrontText id="copy_ce7359b93cc2e115" fallback="We never sell, share or market customer contact details. Inquiries are handled exclusively by licensed tasters and customer care in Siliguri, West Bengal." /> </p>
        </form>
      )}
    </div>
  );
}
