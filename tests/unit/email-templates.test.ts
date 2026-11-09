import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

// Isolated temp DB migrated fresh (services read DATABASE_PATH lazily).
const TEST_DB = path.join(tmpdir(), `email-tpl-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

import {
  listEmailTemplates,
  getEmailTemplate,
  updateEmailTemplate,
  renderEmailTemplate,
  generateEmailDraft,
  listLogoOptions,
  defaultLogoUrl,
  emailTemplateCompletion,
} from "../../src/lib/emailTemplates";
import { getSmtpStatus } from "../../src/lib/email";
import { dispatchToolCall, dispatchPromptGet, dispatchCompletion, dispatchResourceRead } from "../../src/lib/mcp";

describe("email templates: migration seeds + CRUD + render", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
  });
  afterAll(() => {
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try {
        rmSync(TEST_DB + suffix, { force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("seeds all seven transactional templates", () => {
    const all = listEmailTemplates();
    for (const key of [
      "admin_password_reset",
      "order_confirmation",
      "order_shipped",
      "contact_acknowledgement",
      "wholesale_acknowledgement",
      "newsletter_welcome",
      "abandoned_cart_recovery",
    ]) {
      expect(all.some((t) => t.key === key)).toBe(true);
    }
  });

  it("renders {{variables}} with brand defaults and keeps unknown keys empty", () => {
    const tpl = getEmailTemplate("order_confirmation");
    expect(tpl).not.toBeNull();
    const out = renderEmailTemplate(tpl!, { order_id: "TF-1", customer_name: "Aarav", order_total: "₹499" });
    expect(out.subject).toContain("TF-1");
    expect(out.html).toContain("Aarav");
    expect(out.html).toContain("Siliguri");
    expect(out.text).not.toContain("{{");
  });

  it("supports the {{#logo}} conditional block", () => {
    const tpl = getEmailTemplate("admin_password_reset");
    const withLogo = renderEmailTemplate(tpl!, { reset_link: "https://x/reset" });
    expect(withLogo.html).toContain("<img");
    const noLogo = renderEmailTemplate(
      { subject: "s", html_body: "{{#logo}}L{{/logo}}", text_body: "t" },
      { logo_url: "" }
    );
    expect(noLogo.html).not.toContain("L");
  });

  it("updates subject/bodies and tracks new variables", () => {
    const updated = updateEmailTemplate("newsletter_welcome", {
      subject: "Welcome updated — TeaFloww",
      html_body: "<div><p>Hello {{first_name}}, welcome!</p></div>",
      text_body: "Hello {{first_name}}, welcome!",
    });
    expect(updated.subject).toContain("updated");
    expect(updated.variables).toContain("first_name");
    // restore seed copy for other tests
    updateEmailTemplate("newsletter_welcome", {
      subject: "Welcome to the TeaFloww tea circle",
      html_body: "<div><p>welcome back</p></div>",
      text_body: "welcome back, friend",
    });
  });

  it("rejects short/empty template input", () => {
    expect(() =>
      updateEmailTemplate("newsletter_welcome", { subject: "x", html_body: "short", text_body: "t" })
    ).toThrow();
  });

  it("generates deterministic drafts from a prompt (all tones)", () => {
    for (const tone of ["warm", "formal", "festive", "minimal"] as const) {
      const draft = generateEmailDraft({ goal: "Festive First Flush arrival with 15% off", tone });
      expect(draft.subject).toContain("TeaFloww");
      expect(draft.html_body).toContain("{{store_name}}");
      expect(draft.text_body.length).toBeGreaterThan(10);
    }
    expect(() => generateEmailDraft({ goal: "short", tone: "warm" })).toThrow();
  });

  it("exposes absolute-URL logo references", () => {
    const logos = listLogoOptions();
    expect(logos.length).toBeGreaterThan(10);
    expect(logos[0].absoluteUrl).toMatch(/^https?:\/\//);
    expect(defaultLogoUrl()).toMatch(/^https?:\/\//);
  });

  it("completes template keys by prefix", () => {
    expect(emailTemplateCompletion("order")).toContain("order_confirmation");
    expect(emailTemplateCompletion("zzz-no-match")).toEqual([]);
  });

  it("reports redacted SMTP status without secrets", () => {
    const status = getSmtpStatus();
    expect(typeof status.configured).toBe("boolean");
    expect(status).not.toHaveProperty("user");
    expect(status).not.toHaveProperty("pass");
    expect(JSON.stringify(status)).not.toContain("SMTP_PASS");
  });
});

describe("email templates: MCP tools / resource / prompt / completion", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
  });

  it("lists templates via email.listTemplates", () => {
    const res = dispatchToolCall("email.listTemplates", {}) as { templates: { key: string }[] };
    expect(res.templates.length).toBeGreaterThanOrEqual(7);
  });

  it("gets + previews + updates via MCP tools", () => {
    const got = dispatchToolCall("email.getTemplate", { template_key: "order_shipped" }) as {
      template: { key: string };
      preview: { subject: string };
    };
    expect(got.template.key).toBe("order_shipped");
    expect(got.preview.subject.length).toBeGreaterThan(3);

    const preview = dispatchToolCall("email.previewTemplate", {
      template_key: "order_shipped",
      vars: { order_id: "TF-9", tracking_url: "https://x/track" },
    }) as { preview: { subject: string } };
    expect(preview.preview.subject).toContain("TF-9");

    const updated = dispatchToolCall("email.updateTemplate", {
      template_key: "order_shipped",
      subject: "Shipped subject via MCP — TeaFloww",
      html_body: "<div><p>shipped {{order_id}}</p></div>",
      text_body: "shipped {{order_id}}",
    }) as { template: { subject: string } };
    expect(updated.template.subject).toContain("MCP");
  });

  it("reports SMTP conf via email.getConfig without secrets", () => {
    const res = dispatchToolCall("email.getConfig", {}) as { smtp: Record<string, unknown>; logos: unknown[] };
    expect(typeof res.smtp.configured).toBe("boolean");
    expect(Array.isArray(res.logos)).toBe(true);
  });

  it("returns preview (not delivery) via email.sendTest when SMTP is unset", () => {
    const res = dispatchToolCall("email.sendTest", {
      template_key: "newsletter_welcome",
      to: "tester@example.com",
    }) as { sent: boolean; preview: { subject: string } };
    expect(typeof res.sent).toBe("boolean");
    expect(res.preview.subject.length).toBeGreaterThan(0);
  });

  it("generates drafts via email.generateDraft", () => {
    const res = dispatchToolCall("email.generateDraft", {
      goal: "Welcome new subscribers with harvest stories",
      tone: "warm",
    }) as { draft: { subject: string } };
    expect(res.draft.subject).toContain("TeaFloww");
  });

  it("reads tea://email/templates resource", () => {
    const res = dispatchResourceRead("tea://email/templates") as {
      contents: { text: string }[];
    };
    const payload = JSON.parse(res.contents[0].text) as { templates: unknown[]; smtp: unknown };
    expect(Array.isArray(payload.templates)).toBe(true);
    expect(payload.smtp).toBeDefined();
  });

  it("renders the email-template-composer prompt", () => {
    const res = dispatchPromptGet("email-template-composer", {
      templateKey: "newsletter_welcome",
      goal: "festive harvest announcement",
      tone: "festive",
    }) as { messages: { content: { text: string } }[] };
    expect(res.messages[0].content.text).toContain("newsletter_welcome");
  });

  it("autocompletes template_key and tone", () => {
    const t = dispatchCompletion({}, { name: "template_key", value: "order" });
    expect(t.completion.values).toContain("order_confirmation");
    const tone = dispatchCompletion({}, { name: "tone", value: "fes" });
    expect(tone.completion.values).toContain("festive");
  });
});
