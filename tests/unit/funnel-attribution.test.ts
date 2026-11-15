import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeTouchWithClickInference, resolveFunnelNameFromPath } from "@/lib/funnel/types";
import {
  extractAttributionFromRequest,
  getEntityAttribution,
  recordConversationEvent,
  recordEntityAttribution,
  upsertVisitorSession,
} from "@/lib/funnel/server";
import {
  exportRemarketingCsv,
  getFunnelAnalytics,
  queryRemarketingAudience,
} from "@/lib/funnel/analytics";
import { buildMetaFunnelEventPayload, sendMetaServerFunnelEvent } from "@/lib/seo/metaCapi";
import { captureLead } from "@/lib/leads";
import { recordContactInquiry } from "@/lib/contact";
import { recordWholesaleInquiry } from "@/lib/wholesale";
import { saveNewsletterPreference } from "@/lib/newsletter";
import { GET as getAdminFunnelRoute } from "@/app/api/admin/funnel/route";
import {
  GET as getAudiencesRoute,
  POST as postAudiencesRoute,
} from "@/app/api/admin/funnel/audiences/route";

function reqWithCookiesAndUrl(
  url: string,
  cookieMap: Record<string, string> = {},
  headers: Record<string, string> = {}
) {
  const cookieHeader = Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new Request(url, {
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...headers,
    },
  });
}

