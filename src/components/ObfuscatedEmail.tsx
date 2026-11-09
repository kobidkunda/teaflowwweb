"use client";

import React, { useEffect, useState } from "react";

const EMAIL_USER = "info";
const EMAIL_DOMAIN = "teafloww.com";

/**
 * Canonical customer-care address, assembled at runtime.
 *
 * Why: the CDN edge (Cloudflare Scrape Shield / Email Address Obfuscation)
 * rewrites every literal `mailto:` / email string in served HTML and injects
 * the render-blocking `email-decode.min.js` (≈140 ms, extends the critical
 * path) plus a post-load footer reflow. Assembling the address in the
 * browser keeps it out of edge HTML so no rewrite — and no extra script —
 * ever happens. Keep this module free of the contiguous address string.
 */
export function getContactEmail(): string {
  return `${EMAIL_USER}@${EMAIL_DOMAIN}`;
}

interface ObfuscatedEmailProps {
  className?: string;
  style?: React.CSSProperties;
  /** Link target before hydration (no-JS / pre-mount fallback). */
  fallbackHref?: string;
  fallbackLabel?: string;
}

export function ObfuscatedEmail({
  className,
  style,
  fallbackHref = "/contact",
  fallbackLabel = "Contact us",
}: ObfuscatedEmailProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <a href={fallbackHref} className={className} style={style}>
        {fallbackLabel}
      </a>
    );
  }

  const address = getContactEmail();
  return (
    <a href={`mailto:${address}`} className={className} style={style}>
      {address}
    </a>
  );
}
