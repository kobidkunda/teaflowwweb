import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { getStoreSettings, updateStoreSettings } from "@/lib/storeSettings";
import {
  isValidWebhookUrl,
  parseNotificationEmails,
  signWebhookPayload,
} from "@/lib/notifications/events";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch";
import { listRecentDeliveries } from "@/lib/notifications/deliveries";
import { processOneJob } from "@/lib/international/jobs";
import { recordContactInquiry } from "@/lib/contact";
import { recordWholesaleInquiry } from "@/lib/wholesale";
import { captureLead } from "@/lib/leads";
import { saveNewsletterPreference } from "@/lib/newsletter";

describe("Admin Notification Emails & Per-Event Webhooks", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM commerce_jobs").run();
    try {
      db.prepare("DELETE FROM webhook_deliveries").run();
    } catch {
      // table may be created on first dispatch
    }
    updateStoreSettings({
      store_name: "TeaFloww",
      currency: "INR",
      tax_rate_percent: 5,
      contact_email: "info@teafloww.com",
      whatsapp_number: "+91 7001304853",
      notification_emails: "info@teafloww.com, sales@teafloww.com, invalid-email",
      webhook_secret: "test_secret_123",
      webhook_url_enquiry: "https://hooks.example.com/enquiry",
      webhook_url_bulk_order: "https://hooks.example.com/bulk",
      webhook_url_lead_modal: "https://hooks.example.com/lead",
      webhook_url_newsletter: "https://hooks.example.com/newsletter",
      webhook_url_private_label: "https://hooks.example.com/private-label",
      webhook_url_quote: "https://hooks.example.com/quote",
      webhook_url_order: "https://hooks.example.com/order",
      webhook_url_subscription: "https://hooks.example.com/subscription",
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("parses comma-separated notification emails and validates webhook URLs", () => {
    expect(parseNotificationEmails("a@teafloww.com, B@TeaFloww.com, bad, a@teafloww.com")).toEqual([
      "a@teafloww.com",
      "b@teafloww.com",
    ]);
    expect(isValidWebhookUrl("https://hooks.example.com/test")).toBe(true);
    expect(isValidWebhookUrl("ftp://hooks.example.com/test")).toBe(false);
    expect(isValidWebhookUrl("")).toBe(false);
  });

  it("persists notification_emails, webhook_secret, and per-event webhook URLs in store_settings", () => {
    const s = getStoreSettings();
    expect(s.notification_emails).toBe("info@teafloww.com, sales@teafloww.com, invalid-email");
    expect(s.webhook_secret).toBe("test_secret_123");
    expect(s.webhook_url_enquiry).toBe("https://hooks.example.com/enquiry");
    expect(s.webhook_url_bulk_order).toBe("https://hooks.example.com/bulk");
    expect(s.webhook_url_lead_modal).toBe("https://hooks.example.com/lead");
    expect(s.webhook_url_newsletter).toBe("https://hooks.example.com/newsletter");
    expect(s.webhook_url_private_label).toBe("https://hooks.example.com/private-label");
    expect(s.webhook_url_quote).toBe("https://hooks.example.com/quote");
    expect(s.webhook_url_order).toBe("https://hooks.example.com/order");
    expect(s.webhook_url_subscription).toBe("https://hooks.example.com/subscription");
  });

  it("enqueues email & webhook jobs, signs webhook payloads with HMAC-SHA256, and records delivery status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const dispatched = dispatchNotificationEvent({
      event: "enquiry",
      source: "/api/contact",
      referenceId: "INQ-TEST-1",
      summary: "Test enquiry from Kobid",
      data: { name: "Kobid", email: "kobid@example.com", message: "Hello" },
      deferDrain: true,
    });

    expect(dispatched.queuedEmails).toBe(2);
    expect(dispatched.queuedWebhooks).toBe(1);

    const db = getDb();
    const webhookJob = db
      .prepare("SELECT id, kind, document FROM commerce_jobs WHERE kind = 'admin_webhook' LIMIT 1")
      .get() as { id: string; kind: string; document: string } | undefined;
    expect(webhookJob).toBeDefined();

    // Run jobs until webhook job executes (processOneJob picks oldest queued job)
    for (let i = 0; i < 5; i++) {
      await processOneJob();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://hooks.example.com/enquiry");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-TeaFloww-Event"]).toBe("enquiry");
    expect(headers["X-TeaFloww-Signature"]).toBe(
      signWebhookPayload("test_secret_123", String(init.body))
    );

    const deliveries = listRecentDeliveries(10);
    const sentWebhook = deliveries.find((d) => d.channel === "webhook" && d.event_type === "enquiry");
    expect(sentWebhook?.status).toBe("sent");
    expect(sentWebhook?.http_status).toBe(200);
  });

  it("marks failed webhook deliveries for retry when endpoint returns HTTP 500", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 })) as unknown as typeof fetch;

    dispatchNotificationEvent({
      event: "order",
      source: "/api/international/orders",
      referenceId: "ORD-FAIL-1",
      summary: "Order failed webhook test",
      data: { orderId: "ORD-FAIL-1", totalPaise: 49900 },
      deferDrain: true,
    });

    for (let i = 0; i < 4; i++) {
      await processOneJob();
    }

    const job = getDb()
      .prepare("SELECT status, attempts FROM commerce_jobs WHERE kind = 'admin_webhook' LIMIT 1")
      .get() as { status: string; attempts: number };
    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(1);

    const failedDelivery = listRecentDeliveries(10).find((d) => d.channel === "webhook");
    expect(failedDelivery?.status).toBe("failed");
    expect(failedDelivery?.http_status).toBe(500);
  });

  it("persists contact, wholesale, lead modal, and newsletter submissions and enqueues notifications", () => {
    const contact = recordContactInquiry({
      name: "Aarav Sharma",
      email: "aarav@example.com",
      topic: "general",
      message: "Looking for first flush Darjeeling details.",
    });
    expect(contact.id).toBeGreaterThan(0);

    const wholesale = recordWholesaleInquiry({
      name: "Priya Nair",
      business_name: "Malabar Cafe",
      email: "priya@malabarcafe.in",
      phone: "+91 9876543210",
      interest: "Single-Estate Orthodox Teas",
      estimated_volume: "25 – 100 kg",
      location: "Kochi",
    });
    expect(wholesale.id).toBeGreaterThan(0);

    const lead = captureLead({
      sessionId: "sess_test_modal_1",
      phoneNumber: "+91 9832012345",
      customerName: "Rohan",
      source: "exit_intent",
    });
    expect(lead.success).toBe(true);

    const uniqueEmail = `tea-lover-${Date.now()}@example.com`;
    saveNewsletterPreference(uniqueEmail, "I agree to receive email news.");

    const deliveries = listRecentDeliveries(30);
    const eventsSeen = new Set(deliveries.map((d) => d.event_type));
    expect(eventsSeen.has("enquiry")).toBe(true);
    expect(eventsSeen.has("bulk_order")).toBe(true);
    expect(eventsSeen.has("lead_modal")).toBe(true);
    expect(eventsSeen.has("newsletter")).toBe(true);
  });
});
