import {
  deleteTradeOffer,
  getTradeFunnelSummary,
  getTradeSettings,
  listAllTradeOffersAdmin,
  listLocalizedContent,
  listPublicTradeProducts,
  listTradeEnquiries,
  listTradeLanes,
  listTradeOrdersAdmin,
  listTradeSharedPilots,
  reconcileTradeOrder,
  setTradeLaneActive,
  updateTradeEnquiry,
  updateTradeSettings,
  upsertLocalizedContent,
  upsertTradeLane,
  upsertTradeOffer,
  upsertTradeSharedPilot,
} from "./catalogue";
import { createTradeQuote } from "./quotes";

export const TRADE_TOOL_ALIASES: Record<string, string> = {
  trade_get_overview: "trade.getOverview",
  trade_update_settings: "trade.updateSettings",
  trade_list_offers: "trade.listOffers",
  trade_upsert_offer: "trade.upsertOffer",
  trade_delete_offer: "trade.deleteOffer",
  trade_list_lanes: "trade.listLanes",
  trade_upsert_lane: "trade.upsertLane",
  trade_toggle_lane: "trade.toggleLane",
  trade_preview_quote: "trade.previewQuote",
  trade_list_content: "trade.listContent",
  trade_upsert_content: "trade.upsertContent",
  trade_list_enquiries: "trade.listEnquiries",
  trade_update_enquiry: "trade.updateEnquiry",
  trade_convert_enquiry: "trade.convertEnquiryToQuote",
  trade_list_pilots: "trade.listPilots",
  trade_upsert_pilot: "trade.upsertPilot",
  trade_list_orders: "trade.listOrders",
  trade_reconcile_order: "trade.reconcileOrder",
};

