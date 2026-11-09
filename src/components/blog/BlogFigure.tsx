"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState } from "react";
import Image from "next/image";
import { ZoomIn, X } from "lucide-react";

export interface BlogFigureProps {
  url: string;
  caption?: string;
  credit?: string;
  alt?: string;
}

export function BlogFigure({ url, caption, credit, alt }: BlogFigureProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!url) return null;

  return (
    <>
      <figure className="my-8 group">
        <div
          onClick={() => setIsOpen(true)}
          className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#ede9df] cursor-zoom-in border border-[#e2dcd0] shadow-sm transition-all duration-300 group-hover:shadow-md"
        >
          <Image
            src={url}
            alt={alt || caption || "Tea estate illustration"}
            fill
            sizes="(max-width: 896px) 100vw, 896px"
            loading="lazy"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
          <div className="absolute bottom-3 right-3 p-2 bg-[#18231c]/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm pointer-events-none">
            <ZoomIn className="w-4 h-4" />
          </div>
        </div>

        {(caption || credit) && (
          <figcaption className="mt-3 text-xs text-[#52594e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 italic px-1">
            <span>{caption}</span>
            {credit && (
              <span className="not-italic text-[11px] font-medium text-[#7a8174]"> <StorefrontText id="copy_c707ee4ecc240442" fallback="Source:" /> {credit}
              </span>
            )}
          </figcaption>
        )}
      </figure>

      {/* Lightbox Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-[#121915]/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
            aria-label="Close image preview"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl max-h-[85vh] w-full h-full flex flex-col items-center justify-center"
          >
            <div className="relative w-full h-[70vh]">
              <Image
                src={url}
                alt={alt || caption || "Tea image preview"}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-contain"
              />
            </div>
            {caption && (
              <p className="mt-4 text-sm text-[#ece7dc] text-center max-w-2xl font-serif">
                {caption} {credit ? `(${credit})` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
