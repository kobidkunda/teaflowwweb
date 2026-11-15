"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, trackingRouteAllowed } from "@/lib/seo/consent";
import {
  captureAttributionFromUrl,
  sendFunnelEvent,
  trackFunnelConversation,
} from "@/lib/funnel/clientAttribution";
import type { ConversationChannel } from "@/lib/funnel/types";

function inferConversationChannel(pathname: string, href: string, anchor: HTMLAnchorElement): ConversationChannel {
  const explicit = anchor.dataset.funnelChannel as ConversationChannel | undefined;
  if (explicit) return explicit;
  if (href.startsWith("tel:")) return "phone_call";
  const lowerPath = (pathname || "/").toLowerCase();
  if (lowerPath.startsWith("/checkout")) return "whatsapp_checkout_help";
  if (lowerPath.startsWith("/cart")) return "whatsapp_cart_recovery";
  if (lowerPath.startsWith("/wholesale")) return "whatsapp_wholesale";
  if (lowerPath.startsWith("/private-label") || lowerPath.startsWith("/blend-lab")) {
    return "whatsapp_private_label";
  }
  if (lowerPath.startsWith("/contact")) return "whatsapp_contact";
  if (lowerPath.startsWith("/purchase") || lowerPath.startsWith("/order")) return "whatsapp_order";
  return "whatsapp_floating";
}

function extractWhatsAppPreview(href: string, anchor: HTMLAnchorElement): string {
  try {
    if (href.startsWith("tel:")) {
      return `Phone call click: ${anchor.textContent?.trim() || href.slice(4)}`.slice(0, 200);
    }
    const url = new URL(href);
    const text = url.searchParams.get("text");
    if (text) return text.replace(/\s+/g, " ").trim().slice(0, 200);
  } catch {}
  return (anchor.textContent || "WhatsApp chat click").replace(/\s+/g, " ").trim().slice(0, 200);
}

export function FunnelTracker() {
  const pathname = usePathname() || "/";
  const lastVisitRef = useRef<string>("");

  useEffect(() => {
    if (!trackingRouteAllowed(pathname)) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    const visitKey = `${pathname}${search}`;
    captureAttributionFromUrl(pathname);

    if (lastVisitRef.current !== visitKey) {
      lastVisitRef.current = visitKey;
      sendFunnelEvent({
        funnelStage: "visit",
        eventName: "page_view",
        path: pathname,
      });
    }
  }, [pathname]);

  useEffect(() => {
    const syncConsentToAttr = () => {
      captureAttributionFromUrl(pathname);
    };
    window.addEventListener(CONSENT_EVENT, syncConsentToAttr);
    return () => window.removeEventListener(CONSENT_EVENT, syncConsentToAttr);
  }, [pathname]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (
        !href.includes("wa.me/") &&
        !href.includes("api.whatsapp.com") &&
        !href.startsWith("tel:")
      ) {
        return;
      }

      const currentPath = window.location.pathname || pathname || "/";
      if (!trackingRouteAllowed(currentPath)) return;

      const channel = inferConversationChannel(currentPath, href, anchor);
      const messagePreview = extractWhatsAppPreview(href, anchor);

      trackFunnelConversation({
        channel,
        sourcePage: currentPath,
        messagePreview,
      });
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, [pathname]);

  return null;
}
