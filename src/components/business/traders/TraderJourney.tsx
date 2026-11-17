"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { BusinessInterest } from "@/lib/business/schema";

export type TraderModel = "new" | "retail" | "distributor" | "brand";
type EnquiryDraft = { interest: BusinessInterest; note: string; pincode?: string };
type Journey = { model: TraderModel; choose: (model: TraderModel) => void; draft: EnquiryDraft | null; requestQuote: (draft: EnquiryDraft) => void };
const Context = createContext<Journey | null>(null);
export function useTraderJourney() { return useContext(Context); }
export function TraderJourney({ children }: { children: ReactNode }) {
  const [model, choose] = useState<TraderModel>("new");
  const [draft, setDraft] = useState<EnquiryDraft | null>(null);
  function requestQuote(next: EnquiryDraft) {
    setDraft(next);
    document.getElementById("business-quote")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    requestAnimationFrame(() => document.getElementById("trader-enquiry-title")?.focus({ preventScroll: true }));
  }
  return <Context.Provider value={{ model, choose, draft, requestQuote }}>{children}</Context.Provider>;
}
