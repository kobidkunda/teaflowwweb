import { randomUUID } from "crypto";
import { z } from "zod";
import { gate, body, owner, json, failure } from "@/lib/international/http";
import { createQuote, publicQuote, getQuote } from "@/lib/international/quotes";
import { startPayment, liveOrder, validGuestToken, syncYoupiOrderStatus, switchOrderToCod, retryOrderPayment } from "@/lib/international/orders";
import { getDb } from "@/lib/db";
import { publicMarkets } from "@/lib/international/store";
import { enabledLanguages } from "@/lib/international/translations";
import { currencySchema, localeSchema, countrySchema, CommerceError } from "@/lib/international/models";
import { shipment } from "@/lib/international/fulfillment";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { getShippingSettings } from "@/lib/shippingSettings";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const denied = gate(request); if (denied) return denied;
  try {
    const { action } = await params;
    if (action === "markets") return json({ markets: publicMarkets(), languages: enabledLanguages() });
    if (action === "payment-methods") {
      const p = getPaymentSettings();
      const s = getShippingSettings();
      return json({
        onlinePaymentEnabled: p.online_payment_enabled,
        discounts: {
          upi: {
            enabled: p.upi_discount_enabled,
            type: p.upi_discount_type,
            value: p.upi_discount_value,
            maxRupees: p.upi_discount_max_rupees,
          },
          card: {
            enabled: p.card_discount_enabled,
            type: p.card_discount_type,
            value: p.card_discount_value,
            maxRupees: p.card_discount_max_rupees,
          },
          netbanking: {
            enabled: p.netbanking_discount_enabled,
            type: p.netbanking_discount_type,
            value: p.netbanking_discount_value,
            maxRupees: p.netbanking_discount_max_rupees,
          },
          cod: {
            enabled: s.cod_enabled,
            feePaise: s.cod_fee_paise,
            feeRupees: s.cod_fee_rupees,
            minRupees: s.cod_min_rupees,
            maxRupees: s.cod_max_rupees,
            minPaise: s.cod_min_paise,
            maxPaise: s.cod_max_paise,
            postcodes: s.cod_postcodes,
          },
          minOrderRupees: p.min_order_for_discount_rupees,
          badgeText: p.payment_discount_badge_text,
        },
        shipping: {
          minDeliveryOrderRupees: s.min_delivery_order_rupees,
          minDeliveryOrderPaise: s.min_delivery_order_paise,
          freeShippingThresholdRupees: s.free_shipping_threshold_rupees,
          freeShippingThresholdPaise: s.free_shipping_threshold_paise,
          shippingFlatFeeRupees: s.shipping_flat_fee_rupees,
          shippingFlatFeePaise: s.shipping_flat_fee_paise,
          freeShippingEnabled: s.free_shipping_enabled,
          dispatchCommitment: s.dispatch_commitment,
        },
      });
    }
    if (action === "order") {
      const query = new URL(request.url).searchParams;
      const rawId = query.get("id");
      if (!rawId || !z.string().uuid().safeParse(rawId).success) return new Response(null, { status: 404 });
      const id = rawId;
      const token = query.get("token") || "";
      if (!validGuestToken(id, token)) return new Response(null, { status: 404 });
      let o = liveOrder(id);
      if (o.payment_status === "payment_pending" || o.payment_status === "creating") {
        try {
          o = await syncYoupiOrderStatus(o);
        } catch {}
      }
      const s = shipment(id), tracking = s ? JSON.parse(s.document).publicTracking : null;
      let orderDoc: Record<string, unknown> = {};
      try { orderDoc = JSON.parse(o.document); } catch {}
      return json({
        orderId: o.id,
        paymentStatus: o.payment_status,
        fulfillmentStatus: o.fulfillment_status,
        refundMinor: o.refund_minor,
        tracking,
        checkoutUrl: typeof orderDoc.checkoutUrl === "string" ? orderDoc.checkoutUrl : undefined,
      });
    }
    return new Response(null, { status: 404 });
  } catch (e) { return failure(e, request); }
}
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const denied = gate(request); if (denied) return denied;
  try {
    const { action } = await params, session = owner(request), input = await body(request);
    if (action === "preferences") {
      const prefs = z.object({ country: countrySchema, currency: currencySchema, locale: localeSchema }).strict().parse(input);
      if (!enabledLanguages().some(l => l.code === prefs.locale)) throw new CommerceError("This language is not published yet.");
      const response = json({ ok: true }, session);
      response.cookies.set("tf_preferences", JSON.stringify(prefs), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 365 * 86400 });
      return response;
    }
    if (action === "quote") return json(publicQuote(await createQuote(input, session)), session);
    if (action === "payment") {
      const payload = typeof input === "object" && input !== null ? { ...(input as Record<string, unknown>) } : {};
      if (typeof payload.idempotencyKey !== "string" || !z.string().uuid().safeParse(payload.idempotencyKey).success) {
        payload.idempotencyKey = randomUUID();
      }
      if (typeof payload.quoteId !== "string" || !z.string().uuid().safeParse(payload.quoteId).success) {
        throw new CommerceError("Your checkout session has expired or is invalid. Please review your total before continuing.");
      }
      const p = z.object({
        quoteId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
        currencyAcceptance: currencySchema,
        inrAcceptance: z.boolean().default(false),
        method: z.enum(["upi", "card", "netbanking", "cod", "prepaid"]).optional(),
      }).strict().parse(payload);

      let quote = getQuote(p.quoteId, session);
      if (quote.subscription) throw new CommerceError("Continue through your subscription renewal page.");

      const paySettings = getPaymentSettings();
      if (!paySettings.online_payment_enabled && (p.method ? p.method !== "cod" : quote.input.method !== "cod")) {
        throw new CommerceError("Online payment is currently disabled. Please checkout using Cash on Delivery.");
      }

      // Reconcile payment method if client requested a specific method (e.g. COD)
      if (p.method && p.method !== quote.input.method) {
        quote = await createQuote({ ...quote.input, method: p.method }, session);
      }

      if (p.currencyAcceptance !== quote.currency || (quote.input.address.country !== "IN" && quote.currency === "INR" && !p.inrAcceptance)) throw new CommerceError("Confirm the payable currency before continuing.");
      getDb().prepare("INSERT INTO commerce_events (id,kind,document,created_ms) VALUES (?,'currency_consent',?,?) ON CONFLICT(id) DO NOTHING").run(`currency-consent:${quote.id}`, JSON.stringify({ quoteId: quote.id, currency: quote.currency, totalMinor: quote.totalMinor, inrAcceptance: p.inrAcceptance }), Date.now());
      return json(await startPayment(quote.id, session, p.idempotencyKey), session);
    }
    if (action === "change-to-cod") {
      const payload = typeof input === "object" && input !== null ? { ...(input as Record<string, unknown>) } : {};
      const p = z.object({
        orderId: z.string().uuid(),
        token: z.string().min(1),
      }).strict().parse(payload);
      const updated = switchOrderToCod(p.orderId, p.token);
      return json({
        ok: true,
        orderId: updated.id,
        paymentStatus: updated.payment_status,
      }, session);
    }
    if (action === "retry-payment") {
      const payload = typeof input === "object" && input !== null ? { ...(input as Record<string, unknown>) } : {};
      const p = z.object({
        orderId: z.string().uuid(),
        token: z.string().min(1),
      }).strict().parse(payload);
      const retryResult = await retryOrderPayment(p.orderId, p.token);
      return json({
        ok: true,
        ...retryResult,
      }, session);
    }
    return new Response(null, { status: 404 });
  } catch (e) { return failure(e, request); }
}
