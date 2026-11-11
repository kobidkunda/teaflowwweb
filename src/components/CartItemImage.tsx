"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import Image from "next/image";
import React, { useState } from "react";

export function CartItemImage({ src, name, size, className }: {
  src: string | null; name: string; size: number; className: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!src || failedUrl === src) {
    return <span role="img" aria-label={`Image unavailable for ${name}`} style={{ width: size, height: size, display: "grid", placeItems: "center", background: "var(--paper, #f6f1e7)", color: "var(--ink, #171713)", fontSize: 10, textAlign: "center" }}><StorefrontText id="copy_7817cd06563196ee" fallback="Image unavailable" /></span>;
  }
  return <Image src={src} alt={name} width={size} height={size} sizes={`${size}px`} className={className} loading="lazy" onError={() => setFailedUrl(src)} />;
}
