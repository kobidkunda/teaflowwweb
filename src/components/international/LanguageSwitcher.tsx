"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useInternational } from "./InternationalProvider";
import { LANGUAGES } from "@/lib/international/models";

// Define the primary Pan-India languages to present first
const PAN_INDIA_CODES = ["en", "hi", "bn", "pa", "mr", "gu", "ta", "te"];

interface LanguageSwitcherProps {
  variant?: "header" | "compact" | "drawer";
  className?: string;
}

export function LanguageSwitcher({ variant = "header", className = "" }: LanguageSwitcherProps) {
  const ctx = useInternational();
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const currentLocale = ctx?.locale || "en";
  const currentLang = LANGUAGES.find((l) => l.code === currentLocale) || {
    code: "en",
    name: "English",
  };

  async function handleSelectLanguage(newLocale: string) {
    setIsOpen(false);
    if (newLocale === currentLocale) return;

    try {
      // Save customer preference cookie
      await fetch("/api/commerce/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: ctx?.country || "IN",
          currency: ctx?.currency || "INR",
          locale: newLocale,
        }),
      });

      // Calculate localized URL path
      const pathname = window.location.pathname;
      const strippedPath =
        pathname.replace(
          /^\/(hi|bn|pa|mr|gu|ta|te|ar|fr|de|es|pt|ja|zh-CN)(?=\/|$)/,
          ""
        ) || "/";
      const newPath =
        newLocale === "en" ? strippedPath : `/${newLocale}${strippedPath === "/" ? "" : strippedPath}`;

      window.location.assign(`${newPath}${window.location.search}`);
    } catch {
      // Fallback reload
      window.location.reload();
    }
  }

  // Filter to Pan-India priority languages
  const availableLanguages = LANGUAGES.filter((l) => PAN_INDIA_CODES.includes(l.code));

  if (!hydrated) {
    return (
      <div className={`tf-lang-switcher tf-lang-${variant} ${className}`}>
        <button
          type="button"
          className="tf-lang-trigger"
          aria-label="Language selection"
          disabled
        >
          <Globe size={14} className="tf-lang-globe" aria-hidden="true" />
          <span className="tf-lang-current-label">EN</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className={`tf-lang-switcher tf-lang-${variant} ${isOpen ? "is-open" : ""} ${className}`}
    >
      <button
        type="button"
        id={dropdownId}
        className="tf-lang-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select language. Current: ${currentLang.name}`}
      >
        <Globe size={14} className="tf-lang-globe text-[#23483a]" aria-hidden="true" />
        <span className="tf-lang-current-label font-medium">{currentLang.name}</span>
        <ChevronDown
          size={12}
          className={`tf-lang-chevron transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={dropdownId}
          className="tf-lang-menu"
        >
          <div className="tf-lang-menu-header">
            <span>🇮🇳 Pan-India Languages</span>
          </div>
          <div className="tf-lang-options-grid">
            {availableLanguages.map((lang) => {
              const isSelected = lang.code === currentLocale;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`tf-lang-option ${isSelected ? "is-selected" : ""}`}
                >
                  <span className="tf-lang-option-name">{lang.name}</span>
                  <span className="tf-lang-option-code">
                    {lang.code.toUpperCase()}
                  </span>
                  {isSelected && (
                    <Check size={14} className="tf-lang-check" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
