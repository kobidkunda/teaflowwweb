"use client";

import React, { useMemo } from "react";
import { Search, AlertTriangle, CheckCircle2, Globe, ShieldAlert } from "lucide-react";

export interface SeoControlsProps {
  seoTitle?: string | null;
  onSeoTitleChange: (val: string) => void;
  seoDescription?: string | null;
  onSeoDescriptionChange: (val: string) => void;
  canonicalOverride?: string | null;
  onCanonicalOverrideChange: (val: string) => void;
  noindex?: number | boolean;
  onNoindexChange: (val: boolean) => void;
  defaultTitle: string;
  defaultDescription: string;
  defaultPath: string;
}

export function SeoControlsSection({
  seoTitle = "",
  onSeoTitleChange,
  seoDescription = "",
  onSeoDescriptionChange,
  canonicalOverride = "",
  onCanonicalOverrideChange,
  noindex = false,
  onNoindexChange,
  defaultTitle,
  defaultDescription,
  defaultPath,
}: SeoControlsProps) {
  const currentTitle = (seoTitle || "").trim();
  const currentDescription = (seoDescription || "").trim();
  const currentCanonical = (canonicalOverride || "").trim();
  const isNoindex = Boolean(noindex);

  const effectiveTitle = currentTitle || defaultTitle || "Untitled Product";
  const effectiveDescription =
    currentDescription || defaultDescription || "Explore this tea at TeaFloww.";

  // Validation checks
  const titleLength = currentTitle.length;
  const descLength = currentDescription.length;

  const isCanonicalValid = useMemo(() => {
    if (!currentCanonical) return true;
    return currentCanonical.startsWith("/") || /^https:\/\//i.test(currentCanonical);
  }, [currentCanonical]);

  const displayUrl = useMemo(() => {
    const base = "https://teafloww.com";
    if (currentCanonical && isCanonicalValid) {
      if (/^https:\/\//i.test(currentCanonical)) return currentCanonical;
      return `${base}${currentCanonical.startsWith("/") ? "" : "/"}${currentCanonical}`;
    }
    return `${base}${defaultPath.startsWith("/") ? "" : "/"}${defaultPath}`;
  }, [currentCanonical, isCanonicalValid, defaultPath]);

  return (
    <div className="bg-white border border-[#e4ded0] rounded-xl p-6 space-y-6" data-testid="seo-controls-section">
      <div className="flex items-center justify-between border-b border-[#f0ede6] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#f4f1ea] rounded-md text-[#2c4e38]">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#18231c]">
              Search Engine Optimization (SEO & GEO)
            </h3>
            <p className="text-xs text-[#73786f]">
              Configure title tags, meta descriptions, canonical routing, and search robot directives.
            </p>
          </div>
        </div>

        <div>
          {isNoindex ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              noindex (Hidden from Search)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Indexable (Crawled by Search Engines)
            </span>
          )}
        </div>
      </div>

      {/* Live SERP Snippet Preview Box */}
      <div className="p-4 bg-[#f8f9fa] border border-[#dadce0] rounded-lg">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#70757a] mb-2.5 flex items-center justify-between">
          <span>Search Result Preview</span>
          <span className="text-[10px] font-normal italic">
            Approximation only — actual search engine rendering may vary
          </span>
        </div>

        <div className="bg-white p-4 rounded-md border border-[#e8eaed] space-y-1 font-sans">
          <div className="flex items-center gap-1.5 text-xs text-[#202124] truncate">
            <Globe className="w-3.5 h-3.5 text-[#5f6368] shrink-0" />
            <span className="text-[#202124] font-medium truncate">{displayUrl}</span>
          </div>

          <div className="text-base sm:text-lg text-[#1a0dab] font-medium leading-normal hover:underline cursor-pointer truncate">
            {effectiveTitle} · Himalayan Tea House
          </div>

          <p className="text-xs sm:text-sm text-[#4d5156] line-clamp-2 leading-relaxed">
            {effectiveDescription}
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 gap-5">
        {/* SEO Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="seo_title" className="block text-xs font-bold uppercase tracking-wider text-[#18231c]">
              Custom SEO Title
            </label>
            <span
              className={`text-xs ${
                titleLength > 60
                  ? "text-amber-600 font-semibold"
                  : titleLength >= 40
                  ? "text-emerald-600 font-semibold"
                  : "text-[#73786f]"
              }`}
            >
              {titleLength} / 60 chars {titleLength > 60 && "(Long)"}
            </span>
          </div>
          <input
            type="text"
            id="seo_title"
            value={seoTitle || ""}
            onChange={(e) => onSeoTitleChange(e.target.value)}
            placeholder={`Default: ${defaultTitle || "Product Name"}`}
            maxLength={120}
            className="w-full px-3.5 py-2 text-sm bg-white border border-[#cfc8b8] rounded-md text-[#18231c] focus:outline-none focus:border-[#2c4e38]"
          />
          <p className="text-[11px] text-[#73786f] mt-1">
            Keep under 60 characters for optimal display across desktop and mobile SERPs without truncation.
          </p>
        </div>

        {/* SEO Meta Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="seo_description"
              className="block text-xs font-bold uppercase tracking-wider text-[#18231c]"
            >
              Custom Meta Description
            </label>
            <span
              className={`text-xs ${
                descLength > 160
                  ? "text-amber-600 font-semibold"
                  : descLength >= 120
                  ? "text-emerald-600 font-semibold"
                  : "text-[#73786f]"
              }`}
            >
              {descLength} / 160 chars {descLength > 160 && "(Long)"}
            </span>
          </div>
          <textarea
            id="seo_description"
            rows={3}
            value={seoDescription || ""}
            onChange={(e) => onSeoDescriptionChange(e.target.value)}
            placeholder={`Default: ${defaultDescription || "Product narrative and cupping notes..."}`}
            maxLength={300}
            className="w-full px-3.5 py-2 text-sm bg-white border border-[#cfc8b8] rounded-md text-[#18231c] focus:outline-none focus:border-[#2c4e38]"
          />
          <p className="text-[11px] text-[#73786f] mt-1">
            Recommended length: 120–160 characters. Provide an honest synopsis of this tea and its flavor notes.
          </p>
        </div>

        {/* Canonical Override */}
        <div>
          <label
            htmlFor="canonical_override"
            className="block text-xs font-bold uppercase tracking-wider text-[#18231c] mb-1.5"
          >
            Canonical URL Override (Optional)
          </label>
          <input
            type="text"
            id="canonical_override"
            value={canonicalOverride || ""}
            onChange={(e) => onCanonicalOverrideChange(e.target.value)}
            placeholder={`Default canonical: ${defaultPath}`}
            className={`w-full px-3.5 py-2 text-sm bg-white border rounded-md text-[#18231c] focus:outline-none ${
              !isCanonicalValid ? "border-red-400 bg-red-50/20" : "border-[#cfc8b8] focus:border-[#2c4e38]"
            }`}
          />
          {!isCanonicalValid ? (
            <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Must be an absolute HTTPS URL (https://...) or a site-relative path (/tea/...).
            </p>
          ) : (
            <p className="text-[11px] text-[#73786f] mt-1">
              Leave blank to automatically use the standard canonical URL ({defaultPath}).
            </p>
          )}
        </div>

        {/* Search Engine Robots Indexability Directive */}
        <div className="pt-2 border-t border-[#f0ede6]">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="noindex_toggle"
              checked={isNoindex}
              onChange={(e) => onNoindexChange?.(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2c4e38] focus:ring-[#2c4e38]"
            />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#18231c]">
                Exclude from Search Engine Indexes (noindex)
              </span>
              <p className="text-xs text-[#73786f] mt-0.5">
                Enable if this item is seasonal, discontinued, or duplicate and should not be crawled by Google and Bing.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
