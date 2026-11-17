import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";
import { TrialService } from "@/lib/trials/service";
import {
  QuoteRequestSchema,
  TradeEnquiryRequestSchema,
  SharedInterestRequestSchema,
  type Handover,
  type QuoteLineSnapshot,
  type QuoteResult,
  type TradeQuoteRequest,
} from "./contracts";
import {
  findMatchingTradeLanes,
  getTradeSettings,
  type TradeLaneRecord,
} from "./catalogue";
import { computeParcelPacking } from "./packing";
import {
  getTableColumns,
  recordConversationEvent,
  safeRecordEntityAttribution,
  type ExtractedRequestAttribution,
} from "@/lib/funnel/server";

const QUOTE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class TradeQuoteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function buildEnquiryDraft(args: {
  locale: string;
  pin: string;
  lines: Array<{ label: string; quantity: number }>;
  reason: string;
}): string {
  const itemText = args.lines.map((l) => `${l.quantity} x ${l.label}`).join(", ");
  if (args.locale === "bn") {
    return `নমস্কার TeaFloww, পিনকোড ${args.pin}-এর জন্য ${itemText} সম্পর্কে পরিবহন খরচ ও ডেলিভারির তথ্য জানতে চাই (${args.reason})।`;
  }
  if (args.locale === "hi") {
    return `नमस्ते TeaFloww, पिनकोड ${args.pin} के लिए ${itemText} का ट्रांसपोर्ट और डिलीवरी कोट चाहिए (${args.reason})।`;
  }
  if (args.locale === "gu") {
    return `નમસ્તે TeaFloww, પિનકોડ ${args.pin} માટે ${itemText} ના ટ્રાન્સપોર્ટ અને ડિલિવરી ખર્ચની માહિતી આપશો (${args.reason}).`;
  }
  if (args.locale === "mr") {
    return `नमस्कार TeaFloww, पिनकोड ${args.pin} साठी ${itemText} चे वाहतूक आणि डिलिव्हरी दर कळवा (${args.reason}).`;
  }
  return `Hello TeaFloww, please confirm transport & delivery quote for ${itemText} to PIN ${args.pin} (${args.reason}).`;
}

