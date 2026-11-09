"use client";

import React from "react";
import { Sparkles, Info, AlertCircle, Compass } from "lucide-react";

export interface EditorialCalloutProps {
  type?: "tip" | "note" | "warning" | "origin" | string;
  title?: string;
  text?: string;
  children?: React.ReactNode;
}

export function EditorialCallout({
  type = "tip",
  title,
  text,
  children,
}: EditorialCalloutProps) {
  const configs = {
    tip: {
      border: "border-[#2c4e38]/30",
      bg: "bg-gradient-to-r from-[#f4f7f4] to-[#f9faf8]",
      text: "text-[#243f2e]",
      icon: <Sparkles className="w-5 h-5 text-[#2c4e38] flex-shrink-0" />,
      defaultTitle: "Sommelier Note",
    },
    note: {
      border: "border-[#cfc8b8]",
      bg: "bg-[#f9f7f2]",
      text: "text-[#3e443c]",
      icon: <Info className="w-5 h-5 text-[#737a6d] flex-shrink-0" />,
      defaultTitle: "Editorial Note",
    },
    origin: {
      border: "border-[#b36b3d]/30",
      bg: "bg-gradient-to-r from-[#fcf6f0] to-[#fbf8f5]",
      text: "text-[#4d3222]",
      icon: <Compass className="w-5 h-5 text-[#b36b3d] flex-shrink-0" />,
      defaultTitle: "Terroir & Provenance",
    },
    warning: {
      border: "border-[#c4533b]/30",
      bg: "bg-[#fdf5f3]",
      text: "text-[#542820]",
      icon: <AlertCircle className="w-5 h-5 text-[#c4533b] flex-shrink-0" />,
      defaultTitle: "Brewing Caution",
    },
  };

  const current = configs[type as keyof typeof configs] || configs.tip;

  return (
    <aside
      className={`my-8 p-6 rounded-2xl border ${current.border} ${current.bg} shadow-sm`}
    >
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5">{current.icon}</div>
        <div className="flex-1">
          <h4 className="font-serif text-base sm:text-lg font-bold text-[#18231c] mb-1">
            {title || current.defaultTitle}
          </h4>
          <div className={`text-sm leading-relaxed ${current.text}`}>
            {text && <p>{text}</p>}
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}
