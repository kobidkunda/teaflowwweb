import { subscriptionTick, finishCycleChange, refundSubscriptionOrder, renewalEmailData } from "@/lib/subscriptions/service";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendTemplatedMail } from "@/lib/email";
import { refreshFx, latestFx } from "./fx";
import { releaseExpired, applyPaymentEvent, liveOrder, guestToken } from "./orders";
import { generateTranslation } from "./translations";
import { shipmentAction } from "./fulfillment";
import { enqueue } from "./store";
import { CommerceError, type Quote } from "./models";
type Job = { id: string; kind: string; document: string; attempts: number; lease_ms: number };
export async function processOneJob() {
  const db = getDb(), now = Date.now();
  db.prepare("UPDATE commerce_jobs SET status='failed',error='Worker lease expired after the retry limit.' WHERE status='processing' AND lease_ms<? AND attempts>=5").run(now);
  const job = db.transaction(() => {
    const candidate = db.prepare("SELECT * FROM commerce_jobs WHERE ((status='queued' AND run_ms<=?) OR (status='processing' AND lease_ms<?)) AND attempts<5 ORDER BY created_ms LIMIT 1").get(now, now) as Job | undefined;
    if (!candidate) return null;
    const claim = db.prepare("UPDATE commerce_jobs SET status='processing',lease_ms=?,attempts=attempts+1 WHERE id=? AND lease_ms=?").run(now + 120000, candidate.id, candidate.lease_ms);
    return claim.changes ? candidate : null;
  })();
  if (!job) return false;
  try {
    const data = JSON.parse(job.document);
    if (job.kind === "subscription_tick") await subscriptionTick();
    else if (job.kind === "subscription_change") await finishCycleChange(data.cycleId, data.action);
    else if (job.kind === "subscription_refund") await refundSubscriptionOrder(data.orderId);
    else if (job.kind === "auto_dispatch") {
      const { prepareFullShiprocketShipment } = await import("@/lib/shiprocket");
      await prepareFullShiprocketShipment(data.orderId, "worker");
    }
    else if (job.kind === "subscription_email") {
      const renewal = renewalEmailData(data.cycleId);
      if (renewal) {
        const base = (process.env.APP_BASE_URL || "https://teafloww.com").replace(/\/+$/, "");
        const sent = await sendTemplatedMail({ to: renewal.to, templateKey: "subscription_renewal", vars: { customer_name: renewal.name, dispatch_date: renewal.date, renewal_url: `${base}/account/subscriptions?renewal=${encodeURIComponent(renewal.cycleId)}` } });
        if (!sent.sent) throw new CommerceError("Renewal email delivery failed or is not configured.");
      }
    }
    else if (job.kind === "translate") await generateTranslation(data);
    else if (job.kind === "fx") await refreshFx();
    else if (job.kind === "cleanup") releaseExpired();
    else if (job.kind === "payment_webhook") applyPaymentEvent(data.eventId, data.payload);
    else if (job.kind === "track") await shipmentAction(data.orderId, "track", "worker");
    else if (job.kind === "email") {
      const order = liveOrder(data.orderId), q = JSON.parse(order.document) as Quote;
      if (order.payment_status === "cancelled") {
        db.prepare("UPDATE commerce_jobs SET status='completed',error=NULL WHERE id=?").run(job.id);
        return true;
      }
      const baseUrl = (process.env.APP_BASE_URL || "https://teafloww.com").replace(/\/+$/, "");
      const trackingUrl = `${baseUrl}/purchase/${encodeURIComponent(order.id)}?token=${encodeURIComponent(guestToken(order.id))}`;
      const sent = await sendTemplatedMail({
        to: q.input.address.email,
        templateKey: data.template,
        locale: q.input.locale,
        vars: {
          customer_name: q.input.address.name,
          order_id: order.id,
          order_total: `${q.totalMinor / 10 ** new Intl.NumberFormat("en", { style: "currency", currency: q.currency }).resolvedOptions().maximumFractionDigits!} ${q.currency}`,
          payment_status: order.payment_status,
          tracking_url: trackingUrl,
          order_url: trackingUrl,
        },
      });
      if (!sent.sent) throw new CommerceError("Email delivery is not configured or failed.");
    } else throw new CommerceError("This job requires staff review.");
    db.prepare("UPDATE commerce_jobs SET status='completed',error=NULL WHERE id=? AND lease_ms=?").run(job.id, now + 120000);
  } catch (e) {
    db.prepare("UPDATE commerce_jobs SET status=?,error=?,run_ms=?,lease_ms=0 WHERE id=? AND lease_ms=?").run(job.attempts >= 4 ? "failed" : "queued", e instanceof CommerceError ? e.message : "Provider operation failed. Review configuration and retry.", now + Math.min(3600000, 30000 * 2 ** job.attempts), job.id, now + 120000);
  }
  return true;
}
export function scheduleMaintenance() {
  const bucket = Math.floor(Date.now() / 60000);
  enqueue("cleanup", {}, `cleanup:${bucket}`);
  enqueue("subscription_tick", {}, `subscription:tick:${bucket}`);
  const fx = latestFx();
  if (process.env.EXCHANGE_RATE_API_KEY && (!fx || fx.next <= Date.now())) enqueue("fx", {}, `fx:${Math.floor(Date.now() / 3600000)}`);
  const rows = getDb().prepare("SELECT order_id FROM commerce_shipments WHERE status IN ('booked','labelled')").all() as { order_id: string }[];
  rows.forEach(r => enqueue("track", { orderId: r.order_id }, `track:${r.order_id}:${Math.floor(Date.now() / 3600000)}`));
}
export function retryJob(id: string) { getDb().prepare("UPDATE commerce_jobs SET status='queued',attempts=0,lease_ms=0,run_ms=? WHERE id=? AND status='failed' AND kind IN ('translate','fx','track','cleanup','payment_webhook','subscription_tick','subscription_email','subscription_change','subscription_refund')").run(Date.now(), id); }
export function eventId() { return randomUUID(); }
