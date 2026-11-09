"use client";
import React, { createContext, useContext } from "react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { InternationalContext } from "@/lib/international/context";
import { convertPaise, formatMoney, gatewayRoundingStep } from "@/lib/international/money";
import { formatINR } from "@/lib/money";
const Context = createContext<InternationalContext | null>(null);
export function InternationalProvider({ value, children }: { value: InternationalContext; children: ReactNode }) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useInternational() { return useContext(Context); }
export function useDisplayMoney() {
  const ctx = useInternational();
  return (paise: number) => {
    if (!ctx) return formatINR(paise);
    if (ctx.currency === "INR") return formatMoney(paise, "INR", ctx.locale);
    const rate = ctx.rates[ctx.currency];
    if (!rate) return formatINR(paise);
    return formatMoney(convertPaise(Math.max(0, Math.round(paise)), rate, ctx.currency, ctx.fxMarkupBps, gatewayRoundingStep(ctx.currency, ctx.roundingMinor)), ctx.currency, ctx.locale);
  };
}
export function LocalizedLink(props: ComponentProps<typeof Link>) {
  const ctx = useInternational();
  const href = typeof props.href === "string" && ctx && ctx.locale !== "en" && /^\/(?!\/|api\/|admin|order\/|purchase\/|feeds|mcp|_next)/.test(props.href) && !/^\/(hi|bn|ar|fr|de|es|pt|ja|zh-CN)(\/|$)/.test(props.href) ? `/${ctx.locale}${props.href}` : props.href;
  const children = typeof props.children === "string" ? ctx?.phraseTexts[props.children] || props.children : props.children;
  return <Link {...props} href={href}>{children}</Link>;
}
export function Text({ id, fallback }: { id: string; fallback: string }) { const ctx = useInternational(); return <>{ctx?.texts[id] || fallback}</>; }
