import React from "react";

export interface DraftPreviewBannerProps {
  status?: string;
  revision?: number;
}

export function DraftPreviewBanner({ status = "draft", revision }: DraftPreviewBannerProps) {
  return (
    <div
      data-testid="trial-preview-banner"
      role="alert"
      className="trial-preview-banner w-full bg-[#fff8e1] border-b border-[#f0dfaa] text-[#7c5e10] px-4 py-2.5 text-xs font-semibold flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#d97706] animate-pulse" aria-hidden="true" />
        <span>DRAFT PREVIEW · NOT PUBLISHED</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-wider">
        <span>STATUS: {status}</span>
        {typeof revision === "number" && <span>REV: {revision}</span>}
        <span className="bg-[#f0dfaa] text-[#634807] px-2 py-0.5 rounded text-[10px] font-bold">
          ADMIN ACCESS ONLY
        </span>
      </div>
    </div>
  );
}
