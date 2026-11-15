import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { cleanWhatsAppNumber } from "@/lib/wholesale";
import {
  EMPTY_ATTRIBUTION_TOUCH,
  FUNNEL_NAMES,
  FUNNEL_STAGE_RANK,
  attributionBundleSchema,
  hasCampaignOrClickSignals,
  normalizeTouchWithClickInference,
  resolveFunnelNameFromPath,
  sanitizeAttrStr,
  type AttributionBundle,
  type AttributionTouch,
  type ConversationChannel,
  type FunnelName,
  type FunnelStage,
} from "./types";

export function toDbTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function detectDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" | "bot" | "unknown" {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/bot|crawl|spider|slurp|headless/.test(ua)) return "bot";
  if (/ipad|tablet|playbook|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua)) return "mobile";
  return "desktop";
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function parseCompactAttrCookie(raw: string | undefined): Partial<AttributionBundle> | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    const checked = attributionBundleSchema.safeParse(parsed);
    return checked.success ? checked.data : null;
  } catch {
    return null;
  }
}

function extractTouchFromUrl(rawUrl: string | undefined): Partial<AttributionTouch> | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl, "https://teafloww.com");
    const params = url.searchParams;
    const touch: Partial<AttributionTouch> = {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_term: params.get("utm_term") || "",
      utm_content: params.get("utm_content") || "",
      utm_id: params.get("utm_id") || "",
      gclid: params.get("gclid") || "",
      dclid: params.get("dclid") || "",
      gbraid: params.get("gbraid") || "",
      wbraid: params.get("wbraid") || "",
      fbclid: params.get("fbclid") || "",
      ttclid: params.get("ttclid") || "",
      msclkid: params.get("msclkid") || "",
      landing_page: `${url.pathname}${url.search}`.slice(0, 500),
    };
    return hasCampaignOrClickSignals(touch) ? touch : null;
  } catch {
    return null;
  }
}

export interface ExtractedRequestAttribution {
  sessionId: string;
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
  funnelName: FunnelName;
  fbc?: string;
  fbp?: string;
  marketingConsent: boolean;
  analyticsConsent: boolean;
  userAgent: string;
  deviceType: string;
  clientIp: string;
  referer: string;
}

/**
 * Extracts unified first-party session, UTM, click-ID, and Meta cookie attribution
 * from any incoming Next.js/Fetch Request + optional JSON body payload.
 */
