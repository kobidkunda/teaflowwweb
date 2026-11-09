import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import ContactPage, { generateMetadata } from "@/app/contact/page";
import { getPageOrDefault } from "@/lib/pages";
import {
  contactInquirySchema,
  recordContactInquiry,
  buildContactWhatsAppUrl,
  getContactInquiries,
} from "@/lib/contact";
import { POST } from "@/app/api/contact/route";

describe("/contact Page Design & Content Verification", () => {
  it("generates valid SEO metadata and canonical configuration for /contact", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBeDefined();
    expect(String(metadata.title)).toMatch(/Contact.*(TeaFloww|Tasting Room|Himalayan)/i);
    expect(metadata.description).toBeDefined();
    expect(String(metadata.description)).toContain("Siliguri");
    expect(metadata.alternates?.canonical).toContain("/contact");
  });

  it("retrieves published page record from getPageOrDefault('contact')", () => {
    const page = getPageOrDefault("contact");
    expect(page).toBeDefined();
    expect(page.slug).toBe("contact");
    expect(page.is_published).toBe(1);
  });

  it("renders ContactPage with verified brand, corporate entity, GSTIN, and location details", () => {
    const html = renderToString(React.createElement(ContactPage));

    // Brand and corporate identity from AGENTS.md
    expect(html).toContain("TeaFloww");
    expect(html).toContain("Nirva");
    expect(html).toContain("19CTHPK8646J2ZY"); // GSTIN
    expect(html).toContain("info@teafloww.com");
    expect(html).toContain("7001304853");
    expect(html).toContain("Fulbari Ghoshpukur Bypass");
    expect(html).toContain("Sukantapally East");

    // Semantic JSON-LD schemas
    expect(html).toContain("application/ld+json");
    expect(html).toContain("ContactPage");
    expect(html).toContain("BreadcrumbList");

    // Sections rendered
    expect(html).toContain("The Himalayan Crossroads");
    expect(html).toContain("Visiting &amp; Inquiry Guide");
  });
});

describe("Contact Inquiries Library & Validation", () => {
  it("validates valid input correctly with contactInquirySchema", () => {
    const validData = {
      name: "Tashi Dorji",
      email: "tashi@example.com",
      phone: "+91 98320 12345",
      topic: "brewing",
      message: "Please share recommended steeping ratios for the Darjeeling First Flush.",
    };
    const res = contactInquirySchema.safeParse(validData);
    expect(res.success).toBe(true);
  });

  it("rejects invalid email and overly short message", () => {
    const invalidEmail = {
      name: "Priyanshu",
      email: "not-an-email",
      topic: "general",
      message: "Hello world this is valid length",
    };
    const res1 = contactInquirySchema.safeParse(invalidEmail);
    expect(res1.success).toBe(false);

    const tooShortMessage = {
      name: "Priyanshu",
      email: "valid@example.com",
      topic: "general",
      message: "Hi",
    };
    const res2 = contactInquirySchema.safeParse(tooShortMessage);
    expect(res2.success).toBe(false);
  });

  it("records inquiry into database and generates reference code & WhatsApp link", () => {
    const input = {
      name: "Ananya Roy",
      email: `ananya.${Date.now()}@example.com`,
      phone: "+91 70013 04853",
      topic: "cupping" as const,
      order_id: "TF-ORD-9021",
      message: "Requesting a private tasting room reservation for 2 guests this Saturday morning.",
    };

    const res = recordContactInquiry(input);
    expect(res.id).toBeGreaterThan(0);
    expect(res.referenceCode).toMatch(/^TF-CNT-\d{6}$/);
    expect(res.whatsappUrl).toContain("https://wa.me/917001304853");
    expect(res.whatsappUrl).toContain(encodeURIComponent("Ananya Roy"));

    // Verify retrieval
    const recent = getContactInquiries({ limit: 5 });
    const match = recent.find((r) => r.reference_code === res.referenceCode);
    expect(match).toBeDefined();
    expect(match?.name).toBe("Ananya Roy");
    expect(match?.topic).toBe("cupping");
  });

  it("handles honeypot gracefully without database insertion", () => {
    const botInput = {
      name: "Spam Bot",
      email: "spambot@spam.com",
      topic: "general" as const,
      message: "Spam message buy our crypto service today now",
      honeypot: "http://spamlink.com",
    };

    const res = recordContactInquiry(botInput);
    expect(res.id).toBe(0);
    expect(res.referenceCode).toMatch(/^TF-CNT-\d{6}$/);
  });

  it("properly encodes WhatsApp click-to-chat URL", () => {
    const url = buildContactWhatsAppUrl({
      name: "Rahul Verma",
      topic: "wholesale",
      message: "Interested in 50 kg Darjeeling Summer Chinary lot.",
      orderId: "TF-BULK-1",
    });

    expect(url).toContain("https://wa.me/917001304853");
    expect(url).toContain("Rahul%20Verma");
    expect(url).toContain("Wholesale");
  });
});

describe("POST /api/contact Route Handler", () => {
  it("accepts valid contact submission and returns 200 with referenceCode", async () => {
    const req = new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Debashis Mukherjee",
        email: "debashis@example.com",
        phone: "+91 70013 04853",
        topic: "brewing",
        message: "Need guidance on second flush muscatel water temperature.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.referenceCode).toMatch(/^TF-CNT-\d{6}$/);
    expect(json.whatsappUrl).toBeDefined();
  });

  it("returns 400 on validation failure with structured issues", async () => {
    const req = new Request("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "invalid-email",
        topic: "not-a-topic",
        message: "hi",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.issues).toBeDefined();
  });
});
