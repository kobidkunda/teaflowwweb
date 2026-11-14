"use client";
import Image from "next/image";
import React, { useState } from "react";

export function CartItemImage({ src, name, size, className }: {
  src: string | null; name: string; size: number; className: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!src || failedUrl === src) {
    return (
      <span
        role="img"
        aria-label={`Image unavailable for ${name}`}
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          background: "var(--paper, #f6f1e7)",
          color: "#9a9589",
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        <svg width={Math.max(16, Math.round(size * 0.42))} height={Math.max(16, Math.round(size * 0.42))} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        </svg>
      </span>
    );
  }
  return <Image src={src} alt={name} width={size} height={size} sizes={`${size}px`} className={className} loading="eager" onError={() => setFailedUrl(src)} />;
}