export function extractAttributionFromRequest(
  request?: Request | null,
  body?: unknown,
  fallbackPath = "/"
): ExtractedRequestAttribution {
  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const bodyAttrParsed = attributionBundleSchema.safeParse(bodyObj.attribution);
  const bodyAttr = bodyAttrParsed.success ? bodyAttrParsed.data : undefined;

  const cookieHeader = request?.headers.get("cookie") || "";
  const cookies = parseCookieHeader(cookieHeader);
  const cookieAttr = parseCompactAttrCookie(cookies.tf_attr);

  const sessionId =
    sanitizeAttrStr(bodyAttr?.sessionId, 128) ||
    sanitizeAttrStr(bodyObj.sessionId, 128) ||
    sanitizeAttrStr(bodyObj.session_id, 128) ||
    sanitizeAttrStr(request?.headers.get("x-teafloww-session"), 128) ||
    sanitizeAttrStr(cookieAttr?.sessionId, 128) ||
    sanitizeAttrStr(cookies.tf_sid, 128) ||
    "";

  const referer = sanitizeAttrStr(request?.headers.get("referer"), 500);
  const urlTouch = extractTouchFromUrl(request?.url) || extractTouchFromUrl(referer);
  const pathHint =
    sanitizeAttrStr(bodyObj.path, 500) ||
    sanitizeAttrStr(bodyAttr?.lastTouch?.landing_page, 500) ||
    sanitizeAttrStr(cookieAttr?.lastTouch?.landing_page, 500) ||
    referer ||
    fallbackPath;

  const rawFirst: Partial<AttributionTouch> =
    bodyAttr?.firstTouch ||
    cookieAttr?.firstTouch ||
    urlTouch ||
    { referrer: referer, landing_page: pathHint };

  const rawLast: Partial<AttributionTouch> =
    bodyAttr?.lastTouch ||
    urlTouch ||
    cookieAttr?.lastTouch ||
    rawFirst;

  const firstTouch = normalizeTouchWithClickInference({
    ...EMPTY_ATTRIBUTION_TOUCH,
    ...rawFirst,
    referrer: rawFirst.referrer || referer,
    landing_page: rawFirst.landing_page || pathHint,
  });

  const lastTouch = normalizeTouchWithClickInference({
    ...EMPTY_ATTRIBUTION_TOUCH,
    ...rawLast,
    referrer: rawLast.referrer || referer,
    landing_page: rawLast.landing_page || pathHint,
  });

  const fbc =
    sanitizeAttrStr(bodyAttr?.fbc, 300) ||
    (cookies._fbc ? decodeURIComponent(cookies._fbc).slice(0, 300) : undefined);
  const fbp =
    sanitizeAttrStr(bodyAttr?.fbp, 300) ||
    (cookies._fbp ? decodeURIComponent(cookies._fbp).slice(0, 300) : undefined);

  const funnelCandidate = bodyAttr?.funnelName || cookieAttr?.funnelName;
  const funnelName: FunnelName =
    funnelCandidate && (FUNNEL_NAMES as readonly string[]).includes(funnelCandidate)
      ? funnelCandidate
      : resolveFunnelNameFromPath(pathHint);

  const userAgent = sanitizeAttrStr(request?.headers.get("user-agent"), 500);
  const forwarded = request?.headers.get("x-forwarded-for") || "";
  const clientIp = sanitizeAttrStr(
    forwarded.split(",")[0] || request?.headers.get("x-real-ip") || "",
    120
  );

  return {
    sessionId,
    firstTouch,
    lastTouch,
    funnelName,
    fbc: fbc || undefined,
    fbp: fbp || undefined,
    marketingConsent: Boolean(bodyAttr?.marketingConsent ?? cookieAttr?.marketingConsent),
    analyticsConsent: Boolean(bodyAttr?.analyticsConsent ?? cookieAttr?.analyticsConsent),
    userAgent,
    deviceType: detectDeviceType(userAgent),
    clientIp,
    referer,
  };
}

function serializeClickIds(touch: AttributionTouch): string {
  return JSON.stringify({
    dclid: touch.dclid || undefined,
    gbraid: touch.gbraid || undefined,
    wbraid: touch.wbraid || undefined,
    ttclid: touch.ttclid || undefined,
    msclkid: touch.msclkid || undefined,
  });
}

export interface UpsertVisitorSessionParams {
  sessionId: string;
  firstTouch?: AttributionTouch;
  lastTouch?: AttributionTouch;
  funnelName?: FunnelName;
  funnelStage?: FunnelStage;
  fbc?: string;
  fbp?: string;
  marketingConsent?: boolean;
  analyticsConsent?: boolean;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  convertedOrderId?: string | null;
  convertedRevenuePaise?: number;
  deviceType?: string;
  geo?: { country?: string; region?: string; city?: string };
}

