"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import { Share2, Link2, Check, MessageSquare } from "lucide-react";

export function BlogShareButtons({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/blog/${slug}`
      : `https://teafloww.com/blog/${slug}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const shareWhatsapp = () => {
    const text = encodeURIComponent(`${title} — Read on Teafloww: ${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`${title} via @teafloww\n${url}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-[#686f64] font-semibold mr-1 flex items-center gap-1">
        <Share2 className="w-3.5 h-3.5" />
        <span> <StorefrontText id="copy_29887a5ff9846ccc" fallback="Share" /> </span>
      </span>

      <button
        type="button"
        onClick={copyToClipboard}
        className="p-2 rounded-lg bg-[#f7f5f0] border border-[#e5decb] hover:border-[#18231c] text-[#18231c] text-xs font-medium inline-flex items-center gap-1 transition-colors"
        title="Copy article link"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-[#2c4e38]" />
            <span className="text-[11px] font-semibold text-[#2c4e38]"> <StorefrontText id="copy_ea61bc15688d1e48" fallback="Copied!" /> </span>
          </>
        ) : (
          <>
            <Link2 className="w-3.5 h-3.5" />
            <span className="text-[11px]"> <StorefrontText id="copy_724e78a3254c899d" fallback="Copy Link" /> </span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={shareWhatsapp}
        className="p-2 rounded-lg bg-[#f7f5f0] border border-[#e5decb] hover:border-[#25D366] text-[#18231c] hover:text-[#25D366] transition-colors"
        title="Share to WhatsApp"
      >
        <MessageSquare className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={shareTwitter}
        className="p-2 rounded-lg bg-[#f7f5f0] border border-[#e5decb] hover:border-[#18231c] text-[#18231c] transition-colors text-xs font-bold"
        title="Share to X / Twitter"
      >
        𝕏
      </button>
    </div>
  );
}
