"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { getContactEmail, ObfuscatedEmail } from "@/components/ObfuscatedEmail";
import {
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Building2,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  Globe2,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

export interface ContactChannelsProps {
  className?: string;
}

export function ContactChannels({ className = "" }: ContactChannelsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (key: string, text: string) => {
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        return;
      }
      navigator.clipboard.writeText(text).catch(() => {
        // Clipboard unavailable (permissions / non-secure context): toast stays hidden.
      });
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2500);
    } catch {
      // Synchronous clipboard failure: never surface a console error for a nicety.
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Toast Announcement (Accessible Live Region) */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-[#18231c] px-4 py-3 text-xs font-semibold text-white shadow-xl transition-all duration-300 ${
          copiedKey
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <Check size={14} className="text-[#3b744d]" />
        <span> <StorefrontText id="copy_d37078fe6a1faa15" fallback="Copied to clipboard" /> </span>
      </div>

      {/* Primary Direct Contact Channels Card */}
      <div className="rounded-2xl border border-[#e4ded0] bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f0ede6]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#23483a] flex items-center gap-1.5">
            <Sparkles size={13} /> <StorefrontText id="copy_22e204db9aecb470" fallback="Direct Touchpoints" /> </span>
          <span className="text-[11px] font-medium text-[#6e746a]"> <StorefrontText id="copy_1ae99ab2b8dfb210" fallback="Siliguri Sourcing Desk" /> </span>
        </div>

        <div className="space-y-4">
          {/* WhatsApp Concierge */}
          <div className="group rounded-xl border border-[#d6ebd9] bg-[#f4faf5] p-4 transition-all hover:border-[#b8deb9] hover:bg-[#ebf7ec]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#25d366]/20 text-[#128c7e]">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#128c7e]"> <StorefrontText id="copy_443e2e0c76bdd046" fallback="WhatsApp Concierge" /> </span>
                    <span className="rounded bg-[#25d366]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#128c7e]"> <StorefrontText id="copy_e2861894f065ab75" fallback="Instant" /> </span>
                  </div>
                  <a
                    href="https://wa.me/917001304853?text=Hello%20TeaFloww%20team%2C%20I%20have%20an%20inquiry%20regarding%20your%20Himalayan%20single-estate%20teas."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block font-mono text-sm sm:text-base font-bold text-[#18231c] hover:text-[#23483a] transition-colors"
                  >
                    +91 7001304853
                  </a>
                  <p className="mt-1 text-xs text-[#52594e]">
                    Direct messaging for batch availability, brewing inquiries &amp; tasting bookings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard("whatsapp", "+91 7001304853")}
                className="shrink-0 rounded-md border border-[#c4e0c8] bg-white p-2 text-[#23483a] hover:bg-[#e6f4e8] transition-colors"
                title="Copy WhatsApp number"
                aria-label="Copy WhatsApp number"
              >
                {copiedKey === "whatsapp" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#d8edd9] pt-2.5 text-xs">
              <span className="text-[#647466]"> <StorefrontText id="copy_28f5105234ba2bb8" fallback="Active: Mo–Sa 09:00–18:00 IST" /> </span>
              <a
                href="https://wa.me/917001304853"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-[#128c7e] hover:underline"
              > <StorefrontText id="copy_22e2956da017d8bc" fallback="Launch Chat" /> <ArrowUpRight size={12} />
              </a>
            </div>
          </div>

          {/* Email Channel */}
          <div className="rounded-xl border border-[#e8e2d4] bg-[#faf8f4] p-4 transition-all hover:border-[#d9d0bf]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eee9dc] text-[#23483a]">
                  <Mail size={19} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6e746a]">
                    Official Inquiries &amp; Orders
                  </span>
                  <ObfuscatedEmail className="mt-0.5 block text-sm sm:text-base font-bold text-[#18231c] hover:text-[#23483a] transition-colors" />
                  <p className="mt-1 text-xs text-[#52594e]">
                    Inquiries, commercial procurement orders &amp; sommelier consultation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard("email", getContactEmail())}
                className="shrink-0 rounded-md border border-[#dfd8ca] bg-white p-2 text-[#18231c] hover:bg-[#f3ede1] transition-colors"
                title="Copy email address"
                aria-label="Copy email address"
              >
                {copiedKey === "email" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Telephone Line */}
          <div className="rounded-xl border border-[#e8e2d4] bg-[#faf8f4] p-4 transition-all hover:border-[#d9d0bf]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eee9dc] text-[#23483a]">
                  <Phone size={19} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6e746a]"> <StorefrontText id="copy_b43abcf5950fb7d5" fallback="Direct Telephone Line" /> </span>
                  <a
                    href="tel:+917001304853"
                    className="mt-0.5 block font-mono text-sm sm:text-base font-bold text-[#18231c] hover:text-[#23483a] transition-colors"
                  >
                    +91 7001304853
                  </a>
                  <p className="mt-1 text-xs text-[#52594e]"> <StorefrontText id="copy_0273dae1c48577b1" fallback="Direct voice line to our sourcing and dispatch desk." /> </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard("phone", "+91 7001304853")}
                className="shrink-0 rounded-md border border-[#dfd8ca] bg-white p-2 text-[#18231c] hover:bg-[#f3ede1] transition-colors"
                title="Copy telephone number"
                aria-label="Copy telephone number"
              >
                {copiedKey === "phone" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Language & Operating Hours Strip */}
        <div className="mt-5 pt-4 border-t border-[#f0ede6] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#52594e]">
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-[#23483a] mt-0.5 shrink-0" />
            <div>
              <strong className="block text-[#18231c]"> <StorefrontText id="copy_6451ba50e41974d3" fallback="Operating Hours" /> </strong>
              <span> <StorefrontText id="copy_318cbfa0c98d227b" fallback="Mo–Sa: 09:00 – 18:00 IST" /> </span>
              <span className="block text-[#868074]"> <StorefrontText id="copy_2b4075b7c8eeb753" fallback="Sunday: Estate cuppings by invite" /> </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Globe2 size={14} className="text-[#23483a] mt-0.5 shrink-0" />
            <div>
              <strong className="block text-[#18231c]"> <StorefrontText id="copy_00c38910d16a472a" fallback="Languages Spoken" /> </strong>
              <span> <StorefrontText id="copy_c85994153867dff6" fallback="English, Bengali, Hindi, Nepali" /> </span>
            </div>
          </div>
        </div>
      </div>

      {/* Facility Cards: Works & Registered Office */}
      <div className="grid grid-cols-1 gap-5">
        {/* Works & Sourcing Facility Card */}
        <div className="rounded-2xl border border-[#e4ded0] bg-white p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4efe4] px-2.5 py-0.5 text-[11px] font-bold text-[#23483a]">
              <MapPin size={12} />
              Works &amp; Sourcing Facility
            </span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  "works",
                  "00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri, Dist Jalpaiguri, Siliguri, West Bengal — 734015"
                )
              }
              className="inline-flex items-center gap-1 rounded border border-[#dfd8ca] bg-[#faf8f4] px-2.5 py-1 text-[11px] font-semibold text-[#18231c] hover:bg-[#eee8dc] transition-colors"
            >
              {copiedKey === "works" ? <Check size={12} /> : <Copy size={12} />} <StorefrontText id="copy_b0e3d6c0e2c3c45c" fallback="Copy Address" /> </button>
          </div>

          <h3 className="font-serif text-lg font-bold text-[#18231c] mb-1">
            TeaFloww Cupping Lab &amp; Sourcing Works
          </h3>

          <address className="not-italic text-xs sm:text-sm text-[#52594e] space-y-0.5 mb-3 leading-relaxed">
            <p className="font-semibold text-[#18231c]">Fulbari Logistics &amp; Sensory Hub</p>
            <p> <StorefrontText id="copy_fc5669c38341c743" fallback="00, Fulbari Ghoshpukur Bypass, Fulbari, Binnaguri" /> </p>
            <p> <StorefrontText id="copy_afca5e0974e4f624" fallback="Dist Jalpaiguri, City Siliguri, West Bengal — 734015" /> </p>
            <p>India (Gateway to Darjeeling &amp; Dooars)</p>
          </address>

          <div className="rounded-lg bg-[#f9f7f2] p-3 text-xs text-[#52594e] space-y-1">
            <p>
              🍃 <strong> <StorefrontText id="copy_094e236da229aed1" fallback="Facility Operations:" /> </strong> <StorefrontText id="copy_c63f1b1fb2e756aa" fallback="Sensory cupping room, leaf grading, nitrogen vacuum flush packaging, and daily courier dispatch." /> </p>
            <p>
              🤝 <strong> <StorefrontText id="copy_27ab25c5b74d3748" fallback="Visitor Advisory:" /> </strong> <StorefrontText id="copy_c6acabca01c67910" fallback="Private tastings and trade visits are arranged by prior booking to preserve tasting room tranquility." /> </p>
          </div>
        </div>

        {/* Registered Office & Entity Card */}
        <div className="rounded-2xl border border-[#e4ded0] bg-white p-6 sm:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4efe4] px-2.5 py-0.5 text-[11px] font-bold text-[#23483a]">
              <Building2 size={12} />
              Registered Office &amp; Entity
            </span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  "office",
                  "Shiv Shakti Kali Bari Rd, Sukantapally East, Siliguri, West Bengal — 734005, India"
                )
              }
              className="inline-flex items-center gap-1 rounded border border-[#dfd8ca] bg-[#faf8f4] px-2.5 py-1 text-[11px] font-semibold text-[#18231c] hover:bg-[#eee8dc] transition-colors"
            >
              {copiedKey === "office" ? <Check size={12} /> : <Copy size={12} />} <StorefrontText id="copy_b0e3d6c0e2c3c45c" fallback="Copy Address" /> </button>
          </div>

          <h3 className="font-serif text-lg font-bold text-[#18231c] mb-1"> <StorefrontText id="copy_05f78732ea820657" fallback="Nirva (Operating Brand: TeaFloww)" /> </h3>

          <address className="not-italic text-xs sm:text-sm text-[#52594e] space-y-0.5 mb-3 leading-relaxed">
            <p> <StorefrontText id="copy_3277b7e9c44f25ee" fallback="Shiv Shakti Kali Bari Rd, Sukantapally East" /> </p>
            <p> <StorefrontText id="copy_c9d528f22a35f24b" fallback="Siliguri, West Bengal — 734005, India" /> </p>
            <p> <StorefrontText id="copy_2afc05deb88dc928" fallback="Corporate Domain: TeaFloww.com" /> </p>
          </address>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#f0ede6] text-xs">
            <div className="flex items-center gap-1.5 text-[#23483a] font-semibold">
              <ShieldCheck size={14} />
              <span> <StorefrontText id="copy_245b8ecd18f90172" fallback="GSTIN: 19CTHPK8646J2ZY" /> </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard("gstin", "19CTHPK8646J2ZY")}
              className="text-[11px] font-medium text-[#6e746a] hover:text-[#18231c] underline"
            >
              {copiedKey === "gstin" ? "Copied!" : "Copy GSTIN"}
            </button>
          </div>
        </div>
      </div>

      {/* Trade & Tracking Fast-Track Card */}
      <div className="rounded-2xl border border-[#d8d2c2] bg-[#f7f4ec] p-5 sm:p-6 text-xs text-[#52594e] space-y-3">
        <h4 className="font-serif text-sm font-bold text-[#18231c] uppercase tracking-wider"> <StorefrontText id="copy_8be69739bd19b3c2" fallback="Quick Access Portals" /> </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/track"
            className="group flex flex-col justify-between rounded-lg border border-[#e2dcd0] bg-white p-3 hover:border-[#23483a] transition-colors"
          >
            <div>
              <span className="block font-bold text-[#18231c] group-hover:text-[#23483a]"> <StorefrontText id="copy_4a38ce454375bd94" fallback="📦 Track Consignment" /> </span>
              <span className="text-[11px] text-[#6e746a] mt-0.5 block"> <StorefrontText id="copy_f44db39ec29617ef" fallback="Live courier updates from Siliguri hub" /> </span>
            </div>
            <span className="mt-2 text-[11px] font-bold text-[#23483a] inline-flex items-center gap-0.5"> <StorefrontText id="copy_2b8fc17f26dbac05" fallback="Track Order →" /> </span>
          </Link>

          <Link
            href="/wholesale"
            className="group flex flex-col justify-between rounded-lg border border-[#e2dcd0] bg-white p-3 hover:border-[#23483a] transition-colors"
          >
            <div>
              <span className="block font-bold text-[#18231c] group-hover:text-[#23483a]">
                🌿 Wholesale &amp; Bulk Lots
              </span>
              <span className="text-[11px] text-[#6e746a] mt-0.5 block">
                Trade catalogues &amp; commercial pricing
              </span>
            </div>
            <span className="mt-2 text-[11px] font-bold text-[#23483a] inline-flex items-center gap-0.5"> <StorefrontText id="copy_a2167136c634de45" fallback="Wholesale Portal →" /> </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