export function upsertVisitorSession(
  params: UpsertVisitorSessionParams,
  database?: InstanceType<typeof Database>
): void {
  if (!params.sessionId) return;
  const db = database ?? getDb();
  const now = toDbTimestamp();

  const first = normalizeTouchWithClickInference(params.firstTouch || params.lastTouch || EMPTY_ATTRIBUTION_TOUCH);
  const last = normalizeTouchWithClickInference(params.lastTouch || params.firstTouch || EMPTY_ATTRIBUTION_TOUCH);
  const stage: FunnelStage = params.funnelStage || "visit";
  const stageRank = FUNNEL_STAGE_RANK[stage] ?? 1;
  const funnelName: FunnelName = params.funnelName || "retail_storefront";

  const cleanPhone =
    params.customerPhone && params.customerPhone.replace(/\D/g, "").length >= 7
      ? cleanWhatsAppNumber(params.customerPhone)
      : null;
  const cleanEmail = params.customerEmail ? params.customerEmail.trim().toLowerCase().slice(0, 254) : null;
  const cleanName = params.customerName ? params.customerName.trim().slice(0, 120) : null;

  const hasNewLastSignals = hasCampaignOrClickSignals(last);

  db.prepare(`
    INSERT INTO visitor_sessions (
      session_id,
      first_utm_source, first_utm_medium, first_utm_campaign, first_utm_term, first_utm_content, first_utm_id,
      first_gclid, first_fbclid, first_click_ids_json, first_referrer, first_landing_page, first_seen_at,
      last_utm_source, last_utm_medium, last_utm_campaign, last_utm_term, last_utm_content, last_utm_id,
      last_gclid, last_fbclid, last_click_ids_json, last_referrer, last_landing_page, last_seen_at,
      fbc, fbp, marketing_consent, analytics_consent,
      customer_id, customer_name, customer_email, customer_phone,
      funnel_name, highest_stage, stage_rank,
      converted_order_id, converted_revenue_paise,
      device_type, ip_country, ip_region, ip_city,
      created_at, updated_at
    ) VALUES (
      ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(session_id) DO UPDATE SET
      first_utm_source = CASE WHEN visitor_sessions.first_utm_source = '' THEN excluded.first_utm_source ELSE visitor_sessions.first_utm_source END,
      first_utm_medium = CASE WHEN visitor_sessions.first_utm_medium = '' THEN excluded.first_utm_medium ELSE visitor_sessions.first_utm_medium END,
      first_utm_campaign = CASE WHEN visitor_sessions.first_utm_campaign = '' THEN excluded.first_utm_campaign ELSE visitor_sessions.first_utm_campaign END,
      first_utm_term = CASE WHEN visitor_sessions.first_utm_term = '' THEN excluded.first_utm_term ELSE visitor_sessions.first_utm_term END,
      first_utm_content = CASE WHEN visitor_sessions.first_utm_content = '' THEN excluded.first_utm_content ELSE visitor_sessions.first_utm_content END,
      first_utm_id = CASE WHEN visitor_sessions.first_utm_id = '' THEN excluded.first_utm_id ELSE visitor_sessions.first_utm_id END,
      first_gclid = CASE WHEN visitor_sessions.first_gclid = '' THEN excluded.first_gclid ELSE visitor_sessions.first_gclid END,
      first_fbclid = CASE WHEN visitor_sessions.first_fbclid = '' THEN excluded.first_fbclid ELSE visitor_sessions.first_fbclid END,
      first_referrer = CASE WHEN visitor_sessions.first_referrer = '' THEN excluded.first_referrer ELSE visitor_sessions.first_referrer END,
      first_landing_page = CASE WHEN visitor_sessions.first_landing_page = '' THEN excluded.first_landing_page ELSE visitor_sessions.first_landing_page END,
      last_utm_source = CASE WHEN ? = 1 OR visitor_sessions.last_utm_source = '' THEN excluded.last_utm_source ELSE visitor_sessions.last_utm_source END,
      last_utm_medium = CASE WHEN ? = 1 OR visitor_sessions.last_utm_medium = '' THEN excluded.last_utm_medium ELSE visitor_sessions.last_utm_medium END,
      last_utm_campaign = CASE WHEN ? = 1 OR visitor_sessions.last_utm_campaign = '' THEN excluded.last_utm_campaign ELSE visitor_sessions.last_utm_campaign END,
      last_utm_term = CASE WHEN ? = 1 OR visitor_sessions.last_utm_term = '' THEN excluded.last_utm_term ELSE visitor_sessions.last_utm_term END,
      last_utm_content = CASE WHEN ? = 1 OR visitor_sessions.last_utm_content = '' THEN excluded.last_utm_content ELSE visitor_sessions.last_utm_content END,
      last_utm_id = CASE WHEN ? = 1 OR visitor_sessions.last_utm_id = '' THEN excluded.last_utm_id ELSE visitor_sessions.last_utm_id END,
      last_gclid = CASE WHEN ? = 1 OR visitor_sessions.last_gclid = '' THEN excluded.last_gclid ELSE visitor_sessions.last_gclid END,
      last_fbclid = CASE WHEN ? = 1 OR visitor_sessions.last_fbclid = '' THEN excluded.last_fbclid ELSE visitor_sessions.last_fbclid END,
      last_click_ids_json = CASE WHEN ? = 1 THEN excluded.last_click_ids_json ELSE visitor_sessions.last_click_ids_json END,
      last_referrer = CASE WHEN excluded.last_referrer != '' THEN excluded.last_referrer ELSE visitor_sessions.last_referrer END,
      last_landing_page = CASE WHEN ? = 1 AND excluded.last_landing_page != '' THEN excluded.last_landing_page ELSE visitor_sessions.last_landing_page END,
      last_seen_at = excluded.last_seen_at,
      fbc = COALESCE(excluded.fbc, visitor_sessions.fbc),
      fbp = COALESCE(excluded.fbp, visitor_sessions.fbp),
      marketing_consent = CASE WHEN excluded.marketing_consent > visitor_sessions.marketing_consent THEN excluded.marketing_consent ELSE visitor_sessions.marketing_consent END,
      analytics_consent = CASE WHEN excluded.analytics_consent > visitor_sessions.analytics_consent THEN excluded.analytics_consent ELSE visitor_sessions.analytics_consent END,
      customer_id = COALESCE(excluded.customer_id, visitor_sessions.customer_id),
      customer_name = COALESCE(excluded.customer_name, visitor_sessions.customer_name),
      customer_email = COALESCE(excluded.customer_email, visitor_sessions.customer_email),
      customer_phone = COALESCE(excluded.customer_phone, visitor_sessions.customer_phone),
      funnel_name = CASE WHEN excluded.stage_rank >= visitor_sessions.stage_rank THEN excluded.funnel_name ELSE visitor_sessions.funnel_name END,
      highest_stage = CASE WHEN excluded.stage_rank >= visitor_sessions.stage_rank THEN excluded.highest_stage ELSE visitor_sessions.highest_stage END,
      stage_rank = CASE WHEN excluded.stage_rank >= visitor_sessions.stage_rank THEN excluded.stage_rank ELSE visitor_sessions.stage_rank END,
      converted_order_id = COALESCE(excluded.converted_order_id, visitor_sessions.converted_order_id),
      converted_revenue_paise = CASE WHEN excluded.converted_revenue_paise > 0 THEN excluded.converted_revenue_paise ELSE visitor_sessions.converted_revenue_paise END,
      device_type = CASE WHEN visitor_sessions.device_type = 'unknown' THEN excluded.device_type ELSE visitor_sessions.device_type END,
      ip_country = CASE WHEN excluded.ip_country != '' THEN excluded.ip_country ELSE visitor_sessions.ip_country END,
      ip_region = CASE WHEN excluded.ip_region != '' THEN excluded.ip_region ELSE visitor_sessions.ip_region END,
      ip_city = CASE WHEN excluded.ip_city != '' THEN excluded.ip_city ELSE visitor_sessions.ip_city END,
      updated_at = excluded.updated_at
  `).run(
    params.sessionId,
    first.utm_source, first.utm_medium, first.utm_campaign, first.utm_term, first.utm_content, first.utm_id,
    first.gclid, first.fbclid, serializeClickIds(first), first.referrer, first.landing_page, now,
    last.utm_source, last.utm_medium, last.utm_campaign, last.utm_term, last.utm_content, last.utm_id,
    last.gclid, last.fbclid, serializeClickIds(last), last.referrer, last.landing_page, now,
    params.fbc || null, params.fbp || null, params.marketingConsent ? 1 : 0, params.analyticsConsent ? 1 : 0,
    params.customerId || null, cleanName, cleanEmail, cleanPhone,
    funnelName, stage, stageRank,
    params.convertedOrderId || null, params.convertedRevenuePaise ?? 0,
    params.deviceType || "unknown", params.geo?.country || "", params.geo?.region || "", params.geo?.city || "",
    now, now,
    // 10 flags for CASE WHEN ? = 1
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0,
    hasNewLastSignals ? 1 : 0
  );
}

