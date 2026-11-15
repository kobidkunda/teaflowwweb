import { describe, it, expect } from "vitest";
import {
  EMAIL_TEMPLATE_KEYS,
  getCanonicalEmailTemplates,
  renderEmailTemplate,
  generateEmailDraft,
} from "../../src/lib/emailTemplates";
import { buildBrandEmailHtml, buildBrandEmailText } from "../../src/lib/emailLayout";
import { sampleVarsFor } from "../../src/app/api/admin/email-templates/[key]/route";

describe("Brand Email Templates & Layout System", () => {
  it("includes all 10 canonical templates in EMAIL_TEMPLATE_KEYS", () => {
    expect(EMAIL_TEMPLATE_KEYS).toHaveLength(10);
    const expectedKeys = [
      "admin_password_reset",
      "order_confirmation",
      "commerce_order_received",
      "commerce_payment_review",
      "order_shipped",
      "contact_acknowledgement",
      "wholesale_acknowledgement",
      "newsletter_welcome",
      "abandoned_cart_recovery",
      "subscription_renewal",
    ];
    for (const key of expectedKeys) {
      expect(EMAIL_TEMPLATE_KEYS).toContain(key);
    }
  });

  it("canonical templates export rich HTML and text for every template", () => {
    const templates = getCanonicalEmailTemplates();
    expect(templates).toHaveLength(10);

    for (const tpl of templates) {
      expect(tpl.subject.length).toBeGreaterThan(5);
      expect(tpl.html_body.length).toBeGreaterThan(1000);
      expect(tpl.text_body.length).toBeGreaterThan(100);

      // Verify presence of brand logo lockup and alt text
      expect(tpl.html_body).toContain("{{#logo}}");
      expect(tpl.html_body).toContain("<img");
      expect(tpl.html_body).toContain('alt="{{store_name}} Logo"');

      // Verify presence of responsive data / summary table
      expect(tpl.html_body).toContain('<table role="table"');
      expect(tpl.html_body).toContain('<th scope="col"');
      expect(tpl.html_body).toContain("<tbody>");

      // Verify official company info in footer
      expect(tpl.html_body).toContain("Nirva");
      expect(tpl.html_body).toContain("19CTHPK8646J2ZY");
      expect(tpl.html_body).toContain("Siliguri");
      expect(tpl.html_body).toContain("{{support_email}}");

      // Plain text footer verification
      expect(tpl.text_body).toContain("Nirva");
      expect(tpl.text_body).toContain("Siliguri");
      expect(tpl.text_body).toContain("19CTHPK8646J2ZY");
    }
  });

  it("renders every template completely with sample variables", () => {
    const templates = getCanonicalEmailTemplates();
    const sample = sampleVarsFor();

    for (const tpl of templates) {
      const rendered = renderEmailTemplate(tpl, sample);

      // Rendered HTML assertions
      expect(rendered.subject).not.toContain("{{");
      expect(rendered.html).toContain("TeaFloww");
      expect(rendered.html).toContain("https://teafloww.com/logo/png/");
      expect(rendered.html).not.toContain("{{#logo}}");
      expect(rendered.html).not.toContain("{{/logo}}");
      expect(rendered.html).not.toContain("{{store_name}}");
      expect(rendered.html).not.toContain("{{support_email}}");

      // Rendered text assertions
      expect(rendered.text).toContain("TeaFloww");
      expect(rendered.text).toContain("info@teafloww.com");
      expect(rendered.text).not.toContain("{{store_name}}");
      expect(rendered.text).not.toContain("{{support_email}}");
    }
  });

  it("buildBrandEmailHtml creates accessible, client-compatible markup", () => {
    const html = buildBrandEmailHtml({
      categoryBadge: "Verification",
      heading: "Test Heading",
      leadParagraph: "Test lead description.",
      table: {
        caption: "Test Caption",
        columns: [
          { header: "Item", align: "left", width: "70%" },
          { header: "Amount", align: "right", width: "30%" },
        ],
        rows: [
          ["Darjeeling First Flush", "₹850"],
          { cells: ["Total", "₹850"], isHighlighted: true },
        ],
      },
      ctaButton: {
        label: "Take Action",
        url: "https://teafloww.com/test",
      },
      secondaryNoteHtml: "Special note text.",
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<table role="presentation"');
    expect(html).toContain('<table role="table"');
    expect(html).toContain('Verification');
    expect(html).toContain('Test Heading');
    expect(html).toContain('Take Action &rarr;');
    expect(html).toContain('https://teafloww.com/test');
    expect(html).toContain('Special note text.');
  });

  it("buildBrandEmailText creates clean ASCII formatted plain text", () => {
    const text = buildBrandEmailText({
      categoryBadge: "Verification",
      heading: "Test Heading",
      leadParagraph: "Test lead description.",
      table: {
        columns: ["Item", "Amount"],
        rows: [["Darjeeling First Flush", "₹850"]],
      },
      ctaButton: {
        label: "Take Action",
        url: "https://teafloww.com/test",
      },
      secondaryNote: "Special note text.",
    });

    expect(text).toContain("[VERIFICATION]");
    expect(text).toContain("Test Heading");
    expect(text).toContain("Item | Amount");
    expect(text).toContain("Take Action:");
    expect(text).toContain("https://teafloww.com/test");
    expect(text).toContain("Special note text.");
  });

  it("generateEmailDraft produces rich drafts with logo and overview tables", () => {
    for (const tone of ["warm", "formal", "festive", "minimal"] as const) {
      const draft = generateEmailDraft({
        goal: "Autumnal Flush Reserve batch release",
        tone,
        call_to_action: "Reserve Your Tin",
      });

      expect(draft.subject).toContain("Autumnal Flush");
      expect(draft.subject).toContain("TeaFloww");
      expect(draft.html_body).toContain('<table role="table"');
      expect(draft.html_body).toContain("Reserve Your Tin &rarr;");
      expect(draft.html_body).toContain("{{store_name}}");
      expect(draft.text_body).toContain("Reserve Your Tin");
    }
  });

  it("sampleVarsFor covers all template variable requirements", () => {
    const vars = sampleVarsFor();
    expect(vars.customer_name).toBe("Aarav Sharma");
    expect(vars.order_id).toBe("TF-2026-000123");
    expect(vars.order_total).toBe("₹1,249");
    expect(vars.payment_status).toBe("Captured (Online UPI)");
    expect(vars.dispatch_date).toBe("November 24, 2026");
    expect(vars.tracking_url).toContain("https://teafloww.com");
    expect(vars.reset_link).toContain("https://teafloww.com");
    expect(vars.reference_code).toBe("TF-CNT-ABC123");
    expect(vars.business_name).toBe("Himalayan Retreat, Gangtok");
    expect(vars.recovery_url).toContain("https://teafloww.com");
  });
});