describe("Funnel, UTM Attribution & Remarketing Engine", () => {
  it("normalizes click IDs to source/medium when explicit UTMs are omitted", () => {
    const g = normalizeTouchWithClickInference({ gclid: "GCLID_XYZ" });
    expect(g.utm_source).toBe("google");
    expect(g.utm_medium).toBe("cpc");

    const f = normalizeTouchWithClickInference({ fbclid: "FBCLID_ABC" });
    expect(f.utm_source).toBe("meta");
    expect(f.utm_medium).toBe("paid_social");

    const explicit = normalizeTouchWithClickInference({
      utm_source: "youtube",
      utm_medium: "video",
      gclid: "GCLID_XYZ",
    });
    expect(explicit.utm_source).toBe("youtube");
    expect(explicit.utm_medium).toBe("video");

    expect(resolveFunnelNameFromPath("/wholesale")).toBe("wholesale_b2b");
    expect(resolveFunnelNameFromPath("/private-label")).toBe("private_label");
    expect(resolveFunnelNameFromPath("/trials")).toBe("trials");
    expect(resolveFunnelNameFromPath("/blend-lab")).toBe("blend_lab");
    expect(resolveFunnelNameFromPath("/subscriptions")).toBe("subscriptions");
    expect(resolveFunnelNameFromPath("/shop/darjeeling-first-flush")).toBe("retail_storefront");
  });

  it("preserves immutable First-Touch while updating Last-Touch and advancing funnel stage", () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionId = `sess_ft_${suffix}`;
    const email = `buyer_${suffix}@example.com`;

    const firstTouch = normalizeTouchWithClickInference({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: `first_camp_${suffix}`,
      utm_term: "darjeeling first flush",
      utm_content: "headline_a",
      gclid: "g_111",
      landing_page: "/shop?utm_source=google",
    });

    upsertVisitorSession({
      sessionId,
      funnelName: "retail_storefront",
      funnelStage: "visit",
      firstTouch,
      lastTouch: firstTouch,
    });

    // Second touch from Meta remarketing
    upsertVisitorSession({
      sessionId,
      funnelName: "retail_storefront",
      funnelStage: "add_to_cart",
      customerEmail: email,
      customerName: "Ananya Sharma",
      customerPhone: "9832011223",
      lastTouch: normalizeTouchWithClickInference({
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: `retarget_camp_${suffix}`,
        utm_term: "retargeting_carousel",
        utm_content: "video_2",
        fbclid: "fb_222",
        landing_page: "/cart",
      }),
    });

    // Attribution stitching by email even without cookies
    recordEntityAttribution({
      entityType: "order",
      entityId: `ord_${suffix}`,
      funnelName: "retail_storefront",
      funnelStage: "order_paid",
      customerEmail: email,
      convertedOrderId: `ord_${suffix}`,
      convertedRevenuePaise: 249900,
    });

    const firstAnalytics = getFunnelAnalytics({
      period: "7d",
      touch: "first",
      dimension: "campaign",
      utmCampaign: `first_camp_${suffix}`,
    });
    expect(firstAnalytics.kpis.totalSessions).toBe(1);
    expect(firstAnalytics.kpis.paidOrders).toBe(1);
    expect(firstAnalytics.kpis.paidRevenuePaise).toBe(249900);
    expect(firstAnalytics.breakdown[0]?.primaryKey).toBe(`first_camp_${suffix}`);

    const lastAnalytics = getFunnelAnalytics({
      period: "7d",
      touch: "last",
      dimension: "keyword",
      utmCampaign: `retarget_camp_${suffix}`,
    });
    expect(lastAnalytics.kpis.totalSessions).toBe(1);
    expect(lastAnalytics.breakdown[0]?.primaryKey).toBe("retargeting_carousel");
    expect(lastAnalytics.kpis.paidOrders).toBe(1);
  });

  it("extracts request UTMs/cookies cleanly and stitches leads, forms, newsletters, and conversations", () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionId = `sess_req_${suffix}`;
    const camp = `b2b_kw_camp_${suffix}`;
    const term = `bulk assam tea ${suffix}`;

    const bundle = {
      sessionId,
      funnelName: "wholesale_b2b",
      marketingConsent: true,
      analyticsConsent: true,
      firstTouch: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: camp,
        utm_term: term,
        utm_content: "b2b_text_ad",
        gclid: `g_${suffix}`,
        landing_page: `/wholesale?utm_campaign=${camp}`,
      },
      lastTouch: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: camp,
        utm_term: term,
        utm_content: "b2b_text_ad",
        gclid: `g_${suffix}`,
        landing_page: `/wholesale?utm_campaign=${camp}`,
      },
    };

    const req = reqWithCookiesAndUrl("https://teafloww.com/wholesale", {
      tf_sid: encodeURIComponent(sessionId),
      tf_attr: encodeURIComponent(JSON.stringify(bundle)),
    });

    const extracted = extractAttributionFromRequest(req, null, "/wholesale");
    expect(extracted.sessionId).toBe(sessionId);
    expect(extracted.lastTouch.utm_campaign).toBe(camp);
    expect(extracted.lastTouch.utm_term).toBe(term);

    const lead = captureLead({
      sessionId,
      phoneNumber: "+91 9832000111",
      customerName: "=CmdTest",
      source: "cart_incentive",
      resolvedAttribution: extracted,
    });
    expect(lead.leadId).toBeGreaterThan(0);

    const contact = recordContactInquiry(
      {
        name: "Rohan Verma",
        email: `rohan_${suffix}@example.com`,
        phone: "+91 9832000222",
        topic: "wholesale",
        message: "Looking for 200kg CTC",
      },
      { attribution: extracted }
    );
    expect(contact.id).toBeGreaterThan(0);

    const ws = recordWholesaleInquiry(
      {
        name: "Priya Kapoor",
        business_name: "Jaipur Chai House",
        email: `priya_${suffix}@example.com`,
        phone: "+91 9832000333",
        interest: "Assam CTC",
        estimated_volume: "500kg",
        location: "Jaipur",
      },
      extracted
    );
    expect(ws.id).toBeGreaterThan(0);

    const subEmail = `news_${suffix}@example.com`;
    saveNewsletterPreference(subEmail, "Agree", extracted);

    const conv = recordConversationEvent({
      sessionId,
      channel: "whatsapp_wholesale",
      sourcePage: "/wholesale",
      customerName: "Priya Kapoor",
      customerEmail: `priya_${suffix}@example.com`,
      customerPhone: "+91 9832000333",
      messagePreview: "Clicked WhatsApp from wholesale form",
      attribution: extracted,
    });
    expect(conv.id).toBeTruthy();

    const storedWsAttr = getEntityAttribution("bulk_order", `wholesale:${ws.id}`);
    expect(storedWsAttr?.utm_campaign).toBe(camp);
    expect(storedWsAttr?.utm_term).toBe(term);

    const storedNewsAttr = getEntityAttribution("newsletter", subEmail);
    expect(storedNewsAttr?.utm_source).toBe("google");

    // Verify B2B remarketing segment includes unconverted prospect and escapes formula characters in CSV
    const leadsAudience = queryRemarketingAudience({
      segment: "leads_unconverted",
      period: "7d",
      utmCampaign: camp,
    });
    expect(leadsAudience.records.some((r) => r.email === `priya_${suffix}@example.com`)).toBe(true);

    const metaCsv = exportRemarketingCsv(
      { segment: "leads_unconverted", period: "7d", utmCampaign: camp },
      "meta_hashed"
    );
    const expectedPriyaHash = createHash("sha256")
      .update(`priya_${suffix}@example.com`)
      .digest("hex");
    expect(metaCsv.csv).toContain(expectedPriyaHash);

    const plainCsv = exportRemarketingCsv(
      { segment: "leads_unconverted", period: "7d", utmCampaign: camp },
      "crm_plain"
    );
    // Formula injection neutralization ('=CmdTest)
    expect(plainCsv.csv).toContain("'=CmdTest");
    expect(plainCsv.csv).toContain(term);
  });

  it("enforces Meta CAPI marketing consent gate and attaches UTM/funnel custom_data", async () => {
    const blocked = await sendMetaServerFunnelEvent({
      eventName: "Lead",
      eventId: `test_lead_${Date.now()}`,
      marketingConsent: false,
      user: { email: "test@example.com" },
    });
    expect(blocked).toEqual({ sent: false, reason: "no_marketing_consent" });

    const payload = buildMetaFunnelEventPayload({
      eventName: "Lead",
      eventId: "lead_123",
      user: { email: "Ananya@Example.com", phone: "9832012345", name: "Ananya Rai" },
      attribution: {
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "darjeeling_spring",
        utmTerm: "first flush darjeeling",
        utmContent: "responsive_ad_1",
        funnelName: "retail_storefront",
      },
      customData: { content_name: "wholesale_inquiry" },
    });

    const ev = (payload.data as Array<Record<string, unknown>>)[0];
    expect(ev.event_name).toBe("Lead");
    expect(ev.event_id).toBe("lead_123");
    const custom = ev.custom_data as Record<string, unknown>;
    expect(custom.utm_source).toBe("google");
    expect(custom.utm_campaign).toBe("darjeeling_spring");
    expect(custom.utm_term).toBe("first flush darjeeling");
    expect(custom.funnel_name).toBe("retail_storefront");
  });

  it("rejects unauthenticated requests to admin funnel and audience APIs with 401", async () => {
    const res1 = await getAdminFunnelRoute(new Request("http://localhost:3000/api/admin/funnel"));
    expect(res1.status).toBe(401);

    const res2 = await getAudiencesRoute(new Request("http://localhost:3000/api/admin/funnel/audiences"));
    expect(res2.status).toBe(401);

    const res3 = await postAudiencesRoute(
      new Request("http://localhost:3000/api/admin/funnel/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: "leads_unconverted", format: "meta_hashed" }),
      })
    );
    expect(res3.status).toBe(401);
  });
});