export interface RecordFunnelEventParams {
  sessionId: string;
  eventId?: string;
  funnelName?: FunnelName;
  funnelStage: FunnelStage;
  eventName: string;
  entityType?: string | null;
  entityId?: string | null;
  path?: string;
  valuePaise?: number;
  currency?: string;
  attribution?: ExtractedRequestAttribution;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  convertedOrderId?: string | null;
  convertedRevenuePaise?: number;
  geo?: { country?: string; region?: string; city?: string };
  metadata?: Record<string, unknown>;
}

function mapToLegacyAnalyticsType(stage: FunnelStage): "pageview" | "product_view" | "checkout_start" | "order_complete" | "custom" {
  if (stage === "visit") return "pageview";
  if (stage === "product_view") return "product_view";
  if (stage === "checkout_start") return "checkout_start";
  if (stage === "order_placed" || stage === "order_paid") return "order_complete";
  return "custom";
}

export function recordFunnelEvent(
  params: RecordFunnelEventParams,
  database?: InstanceType<typeof Database>
): { id: string } {
  const db = database ?? getDb();
  const id = randomUUID();
  const now = toDbTimestamp();
  const sessionId = params.sessionId || `anon_${randomUUID()}`;
  const path = sanitizeAttrStr(params.path || "/", 500) || "/";
  const funnelName = params.funnelName || params.attribution?.funnelName || resolveFunnelNameFromPath(path);
  const stageRank = FUNNEL_STAGE_RANK[params.funnelStage] ?? 1;
  const last = params.attribution?.lastTouch || params.attribution?.firstTouch || EMPTY_ATTRIBUTION_TOUCH;

  upsertVisitorSession(
    {
      sessionId,
      firstTouch: params.attribution?.firstTouch,
      lastTouch: params.attribution?.lastTouch,
      funnelName,
      funnelStage: params.funnelStage,
      fbc: params.attribution?.fbc,
      fbp: params.attribution?.fbp,
      marketingConsent: params.attribution?.marketingConsent,
      analyticsConsent: params.attribution?.analyticsConsent,
      customerId: params.customerId,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      convertedOrderId: params.convertedOrderId,
      convertedRevenuePaise: params.convertedRevenuePaise,
      deviceType: params.attribution?.deviceType,
      geo: params.geo,
    },
    db
  );

  db.prepare(`
    INSERT INTO funnel_events (
      id, session_id, event_id, funnel_name, funnel_stage, stage_rank, event_name,
      entity_type, entity_id, path, value_paise, currency,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, referrer,
      metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sessionId,
    params.eventId || null,
    funnelName,
    params.funnelStage,
    stageRank,
    sanitizeAttrStr(params.eventName, 80),
    params.entityType || null,
    params.entityId || null,
    path,
    Math.max(0, Math.round(params.valuePaise ?? 0)),
    sanitizeAttrStr(params.currency || "INR", 10) || "INR",
    last.utm_source,
    last.utm_medium,
    last.utm_campaign,
    last.utm_term,
    last.utm_content,
    last.gclid,
    last.fbclid,
    last.referrer || params.attribution?.referer || "",
    JSON.stringify(params.metadata || {}),
    now
  );

  // Mirror into legacy analytics_events so /admin/visitors remains populated
  try {
    db.prepare(`
      INSERT INTO analytics_events (session_id, event_type, path, referrer, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      mapToLegacyAnalyticsType(params.funnelStage),
      path,
      last.utm_source
        ? `${last.utm_source}${last.utm_medium ? ` / ${last.utm_medium}` : ""}${last.utm_campaign ? ` (${last.utm_campaign})` : ""}`
        : last.referrer || params.attribution?.referer || "",
      params.attribution?.userAgent || "",
      JSON.stringify({
        funnel_name: funnelName,
        funnel_stage: params.funnelStage,
        utm_source: last.utm_source,
        utm_medium: last.utm_medium,
        utm_campaign: last.utm_campaign,
        utm_term: last.utm_term,
      }),
      now
    );
  } catch {
    // Non-fatal if analytics_events table absent in isolated unit tests
  }

  return { id };
}

