import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getAdminUser } from "@/lib/adminAuth";
import { gate, body, json, failure } from "@/lib/international/http";
import { markets, saveMarket, readiness, packageConfig, saveConfig, audit, enqueue, config } from "@/lib/international/store";
import { marketSchema, packageSchema, localeSchema, CommerceError } from "@/lib/international/models";
import { shippingCountries } from "@/lib/international/providers";
import { studio, sourceFor, queueTranslation, editTranslation } from "@/lib/international/translations";
import { latestFx } from "@/lib/international/fx";
import { bookShipment, shipmentAction, reconcileCod, reconcilePayment, cancelUnpaid } from "@/lib/international/fulfillment";
import { refundOrder } from "@/lib/international/orders";
import { retryJob } from "@/lib/international/jobs";
import { campaigns, campaignSchema } from "@/lib/international/campaigns";
import { getActiveRazorpayCredentials } from "@/lib/paymentSettings";
import { getActiveShiprocketCredentials } from "@/lib/shippingSettings";
export const runtime = "nodejs";
const rows = (sql: string) => getDb().prepare(sql).all();
export async function GET(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const denied = gate(request, true); if (denied) return denied;
  try {
    const { action } = await params;
    if (action === "markets") {
      const fx = latestFx();
      const fxJob = getDb().prepare("SELECT id,status,error,created_ms FROM commerce_jobs WHERE kind='fx' ORDER BY created_ms DESC LIMIT 1").get() as { id: string; status: string; error: string | null; created_ms: number } | undefined;
      const recentAudit = rows("SELECT * FROM commerce_audit ORDER BY created_ms DESC LIMIT 100");
      return json({
        markets: markets().map(m => ({ ...m, reasons: readiness(m) })),
        package: packageConfig(),
        fx: fx ? { ...fx, isStale: Boolean(fx && Date.now() > fx.next) } : null,
        fxJob: fxJob || null,
        audit: recentAudit,
        campaigns: campaigns(),
        status: {
          shipping: Boolean(
            (process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD) ||
            (getActiveShiprocketCredentials().email && getActiveShiprocketCredentials().password)
          ),
          countries: Boolean(process.env.SHIPPING_COUNTRIES_URL),
          international: Boolean(process.env.INTERNATIONAL_RATE_URL),
          duties: Boolean(process.env.LANDED_COST_URL),
          razorpay: Boolean(
            (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) ||
            (getActiveRazorpayCredentials().keyId && getActiveRazorpayCredentials().keySecret)
          ),
          translations: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_TRANSLATION_MODEL),
          worker: Boolean(process.env.COMMERCE_WORKER_SECRET),
        },
      });
    }
    if (action === "translations") {
      const url = new URL(request.url), locale = localeSchema.parse(url.searchParams.get("locale") || "hi");
      const list = studio(locale);
      const translationId = url.searchParams.get("translationId");
      let history: unknown[] = [];
      if (translationId) {
        history = getDb().prepare("SELECT id,document,created_ms FROM commerce_translation_history WHERE translation_id=? ORDER BY created_ms DESC LIMIT 20").all(translationId);
      }
      return json({
        resources: list.map(r => ({ ...r, source: sourceFor(r.resource) })),
        counts: list.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}),
        history,
      });
    }
    if (action === "orders") return json({ orders: rows("SELECT * FROM commerce_orders ORDER BY created_ms DESC LIMIT 200"), shipments: rows("SELECT * FROM commerce_shipments ORDER BY updated_ms DESC LIMIT 200") });
    if (action === "jobs") return json({ jobs: rows("SELECT id,kind,status,attempts,error,created_ms FROM commerce_jobs ORDER BY created_ms DESC LIMIT 200") });
    if (action === "audit") return json({ audit: rows("SELECT * FROM commerce_audit ORDER BY created_ms DESC LIMIT 200") });
    return new Response(null, { status: 404 });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const denied = gate(request, true); if (denied) return denied;
  try {
    const { action } = await params, input = await body(request), actor = String(getAdminUser(request)!.id), db = getDb();
    if (action === "market") { const m = saveMarket(input, actor); return json({ market: m }); }
    if (action === "bulk") {
      const p = z.object({ codes: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(300), enabled: z.boolean() }).strict().parse(input);
      const selected = markets().filter(m => p.codes.includes(m.code));
      const skipped: string[] = [];
      db.transaction(() => selected.forEach(({ version: _version, ...m }) => { if (p.enabled && readiness(m).length) skipped.push(m.code); else saveMarket({ ...m, enabled: p.enabled }, actor); }))();
      return json({ ok: true, skipped });
    }
    if (action === "import") {
      z.object({}).strict().parse(input);
      const destinations = await shippingCountries(), existing = markets();
      db.transaction(() => {
        for (const destination of destinations) {
          const old = existing.find(m => m.code === destination.code);
          const { version: _version, ...oldData } = old || { version: 0 };
          const m = marketSchema.parse({ ...destination, ...oldData, code: destination.code, name: destination.name, providerId: destination.providerId, covered: true, enabled: old?.enabled || false });
          db.prepare("INSERT INTO commerce_markets (code,document) VALUES (?,?) ON CONFLICT(code) DO UPDATE SET document=excluded.document,version=commerce_markets.version+1").run(m.code, JSON.stringify(m));
        }
        for (const old of existing.filter(m => !destinations.some(d => d.code === m.code))) {
          const { version: _version, ...m } = old;
          db.prepare("UPDATE commerce_markets SET document=?,version=version+1 WHERE code=?").run(JSON.stringify({ ...m, covered: false }), m.code);
        }
        audit(actor, "markets.import", { count: destinations.length });
      })();
      return json({ imported: destinations.length });
    }
    if (action === "package") { const p = packageSchema.parse(input); saveConfig("package", p); db.prepare("UPDATE commerce_markets SET version=version+1").run(); audit(actor, "package.save", p); return json({ ok: true }); }
    if (action === "fx") { z.object({}).strict().parse(input); enqueue("fx", {}, `fx:manual:${randomUUID()}`); return json({ queued: true }); }
    if (action === "translate") {
      const p = z.object({ resources: z.array(z.string().max(100)).min(1).max(100), locale: localeSchema }).strict().parse(input);
      p.resources.forEach(r => queueTranslation(r, p.locale)); audit(actor, "translations.queue", p); return json({ queued: p.resources.length });
    }
    if (action === "translation") {
      const p = z.object({ id: z.string().uuid(), action: z.enum(["draft", "publish", "unpublish"]), texts: z.record(z.string(), z.string()).default({}) }).strict().parse(input);
      editTranslation(p.id, p.texts, p.action); audit(actor, `translation.${p.action}`, { id: p.id }); return json({ ok: true });
    }
    if (action === "campaign") {
      const p = campaignSchema.parse(input);
      db.prepare("INSERT INTO commerce_campaigns (id,document) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document").run(p.id, JSON.stringify(p)); audit(actor, "campaign.save", p); return json({ ok: true });
    }
    if (action === "coupon") {
      const p = z.object({ code: z.string().regex(/^[A-Z0-9-]{4,24}$/), countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(300) }).strict().parse(input);
      if (!db.prepare("SELECT code FROM coupons WHERE code=?").get(p.code)) throw new CommerceError("Offer code not found.");
      saveConfig(`coupon:${p.code}`, p.countries); db.prepare("UPDATE commerce_markets SET version=version+1").run(); audit(actor, "coupon.countries", p); return json({ ok: true });
    }
    if (action === "fulfillment") {
      const p = z.object({ orderId: z.string().uuid(), action: z.enum(["book", "label", "pickup", "track", "awb", "cod", "cancel", "reconcile", "refund"]), amount: z.number().int().positive().optional(), reference: z.string().max(200).optional(), key: z.string().uuid().optional() }).strict().parse(input);
      let result: unknown;
      if (p.action === "book") result = await bookShipment(p.orderId, actor);
      else if (p.action === "cod") { if (!p.amount || !p.reference) throw new CommerceError("Collection amount and remittance reference are required."); reconcileCod(p.orderId, p.amount, p.reference, actor); }
      else if (p.action === "reconcile") { if (!p.reference) throw new CommerceError("Gateway order ID required."); await reconcilePayment(p.orderId, p.reference, actor); }
      else if (p.action === "refund") { if (!p.amount || !p.key) throw new CommerceError("Refund amount and idempotency key required."); await refundOrder(p.orderId, p.amount, p.key); }
      else if (p.action === "cancel") cancelUnpaid(p.orderId, actor);
      else result = await shipmentAction(p.orderId, p.action, actor);
      return json({ ok: true, result });
    }
    if (action === "retry") { const p = z.object({ id: z.string().uuid() }).strict().parse(input); retryJob(p.id); return json({ ok: true }); }
    if (action === "preview") {
      const p = z.object({ country: z.string().regex(/^[A-Z]{2}$/) }).strict().parse(input);
      const response = json({ ok: true }); response.cookies.set("tf_preview_country", p.country, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 1800 }); return response;
    }
    void config;
    return new Response(null, { status: 404 });
  } catch (e) { return failure(e); }
}
