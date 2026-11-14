import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getTrackingSettings } from "@/lib/trackingSettings";
import { quoteAnalytics } from "@/lib/international/analytics";
import type { Quote } from "@/lib/international/models";

export interface MetaCapiAttribution {
  fbc?: string;
  fbp?: string;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
}

function sha256Normalized(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
}

function normalizePhoneHash(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return undefined;
  // Default Indian 10-digit numbers to 91 country code if no country code present
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return createHash("sha256").update(normalized).digest("hex");
}

function splitName(fullName: string | undefined | null): { fn?: string; ln?: string } {
  if (!fullName) return {};
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { fn: parts[0] };
  return { fn: parts[0], ln: parts.slice(1).join(" ") };
}

export function saveOrderAttribution(orderId: string, attribution: MetaCapiAttribution): void {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO commerce_events (id, kind, document, created_ms) VALUES (?, 'meta_attribution', ?, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document"
    ).run(`meta-attr:${orderId}`, JSON.stringify(attribution), Date.now());
  } catch {
    // Non-fatal: attribution enrichment should never block payment
  }
}

function loadOrderAttribution(orderId: string): MetaCapiAttribution {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT document FROM commerce_events WHERE id = ?")
      .get(`meta-attr:${orderId}`) as { document: string } | undefined;
    if (!row?.document) return {};
    return JSON.parse(row.document) as MetaCapiAttribution;
  } catch {
    return {};
  }
}

export function buildMetaPurchasePayload(orderId: string, quote: Quote, attribution: MetaCapiAttribution = {}) {
  const analytics = quoteAnalytics(quote);
  const addr = quote.input.address;
  const { fn, ln } = splitName(addr.name);

  const userData: Record<string, unknown> = {};
  const em = sha256Normalized(addr.email);
  const ph = normalizePhoneHash(addr.phone);
  const fnHash = sha256Normalized(fn);
  const lnHash = sha256Normalized(ln);
  const ct = sha256Normalized(addr.city?.replace(/[^a-zA-Z0-9]/g, ""));
  const st = sha256Normalized(addr.state?.replace(/[^a-zA-Z0-9]/g, ""));
  const zp = sha256Normalized(addr.postcode?.replace(/\s+/g, ""));
  const country = sha256Normalized(addr.country);

  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fnHash) userData.fn = [fnHash];
  if (lnHash) userData.ln = [lnHash];
  if (ct) userData.ct = [ct];
  if (st) userData.st = [st];
  if (zp) userData.zp = [zp];
  if (country) userData.country = [country];
  if (attribution.fbc) userData.fbc = attribution.fbc;
  if (attribution.fbp) userData.fbp = attribution.fbp;
  if (attribution.clientIp) userData.client_ip_address = attribution.clientIp;
  if (attribution.userAgent) userData.client_user_agent = attribution.userAgent;

  const eventData: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: `purchase_${orderId}`,
    event_source_url: attribution.sourceUrl || `https://teafloww.com/purchase/${orderId}`,
    action_source: "website",
    user_data: userData,
    custom_data: {
      currency: analytics.currency,
      value: Number(analytics.total.toFixed(2)),
      order_id: orderId,
      content_type: "product",
      content_ids: analytics.items.map((i) => i.item_id),
      contents: analytics.items.map((i) => ({
        id: i.item_id,
        quantity: i.quantity ?? 1,
        item_price: Number(i.price.toFixed(2)),
      })),
      num_items: analytics.items.reduce((sum, i) => sum + (i.quantity ?? 1), 0),
    },
  };

  const payload: Record<string, unknown> = { data: [eventData] };
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (testCode) payload.test_event_code = testCode;
  return payload;
}

/**
 * Sends a server-side Purchase event to Meta Conversions API with the exact same
 * `event_id` (`purchase_<orderId>`) used by the browser Pixel/GTM so Meta deduplicates cleanly.
 * No-ops gracefully if `META_CAPI_ACCESS_TOKEN` is not configured.
 */
export async function sendMetaServerPurchaseEvent(
  orderId: string,
  quote: Quote,
  explicitAttribution?: MetaCapiAttribution
): Promise<{ sent: boolean; reason?: string }> {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return { sent: false, reason: "no_access_token" };
  }

  const settings = getTrackingSettings();
  const pixelId = (process.env.META_PIXEL_ID?.trim() || settings.meta_pixel_id || "").trim();
  if (!/^\d+$/.test(pixelId)) {
    return { sent: false, reason: "invalid_pixel_id" };
  }

  const db = getDb();
  const dedupId = `capi:purchase:${orderId}`;
  try {
    const existing = db.prepare("SELECT id FROM commerce_events WHERE id = ?").get(dedupId);
    if (existing) return { sent: false, reason: "already_sent" };
  } catch {
    // Continue if table check fails
  }

  const storedAttr = loadOrderAttribution(orderId);
  const attribution = { ...storedAttr, ...explicitAttribution };
  const payload = buildMetaPurchasePayload(orderId, quote, attribution);

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.error("meta-capi Purchase event failed", { orderId, status: res.status, detail: errText.slice(0, 300) });
      return { sent: false, reason: `http_${res.status}` };
    }

    try {
      db.prepare(
        "INSERT INTO commerce_events (id, kind, document, created_ms) VALUES (?, 'meta_capi_purchase', ?, ?) ON CONFLICT(id) DO NOTHING"
      ).run(dedupId, JSON.stringify({ orderId, pixelId, eventId: `purchase_${orderId}` }), Date.now());
    } catch {}

    return { sent: true };
  } catch (err) {
    logger.error("meta-capi network error sending Purchase", { orderId, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: "network_error" };
  }
}
