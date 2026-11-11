"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useRef, useEffect, useState } from "react";
import {
  FileText,
  Eye,
  Download,
  ExternalLink,
  X,
  Award,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export interface ProductDossierPdfProps {
  pdfUrl: string;
  pdfTitle?: string | null;
  productName: string;
  estate?: string;
  flush?: string;
  lotNumber?: string;
  harvestDate?: string;
  className?: string;
}

export function ProductDossierPdf({
  pdfUrl,
  pdfTitle,
  productName,
  estate,
  flush,
  lotNumber,
  harvestDate,
  className = "",
}: ProductDossierPdfProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const displayTitle =
    pdfTitle && pdfTitle.trim().length > 0
      ? pdfTitle.trim()
      : `${productName} — Estate Harvest & Tasting Dossier`;

  function openModal() {
    if (dialogRef.current) {
      dialogRef.current.showModal();
      setIsOpen(true);
    }
  }

  function closeModal() {
    if (dialogRef.current) {
      dialogRef.current.close();
      setIsOpen(false);
    }
  }

  // Modern Web Guidance: Fallback for browsers without native <dialog closedby="any"> support (e.g. Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Synchronize open state on native close (Esc key or form[method=dialog])
    function handleClose() {
      setIsOpen(false);
    }
    dialog.addEventListener("close", handleClose);

    let removePointerListener: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;

      const isOutside = (e: PointerEvent, el: HTMLDialogElement) => {
        const r = el.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };

      const handlePointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e, dialog);
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e, dialog)) {
          dialog.close();
        }
        pressedOutside = false;
      };

      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);

      removePointerListener = () => {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      if (removePointerListener) removePointerListener();
    };
  }, []);

  return (
    <div
      className={`pdp-dossier-card bg-gradient-to-br from-[#fbf8f1] via-[#f8f3e8] to-[#f2ecde] border border-[#dcd4c4] rounded-2xl p-4 sm:p-5 shadow-xs my-5 transition-all duration-300 hover:shadow-md hover:border-[#bfa882] ${className}`}
      data-testid="pdp-dossier-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Document Badge & Metadata */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-11 h-13 rounded-lg bg-gradient-to-b from-[#8f2d24] to-[#6d1f18] text-white flex flex-col items-center justify-center shadow-xs">
              <FileText className="w-5 h-5 text-amber-100" strokeWidth={2.2} />
              <span className="text-[8px] font-black tracking-widest text-amber-200 uppercase mt-0.5"><StorefrontText id="copy_1d393b0081b632c5" fallback="PDF" />
              </span>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2c4e38] text-white flex items-center justify-center text-[9px] shadow-xs">
              <ShieldCheck className="w-2.5 h-2.5 text-emerald-200" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-[#2c4e38]/10 text-[#2c4e38]">
                <Award className="w-3 h-3 text-[#2c4e38]" /><StorefrontText id="copy_7f033f369e57f7ba" fallback="Official Garden Dossier" />
              </span>
              {estate && (
                <span className="text-[11px] font-semibold text-[#666052] truncate">
                  {estate}
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-serif font-bold text-[#18231c] leading-snug line-clamp-1">
              {displayTitle}
            </h3>

            <p className="text-xs text-[#596055] mt-0.5 line-clamp-2 leading-relaxed"><StorefrontText id="copy_266f774c8fae2e44" fallback="Certified single-estate cupping notes, batch origin verification, and garden analysis sheet." />
            </p>
          </div>
        </div>

        {/* Right: Dual Interactive Action Buttons */}
        <div className="flex items-center gap-2 sm:self-center shrink-0 w-full sm:w-auto">
          {/* Inspect / View Modal Button */}
          <button
            type="button"
            onClick={openModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#2c4e38] text-white text-xs font-semibold hover:bg-[#223d2c] active:scale-[0.98] transition-all duration-200 shadow-xs cursor-pointer"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            data-testid="pdp-view-dossier-btn"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-300" />
            <span><StorefrontText id="copy_7f51be266c4306c6" fallback="View Dossier" /></span>
          </button>

          {/* Direct Download Button */}
          <a
            href={`${pdfUrl}?download=1`}
            download
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#cfc4b0] bg-white/80 hover:bg-white text-[#2a3026] text-xs font-semibold hover:border-[#968972] active:scale-[0.98] transition-all duration-200 shadow-2xs cursor-pointer"
            title="Download PDF document"
            aria-label={`Download ${displayTitle} PDF`}
            data-testid="pdp-download-dossier-btn"
          >
            <Download className="w-3.5 h-3.5 text-[#b36b3d]" />
            <span className="hidden xs:inline"><StorefrontText id="copy_d6eafe8235910042" fallback="Download" /></span>
          </a>
        </div>
      </div>

      {/* ===================================================================
          Modern Web Guidance: Native <dialog> Modal Overlay
          Supports: closedby="any", overscroll containment, @starting-style
          =================================================================== */}
      <dialog
        ref={dialogRef}
        id="pdp-pdf-dialog"
        className="tf-pdf-dialog"
        closedby="any"
        aria-labelledby="pdp-pdf-dialog-title"
        aria-describedby="pdp-pdf-dialog-desc"
      >
        {/* Modal Top Chrome / Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#ffffff] border-b border-[#e5dfd3] gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-11 rounded bg-gradient-to-b from-[#8f2d24] to-[#6d1f18] text-white flex flex-col items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-4 h-4 text-amber-100" />
              <span className="text-[7px] font-black tracking-widest text-amber-200 uppercase"><StorefrontText id="copy_1d393b0081b632c5" fallback="PDF" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="pdp-pdf-dialog-title"
                  className="text-base sm:text-lg font-serif font-bold text-[#18231c] truncate"
                >
                  {displayTitle}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#e8f0eb] text-[#2c4e38]">
                  <Sparkles className="w-2.5 h-2.5" /><StorefrontText id="copy_6ab694cfc6fa5d8c" fallback="Authenticated" />
                </span>
              </div>
              <p id="pdp-pdf-dialog-desc" className="text-xs text-[#63685e] truncate mt-0.5">
                {productName}
                {estate ? ` · Estate: ${estate}` : ""}
                {flush ? ` · ${flush}` : ""}
                {harvestDate ? ` · ${harvestDate}` : ""}
                {lotNumber ? ` · Lot: ${lotNumber}` : ""}
              </p>
            </div>
          </div>

          {/* Modal Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Open in full new tab */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#d6cfc2] bg-[#fbf8f1] hover:bg-[#f2ecdd] text-[#1d2a24] text-xs font-semibold transition-colors"
              title="Open full PDF document in a new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#555e50]" />
              <span><StorefrontText id="copy_f024d23702d28653" fallback="Full Screen" /></span>
            </a>

            {/* Direct Download */}
            <a
              href={`${pdfUrl}?download=1`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#2c4e38] bg-[#2c4e38] hover:bg-[#203a29] text-white text-xs font-semibold transition-colors shadow-2xs"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline"><StorefrontText id="copy_d6eafe8235910042" fallback="Download" /></span>
            </a>

            {/* Accessible Native Close Button via <form method="dialog"> */}
            <form method="dialog">
              <button
                type="submit"
                autoFocus
                className="w-9 h-9 rounded-md border border-[#d6cfc2] bg-[#fbf8f1] hover:bg-[#eedfc4] text-[#18231c] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close dossier preview"
                data-testid="pdp-close-dossier-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Modal Main Viewport: High-Performance Embedded PDF Iframe */}
        <div className="relative flex-1 w-full bg-[#202521] overflow-hidden flex flex-col">
          {isOpen && (
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              title={`${displayTitle} PDF Viewer`}
              className="w-full h-full border-0 flex-1"
              allow="fullscreen"
            />
          )}

          {/* Mobile & Small Screen Fallback Ribbon */}
          <div className="sm:hidden px-4 py-2.5 bg-[#fbf8f1] border-t border-[#dcd4c4] text-center text-[11px] text-[#555a50] flex items-center justify-between gap-2">
            <span><StorefrontText id="copy_62bcfd7f757b302f" fallback="Viewing on mobile?" /></span>
            <div className="flex gap-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2c4e38] font-bold underline"
              ><StorefrontText id="copy_7d3752038344b933" fallback="Open Fullscreen" />
              </a>
              <span className="text-[#999]">•</span>
              <a
                href={`${pdfUrl}?download=1`}
                download
                className="text-[#b36b3d] font-bold underline"
              ><StorefrontText id="copy_6183be0883d2a89c" fallback="Download PDF" />
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
