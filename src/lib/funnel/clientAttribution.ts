"use client";

import { getOrCreateSessionId } from "@/lib/fingerprint";
import { readTrackingConsent, trackingRouteAllowed } from "@/lib/seo/consent";
import {
  EMPTY_ATTRIBUTION_TOUCH,
  hasCampaignOrClickSignals,
  normalizeTouchWithClickInference,
  resolveFunnelNameFromPath,
  type AttributionBundle,
  type AttributionTouch,
  type ConversationChannel,
  type FunnelName,
  type FunnelStage,
} from "./types";

const ATTR_STORAGE_KEY = "tf_attribution_v1";
const ATTR_COOKIE_NAME = "tf_attr";
const COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

interface StoredAttributionState {
  version: 1;
  sessionId: string;
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
  funnelName: FunnelName;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`);
    const match = document.cookie.match(pattern);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  try {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
  } catch {
    // Ignore restricted cookie storage
  }
}

function readUrlTouch(href?: string): AttributionTouch {
  if (typeof window === "undefined") return { ...EMPTY_ATTRIBUTION_TOUCH };
  try {
    const url = new URL(href || window.location.href, window.location.origin);
    const sp = url.searchParams;
    const rawReferrer = typeof document !== "undefined" ? document.referrer : "";
    let externalReferrer = "";
    if (rawReferrer) {
      try {
        const refHost = new URL(rawReferrer).host;
        if (refHost && refHost !== window.location.host) {
          externalReferrer = rawReferrer.slice(0, 500);
        }
      } catch {}
    }

    return normalizeTouchWithClickInference({
      utm_source: sp.get("utm_source") || "",
      utm_medium: sp.get("utm_medium") || "",
      utm_campaign: sp.get("utm_campaign") || "",
      utm_term: sp.get("utm_term") || "",
      utm_content: sp.get("utm_content") || "",
      utm_id: sp.get("utm_id") || "",
      gclid: sp.get("gclid") || "",
      dclid: sp.get("dclid") || "",
      gbraid: sp.get("gbraid") || "",
      wbraid: sp.get("wbraid") || "",
      fbclid: sp.get("fbclid") || "",
      ttclid: sp.get("ttclid") || "",
      msclkid: sp.get("msclkid") || "",
      referrer: externalReferrer,
      landing_page: `${url.pathname}${url.search}`.slice(0, 500),
      captured_at: new Date().toISOString(),
    });
  } catch {
    return { ...EMPTY_ATTRIBUTION_TOUCH };
  }
}

function readStoredState(): StoredAttributionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ATTR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttributionState;
    if (parsed?.version === 1 && parsed.firstTouch && parsed.lastTouch) {
      return parsed;
    }
  } catch {}
  return null;
}

function compactTouchForCookie(t: AttributionTouch): Partial<AttributionTouch> {
  const out: Partial<AttributionTouch> = {};
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "gclid",
    "fbclid",
    "gbraid",
    "wbraid",
    "ttclid",
    "msclkid",
    "referrer",
    "landing_page",
  ] as const) {
    if (t[k]) out[k] = t[k].slice(0, 140);
  }
  return out;
}

function persistState(state: StoredAttributionState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(state));
  } catch {}

  const consent = readTrackingConsent();
  const compact = {
    sessionId: state.sessionId,
    funnelName: state.funnelName,
    firstTouch: compactTouchForCookie(state.firstTouch),
    lastTouch: compactTouchForCookie(state.lastTouch),
    marketingConsent: consent.marketing,
    analyticsConsent: consent.analytics,
  };
  writeCookie(ATTR_COOKIE_NAME, JSON.stringify(compact), COOKIE_MAX_AGE_SECONDS);
  if (state.sessionId) {
    writeCookie("tf_sid", state.sessionId, COOKIE_MAX_AGE_SECONDS);
  }
}

/**
 * Captures current URL UTM/click parameters + referrer, preserves immutable First-Touch,
 * updates Last-Touch when new acquisition signals arrive, and persists to localStorage + cookie.
 */
export function captureAttributionFromUrl(pathnameOverride?: string): AttributionBundle {
  if (typeof window === "undefined") {
    return {
      sessionId: "",
      firstTouch: EMPTY_ATTRIBUTION_TOUCH,
      lastTouch: EMPTY_ATTRIBUTION_TOUCH,
      funnelName: "retail_storefront",
      marketingConsent: false,
      analyticsConsent: false,
    };
  }

  const sessionId = getOrCreateSessionId();
  const path = pathnameOverride || window.location.pathname || "/";
  const currentTouch = readUrlTouch();
  const existing = readStoredState();
  const currentFunnel = resolveFunnelNameFromPath(path);

  let nextState: StoredAttributionState;
  if (!existing) {
    nextState = {
      version: 1,
      sessionId,
      firstTouch: currentTouch,
      lastTouch: currentTouch,
      funnelName: currentFunnel,
    };
  } else {
    const hasNewSignals =
      hasCampaignOrClickSignals(currentTouch) || Boolean(currentTouch.referrer);
    const shouldRefreshFirst =
      !hasCampaignOrClickSignals(existing.firstTouch) &&
      !existing.firstTouch.referrer &&
      hasCampaignOrClickSignals(currentTouch);

    nextState = {
      version: 1,
      sessionId: existing.sessionId || sessionId,
      firstTouch: shouldRefreshFirst ? currentTouch : existing.firstTouch,
      lastTouch: hasNewSignals
        ? {
            ...currentTouch,
            referrer: currentTouch.referrer || existing.lastTouch.referrer,
          }
        : existing.lastTouch,
      funnelName: currentFunnel !== "retail_storefront" ? currentFunnel : existing.funnelName || currentFunnel,
    };
  }

  persistState(nextState);

  const consent = readTrackingConsent();
  return {
    sessionId: nextState.sessionId,
    firstTouch: nextState.firstTouch,
    lastTouch: nextState.lastTouch,
    fbc: readCookie("_fbc"),
    fbp: readCookie("_fbp"),
    funnelName: nextState.funnelName,
    marketingConsent: consent.marketing,
    analyticsConsent: consent.analytics,
  };
}

export function getClientAttributionBundle(pathnameOverride?: string): AttributionBundle {
  return captureAttributionFromUrl(pathnameOverride);
}

export interface ClientFunnelEventPayload {
  eventId?: string;
  funnelName?: FunnelName;
  funnelStage: FunnelStage;
  eventName: string;
  path?: string;
  valuePaise?: number;
  currency?: string;
  entityType?: string;
  entityId?: string;
  conversation?: {
    channel: ConversationChannel;
    sourcePage?: string;
    referenceCode?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    messagePreview?: string;
  };
  metadata?: Record<string, unknown>;
}

export function sendFunnelEvent(payload: ClientFunnelEventPayload): void {
  if (typeof window === "undefined") return;
  const path = payload.path || window.location.pathname || "/";
  if (!trackingRouteAllowed(path) && !path.startsWith("/account")) return;

  const attribution = getClientAttributionBundle(path);
  const body = JSON.stringify({
    sessionId: attribution.sessionId || getOrCreateSessionId(),
    eventId: payload.eventId,
    funnelName: payload.funnelName || resolveFunnelNameFromPath(path),
    funnelStage: payload.funnelStage,
    eventName: payload.eventName,
    path: `${path}${window.location.search || ""}`.slice(0, 500),
    valuePaise: payload.valuePaise ?? 0,
    currency: payload.currency || "INR",
    entityType: payload.entityType,
    entityId: payload.entityId,
    attribution,
    ...(payload.conversation ? { conversation: payload.conversation } : {}),
    metadata: payload.metadata || {},
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/funnel/track", blob)) {
        return;
      }
    }
    void fetch("/api/funnel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Non-fatal background telemetry
  }
}

export function trackFunnelConversation(params: {
  channel: ConversationChannel;
  sourcePage?: string;
  referenceCode?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  messagePreview?: string;
}): void {
  sendFunnelEvent({
    funnelStage: "conversation",
    eventName: `conversation_${params.channel}`,
    path: params.sourcePage,
    conversation: {
      channel: params.channel,
      sourcePage: params.sourcePage,
      referenceCode: params.referenceCode,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      messagePreview: params.messagePreview,
    },
  });
}
