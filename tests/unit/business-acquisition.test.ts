import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { resetRateLimits } from "@/lib/rateLimit";
import { businessLeadSchema } from "@/lib/business/schema";
import { collectAttribution } from "@/lib/business/attribution";
import { sanitizeBusinessEventProperties } from "@/lib/business/events";
import { buildWhatsAppLink } from "@/lib/business/whatsapp";
import { dispatchToolCall, listToolDefinitions } from "@/lib/mcp";
import { POST as postBusinessLead } from "@/app/api/business-leads/route";
import { GET as getPublicOffers } from "@/app/api/business/offers/route";
import { GET as getPublicContent } from "@/app/api/business/content/route";

const VALID_ORIGIN = "https://teafloww.com";

function makeLeadRequest(
  body: unknown,
  opts: {
    origin?: string;
    contentType?: string;
    idempotencyKey?: string;
    contentLength?: string;
  } = {}
) {
  const headers = new Headers();
  if (opts.origin !== undefined) headers.set("origin", opts.origin);
  else headers.set("origin", VALID_ORIGIN);

  if (opts.contentType !== undefined) headers.set("content-type", opts.contentType);
  else headers.set("content-type", "application/json");

  if (opts.idempotencyKey !== undefined) headers.set("idempotency-key", opts.idempotencyKey);
  else headers.set("idempotency-key", randomUUID());

  if (opts.contentLength) headers.set("content-length", opts.contentLength);

  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  return new NextRequest("https://teafloww.com/api/business-leads", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

const BASE_PAYLOAD = {
  segment: "starter",
  interest: "bulk_supply",
  quantityBand: "unsure",
  pincode: "734001",
  name: "Aarav Sharma",
  phone: "9876543210",
  contactConsent: true,
  marketingConsent: false,
  locale: "en",
  attribution: {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "tfw_b2b_tea_business_starter_2026",
  },
};

describe("TeaFloww B2B Business Acquisition", () => {
  beforeEach(() => {
    process.env.SITE_ORIGIN = VALID_ORIGIN;
    resetRateLimits();
    const db = getDb();
    db.prepare("DELETE FROM b2b_quotes").run();
    db.prepare("DELETE FROM b2b_lead_events").run();
    db.prepare("DELETE FROM b2b_leads").run();
    db.prepare("DELETE FROM b2b_integration_outbox").run();
    db.prepare("UPDATE b2b_settings SET leads_enabled = 1, business_landing_enabled = 1 WHERE id = 'default'").run();
  });

  describe("Schema, Attribution, Events & WhatsApp", () => {
    it("accepts valid starter and trader payloads and normalizes +91 phone", () => {
      const res = businessLeadSchema.safeParse({
        ...BASE_PAYLOAD,
        segment: "trader",
        phone: "+91 98765 43210",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.phone).toBe("9876543210");
      }
    });

    it("rejects invalid pincode, malformed phone, missing consent, and unknown keys", () => {
      expect(businessLeadSchema.safeParse({ ...BASE_PAYLOAD, pincode: "123" }).success).toBe(false);
      expect(businessLeadSchema.safeParse({ ...BASE_PAYLOAD, phone: "12345" }).success).toBe(false);
      expect(businessLeadSchema.safeParse({ ...BASE_PAYLOAD, contactConsent: false }).success).toBe(false);
      expect(businessLeadSchema.safeParse({ ...BASE_PAYLOAD, extraField: "hack" }).success).toBe(false);
    });

    it("allowlists only safe attribution parameters", () => {
      const attr = collectAttribution(
        "?utm_source=meta&utm_campaign=b2b&gclid=abc123&phone=9999999999&name=Leak"
      );
      expect(attr).toEqual({
        utm_source: "meta",
        utm_campaign: "b2b",
        gclid: "abc123",
      });
      expect((attr as Record<string, unknown>).phone).toBeUndefined();
      expect((attr as Record<string, unknown>).name).toBeUndefined();
    });

    it("strips PII keys from analytics event properties", () => {
      const clean = sanitizeBusinessEventProperties({
        segment: "starter",
        interest: "bulk_supply",
        phone: "9876543210",
        pincode: "734001",
        name: "Aarav",
      });
      expect(clean).toEqual({ segment: "starter", interest: "bulk_supply" });
    });

    it("builds safe WhatsApp deep link without embedding customer PII", () => {
      const url = buildWhatsAppLink("917001304853", {
        segment: "starter",
        interest: "private_label",
        reference: "TFB-20261117-ABC123",
        locale: "en",
      });
      expect(url).toContain("https://wa.me/917001304853?text=");
      expect(url).toContain("TFB-20261117-ABC123");
      expect(url).not.toContain("9876543210");
      expect(buildWhatsAppLink(null, { segment: "starter", interest: "unsure" })).toBeNull();
    });
  });

  describe("POST /api/business-leads API Contract", () => {
    it("creates lead + outbox transactionally (201), replays idempotently (200), and rejects changed payload (409)", async () => {
      const key = randomUUID();
      const res1 = await postBusinessLead(makeLeadRequest(BASE_PAYLOAD, { idempotencyKey: key }));
      expect(res1.status).toBe(201);
      const body1 = (await res1.json()) as { reference: string };
      expect(body1.reference).toMatch(/^TFB-/);

      const res2 = await postBusinessLead(makeLeadRequest(BASE_PAYLOAD, { idempotencyKey: key }));
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as { reference: string };
      expect(body2.reference).toBe(body1.reference);

      const res3 = await postBusinessLead(
        makeLeadRequest({ ...BASE_PAYLOAD, pincode: "700001" }, { idempotencyKey: key })
      );
      expect(res3.status).toBe(409);

      const db = getDb();
      const leadCount = (db.prepare("SELECT COUNT(*) AS c FROM b2b_leads").get() as { c: number }).c;
      const outboxCount = (
        db.prepare("SELECT COUNT(*) AS c FROM b2b_integration_outbox").get() as { c: number }
      ).c;
      expect(leadCount).toBe(1);
      expect(outboxCount).toBe(1);
    });

    it("enforces origin, content-type, payload size, honeypot, and validation", async () => {
      const wrongOrigin = await postBusinessLead(
        makeLeadRequest(BASE_PAYLOAD, { origin: "https://evil.example" })
      );
      expect(wrongOrigin.status).toBe(403);

      const wrongCt = await postBusinessLead(
        makeLeadRequest(BASE_PAYLOAD, { contentType: "text/plain" })
      );
      expect(wrongCt.status).toBe(415);

      const oversized = await postBusinessLead(
        makeLeadRequest({ ...BASE_PAYLOAD, note: "x".repeat(9000) })
      );
      expect(oversized.status).toBe(413);

      const honeypot = await postBusinessLead(
        makeLeadRequest({ ...BASE_PAYLOAD, honeypot: "http://spam.bot" })
      );
      expect(honeypot.status).toBe(400);

      const invalid = await postBusinessLead(
        makeLeadRequest({ ...BASE_PAYLOAD, pincode: "12345" })
      );
      expect(invalid.status).toBe(422);

      const db = getDb();
      const leadCount = (db.prepare("SELECT COUNT(*) AS c FROM b2b_leads").get() as { c: number }).c;
      expect(leadCount).toBe(0);
    });
  });

  describe("Public Content/Offers API & MCP Full Parity", () => {
    it("exposes all business.* MCP tools and updates data reflected in public APIs", async () => {
      const toolNames = listToolDefinitions().map((t) => t.name);
      expect(toolNames).toContain("business.getOverview");
      expect(toolNames).toContain("business.updateSettings");
      expect(toolNames).toContain("business.upsertOffer");
      expect(toolNames).toContain("business.upsertContent");
      expect(toolNames).toContain("business.upsertClaim");
      expect(toolNames).toContain("business.listLeads");
      expect(toolNames).toContain("business.transitionLead");
      expect(toolNames).toContain("business.createQuote");

      dispatchToolCall("business.updateSettings", {
        support_hours: "Mon-Sat 10:00 AM - 6:00 PM IST",
      });

      const contentRes = await getPublicContent(
        new NextRequest("https://teafloww.com/api/business/content?segment=starter&lang=hi")
      );
      expect(contentRes.status).toBe(200);
      const contentJson = (await contentRes.json()) as {
        supportHours: string;
        offers: Array<{ code: string }>;
        pageContent: { headline: string };
      };
      expect(contentJson.supportHours).toBe("Mon-Sat 10:00 AM - 6:00 PM IST");
      expect(contentJson.offers).toHaveLength(3);
      expect(contentJson.pageContent.headline).toContain("चाय");

      const offersRes = await getPublicOffers(
        new NextRequest("https://teafloww.com/api/business/offers?lang=en")
      );
      expect(offersRes.status).toBe(200);
      const offersJson = (await offersRes.json()) as { offers: Array<{ code: string }> };
      expect(offersJson.offers.map((o) => o.code)).toEqual([
        "bulk_supply",
        "ready_retail",
        "private_label",
      ]);
    });

    it("manages full CRM lead lifecycle and versioned quotes via MCP", async () => {
      const leadRes = await postBusinessLead(makeLeadRequest({ ...BASE_PAYLOAD, segment: "trader" }));
      expect(leadRes.status).toBe(201);
      const { reference } = (await leadRes.json()) as { reference: string };

      const contacted = dispatchToolCall("business.transitionLead", {
        id_or_reference: reference,
        status: "contact_attempted",
        owner_id: "sales_rep_1",
      }) as { lead: { status: string } };
      expect(contacted.lead.status).toBe("contact_attempted");

      const qualified = dispatchToolCall("business.transitionLead", {
        id_or_reference: reference,
        status: "qualified",
      }) as { lead: { status: string } };
      expect(qualified.lead.status).toBe("qualified");

      const detail = dispatchToolCall("business.getLead", {
        id_or_reference: reference,
      }) as { lead: { id: string } };

      const quoted = dispatchToolCall("business.createQuote", {
        lead_id: detail.lead.id,
        line_items: [
          {
            description: "Assam CTC BP 25kg Sack",
            format: "25kg sack",
            quantity_label: "100 kg",
            unit_price_paise: 2600000,
            line_total_paise: 2600000,
          },
        ],
        freight_paise: 150000,
        tax_paise: 137500,
        freight_terms: "Surface carrier to Siliguri/destination",
        mark_sent: true,
      }) as { quote: { quote_number: string; total_paise: number } };
      expect(quoted.quote.total_paise).toBe(2887500);

      const won = dispatchToolCall("business.transitionLead", {
        id_or_reference: reference,
        status: "won",
        first_order_id: "ORD-B2B-1001",
      }) as { lead: { status: string; first_order_id: string } };
      expect(won.lead.status).toBe("won");
      expect(won.lead.first_order_id).toBe("ORD-B2B-1001");

      const outbox = dispatchToolCall("business.listOutbox", {}) as {
        outbox: Array<{ topic: string }>;
      };
      const topics = outbox.outbox.map((o) => o.topic);
      expect(topics).toContain("crm.business_lead.created");
      expect(topics).toContain("conversion.qualified_business_lead");
      expect(topics).toContain("conversion.first_b2b_paid_order");
    });
  });
});
