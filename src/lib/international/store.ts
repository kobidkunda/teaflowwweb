import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { CommerceError, marketSchema, packageSchema, type Market, type Package } from "./models";
import { getActiveRazorpayCredentials } from "@/lib/paymentSettings";
import { getActiveShiprocketCredentials } from "@/lib/shippingSettings";
export function config<T>(key: string): T | null {
  const row = getDb().prepare("SELECT document FROM commerce_config WHERE key=?").get(key) as { document: string } | undefined;
  return row ? JSON.parse(row.document) as T : null;
}
export function saveConfig(key: string, value: unknown) {
  getDb().prepare("INSERT INTO commerce_config (key,document) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET document=excluded.document").run(key, JSON.stringify(value));
}
export function audit(actor: string, action: string, value: unknown) {
  getDb().prepare("INSERT INTO commerce_audit (id,actor,action,document,created_ms) VALUES (?,?,?,?,?)").run(randomUUID(), actor, action, JSON.stringify(value), Date.now());
}
export function markets(): (Market & { version: number })[] {
  try { return (getDb().prepare("SELECT document,version FROM commerce_markets ORDER BY code").all() as { document: string; version: number }[]).map(r => ({ ...marketSchema.parse(JSON.parse(r.document)), version: r.version })); }
  catch { return []; }
}
export function market(code: string) {
  const found = markets().find(m => m.code === code);
  if (!found) throw new CommerceError("This destination is not available for checkout.");
  return found;
}
export function packageConfig(): Package | null {
  const parsed = packageSchema.safeParse(config("package"));
  return parsed.success ? parsed.data : null;
}
export function readiness(m: Market): string[] {
  const reasons: string[] = [];
  if (!m.covered) reasons.push("Shipping coverage requires verification");
  if (!packageConfig()) reasons.push("Package and pickup details missing");
  if (!m.taxApproved) reasons.push("Tax profile needs approval");
  if (m.code !== "IN" && !m.exportApproved) reasons.push("Export and product restrictions need approval");
  const rzpCreds = getActiveRazorpayCredentials();
  const srCreds = getActiveShiprocketCredentials();
  if ((!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) && (!rzpCreds.keyId || !rzpCreds.keySecret)) reasons.push("Payment credentials missing");
  if ((!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) && (!srCreds.email || !srCreds.password)) reasons.push("Shipping credentials missing");
  if (!process.env.ORDER_ACCESS_SECRET && !process.env.SESSION_SECRET) reasons.push("Secure order access missing");
  if (!process.env.RAZORPAY_WEBHOOK_SECRET && !rzpCreds.webhookSecret && !process.env.COMMERCE_WORKER_SECRET) reasons.push("Webhook or worker configuration missing");
  if (m.duties === "included" && !process.env.LANDED_COST_URL) reasons.push("Verified prepaid duties service missing");
  if (m.code !== "IN" && !process.env.INTERNATIONAL_RATE_URL) reasons.push("Account-specific international rate contract missing");
  if (m.code !== "IN" && !process.env.INTERNATIONAL_BOOKING_URL) reasons.push("International fulfillment contract missing");
  return reasons;
}
export function saveMarket(raw: unknown, actor: string) {
  const m = marketSchema.parse(raw);
  if (m.enabled && readiness(m).length) throw new CommerceError("Complete the market readiness checks before enabling checkout.");
  getDb().transaction(() => {
    getDb().prepare("INSERT INTO commerce_markets (code,document,version) VALUES (?,?,1) ON CONFLICT(code) DO UPDATE SET document=excluded.document,version=commerce_markets.version+1").run(m.code, JSON.stringify(m));
    if (m.code === "IN") {
      const upsert = getDb().prepare(
        "INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      );
      upsert.run("shipping_flat_fee_paise", String(m.flatPaise));
      upsert.run("shipping_fee_paise", String(m.flatPaise));
      upsert.run("shipping_flat_paise", String(m.flatPaise));
      if (m.freeAbovePaise !== null) {
        upsert.run("free_shipping_threshold_paise", String(m.freeAbovePaise));
        upsert.run("free_shipping_enabled", "1");
      } else {
        upsert.run("free_shipping_enabled", "0");
      }
      upsert.run("cod_enabled", m.cod.enabled ? "1" : "0");
      upsert.run("cod_fee_paise", String(m.cod.feePaise));
      upsert.run("cod_min_paise", String(m.cod.minPaise));
      upsert.run("cod_max_paise", String(m.cod.maxPaise));
      upsert.run("cod_postcodes", JSON.stringify(m.cod.postcodes));
      upsert.run("cod_blocked_skus", JSON.stringify(m.cod.blockedSkus));
    }
    audit(actor, "market.save", m);
  })();
  return m;
}
export function enqueue(kind: string, document: unknown, dedupe: string = randomUUID(), run = Date.now()) {
  const id = randomUUID();
  getDb().prepare("INSERT INTO commerce_jobs (id,dedupe_key,kind,document,run_ms,created_ms) VALUES (?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO NOTHING").run(id, dedupe, kind, JSON.stringify(document), run, Date.now());
  return id;
}
export function publicMarkets() {
  return markets().map(m => ({ code: m.code, name: m.name, currency: m.currency, language: m.language, approvedCurrencies: m.approvedCurrencies, available: m.enabled && readiness(m).length === 0 }));
}