function persistQuoteRow(args: {
  id: string;
  sessionId: string;
  locale: string;
  kind: "confirmed" | "manual" | "unavailable";
  quoteType: "bulk" | "trial";
  inputHash: string;
  destinationPin: string;
  paymentMethod: string;
  laneId?: string | null;
  laneVersion?: number | null;
  handover?: Handover | null;
  lines: QuoteLineSnapshot[];
  netGrams: number;
  billedGrams: number;
  goodsPaise: number;
  freightPaise: number;
  extraTaxPaise: number;
  otherFeesPaise: number;
  creditPaise: number;
  totalPaise: number;
  dueNowPaise: number;
  dueLaterPaise: number;
  etaLabel?: string | null;
  enquiryDraft?: string | null;
  expiresAt: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO trade_quotes (
      id, channel, session_id, locale, kind, quote_type, input_hash,
      destination_pin, payment_method, lane_id, lane_version, handover_json,
      lines_json, net_grams, billed_grams, goods_paise, freight_paise,
      extra_tax_paise, other_fees_paise, credit_paise, total_paise,
      due_now_paise, due_later_paise, eta_label, enquiry_draft, expires_at
    ) VALUES (
      ?, 'trade', ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    args.id,
    args.sessionId,
    args.locale,
    args.kind,
    args.quoteType,
    args.inputHash,
    args.destinationPin,
    args.paymentMethod,
    args.laneId ?? null,
    args.laneVersion ?? null,
    args.handover ? JSON.stringify(args.handover) : null,
    JSON.stringify(args.lines),
    args.netGrams,
    args.billedGrams,
    args.goodsPaise,
    args.freightPaise,
    args.extraTaxPaise,
    args.otherFeesPaise,
    args.creditPaise,
    args.totalPaise,
    args.dueNowPaise,
    args.dueLaterPaise,
    args.etaLabel ?? null,
    args.enquiryDraft ?? null,
    args.expiresAt
  );
}

function recordTradeFunnelEvent(args: {
  sessionId: string;
  eventName: string;
  locale: string;
  quoteId?: string;
  enquiryId?: string;
  orderId?: string;
  valuePaise?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    getDb()
      .prepare(`
        INSERT INTO trade_funnel_events (
          id, session_id, event_name, locale, quote_id, enquiry_id, order_id, value_paise, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        args.sessionId,
        args.eventName,
        args.locale,
        args.quoteId ?? null,
        args.enquiryId ?? null,
        args.orderId ?? null,
        args.valuePaise ?? 0,
        JSON.stringify(args.metadata ?? {})
      );
  } catch {
    // Non-fatal analytics write
  }
}

export function createTradeQuote(
  rawInput: unknown,
  sessionId: string
): QuoteResult {
  const input: TradeQuoteRequest = QuoteRequestSchema.parse(rawInput);
  const settings = getTradeSettings();
  if (!settings.channel_enabled) {
    throw new TradeQuoteError("Trade channel is currently paused.", 503);
  }

  const db = getDb();
  const quoteId = `tq_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();

  // 1. Resolve lines & canonical server prices/weights
  let lines: QuoteLineSnapshot[] = [];
  let netGrams = 0;
  let goodsPaise = 0;

  if (input.quoteType === "trial") {
    const trialDetails = TrialService.getById(input.trialId) ?? TrialService.getBySlug(input.trialId);
    if (!trialDetails || trialDetails.status !== "published") {
      throw new TradeQuoteError("Selected trial kit is not available.", 404);
    }
    const trial = trialDetails;
    const totalComponentGrams = trialDetails.components.reduce(
      (sum, c) => sum + Number(c.weight_g || 0),
      0
    );
    const unitGrams = totalComponentGrams > 0 ? totalComponentGrams : 200;
    netGrams = unitGrams * input.quantity;
    goodsPaise = trial.price_paise * input.quantity;
    lines = [
      {
        variantId: 0,
        productId: 0,
        productName: trial.title,
        sku: trial.sku,
        grams: unitGrams,
        quantity: input.quantity,
        unitPricePaise: trial.price_paise,
        lineTotalPaise: goodsPaise,
      },
    ];
  } else {
    // Bulk quote: combine duplicate variantIds and validate against published trade_offers
    const combined = new Map<number, number>();
    for (const line of input.lines) {
      combined.set(line.variantId, (combined.get(line.variantId) || 0) + line.quantity);
    }

    const nowIso = new Date().toISOString();
    for (const [variantId, quantity] of combined) {
      const row = db
        .prepare(
          `
          SELECT v.id AS variant_id, v.product_id, v.sku, v.grams, v.price_paise, v.stock,
                 p.name AS product_name, o.eligible_variant_ids_json
          FROM variants v
          JOIN products p ON p.id = v.product_id
          JOIN trade_offers o ON o.product_id = p.id
          WHERE v.id = ?
            AND o.published = 1
            AND ${enabledProductCondition("p")}
            AND (o.starts_at IS NULL OR o.starts_at <= ?)
            AND (o.ends_at IS NULL OR o.ends_at >= ?)
        `
        )
        .get(variantId, nowIso, nowIso) as Record<string, unknown> | undefined;

      if (!row) {
        throw new TradeQuoteError(
          `Variant ${variantId} is not available in the trade channel.`,
          400
        );
      }

      let eligibleIds: number[] = [];
      try {
        eligibleIds = JSON.parse(String(row.eligible_variant_ids_json || "[]"));
      } catch {
        eligibleIds = [];
      }
      if (Array.isArray(eligibleIds) && eligibleIds.length > 0 && !eligibleIds.includes(variantId)) {
        throw new TradeQuoteError(
          `Variant ${variantId} is not eligible for trade orders.`,
          400
        );
      }

      const stock = Number(row.stock);
      if (stock < quantity) {
        throw new TradeQuoteError(
          `Insufficient stock for ${row.product_name} (${row.sku}). Available: ${stock}.`,
          409
        );
      }

      const unitPricePaise = Number(row.price_paise);
      const grams = Number(row.grams);
      const lineTotalPaise = unitPricePaise * quantity;

      netGrams += grams * quantity;
      goodsPaise += lineTotalPaise;
      lines.push({
        variantId,
        productId: Number(row.product_id),
        productName: String(row.product_name),
        sku: String(row.sku),
        grams,
        quantity,
        unitPricePaise,
        lineTotalPaise,
      });
    }
  }

  const inputHash = createHash("sha256")
    .update(JSON.stringify({ input, lines, goodsPaise }))
    .digest("hex")
    .slice(0, 32);

  // 2. Match active lane for PIN
  const lanes = findMatchingTradeLanes(
    input.destinationPin,
    input.quoteType === "trial" ? "trial" : "bulk"
  );

  if (lanes.length === 0) {
    const draft = buildEnquiryDraft({
      locale: input.locale,
      pin: input.destinationPin,
      lines: lines.map((l) => ({ label: `${l.productName} (${l.grams / 1000} kg)`, quantity: l.quantity })),
      reason: "PIN outside instant-quote lanes",
    });
    persistQuoteRow({
      id: quoteId,
      sessionId,
      locale: input.locale,
      kind: "manual",
      quoteType: input.quoteType,
      inputHash,
      destinationPin: input.destinationPin,
      paymentMethod: input.payment,
      lines,
      netGrams,
      billedGrams: netGrams,
      goodsPaise,
      freightPaise: 0,
      extraTaxPaise: 0,
      otherFeesPaise: 0,
      creditPaise: 0,
      totalPaise: 0,
      dueNowPaise: 0,
      dueLaterPaise: 0,
      enquiryDraft: draft,
      expiresAt,
    });
    recordTradeFunnelEvent({
      sessionId,
      eventName: "quote_manual",
      locale: input.locale,
      quoteId,
      metadata: { reason: "unmapped_pin", pin: input.destinationPin },
    });
    return {
      kind: "manual",
      id: quoteId,
      quoteType: input.quoteType,
      destinationPin: input.destinationPin,
      reason: "unmapped_pin",
      enquiryDraft: draft,
      netGrams,
      billedGrams: netGrams,
    };
  }

  // Pick first matching lane (or check if any fits slab)
  let chosenLane: TradeLaneRecord = lanes[0];
  let packing = computeParcelPacking({
    netGrams,
    tareGrams: chosenLane.tare_grams,
    boxLengthCm: chosenLane.box_length_cm,
    boxWidthCm: chosenLane.box_width_cm,
    boxHeightCm: chosenLane.box_height_cm,
    dimDivisor: chosenLane.dim_divisor,
    billingIncrementGrams: chosenLane.billing_increment_grams,
    billedWeightRule: chosenLane.billed_weight_rule,
    maxNetGrams: chosenLane.max_net_grams,
    maxBilledGrams: chosenLane.max_billed_grams,
  });

  if (packing.exceedsSlab) {
    // Check if another matching lane fits
    const fitting = lanes.find((lane) => {
      const p = computeParcelPacking({
        netGrams,
        tareGrams: lane.tare_grams,
        boxLengthCm: lane.box_length_cm,
        boxWidthCm: lane.box_width_cm,
        boxHeightCm: lane.box_height_cm,
        dimDivisor: lane.dim_divisor,
        billingIncrementGrams: lane.billing_increment_grams,
        billedWeightRule: lane.billed_weight_rule,
        maxNetGrams: lane.max_net_grams,
        maxBilledGrams: lane.max_billed_grams,
      });
      return !p.exceedsSlab;
    });

    if (!fitting) {
      const draft = buildEnquiryDraft({
        locale: input.locale,
        pin: input.destinationPin,
        lines: lines.map((l) => ({
          label: `${l.productName} (${l.grams / 1000} kg)`,
          quantity: l.quantity,
        })),
        reason: `Exceeds ${chosenLane.max_billed_grams / 1000} kg slab (${packing.billedGrams / 1000} kg billed)`,
      });
      persistQuoteRow({
        id: quoteId,
        sessionId,
        locale: input.locale,
        kind: "manual",
        quoteType: input.quoteType,
        inputHash,
        destinationPin: input.destinationPin,
        paymentMethod: input.payment,
        laneId: chosenLane.id,
        laneVersion: chosenLane.version,
        lines,
        netGrams,
        billedGrams: packing.billedGrams,
        goodsPaise,
        freightPaise: 0,
        extraTaxPaise: 0,
        otherFeesPaise: 0,
        creditPaise: 0,
        totalPaise: 0,
        dueNowPaise: 0,
        dueLaterPaise: 0,
        enquiryDraft: draft,
        expiresAt,
      });
      recordTradeFunnelEvent({
        sessionId,
        eventName: "quote_manual",
        locale: input.locale,
        quoteId,
        metadata: { reason: "overslab", billedGrams: packing.billedGrams },
      });
      return {
        kind: "manual",
        id: quoteId,
        quoteType: input.quoteType,
        destinationPin: input.destinationPin,
        reason: "overslab",
        enquiryDraft: draft,
        netGrams,
        billedGrams: packing.billedGrams,
        maxNetGrams: chosenLane.max_net_grams,
      };
    }
    chosenLane = fitting;
    packing = computeParcelPacking({
      netGrams,
      tareGrams: chosenLane.tare_grams,
      boxLengthCm: chosenLane.box_length_cm,
      boxWidthCm: chosenLane.box_width_cm,
      boxHeightCm: chosenLane.box_height_cm,
      dimDivisor: chosenLane.dim_divisor,
      billingIncrementGrams: chosenLane.billing_increment_grams,
      billedWeightRule: chosenLane.billed_weight_rule,
      maxNetGrams: chosenLane.max_net_grams,
      maxBilledGrams: chosenLane.max_billed_grams,
    });
  }

  // 3. Payment eligibility check
  if (input.payment === "cod" && !chosenLane.cod_allowed) {
    const alternatives: Array<"prepaid" | "pickup"> = ["prepaid"];
    if (chosenLane.handover_kind === "depot") alternatives.push("pickup");
    persistQuoteRow({
      id: quoteId,
      sessionId,
      locale: input.locale,
      kind: "unavailable",
      quoteType: input.quoteType,
      inputHash,
      destinationPin: input.destinationPin,
      paymentMethod: input.payment,
      laneId: chosenLane.id,
      laneVersion: chosenLane.version,
      lines,
      netGrams,
      billedGrams: packing.billedGrams,
      goodsPaise,
      freightPaise: 0,
      extraTaxPaise: 0,
      otherFeesPaise: 0,
      creditPaise: 0,
      totalPaise: 0,
      dueNowPaise: 0,
      dueLaterPaise: 0,
      expiresAt,
    });
    return {
      kind: "unavailable",
      id: quoteId,
      reason: "Cash on delivery is not available on this route.",
      alternatives,
    };
  }

  if (input.payment === "freight_advance" && !chosenLane.freight_advance_allowed) {
    return {
      kind: "unavailable",
      id: quoteId,
      reason: "Freight-advance payment is not available on this route.",
      alternatives: ["prepaid"],
    };
  }

  // 4. Calculate freight, taxes, fees, and payment schedule
  const billedKg = Math.ceil(packing.billedGrams / 1000);
  const trialBaseFreight =
    input.quoteType === "trial" && chosenLane.base_freight_paise === 0
      ? settings.trial_parcel_rate_paise
      : chosenLane.base_freight_paise;

  const codFee =
    input.payment === "cod" || input.payment === "freight_advance"
      ? chosenLane.cod_allowed
        ? chosenLane.cod_fee_paise
        : 0
      : 0;

  const freightPaise =
    trialBaseFreight +
    billedKg * chosenLane.per_kg_freight_paise +
    chosenLane.last_mile_paise +
    codFee;

  const extraTaxPaise = Math.round(
    ((goodsPaise + freightPaise) * chosenLane.extra_tax_bps) / 10000
  );
  const otherFeesPaise = chosenLane.other_fees_paise;

  let creditPaise = 0;
  let redeemedCreditKey: string | null = null;
  if (
    input.quoteType === "bulk" &&
    input.trialOrderId &&
    settings.trial_credit_paise > 0 &&
    netGrams >= settings.trial_credit_min_qty_kg * 1000
  ) {
    const trialOrd = db
      .prepare(
        `
        SELECT t.order_id, t.created_at, o.status
        FROM trade_orders t
        JOIN orders o ON o.id = t.order_id
        JOIN trade_quotes q ON q.id = t.quote_id
        WHERE t.order_id = ? AND q.quote_type = 'trial' AND o.status != 'cancelled'
      `
      )
      .get(input.trialOrderId) as
      | { order_id: string; created_at: string; status: string }
      | undefined;

    if (trialOrd) {
      const ageMs = Date.now() - new Date(trialOrd.created_at).getTime();
      const maxAgeMs = settings.trial_credit_expiry_days * 86400 * 1000;
      const alreadyUsed = db
        .prepare("SELECT id FROM trade_orders WHERE credit_redeemed_key = ?")
        .get(input.trialOrderId);
      if (ageMs <= maxAgeMs && !alreadyUsed) {
        creditPaise = Math.min(goodsPaise, settings.trial_credit_paise);
        redeemedCreditKey = input.trialOrderId;
      }
    }
  }

  const totalPaise = Math.max(
    0,
    goodsPaise + freightPaise + extraTaxPaise + otherFeesPaise - creditPaise
  );

  if (
    input.payment === "cod" &&
    chosenLane.cod_max_total_paise !== null &&
    totalPaise > chosenLane.cod_max_total_paise
  ) {
    return {
      kind: "unavailable",
      id: quoteId,
      reason: "Order total exceeds the cash-on-delivery ceiling for this lane.",
      alternatives: ["prepaid"],
    };
  }

  let dueNowPaise = totalPaise;
  let dueLaterPaise = 0;
  if (input.payment === "cod") {
    dueNowPaise = 0;
    dueLaterPaise = totalPaise;
  } else if (input.payment === "freight_advance") {
    dueNowPaise = Math.min(totalPaise, freightPaise + extraTaxPaise + otherFeesPaise);
    dueLaterPaise = totalPaise - dueNowPaise;
  }

  const handover: Handover =
    chosenLane.handover_kind === "depot"
      ? {
          kind: "depot",
          name: chosenLane.depot_name || `${chosenLane.locality_label} Transport Depot`,
          address: chosenLane.depot_address || chosenLane.locality_label,
          onwardIncluded: chosenLane.onward_included,
        }
      : {
          kind: "doorstep",
          locality: chosenLane.locality_label || `PIN ${input.destinationPin}`,
        };

  persistQuoteRow({
    id: quoteId,
    sessionId,
    locale: input.locale,
    kind: "confirmed",
    quoteType: input.quoteType,
    inputHash,
    destinationPin: input.destinationPin,
    paymentMethod: input.payment,
    laneId: chosenLane.id,
    laneVersion: chosenLane.version,
    handover,
    lines,
    netGrams,
    billedGrams: packing.billedGrams,
    goodsPaise,
    freightPaise,
    extraTaxPaise,
    otherFeesPaise,
    creditPaise,
    totalPaise,
    dueNowPaise,
    dueLaterPaise,
    etaLabel: chosenLane.eta_label,
    enquiryDraft: redeemedCreditKey,
    expiresAt,
  });

  recordTradeFunnelEvent({
    sessionId,
    eventName: "quote_confirmed",
    locale: input.locale,
    quoteId,
    valuePaise: totalPaise,
    metadata: {
      quoteType: input.quoteType,
      handoverKind: handover.kind,
      payment: input.payment,
    },
  });

  return {
    kind: "confirmed",
    id: quoteId,
    quoteType: input.quoteType,
    expiresAt,
    destinationPin: input.destinationPin,
    payment: input.payment,
    serviceCode: chosenLane.service_code,
    serviceLabel: chosenLane.service_label,
    laneId: chosenLane.id,
    laneVersion: chosenLane.version,
    handover,
    lines,
    netGrams,
    grossGrams: packing.grossGrams,
    dimensionalGrams: packing.dimensionalGrams,
    billedGrams: packing.billedGrams,
    maxNetGrams: chosenLane.max_net_grams,
    capacityRatio: packing.capacityRatio,
    currency: "INR",
    goodsPaise,
    freightPaise,
    extraTaxPaise,
    otherFeesPaise,
    creditPaise,
    totalPaise,
    dueNowPaise,
    dueLaterPaise,
    etaLabel: chosenLane.eta_label,
  };
}

export function getTradeQuoteForSession(quoteId: string, sessionId: string) {
  const row = getDb()
    .prepare("SELECT * FROM trade_quotes WHERE id = ?")
    .get(quoteId) as Record<string, unknown> | undefined;

  if (!row) return null;
  if (String(row.session_id) !== sessionId) {
    throw new TradeQuoteError("This quote belongs to another session.", 403);
  }
  const expired = new Date(String(row.expires_at)).getTime() <= Date.now();
  return {
    row,
    expired,
    handover: row.handover_json
      ? (JSON.parse(String(row.handover_json)) as Handover)
      : null,
    lines: JSON.parse(String(row.lines_json || "[]")) as QuoteLineSnapshot[],
  };
}

function buildTradeEnquiryWhatsAppText(args: {
  id: string;
  draft: string;
  contactName?: string;
  contactPhone: string;
  destinationPin: string;
  preferredHours?: string;
  utmCampaign?: string;
  utmSource?: string;
}): string {
  const parts = [
    `*TEAFLOWW TRADE ENQUIRY (${args.id})*`,
    args.contactName ? `Shop / Name: ${args.contactName}` : null,
    `Phone: ${args.contactPhone}`,
    `PIN Code: ${args.destinationPin}`,
    args.preferredHours ? `Preferred Callback: ${args.preferredHours}` : null,
    "",
    args.draft,
    args.utmCampaign || args.utmSource
      ? `\n_Ref: ${[args.utmSource, args.utmCampaign].filter(Boolean).join(" / ")}_`
      : null,
  ].filter((x): x is string => Boolean(x !== null));
  return parts.join("\n");
}

export function createTradeEnquiry(
  rawInput: unknown,
  sessionId: string,
  attribution?: ExtractedRequestAttribution
) {
  const input = TradeEnquiryRequestSchema.parse(rawInput);
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM trade_enquiries WHERE idempotency_key = ?")
    .get(input.idempotencyKey) as Record<string, unknown> | undefined;
  const settings = getTradeSettings();
  const waPhone = settings.whatsapp_number.replace(/[^0-9]/g, "");

  if (existing) {
    const existingText = buildTradeEnquiryWhatsAppText({
      id: String(existing.id),
      draft: String(existing.whatsapp_draft || ""),
      contactName: existing.contact_name ? String(existing.contact_name) : undefined,
      contactPhone: String(existing.contact_phone || input.contactPhone),
      destinationPin: String(existing.destination_pin || input.destinationPin),
      preferredHours: existing.preferred_hours ? String(existing.preferred_hours) : undefined,
      utmCampaign: existing.utm_campaign ? String(existing.utm_campaign) : undefined,
      utmSource: existing.utm_source ? String(existing.utm_source) : undefined,
    });
    return {
      enquiry: existing,
      deduped: true,
      whatsappUrl: `https://wa.me/${waPhone}?text=${encodeURIComponent(existingText)}`,
    };
  }

  const id = `ENQ-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const draft =
    input.whatsappDraft ||
    buildEnquiryDraft({
      locale: input.locale,
      pin: input.destinationPin,
      lines: input.lines.map((l) => ({ label: l.label, quantity: l.quantity })),
      reason: "Requested callback / transport quote",
    });

  const attrTouch = attribution?.lastTouch || attribution?.firstTouch;
  const bodyTouch = input.attribution?.lastTouch || input.attribution?.firstTouch;
  const utmSource = attrTouch?.utm_source || bodyTouch?.utm_source || "";
  const utmMedium = attrTouch?.utm_medium || bodyTouch?.utm_medium || "";
  const utmCampaign = attrTouch?.utm_campaign || bodyTouch?.utm_campaign || "";
  const utmTerm = attrTouch?.utm_term || bodyTouch?.utm_term || "";
  const utmContent = attrTouch?.utm_content || bodyTouch?.utm_content || "";
  const gclid = attrTouch?.gclid || bodyTouch?.gclid || "";
  const fbclid = attrTouch?.fbclid || bodyTouch?.fbclid || "";
  const landingPage =
    attrTouch?.landing_page || bodyTouch?.landing_page || `/tea-shops/${input.locale}`;
  const referrer = attrTouch?.referrer || bodyTouch?.referrer || attribution?.referer || "";
  const funnelName = attribution?.funnelName || input.attribution?.funnelName || "trade_tea_shops";
  const ctaSource = input.ctaSource || "";

  const cols = getTableColumns(db, "trade_enquiries");
  if (cols.has("utm_source")) {
    db.prepare(`
      INSERT INTO trade_enquiries (
        id, idempotency_key, session_id, locale, destination_pin, enquiry_type,
        lines_json, contact_name, contact_phone, preferred_hours, consent_given,
        whatsapp_draft, status,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        gclid, fbclid, landing_page, referrer, funnel_name, cta_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.idempotencyKey,
      attribution?.sessionId || sessionId,
      input.locale,
      input.destinationPin,
      input.enquiryType,
      JSON.stringify(input.lines),
      input.contactName || null,
      input.contactPhone,
      input.preferredHours || null,
      draft,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      gclid,
      fbclid,
      landingPage,
      referrer,
      funnelName,
      ctaSource
    );
  } else {
    db.prepare(`
      INSERT INTO trade_enquiries (
        id, idempotency_key, session_id, locale, destination_pin, enquiry_type,
        lines_json, contact_name, contact_phone, preferred_hours, consent_given,
        whatsapp_draft, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'new')
    `).run(
      id,
      input.idempotencyKey,
      attribution?.sessionId || sessionId,
      input.locale,
      input.destinationPin,
      input.enquiryType,
      JSON.stringify(input.lines),
      input.contactName || null,
      input.contactPhone,
      input.preferredHours || null,
      draft
    );
  }

  recordTradeFunnelEvent({
    sessionId: attribution?.sessionId || sessionId,
    eventName: "enquiry_submitted",
    locale: input.locale,
    enquiryId: id,
    metadata: {
      pin: input.destinationPin,
      enquiryType: input.enquiryType,
      ctaSource,
      utmSource,
      utmCampaign,
    },
  });

  // Record unified first-party funnel attribution & conversation when tables exist
  if (getTableColumns(db, "entity_attributions").size > 0) {
    safeRecordEntityAttribution(
      {
        entityType: "trade_enquiry",
        entityId: id,
        attribution,
        funnelName: "trade_tea_shops",
        funnelStage: "form_submit",
        eventName: "trade_enquiry_submit",
        path: landingPage,
        customerName: input.contactName || null,
        customerPhone: input.contactPhone,
        metadata: {
          destinationPin: input.destinationPin,
          enquiryType: input.enquiryType,
          ctaSource,
        },
      },
      db
    );
    try {
      recordConversationEvent(
        {
          sessionId: attribution?.sessionId || sessionId,
          channel: "trade_enquiry_form",
          sourcePage: landingPage,
          referenceCode: id,
          customerName: input.contactName || null,
          customerPhone: input.contactPhone,
          messagePreview: draft.slice(0, 300),
          linkedEntityType: "trade_enquiry",
          linkedEntityId: id,
          attribution,
        },
        db
      );
    } catch {
      // Non-fatal in minimal test DBs
    }
  }

  const saved = db.prepare("SELECT * FROM trade_enquiries WHERE id = ?").get(id);
  const waText = buildTradeEnquiryWhatsAppText({
    id,
    draft,
    contactName: input.contactName || undefined,
    contactPhone: input.contactPhone,
    destinationPin: input.destinationPin,
    preferredHours: input.preferredHours || undefined,
    utmCampaign,
    utmSource,
  });

  return {
    enquiry: saved,
    deduped: false,
    whatsappUrl: `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`,
  };
}

export function registerSharedPilotInterest(rawInput: unknown) {
  const input = SharedInterestRequestSchema.parse(rawInput);
  const db = getDb();
  const pilot = db
    .prepare("SELECT * FROM trade_shared_pilots WHERE id = ?")
    .get(input.pilotId) as Record<string, unknown> | undefined;
  if (!pilot || pilot.status !== "active") {
    throw new TradeQuoteError("Shared supply pilot is not currently active.", 404);
  }
  const id = `SI-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  db.prepare(`
    INSERT INTO trade_shared_interests (
      id, pilot_id, contact_name, contact_phone, requested_kg, locale, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'interested')
  `).run(
    id,
    input.pilotId,
    input.contactName,
    input.contactPhone,
    input.requestedKg,
    input.locale
  );
  return db
    .prepare("SELECT * FROM trade_shared_interests WHERE id = ?")
    .get(id);
}
