import { createHmac, randomUUID } from "node:crypto";
import { getStoreSettings } from "@/lib/storeSettings";
import { sendAdminAlertEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { enqueue } from "@/lib/international/store";
import { CommerceError } from "@/lib/international/models";
import {
  EVENT_LABELS,
  EVENT_WEBHOOK_SETTING_KEYS,
  isValidWebhookUrl,
  parseNotificationEmails,
  type NotificationEnvelope,
  type NotificationEventType,
} from "./events";

export function signWebhookPayload(secret: string, body: string): string {
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${digest}`;
}
import {
  markDeliveryFailed,
  markDeliverySent,
  recordDeliveryQueued,
} from "./deliveries";

export interface DispatchNotificationInput {
  event: NotificationEventType;
  source: string;
  summary: string;
  referenceId?: string;
  data: Record<string, unknown>;
  dedupeKey?: string;
  deferDrain?: boolean;
}

export interface AdminEmailJobPayload {
  deliveryId: string;
  to: string;
  envelope: NotificationEnvelope;
}

export interface AdminWebhookJobPayload {
  deliveryId: string;
  url: string;
  secret?: string;
  envelope: NotificationEnvelope;
}

let drainInFlight = false;

async function drainOnce() {
  if (drainInFlight || process.env.NODE_ENV === "test") return;
  drainInFlight = true;
  try {
    const { processOneJob } = await import("@/lib/international/jobs");
    for (let i = 0; i < 10; i++) {
      const processed = await processOneJob();
      if (!processed) break;
    }
  } catch (err) {
    logger.warn("notification drain error", {
      error: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    drainInFlight = false;
  }
}

export function dispatchNotificationEvent(input: DispatchNotificationInput): {
  envelope: NotificationEnvelope;
  queuedEmails: number;
  queuedWebhooks: number;
} {
  const envelope: NotificationEnvelope = {
    id: randomUUID(),
    event: input.event,
    occurredAt: new Date().toISOString(),
    source: input.source,
    summary: input.summary,
    ...(input.referenceId ? { referenceId: input.referenceId } : {}),
    data: input.data,
  };

  let queuedEmails = 0;
  let queuedWebhooks = 0;

  try {
    const settings = getStoreSettings();
    const recipients = parseNotificationEmails(settings.notification_emails);
    const baseKey = input.dedupeKey ? `${input.event}:${input.dedupeKey}` : envelope.id;

    for (const to of recipients) {
      const deliveryId = randomUUID();
      recordDeliveryQueued({
        id: deliveryId,
        eventType: input.event,
        channel: "email",
        target: to,
        payloadPreview: input.summary,
      });
      enqueue(
        "admin_notification_email",
        { deliveryId, to, envelope } satisfies AdminEmailJobPayload,
        `notif:email:${baseKey}:${to}`
      );
      queuedEmails += 1;
    }

    const webhookKey = EVENT_WEBHOOK_SETTING_KEYS[input.event];
    const webhookUrl = settings[webhookKey];
    if (isValidWebhookUrl(webhookUrl)) {
      const deliveryId = randomUUID();
      const targetUrl = webhookUrl.trim();
      recordDeliveryQueued({
        id: deliveryId,
        eventType: input.event,
        channel: "webhook",
        target: targetUrl,
        payloadPreview: JSON.stringify(envelope).slice(0, 500),
      });
      enqueue(
        "admin_webhook",
        {
          deliveryId,
          url: targetUrl,
          secret: settings.webhook_secret || undefined,
          envelope,
        } satisfies AdminWebhookJobPayload,
        `notif:webhook:${baseKey}`
      );
      queuedWebhooks += 1;
    }

    if ((queuedEmails > 0 || queuedWebhooks > 0) && !input.deferDrain) {
      queueMicrotask(() => {
        void drainOnce();
      });
    }
  } catch (err) {
    logger.warn("failed to enqueue notification event", {
      event: input.event,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  return { envelope, queuedEmails, queuedWebhooks };
}

export async function executeAdminEmailJob(payload: AdminEmailJobPayload): Promise<void> {
  const { deliveryId, to, envelope } = payload;
  const eventLabel = EVENT_LABELS[envelope.event] ?? envelope.event;
  const result = await sendAdminAlertEmail({
    to,
    event: envelope.event,
    eventLabel,
    summary: envelope.summary,
    referenceId: envelope.referenceId,
    source: envelope.source,
    occurredAt: envelope.occurredAt,
    data: envelope.data,
  });

  if (!result.sent) {
    markDeliveryFailed(deliveryId, "SMTP not configured or email delivery failed");
    throw new CommerceError("Admin notification email delivery failed or SMTP is not configured.");
  }

  markDeliverySent(deliveryId, null);
}

export async function executeAdminWebhookJob(payload: AdminWebhookJobPayload): Promise<void> {
  const { deliveryId, url, secret, envelope } = payload;
  const body = JSON.stringify(envelope);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "TeaFloww-Webhook/1.0",
    "X-TeaFloww-Event": envelope.event,
    "X-TeaFloww-Delivery-Id": deliveryId,
  };
  if (secret && secret.trim()) {
    headers["X-TeaFloww-Signature"] = signWebhookPayload(secret.trim(), body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const msg = `Webhook endpoint responded with HTTP ${res.status}`;
      markDeliveryFailed(deliveryId, msg, res.status);
      throw new CommerceError(msg);
    }
    markDeliverySent(deliveryId, res.status);
  } catch (err) {
    if (err instanceof CommerceError) throw err;
    const msg = err instanceof Error ? err.message : "Webhook network error";
    markDeliveryFailed(deliveryId, msg, null);
    throw new CommerceError(`Webhook delivery failed: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }
}
