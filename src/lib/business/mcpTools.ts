import { getTraderPresentation, getTraderCatalogue, saveTraderPresentation } from "./traderRepository";
import {
  createB2BQuote,
  getAdminB2BLeadDetail,
  getB2BFunnelSummary,
  getB2BSettings,
  listAdminB2BClaims,
  listAdminB2BLeads,
  listAdminB2BOffers,
  listAdminB2BPageContent,
  listB2BOutbox,
  retryB2BOutboxItem,
  transitionB2BLeadStatus,
  updateB2BSettings,
  upsertB2BClaim,
  upsertB2BOffer,
  upsertB2BPageContent,
} from "./repository";
import type { BusinessLeadStatus, Segment } from "./schema";

export const BUSINESS_TOOL_ALIASES: Record<string, string> = {
  business_get_traders_page: "business.getTradersPage",
  business_save_traders_page: "business.saveTradersPage",
  business_get_overview: "business.getOverview",
  business_update_settings: "business.updateSettings",
  business_list_offers: "business.listOffers",
  business_upsert_offer: "business.upsertOffer",
  business_list_content: "business.listContent",
  business_upsert_content: "business.upsertContent",
  business_list_claims: "business.listClaims",
  business_upsert_claim: "business.upsertClaim",
  business_list_leads: "business.listLeads",
  business_get_lead: "business.getLead",
  business_transition_lead: "business.transitionLead",
  business_create_quote: "business.createQuote",
  business_list_outbox: "business.listOutbox",
  business_retry_outbox: "business.retryOutbox",
};