export interface RecordEntityAttributionParams {
  entityType: string;
  entityId: string;
  attribution?: ExtractedRequestAttribution;
  funnelName?: FunnelName;
  funnelStage: FunnelStage;
  eventName?: string;
  path?: string;
  valuePaise?: number;
  currency?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  convertedOrderId?: string | null;
  convertedRevenuePaise?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Persists entity-level first/last-touch attribution and records the corresponding funnel event.
 * Also reads back any stored session attribution when a server-side call (like a payment webhook)
 * lacks client headers.
 */
export function recordEntityAttribution(
  params: RecordEntityAttributionParams,
  database?: InstanceType<typeof Database>
): { sessionId: string; resolvedTouch: AttributionTouch } {
  const db = database ?? getDb();
  const now = toDbTimestamp();

  const attr = params.attribution;
  let sessionId = attr?.sessionId || "";

  // If no sessionId or no UTMs in request, check visitor_sessions by existing sessionId or email/phone
  let existingSession: Record<string, unknown> | undefined;
  if (sessionId) {
    existingSession = db
      .prepare("SELECT * FROM visitor_sessions WHERE session_id = ?")
      .get(sessionId) as Record<string, unknown> | undefined;
  } else if (params.customerEmail || params.customerPhone) {
    const cleanEmail = params.customerEmail?.trim().toLowerCase();
    const cleanPhone =
      params.customerPhone && params.customerPhone.replace(/\D/g, "").length >= 7
        ? cleanWhatsAppNumber(params.customerPhone)
        : null;
    if (cleanEmail && cleanPhone) {
      existingSession = db
        .prepare(
          "SELECT * FROM visitor_sessions WHERE customer_email = ? OR customer_phone = ? ORDER BY updated_at DESC LIMIT 1"
        )
        .get(cleanEmail, cleanPhone) as Record<string, unknown> | undefined;
    } else if (cleanEmail) {
      existingSession = db
        .prepare("SELECT * FROM visitor_sessions WHERE customer_email = ? ORDER BY updated_at DESC LIMIT 1")
        .get(cleanEmail) as Record<string, unknown> | undefined;
    } else if (cleanPhone) {
      existingSession = db
        .prepare("SELECT * FROM visitor_sessions WHERE customer_phone = ? ORDER BY updated_at DESC LIMIT 1")
        .get(cleanPhone) as Record<string, unknown> | undefined;
    }
    if (existingSession?.session_id) {
      sessionId = String(existingSession.session_id);
    }
  }

  if (!sessionId) {
    sessionId = `srv_${randomUUID()}`;
  }

  const sessionLast: AttributionTouch | null = existingSession
    ? normalizeTouchWithClickInference({
        utm_source: String(existingSession.last_utm_source || ""),
        utm_medium: String(existingSession.last_utm_medium || ""),
        utm_campaign: String(existingSession.last_utm_campaign || ""),
        utm_term: String(existingSession.last_utm_term || ""),
        utm_content: String(existingSession.last_utm_content || ""),
        utm_id: String(existingSession.last_utm_id || ""),
        gclid: String(existingSession.last_gclid || ""),
        fbclid: String(existingSession.last_fbclid || ""),
        referrer: String(existingSession.last_referrer || ""),
        landing_page: String(existingSession.last_landing_page || ""),
      })
    : null;

  const sessionFirst: AttributionTouch | null = existingSession
    ? normalizeTouchWithClickInference({
        utm_source: String(existingSession.first_utm_source || ""),
        utm_medium: String(existingSession.first_utm_medium || ""),
        utm_campaign: String(existingSession.first_utm_campaign || ""),
        utm_term: String(existingSession.first_utm_term || ""),
        utm_content: String(existingSession.first_utm_content || ""),
        utm_id: String(existingSession.first_utm_id || ""),
        gclid: String(existingSession.first_gclid || ""),
        fbclid: String(existingSession.first_fbclid || ""),
        referrer: String(existingSession.first_referrer || ""),
        landing_page: String(existingSession.first_landing_page || ""),
      })
    : null;

  const firstTouch =
    attr?.firstTouch && hasCampaignOrClickSignals(attr.firstTouch)
      ? attr.firstTouch
      : sessionFirst && hasCampaignOrClickSignals(sessionFirst)
      ? sessionFirst
      : attr?.firstTouch || sessionFirst || EMPTY_ATTRIBUTION_TOUCH;

  const lastTouch =
    attr?.lastTouch && hasCampaignOrClickSignals(attr.lastTouch)
      ? attr.lastTouch
      : sessionLast && hasCampaignOrClickSignals(sessionLast)
      ? sessionLast
      : attr?.lastTouch || sessionLast || firstTouch;

  const mergedAttr: ExtractedRequestAttribution = {
    sessionId,
    firstTouch,
    lastTouch,
    funnelName: params.funnelName || attr?.funnelName || resolveFunnelNameFromPath(params.path || "/"),
    fbc: attr?.fbc || (existingSession?.fbc ? String(existingSession.fbc) : undefined),
    fbp: attr?.fbp || (existingSession?.fbp ? String(existingSession.fbp) : undefined),
    marketingConsent: attr?.marketingConsent ?? Boolean(existingSession?.marketing_consent),
    analyticsConsent: attr?.analyticsConsent ?? Boolean(existingSession?.analytics_consent),
    userAgent: attr?.userAgent || "",
    deviceType: attr?.deviceType || String(existingSession?.device_type || "unknown"),
    clientIp: attr?.clientIp || "",
    referer: attr?.referer || lastTouch.referrer || "",
  };

  db.prepare(`
    INSERT INTO entity_attributions (
      entity_type, entity_id, session_id, funnel_name, funnel_stage,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id,
      gclid, fbclid, landing_page, referrer,
      first_touch_json, last_touch_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      session_id = CASE WHEN entity_attributions.session_id = '' THEN excluded.session_id ELSE entity_attributions.session_id END,
      funnel_stage = excluded.funnel_stage,
      utm_source = CASE WHEN entity_attributions.utm_source = '' THEN excluded.utm_source ELSE entity_attributions.utm_source END,
      utm_medium = CASE WHEN entity_attributions.utm_medium = '' THEN excluded.utm_medium ELSE entity_attributions.utm_medium END,
      utm_campaign = CASE WHEN entity_attributions.utm_campaign = '' THEN excluded.utm_campaign ELSE entity_attributions.utm_campaign END,
      utm_term = CASE WHEN entity_attributions.utm_term = '' THEN excluded.utm_term ELSE entity_attributions.utm_term END,
      utm_content = CASE WHEN entity_attributions.utm_content = '' THEN excluded.utm_content ELSE entity_attributions.utm_content END,
      gclid = CASE WHEN entity_attributions.gclid = '' THEN excluded.gclid ELSE entity_attributions.gclid END,
      fbclid = CASE WHEN entity_attributions.fbclid = '' THEN excluded.fbclid ELSE entity_attributions.fbclid END
  `).run(
    params.entityType,
    params.entityId,
    sessionId,
    mergedAttr.funnelName,
    params.funnelStage,
    lastTouch.utm_source,
    lastTouch.utm_medium,
    lastTouch.utm_campaign,
    lastTouch.utm_term,
    lastTouch.utm_content,
    lastTouch.utm_id,
    lastTouch.gclid,
    lastTouch.fbclid,
    lastTouch.landing_page,
    lastTouch.referrer,
    JSON.stringify(firstTouch),
    JSON.stringify(lastTouch),
    now
  );

  recordFunnelEvent(
    {
      sessionId,
      eventId: `${params.entityType}_${params.entityId}`,
      funnelName: mergedAttr.funnelName,
      funnelStage: params.funnelStage,
      eventName: params.eventName || `${params.entityType}_${params.funnelStage}`,
      entityType: params.entityType,
      entityId: params.entityId,
      path: params.path || lastTouch.landing_page || "/",
      valuePaise: params.valuePaise,
      currency: params.currency,
      attribution: mergedAttr,
      customerId: params.customerId,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      convertedOrderId: params.convertedOrderId,
      convertedRevenuePaise: params.convertedRevenuePaise,
      metadata: params.metadata,
    },
    db
  );

  return { sessionId, resolvedTouch: lastTouch };
}

export interface RecordConversationParams {
  sessionId?: string;
  channel: ConversationChannel;
  sourcePage?: string;
  referenceCode?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  messagePreview?: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  attribution?: ExtractedRequestAttribution;
}

export function recordConversationEvent(
  params: RecordConversationParams,
  database?: InstanceType<typeof Database>
): { id: string; sessionId: string } {
  const db = database ?? getDb();
  const id = randomUUID();
  const now = toDbTimestamp();

  const { sessionId, resolvedTouch } = recordEntityAttribution(
    {
      entityType: "conversation",
      entityId: id,
      attribution: params.attribution,
      funnelStage: "conversation",
      eventName: `conversation_${params.channel}`,
      path: params.sourcePage || "/",
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      metadata: {
        channel: params.channel,
        referenceCode: params.referenceCode || null,
        linkedEntityType: params.linkedEntityType || null,
        linkedEntityId: params.linkedEntityId || null,
      },
    },
    db
  );

  const cleanPhone =
    params.customerPhone && params.customerPhone.replace(/\D/g, "").length >= 7
      ? cleanWhatsAppNumber(params.customerPhone)
      : params.customerPhone?.trim() || null;

  db.prepare(`
    INSERT INTO funnel_conversations (
      id, session_id, channel, source_page, reference_code,
      customer_name, customer_email, customer_phone, message_preview,
      linked_entity_type, linked_entity_id,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sessionId,
    params.channel,
    sanitizeAttrStr(params.sourcePage || "/", 500) || "/",
    params.referenceCode ? sanitizeAttrStr(params.referenceCode, 120) : null,
    params.customerName ? sanitizeAttrStr(params.customerName, 120) : null,
    params.customerEmail ? sanitizeAttrStr(params.customerEmail.toLowerCase(), 254) : null,
    cleanPhone,
    sanitizeAttrStr(params.messagePreview || "", 500),
    params.linkedEntityType || null,
    params.linkedEntityId || null,
    resolvedTouch.utm_source,
    resolvedTouch.utm_medium,
    resolvedTouch.utm_campaign,
    resolvedTouch.utm_term,
    resolvedTouch.utm_content,
    resolvedTouch.gclid,
    resolvedTouch.fbclid,
    now
  );

  return { id, sessionId };
}

export function getEntityAttribution(
  entityType: string,
  entityId: string,
  database?: InstanceType<typeof Database>
): Record<string, unknown> | null {
  try {
    const db = database ?? getDb();
    const row = db
      .prepare("SELECT * FROM entity_attributions WHERE entity_type = ? AND entity_id = ?")
      .get(entityType, entityId) as Record<string, unknown> | undefined;
    if (!row) return null;
    let firstTouch: Record<string, unknown> = {};
    let lastTouch: Record<string, unknown> = {};
    try {
      firstTouch = JSON.parse(String(row.first_touch_json || "{}"));
    } catch {}
    try {
      lastTouch = JSON.parse(String(row.last_touch_json || "{}"));
    } catch {}
    return {
      sessionId: row.session_id || "",
      funnelName: row.funnel_name || "retail_storefront",
      funnelStage: row.funnel_stage || "",
      utm_source: row.utm_source || "",
      utm_medium: row.utm_medium || "",
      utm_campaign: row.utm_campaign || "",
      utm_term: row.utm_term || "",
      utm_content: row.utm_content || "",
      gclid: row.gclid || "",
      fbclid: row.fbclid || "",
      landing_page: row.landing_page || "",
      referrer: row.referrer || "",
      firstTouch,
      lastTouch,
    };
  } catch {
    return null;
  }
}

export function safeRecordEntityAttribution(
  params: RecordEntityAttributionParams,
  database?: InstanceType<typeof Database>
): {
  sessionId: string;
  resolvedTouch: AttributionTouch;
} | null {
  try {
    return recordEntityAttribution(params, database);
  } catch (err) {
    logger.warn("funnel attribution record skipped", {
      entityType: params.entityType,
      entityId: params.entityId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function getTableColumns(
  db: InstanceType<typeof Database>,
  table: string
): Set<string> {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return new Set(rows.map((r) => r.name));
  } catch {
    return new Set();
  }
}

export function buildCompactAttributionPayload(
  attr?: ExtractedRequestAttribution | null
): Record<string, unknown> | undefined {
  if (!attr) return undefined;
  return {
    sessionId: attr.sessionId || undefined,
    funnelName: attr.funnelName,
    utm_source: attr.lastTouch.utm_source || attr.firstTouch.utm_source || "",
    utm_medium: attr.lastTouch.utm_medium || attr.firstTouch.utm_medium || "",
    utm_campaign: attr.lastTouch.utm_campaign || attr.firstTouch.utm_campaign || "",
    utm_term: attr.lastTouch.utm_term || attr.firstTouch.utm_term || "",
    utm_content: attr.lastTouch.utm_content || attr.firstTouch.utm_content || "",
    gclid: attr.lastTouch.gclid || attr.firstTouch.gclid || "",
    fbclid: attr.lastTouch.fbclid || attr.firstTouch.fbclid || "",
    landing_page: attr.lastTouch.landing_page || attr.firstTouch.landing_page || "",
    referrer: attr.lastTouch.referrer || attr.firstTouch.referrer || "",
    firstTouch: attr.firstTouch,
    lastTouch: attr.lastTouch,
  };
}