export const TRADE_TOOL_DEFINITIONS = [
  {
    name: "trade.getOverview",
    description:
      "Read TeaFloww Trade (/tea-shops) settings, public offers, active lanes, funnel summary, and queue counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: {
      title: "Get Trade Overview",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => ({
      settings: getTradeSettings(),
      publicProducts: listPublicTradeProducts(),
      offers: listAllTradeOffersAdmin(),
      lanes: listTradeLanes(false),
      funnelSummary: getTradeFunnelSummary(),
    }),
  },
  {
    name: "trade.updateSettings",
    description:
      "Update TeaFloww Trade channel settings (enabled flag, locales, featured_trial_id, trial_parcel_rate_paise, trial_credit_*, whatsapp_number, support_hours, dispatch_cutoff_label, media URLs).",
    inputSchema: {
      type: "object",
      properties: {
        channel_enabled: { type: "boolean" },
        enabled_locales: { type: "array", items: { type: "string" } },
        staged_locales: { type: "array", items: { type: "string" } },
        featured_trial_id: { type: ["string", "null"] },
        trial_parcel_rate_paise: { type: "integer" },
        trial_credit_paise: { type: "integer" },
        trial_credit_min_qty_kg: { type: "integer" },
        trial_credit_expiry_days: { type: "integer" },
        whatsapp_number: { type: "string" },
        support_hours: { type: "string" },
        dispatch_cutoff_label: { type: "string" },
        hero_image_url: { type: "string" },
        hero_video_url: { type: ["string", "null"] },
        hero_video_poster_url: { type: ["string", "null"] },
        trial_image_url: { type: "string" },
      },
    },
    annotations: {
      title: "Update Trade Settings",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      settings: updateTradeSettings((args ?? {}) as Record<string, unknown>),
    }),
  },
  {
    name: "trade.listOffers",
    description: "List all trade channel product assignments and eligible variants.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: {
      title: "List Trade Offers",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => ({ offers: listAllTradeOffersAdmin() }),
  },
  {
    name: "trade.upsertOffer",
    description: "Assign or update a product in the TeaFloww Trade (/tea-shops) channel.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "integer" },
        featured_order: { type: "integer" },
        eligible_variant_ids: { type: "array", items: { type: "integer" } },
        default_variant_id: { type: ["integer", "null"] },
        starts_at: { type: ["string", "null"] },
        ends_at: { type: ["string", "null"] },
        published: { type: "boolean" },
        badge_text: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
      required: ["product_id"],
    },
    annotations: {
      title: "Upsert Trade Offer",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      offer: upsertTradeOffer((args ?? {}) as Record<string, unknown>),
    }),
  },
  {
    name: "trade.deleteOffer",
    description: "Remove a product assignment from the trade channel.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "integer" } },
      required: ["product_id"],
    },
    annotations: {
      title: "Delete Trade Offer",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      deleted: deleteTradeOffer(Number(((args ?? {}) as Record<string, unknown>).product_id)),
    }),
  },
  {
    name: "trade.listLanes",
    description: "List all versioned packaging and freight lanes for TeaFloww Trade.",
    inputSchema: {
      type: "object",
      properties: { active_only: { type: "boolean" } },
    },
    annotations: {
      title: "List Trade Lanes",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      lanes: listTradeLanes(Boolean(((args ?? {}) as Record<string, unknown>).active_only)),
    }),
  },
  {
    name: "trade.upsertLane",
    description:
      "Create a new versioned packaging/freight lane or update an existing lane (PIN range, depot, dimensional divisor, tare, fees, COD/advance rules).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        lane_code: { type: "string" },
        version: { type: "integer" },
        is_active: { type: "boolean" },
        origin_pin: { type: "string" },
        pin_start: { type: "string" },
        pin_end: { type: "string" },
        service_code: { type: "string" },
        service_label: { type: "string" },
        handover_kind: { type: "string", enum: ["doorstep", "depot"] },
        locality_label: { type: "string" },
        depot_name: { type: ["string", "null"] },
        depot_address: { type: ["string", "null"] },
        onward_included: { type: "boolean" },
        billed_weight_rule: { type: "string", enum: ["gross", "max_gross_dim"] },
        dim_divisor: { type: "integer" },
        billing_increment_grams: { type: "integer" },
        tare_grams: { type: "integer" },
        box_length_cm: { type: "integer" },
        box_width_cm: { type: "integer" },
        box_height_cm: { type: "integer" },
        max_net_grams: { type: "integer" },
        max_billed_grams: { type: "integer" },
        base_freight_paise: { type: "integer" },
        per_kg_freight_paise: { type: "integer" },
        last_mile_paise: { type: "integer" },
        extra_tax_bps: { type: "integer" },
        other_fees_paise: { type: "integer" },
        cod_allowed: { type: "boolean" },
        cod_fee_paise: { type: "integer" },
        cod_max_total_paise: { type: ["integer", "null"] },
        freight_advance_allowed: { type: "boolean" },
        eta_label: { type: "string" },
        operator_name: { type: ["string", "null"] },
      },
      required: [
        "lane_code",
        "pin_start",
        "pin_end",
        "service_code",
        "service_label",
        "handover_kind",
      ],
    },
    annotations: {
      title: "Upsert Trade Lane",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    run: (args: unknown) => ({
      lane: upsertTradeLane((args ?? {}) as Record<string, unknown>),
    }),
  },
  {
    name: "trade.toggleLane",
    description: "Enable or pause a trade lane by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        is_active: { type: "boolean" },
      },
      required: ["id", "is_active"],
    },
    annotations: {
      title: "Toggle Trade Lane",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return { ok: setTradeLaneActive(String(a.id), Boolean(a.is_active)) };
    },
  },
  {
    name: "trade.previewQuote",
    description: "Run the server trade quote engine for a destination PIN and lines or trial.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", enum: ["trade"] },
        quoteType: { type: "string", enum: ["bulk", "trial"] },
        locale: { type: "string" },
        destinationPin: { type: "string" },
        lines: { type: "array", items: { type: "object" } },
        trialId: { type: "string" },
        quantity: { type: "integer" },
        payment: { type: "string", enum: ["prepaid", "cod", "freight_advance"] },
      },
      required: ["locale", "destinationPin"],
    },
    annotations: {
      title: "Preview Trade Quote",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    run: (args: unknown) =>
      createTradeQuote({ channel: "trade", ...((args ?? {}) as Record<string, unknown>) }, "mcp_preview_session"),
  },
  {
    name: "trade.listContent",
    description: "List localized trade copy, recordings, transcripts, and review status.",
    inputSchema: {
      type: "object",
      properties: { locale: { type: "string" } },
    },
    annotations: {
      title: "List Trade Content",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return {
        items: listLocalizedContent(typeof a.locale === "string" ? a.locale : undefined),
      };
    },
  },
  {
    name: "trade.upsertContent",
    description:
      "Create or update localized copy, audio recording URL, transcript, or review status for a trade resource key.",
    inputSchema: {
      type: "object",
      properties: {
        resource_key: { type: "string" },
        locale: { type: "string" },
        source_revision: { type: "integer" },
        text_value: { type: "string" },
        audio_url: { type: ["string", "null"] },
        transcript: { type: ["string", "null"] },
        review_status: { type: "string", enum: ["draft", "reviewed", "needs_review"] },
        updated_by: { type: ["string", "null"] },
      },
      required: ["resource_key", "locale", "text_value"],
    },
    annotations: {
      title: "Upsert Trade Content",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      item: upsertLocalizedContent(args ?? {}),
    }),
  },
  {
    name: "trade.listEnquiries",
    description: "List assisted trade enquiries and callback requests.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" } },
    },
    annotations: {
      title: "List Trade Enquiries",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return {
        enquiries: listTradeEnquiries(typeof a.status === "string" ? a.status : undefined),
      };
    },
  },
  {
    name: "trade.updateEnquiry",
    description: "Update enquiry status, assigned owner, or operator notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["new", "assigned", "quoted", "closed"] },
        assigned_owner: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        converted_quote_id: { type: ["string", "null"] },
      },
      required: ["id"],
    },
    annotations: {
      title: "Update Trade Enquiry",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      enquiry: updateTradeEnquiry(args ?? {}),
    }),
  },
  {
    name: "trade.convertEnquiryToQuote",
    description:
      "Convert a manual enquiry into an expiring confirmed trade quote without re-entering the basket.",
    inputSchema: {
      type: "object",
      properties: {
        enquiryId: { type: "string" },
        quoteRequest: { type: "object" },
        assignedOwner: { type: "string" },
      },
      required: ["enquiryId", "quoteRequest"],
    },
    annotations: {
      title: "Convert Trade Enquiry to Quote",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    run: (args: unknown) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const enquiryId = String(a.enquiryId || "");
      const quote = createTradeQuote(
        { channel: "trade", ...((a.quoteRequest ?? {}) as Record<string, unknown>) },
        `op_${enquiryId}`
      );
      if (quote.kind !== "confirmed") {
        return { ok: false, quote };
      }
      const enquiry = updateTradeEnquiry({
        id: enquiryId,
        status: "quoted",
        assigned_owner:
          typeof a.assignedOwner === "string" ? a.assignedOwner : undefined,
        converted_quote_id: quote.id,
      });
      return { ok: true, enquiry, quote };
    },
  },
  {
    name: "trade.listPilots",
    description: "List P2 shared-load town supply pilots.",
    inputSchema: {
      type: "object",
      properties: { active_only: { type: "boolean" } },
    },
    annotations: {
      title: "List Trade Pilots",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      pilots: listTradeSharedPilots(Boolean(((args ?? {}) as Record<string, unknown>).active_only)),
    }),
  },
  {
    name: "trade.upsertPilot",
    description: "Create or update a P2 shared-load town supply pilot.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        town_name: { type: "string" },
        pin_prefix: { type: "string" },
        collection_point: { type: "string" },
        collection_address: { type: "string" },
        local_fee_paise: { type: "integer" },
        cutoff_at: { type: "string" },
        dispatch_partner: { type: "string" },
        dispatch_schedule: { type: "string" },
        target_kg: { type: "integer" },
        booked_kg: { type: "integer" },
        status: { type: "string", enum: ["active", "paused", "dispatched", "cancelled"] },
      },
      required: [
        "town_name",
        "pin_prefix",
        "collection_point",
        "collection_address",
        "cutoff_at",
        "dispatch_partner",
        "dispatch_schedule",
      ],
    },
    annotations: {
      title: "Upsert Trade Pilot",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      pilot: upsertTradeSharedPilot(args ?? {}),
    }),
  },
  {
    name: "trade.listOrders",
    description: "List TeaFloww Trade orders with payment split and remittance status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: {
      title: "List Trade Orders",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => ({ orders: listTradeOrdersAdmin() }),
  },
  {
    name: "trade.reconcileOrder",
    description: "Reconcile a trade order's COD/balance remittance and dispatch status.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        remittance_status: { type: "string", enum: ["none", "pending", "remitted"] },
        remitted_paise: { type: "integer" },
        dispatch_status: { type: "string" },
      },
      required: ["order_id"],
    },
    annotations: {
      title: "Reconcile Trade Order",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      order: reconcileTradeOrder(args ?? {}),
    }),
  },
];
