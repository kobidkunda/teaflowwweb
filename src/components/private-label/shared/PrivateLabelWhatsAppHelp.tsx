"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, ExternalLink, Sparkles } from "lucide-react";
import {
  formatWhatsAppDigits,
  formatWhatsAppDisplay,
  buildPrivateLabelWhatsAppMessage,
  QUICK_HELP_TOPICS,
} from "@/lib/private-label/whatsapp";

export {
  formatWhatsAppDigits,
  formatWhatsAppDisplay,
  buildPrivateLabelWhatsAppMessage,
  QUICK_HELP_TOPICS,
};

export interface PrivateLabelWhatsAppHelpProps {
  whatsappNumber?: string;
  storeName?: string;
}

export function PrivateLabelWhatsAppHelp({
  whatsappNumber = "+91 7001304853",
  storeName = "TeaFloww",
}: PrivateLabelWhatsAppHelpProps) {
  const pathname = usePathname() || "/private-label";
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const cleanDigits = formatWhatsAppDigits(whatsappNumber);
  const displayPhone = formatWhatsAppDisplay(whatsappNumber);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        isOpen &&
        cardRef.current &&
        !cardRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const activeMessage = buildPrivateLabelWhatsAppMessage({
    pathname,
    topic: selectedTopic || undefined,
    customNote: customNote || undefined,
  });

  const whatsappHref = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(activeMessage)}`;

  // Position nicely above mobile bottom bar when on /studio
  const isStudioPage = pathname.includes("/studio");

  return (
    <aside
      className="print:hidden fixed z-40 transition-all duration-300"
      style={{
        bottom: isStudioPage ? "88px" : "24px",
        right: "20px",
      }}
      aria-label="Private Label WhatsApp Help Widget"
    >
      {/* Help Popover Card */}
      {isOpen && (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="false"
          aria-label="Private Label Concierge Chat"
          className="mb-3 w-[min(360px,calc(100vw-32px))] bg-[#092B23] text-[#FFFCF7] rounded-xl shadow-2xl border border-[#D7B474]/30 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(215, 180, 116, 0.2)",
          }}
        >
          {/* Card Header */}
          <div className="bg-[#143C31] px-4 py-3.5 border-b border-[#204E41] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#25D366] text-[#092B23] flex items-center justify-center font-bold">
                <MessageCircle size={18} fill="#092B23" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-[#FFFCF7] leading-tight">
                  Private Label Concierge
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse inline-block" />
                  <span className="text-[11px] text-[#A3B8B0]">
                    Direct from Siliguri Origin Desk
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#A3B8B0] hover:text-[#FFFCF7] p-1 rounded-md transition-colors"
              aria-label="Close WhatsApp help window"
            >
              <X size={18} />
            </button>
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-3.5 text-xs bg-[#092B23]/95">
            <p className="text-[#DDE4DC] leading-relaxed">
              Stuck choosing tea blends, packaging sizes, or custom dielines? Message our team directly on WhatsApp for real-time guidance.
            </p>

            {/* Quick Question Chips */}
            <div>
              <span className="block text-[11px] uppercase font-semibold tracking-wider text-[#D7B474] mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Common Questions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_HELP_TOPICS.map((item) => {
                  const isSelected = selectedTopic === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(isSelected ? null : item.label);
                      }}
                      className={`text-[11px] text-left px-2.5 py-1 rounded-md border transition-all ${
                        isSelected
                          ? "bg-[#D7B474] text-[#092B23] font-semibold border-[#D7B474]"
                          : "bg-[#143C31]/70 text-[#DDE4DC] border-[#204E41] hover:border-[#D7B474]/50 hover:bg-[#143C31]"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Specific Note */}
            <div>
              <label htmlFor="pl-whatsapp-note" className="block text-[11px] text-[#A3B8B0] mb-1">
                Specific question or target volume (optional):
              </label>
              <input
                id="pl-whatsapp-note"
                type="text"
                placeholder="e.g., Looking for 500 pouches of Darjeeling FTGFOP1..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                maxLength={180}
                className="w-full bg-[#143C31]/90 border border-[#204E41] rounded px-2.5 py-1.5 text-xs text-[#FFFCF7] placeholder-[#65746D] focus:outline-none focus:border-[#D7B474]"
              />
            </div>

            {/* Action Button */}
            <div className="pt-1">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // Optional close after launch
                  setTimeout(() => setIsOpen(false), 800);
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1da850] text-[#092B23] font-bold py-2.5 px-4 rounded-lg text-xs tracking-wide transition-all shadow-md transform hover:-translate-y-0.5"
              >
                <MessageCircle size={16} fill="#092B23" />
                <span>Chat on WhatsApp ({displayPhone})</span>
                <ExternalLink size={13} className="opacity-80" />
              </a>
            </div>

            <div className="text-[10px] text-center text-[#A3B8B0]/80">
              Response commitment: Mon–Sat · 09:00 to 18:00 IST
            </div>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <div className="flex items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close WhatsApp assistance" : "Need help? Message our tea master on WhatsApp"}
          className="group flex items-center gap-2 bg-[#143C31] hover:bg-[#092B23] text-[#FFFCF7] border border-[#25D366]/60 rounded-full py-2.5 px-3.5 sm:px-4 shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 focus:ring-offset-[#092B23]"
          style={{
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25), 0 0 12px rgba(37, 211, 102, 0.25)",
          }}
        >
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#25D366] text-[#092B23]">
            <MessageCircle size={17} fill="#092B23" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#25D366] border-2 border-[#143C31] animate-ping" />
          </div>
          <span className="text-xs font-semibold tracking-wide hidden sm:inline-block">
            {isOpen ? "Close Help" : "Need Help? Chat on WhatsApp"}
          </span>
          <span className="text-xs font-semibold sm:hidden">
            {isOpen ? "Close" : "WhatsApp"}
          </span>
        </button>
      </div>
    </aside>
  );
}
