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
import { getStoreSettings } from "@/lib/storeSettings";
import { extractAttributionFromRequest, safeRecordEntityAttribution } from "@/lib/funnel/server";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const denied = gate(request); if (denied) return denied;
  try {
    const { action } = await params;
    if (action === "markets") return json({ markets: publicMarkets(), languages: enabledLanguages() });
    if (action === "payment-methods") {
      const p = getPaymentSettings();
      const s = getShippingSettings();
      const st = getStoreSettings();
      return json({
        onlinePaymentEnabled: p.online_payment_enabled,
        whatsappNumber: st.whatsapp_number || "+91 7001304853",
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
        wholesale: {
          advancePercent: p.wholesale_advance_percent,
          bankDetails: {
            beneficiary: p.wholesale_bank_beneficiary,
            bankName: p.wholesale_bank_name,
            accountNumber: p.wholesale_bank_account_number,
            ifsc: p.wholesale_bank_ifsc,
            branch: p.wholesale_bank_branch,
            upiId: p.wholesale_bank_upi_id,
          },
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
    if (action === "quote") {
      const quoteObj = await createQuote(input, session);
      const attribution = extractAttributionFromRequest(request, input, "/checkout");
      safeRecordEntityAttribution({
        entityType: "quote",
        entityId: quoteObj.id,
        attribution,
        funnelName: quoteObj.wholesale?.isWholesale ? "wholesale_b2b" : attribution.funnelName,
        funnelStage: "checkout_start",
        eventName: "checkout_quote_created",
        path: attribution.lastTouch.landing_page || "/checkout",
        valuePaise: quoteObj.totalMinor,
        currency: quoteObj.currency,
        customerName: quoteObj.input.address.name,
        customerEmail: quoteObj.input.address.email,
        customerPhone: quoteObj.input.address.phone,
        metadata: { currency: quoteObj.currency, isWholesale: Boolean(quoteObj.wholesale?.isWholesale) },
      });

      if (attribution.marketingConsent) {
        import("@/lib/seo/metaCapi")
          .then(({ sendMetaServerFunnelEvent }) =>
            sendMetaServerFunnelEvent({
              eventName: "InitiateCheckout",
              eventId: `ic_${quoteObj.id}`,
              marketingConsent: true,
              user: {
                name: quoteObj.input.address.name,
                email: quoteObj.input.address.email,
                phone: quoteObj.input.address.phone,
                country: quoteObj.input.address.country,
                city: quoteObj.input.address.city,
                postcode: quoteObj.input.address.postcode,
              },
              attribution: {
                fbc: attribution.fbc,
                fbp: attribution.fbp,
                clientIp: attribution.clientIp,
                userAgent: attribution.userAgent,
                sourceUrl: attribution.referer || undefined,
                utmSource: attribution.lastTouch.utm_source,
                utmMedium: attribution.lastTouch.utm_medium,
                utmCampaign: attribution.lastTouch.utm_campaign,
                utmTerm: attribution.lastTouch.utm_term,
                utmContent: attribution.lastTouch.utm_content,
                funnelName: quoteObj.wholesale?.isWholesale ? "wholesale_b2b" : attribution.funnelName,
              },
              customData: {
                currency: quoteObj.currency,
                value: Number((quoteObj.totalMinor / 100).toFixed(2)),
                num_items: quoteObj.lines.reduce((s, l) => s + l.quantity, 0),
              },
            })
          )
          .catch(() => {});
      }

      return json(publicQuote(quoteObj), session);
    }
    if (action === "payment") {
      const attribution = extractAttributionFromRequest(request, input, "/checkout");
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
      const paymentResult = await startPayment(quote.id, session, p.idempotencyKey);
      try {
        const cookieHeader = request.headers.get("cookie") || "";
        const fbc = attribution.fbc || /(?:^|;\s*)_fbc=([^;]+)/.exec(cookieHeader)?.[1];
        const fbp = attribution.fbp || /(?:^|;\s*)_fbp=([^;]+)/.exec(cookieHeader)?.[1];
        const clientIp =
          attribution.clientIp ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          undefined;
        const userAgent = attribution.userAgent || request.headers.get("user-agent") || undefined;
        const sourceUrl = attribution.referer || request.headers.get("referer") || undefined;
        const { saveOrderAttribution } = await import("@/lib/seo/metaCapi");
        saveOrderAttribution(paymentResult.orderId, {
          ...(fbc ? { fbc: decodeURIComponent(fbc) } : {}),
          ...(fbp ? { fbp: decodeURIComponent(fbp) } : {}),
          clientIp,
          userAgent,
          sourceUrl,
          utmSource: attribution.lastTouch.utm_source || undefined,
          utmMedium: attribution.lastTouch.utm_medium || undefined,
          utmCampaign: attribution.lastTouch.utm_campaign || undefined,
          utmTerm: attribution.lastTouch.utm_term || undefined,
          utmContent: attribution.lastTouch.utm_content || undefined,
          funnelName: quote.wholesale?.isWholesale ? "wholesale_b2b" : attribution.funnelName,
        });

        const isDirectOrder =
          paymentResult.paymentStatus === "cod_due" ||
          paymentResult.paymentStatus === "pending_bank_transfer";

        safeRecordEntityAttribution({
          entityType: "order",
          entityId: paymentResult.orderId,
          attribution,
          funnelName: quote.wholesale?.isWholesale ? "wholesale_b2b" : attribution.funnelName,
          funnelStage: isDirectOrder ? "order_placed" : "payment_info",
          eventName:
            paymentResult.paymentStatus === "cod_due"
              ? "order_cod_placed"
              : paymentResult.paymentStatus === "pending_bank_transfer"
              ? "order_bank_transfer_placed"
              : "payment_initiated",
          path: attribution.lastTouch.landing_page || "/checkout",
          valuePaise: quote.totalMinor,
          currency: quote.currency,
          customerName: quote.input.address.name,
          customerEmail: quote.input.address.email,
          customerPhone: quote.input.address.phone,
          convertedOrderId: isDirectOrder ? paymentResult.orderId : null,
          convertedRevenuePaise: isDirectOrder ? quote.totalMinor : 0,
          metadata: {
            quoteId: quote.id,
            paymentStatus: paymentResult.paymentStatus,
            method: quote.input.method,
          },
        });
      } catch {}
      return json(paymentResult, session);
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
