"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import type { TrialLocale } from "@/lib/trials/i18n";
import { Languages } from "lucide-react";

export interface TrialLanguageToggleProps {
  currentLocale: TrialLocale;
  onLocaleChange: (locale: TrialLocale) => void;
}

export function TrialLanguageToggle({
  currentLocale,
  onLocaleChange,
}: TrialLanguageToggleProps) {
  return (
    <div
      role="group"
      aria-label="Language selection"
      className="inline-flex items-center gap-1 bg-[#1a1411] border border-[#d59e5b33] rounded-full p-1 shadow-sm"
    >
      <span className="pl-2 pr-1 text-[#ba8745]" aria-hidden="true">
        <Languages className="w-3.5 h-3.5" />
      </span>
      <button
        type="button"
        data-testid="language-toggle-en"
        aria-pressed={currentLocale === "en"}
        onClick={() => onLocaleChange("en")}
        className={`min-h-[36px] min-w-[44px] px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
          currentLocale === "en"
            ? "bg-[#ba8745] text-[#171311] shadow-xs"
            : "text-[#d0ba9f] hover:text-white"
        }`}
      ><StorefrontText id="copy_ba118bf7fc9c1aed" fallback="English" />
      </button>
      <button
        type="button"
        data-testid="language-toggle-hi"
        aria-pressed={currentLocale === "hi"}
        onClick={() => onLocaleChange("hi")}
        className={`min-h-[36px] min-w-[44px] px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
          currentLocale === "hi"
            ? "bg-[#ba8745] text-[#171311] shadow-xs"
            : "text-[#d0ba9f] hover:text-white"
        }`}
      >
        हिंदी
      </button>
    </div>
  );
}