export const BUSINESS_TOOL_DEFINITIONS = [
  {
    name: "business.getTradersPage",
    description: "Read /tea-traders editable copy, ordered hero slides, selected products and live catalogue images. Empty slide/product arrays use the catalogue automatically. Translations use resource tea-traders.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { title: "Read Tea Traders page", readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    run: () => ({ content: getTraderPresentation(), products: getTraderCatalogue().map(p => ({id:p.id,name:p.name,imageUrl:p.primary_image_url || p.primary_image?.url || null})) }),
  },
  {
    name: "business.saveTradersPage",
    description: "Save the complete Tea Traders presentation from business.getTradersPage. Set copy strings, slides [{id,productId,title,body}], productIds in display order, journeyProductId (nullable). Images, prices and stock always resolve from published enabled backend catalogue products. Up to 8 slides and 12 products. Empty arrays select automatically. Edit translations through translations.update/publish resource tea-traders.",
    inputSchema: { type: "object", required: ["content"], properties: { content: { type: "object", required: ["copy","slides","productIds","journeyProductId"], properties: { copy: { type: "object", additionalProperties: { type: "string" } }, slides: { type: "array", maxItems: 8, items: { type: "object", required: ["id","productId","title","body"], properties: { id: {type:"string"}, productId: {type:"integer"}, title: {type:"string"}, body: {type:"string"} }, additionalProperties: false } }, productIds: {type:"array",maxItems:12,items:{type:"integer"}}, journeyProductId: {type:["integer","null"]} }, additionalProperties: false } }, additionalProperties: false },
    annotations: { title: "Save Tea Traders page", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    run: (args: unknown) => ({ content: saveTraderPresentation((args as {content?:unknown})?.content) }),
  },
  {
    name: "business.getOverview",
    description:
      "Read TeaFloww B2B Acquisition (/start-tea-business, /tea-traders) settings, offers, page content, claims, and funnel summary.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: {
      title: "Get B2B Acquisition Overview",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => ({
      settings: getB2BSettings(),
      offers: listAdminB2BOffers(),
      pageContent: listAdminB2BPageContent(),
      claims: listAdminB2BClaims(),
      funnelSummary: getB2BFunnelSummary(),
    }),
  },
  {
    name: "business.updateSettings",
    description:
      "Update TeaFloww B2B Acquisition settings (landing enabled, leads enabled, WhatsApp E.164 & toggle, support hours, hero/proof image URLs, CRM webhook toggle).",
    inputSchema: {
      type: "object",
      properties: {
        business_landing_enabled: { type: "boolean" },
        leads_enabled: { type: "boolean" },
        whatsapp_enabled: { type: "boolean" },
        whatsapp_e164: { type: ["string", "null"] },
        support_hours: { type: "string" },
        starter_hero_image_url: { type: "string" },
        trader_hero_image_url: { type: "string" },
        proof_image_1_url: { type: "string" },
        proof_image_2_url: { type: "string" },
        crm_webhook_enabled: { type: "boolean" },
      },
    },
    annotations: {
      title: "Update B2B Settings",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      settings: updateB2BSettings((args ?? {}) as Record<string, unknown>),
    }),
  },
  {
    name: "business.listOffers",
    description: "List all B2B offers (bulk_supply, ready_retail, private_label) with approval status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: {
      title: "List B2B Offers",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => ({ offers: listAdminB2BOffers() }),
  },
  {
    name: "business.upsertOffer",
    description:
      "Create or update a B2B offer (bulk_supply, ready_retail, private_label) including EN/HI copy, linked SKU IDs, MOQ text, and approval status.",
    inputSchema: {
      type: "object",
      required: [
        "code",
        "eyebrow_en",
        "eyebrow_hi",
        "title_en",
        "title_hi",
        "description_en",
        "description_hi",
        "cta_label_en",
        "cta_label_hi",
      ],
      properties: {
        code: { type: "string", enum: ["bulk_supply", "ready_retail", "private_label"] },
        eyebrow_en: { type: "string" },
        eyebrow_hi: { type: "string" },
        title_en: { type: "string" },
        title_hi: { type: "string" },
        description_en: { type: "string" },
        description_hi: { type: "string" },
        cta_label_en: { type: "string" },
        cta_label_hi: { type: "string" },
        icon: { type: "string", enum: ["package", "shopping-bag", "pen-tool"] },
        image_url: { type: ["string", "null"] },
        image_alt_en: { type: ["string", "null"] },
        image_alt_hi: { type: ["string", "null"] },
        sku_ids: { type: "array", items: { type: "string" } },
        moq_text_en: { type: ["string", "null"] },
        moq_text_hi: { type: ["string", "null"] },
        pricing_mode: { type: "string", enum: ["request_quote", "approved_display_price"] },
        service_scope: { type: "array", items: { type: "string" } },
        active: { type: "boolean" },
        approve: { type: "boolean" },
        sort_order: { type: "integer" },
      },
    },
    annotations: {
      title: "Upsert B2B Offer",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      offer: upsertB2BOffer(args, "mcp"),
    }),
  },
  {
    name: "business.listContent",
    description: "List localized B2B landing page content for starter and trader segments (en, hi).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: {
      title: "List B2B Page Content",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => ({ pageContent: listAdminB2BPageContent() }),
  },
  {
    name: "business.upsertContent",
    description:
      "Update localized B2B landing page content (hero, process steps, proof, form copy, FAQ, SEO) for starter/trader and en/hi.",
    inputSchema: {
      type: "object",
      required: [
        "segment",
        "locale",
        "eyebrow",
        "headline",
        "intro",
        "primary_cta",
        "secondary_cta",
        "hero_image_url",
        "hero_image_alt",
        "process_intro",
        "steps",
        "proof_title",
        "proof_body",
        "form_heading",
        "form_subhead",
        "faq",
        "seo_title",
        "seo_description",
      ],
      properties: {
        segment: { type: "string", enum: ["starter", "trader"] },
        locale: { type: "string", enum: ["en", "hi"] },
        eyebrow: { type: "string" },
        headline: { type: "string" },
        intro: { type: "string" },
        primary_cta: { type: "string" },
        secondary_cta: { type: "string" },
        hero_image_url: { type: "string" },
        hero_image_alt: { type: "string" },
        process_intro: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "body"],
            properties: { title: { type: "string" }, body: { type: "string" } },
          },
        },
        proof_title: { type: "string" },
        proof_body: { type: "string" },
        proof_items: { type: "array", items: { type: "object" } },
        form_heading: { type: "string" },
        form_subhead: { type: "string" },
        faq: {
          type: "array",
          items: {
            type: "object",
            required: ["q", "a"],
            properties: { q: { type: "string" }, a: { type: "string" } },
          },
        },
        seo_title: { type: "string" },
        seo_description: { type: "string" },
        approve: { type: "boolean" },
      },
    },
    annotations: {
      title: "Upsert B2B Page Content",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      content: upsertB2BPageContent(args),
    }),
  },
  {
    name: "business.listClaims",
    description: "List B2B commercial claims and disclosures with evidence ownership.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: {
      title: "List B2B Claims",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => ({ claims: listAdminB2BClaims() }),
  },
  {
    name: "business.upsertClaim",
    description: "Create or update an approved B2B commercial claim/disclosure.",
    inputSchema: {
      type: "object",
      required: [
        "claim_key",
        "exact_copy_en",
        "exact_copy_hi",
        "evidence_source",
        "evidence_owner",
        "allowed_channels",
      ],
      properties: {
        claim_key: { type: "string" },
        exact_copy_en: { type: "string" },
        exact_copy_hi: { type: "string" },
        evidence_source: { type: "string" },
        evidence_owner: { type: "string" },
        allowed_channels: {
          type: "array",
          items: { type: "string", enum: ["web", "meta", "google", "sales"] },
        },
        active: { type: "boolean" },
        approve: { type: "boolean" },
        valid_until: { type: ["string", "null"] },
      },
    },
    annotations: {
      title: "Upsert B2B Claim",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => ({
      claim: upsertB2BClaim(args),
    }),
  },
  {
    name: "business.listLeads",
    description: "List inbound B2B leads with optional segment and status filters.",
    inputSchema: {
      type: "object",
      properties: {
        segment: { type: "string", enum: ["starter", "trader"] },
        status: {
          type: "string",
          enum: ["new", "contact_attempted", "qualified", "disqualified", "quote_sent", "won", "lost"],
        },
        limit: { type: "integer" },
      },
    },
    annotations: {
      title: "List B2B Leads",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const filter = (args ?? {}) as { segment?: Segment; status?: BusinessLeadStatus; limit?: number };
      return { leads: listAdminB2BLeads(filter) };
    },
  },
  {
    name: "business.getLead",
    description: "Get full B2B lead detail including audit events and versioned quotes by ID or reference.",
    inputSchema: {
      type: "object",
      required: ["id_or_reference"],
      properties: {
        id_or_reference: { type: "string" },
      },
    },
    annotations: {
      title: "Get B2B Lead Detail",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const { id_or_reference } = (args ?? {}) as { id_or_reference: string };
      return getAdminB2BLeadDetail(id_or_reference);
    },
  },
  {
    name: "business.transitionLead",
    description:
      "Transition a B2B lead through the CRM lifecycle (new -> contact_attempted -> qualified -> quote_sent -> won/lost).",
    inputSchema: {
      type: "object",
      required: ["id_or_reference", "status"],
      properties: {
        id_or_reference: { type: "string" },
        status: {
          type: "string",
          enum: ["new", "contact_attempted", "qualified", "disqualified", "quote_sent", "won", "lost"],
        },
        qualification_reason: { type: ["string", "null"] },
        owner_id: { type: ["string", "null"] },
        quoted_amount_paise: { type: ["integer", "null"] },
        first_order_id: { type: ["string", "null"] },
        note: { type: "string" },
        request_deletion: { type: "boolean" },
      },
    },
    annotations: {
      title: "Transition B2B Lead",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    run: (args: unknown) => {
      const { id_or_reference, ...rest } = (args ?? {}) as { id_or_reference: string };
      return { lead: transitionB2BLeadStatus(id_or_reference, rest, "mcp") };
    },
  },
  {
    name: "business.createQuote",
    description: "Create a versioned commercial quotation for a B2B lead.",
    inputSchema: {
      type: "object",
      required: ["lead_id", "line_items", "freight_terms"],
      properties: {
        lead_id: { type: "string" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            required: ["description", "format", "quantity_label", "unit_price_paise", "line_total_paise"],
            properties: {
              description: { type: "string" },
              format: { type: "string" },
              quantity_label: { type: "string" },
              unit_price_paise: { type: "integer" },
              line_total_paise: { type: "integer" },
            },
          },
        },
        freight_paise: { type: "integer" },
        tax_paise: { type: "integer" },
        freight_terms: { type: "string" },
        valid_until: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        mark_sent: { type: "boolean" },
      },
    },
    annotations: {
      title: "Create B2B Quote",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    run: (args: unknown) => ({
      quote: createB2BQuote(args, "mcp"),
    }),
  },
  {
    name: "business.listOutbox",
    description: "List CRM integration outbox events for B2B leads and conversions.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "processing", "done", "dead_letter"] },
      },
    },
    annotations: {
      title: "List B2B Outbox",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const { status } = (args ?? {}) as { status?: "pending" | "processing" | "done" | "dead_letter" };
      return { outbox: listB2BOutbox(status) };
    },
  },
  {
    name: "business.retryOutbox",
    description: "Requeue a failed/dead-letter B2B outbox item back to pending.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
    annotations: {
      title: "Retry B2B Outbox Item",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const { id } = (args ?? {}) as { id: string };
      return { item: retryB2BOutboxItem(id) };
    },
  },
];
