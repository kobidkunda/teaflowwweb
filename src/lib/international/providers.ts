import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CommerceError, type Package, type QuoteInput, type QuoteLine, type Quote } from "./models";
import { getActiveRazorpayCredentials } from "@/lib/paymentSettings";
import { getActiveShiprocketCredentials } from "@/lib/shippingSettings";
const origin = "https://apiv2.shiprocket.in/v1/external";
export async function providerFetch(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(url.startsWith("https://api.openai.com/") ? 90000 : 20000) });
  if (!response.ok) throw new CommerceError("The service is temporarily unavailable. Please retry shortly.");
  if (response.status === 204) return null;
  return response.json() as Promise<unknown>;
}
function isMockShiprocket(creds: ReturnType<typeof getActiveShiprocketCredentials>) {
  if (process.env.COMMERCE_MOCK_PROVIDERS === "1") return true;
  if (creds.mode === "test") {
    if (!creds.email || !creds.password || creds.email.includes("mock") || creds.email.includes("test")) return true;
  }
  return false;
}
let token: { value: string; until: number } | undefined;
export async function shippingRequest(path: string, body?: unknown) {
  const srCreds = getActiveShiprocketCredentials();
  const email = srCreds.email || process.env.SHIPROCKET_EMAIL;
  const password = srCreds.password || process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) throw new CommerceError("Delivery is not configured yet.");
  if (isMockShiprocket(srCreds)) {
    if (path.includes("courier/serviceability")) {
      return {
        data: {
          available_courier_companies: [
            { courier_company_id: 10, rate: 75, cod: 1 },
            { courier_company_id: 12, rate: 95, cod: 1 },
          ],
        },
      };
    }
  }
  if (!token || token.until < Date.now()) {
    const auth = z.object({ token: z.string().min(1) }).parse(await providerFetch(`${origin}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }));
    token = { value: auth.token, until: Date.now() + 3600000 };
  }
  return providerFetch(`${origin}/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
/** Server-configured private integration endpoint; never accept endpoint URLs from a browser. */
async function bridge(env: "INTERNATIONAL_RATE_URL" | "LANDED_COST_URL" | "SHIPPING_COUNTRIES_URL", body?: unknown) {
  const url = process.env[env];
  if (!url || new URL(url).protocol !== "https:") throw new CommerceError("This delivery service needs account configuration.");
  return providerFetch(url, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${process.env.SHIPPING_BRIDGE_TOKEN || ""}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const countryList = z.array(z.object({ code: z.string().regex(/^[A-Z]{2}$/), name: z.string().min(1).max(100), providerId: z.string().max(30), currency: z.string().regex(/^[A-Z]{3}$/).default("INR") }).strict()).min(1).max(300);
export async function shippingCountries() {
  return countryList.parse(await bridge("SHIPPING_COUNTRIES_URL"));
}
export const shippingRateSchema = z.object({ id: z.string().min(1).max(100), costPaise: z.number().int().min(0), expires: z.number().int(), cod: z.boolean(), ddp: z.boolean(), dutiesPaise: z.number().int().min(0).default(0) });
export type ShippingRate = z.infer<typeof shippingRateSchema>;
export async function shippingRate(input: QuoteInput, lines: QuoteLine[], pack: Package, includedDuties: boolean): Promise<ShippingRate> {
  const grams = lines.reduce((s, l) => s + l.grams * l.quantity, pack.tareGrams);
  if (grams > pack.maxGrams) throw new CommerceError("This bag exceeds the configured package size. Please contact us for a delivery quote.");
  if (input.address.country !== "IN") {
    if (process.env.INTERNATIONAL_RATE_URL) {
      const rate = shippingRateSchema.parse(await bridge("INTERNATIONAL_RATE_URL", { address: input.address, lines, package: pack, grams, duties: includedDuties ? "included" : "recipient" }));
      if (includedDuties) {
        if (!rate.ddp) throw new CommerceError("This delivery service does not support prepaid import charges.");
        const landed = z.object({ dutiesPaise: z.number().int().min(0), ddp: z.literal(true), expires: z.number().int() }).parse(await bridge("LANDED_COST_URL", { address: input.address, lines, package: pack, rateId: rate.id }));
        return { ...rate, ...landed, expires: Math.min(rate.expires, landed.expires) };
      }
      return { ...rate, dutiesPaise: 0 };
    }
    throw new CommerceError("International delivery is not configured yet.");
  }
  const srCreds = getActiveShiprocketCredentials();
  const srEmail = srCreds.email || process.env.SHIPROCKET_EMAIL;
  const srPassword = srCreds.password || process.env.SHIPROCKET_PASSWORD;
  if (srEmail && srPassword) {
    const query = new URLSearchParams({ pickup_postcode: pack.pickupPostcode, delivery_postcode: input.address.postcode, weight: String(grams / 1000), cod: input.method === "cod" ? "1" : "0", length: String(pack.length), breadth: String(pack.breadth), height: String(pack.height) });
    const result = z.object({ data: z.object({ available_courier_companies: z.array(z.object({ courier_company_id: z.number(), rate: z.coerce.number().nonnegative(), cod: z.union([z.boolean(), z.number()]).optional() })) }) }).parse(await shippingRequest(`courier/serviceability/?${query}`));
    const candidates = result.data.available_courier_companies.filter(r => input.method !== "cod" || Boolean(r.cod)).sort((a, b) => a.rate - b.rate);
    const rate = candidates[0];
    if (!rate) throw new CommerceError("Delivery is not currently available at this address.");
    return { id: String(rate.courier_company_id), costPaise: Math.round(rate.rate * 100), expires: Date.now() + 15 * 60000, cod: Boolean(rate.cod), ddp: false, dutiesPaise: 0 };
  }
  throw new CommerceError("Delivery is not configured yet.");
}
export async function razorpay(path: string, body?: unknown) {
  const creds = getActiveRazorpayCredentials();
  const id = creds.keyId || process.env.RAZORPAY_KEY_ID;
  const secret = creds.keySecret || process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new CommerceError("Payments are not configured yet.");
  if (
    process.env.NODE_ENV !== "production" &&
    (id.includes("dummy") || secret.includes("dummy") || id === "rzp_test_tea1234567890" || id.includes("1234567890"))
  ) {
    if (path === "orders" && body) {
      const b = body as { amount: number; currency: string };
      return { id: `order_dev${Date.now()}`, amount: b.amount, currency: b.currency };
    }
  }
  return providerFetch(`https://api.razorpay.com/v1/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
export function verifySignature(raw: string, signature: string, secret: string) {
  if (!secret || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function bookingPayload(orderId: string, q: Quote) {
  const a = q.input.address;
  return { order_id: orderId, order_date: new Date(q.created).toISOString().slice(0, 19).replace("T", " "), pickup_location: q.package.pickupLocation,
    billing_customer_name: a.name, billing_last_name: "", billing_address: a.line1, billing_address_2: a.line2, billing_city: a.city, billing_pincode: a.postcode,
    billing_state: a.state, billing_country: a.country, billing_email: a.email, billing_phone: a.phone, shipping_is_billing: true,
    order_items: q.lines.map(l => ({ name: l.name, sku: l.sku, units: l.quantity, selling_price: l.pricePaise / 100, hsn: q.package.hsn })),
    payment_method: q.input.method === "cod" ? "COD" : "Prepaid", sub_total: q.subtotalPaise / 100, total_discount: (q.discountPaise + (q.subscriptionDiscountPaise || 0) + (q.paymentDiscountPaise || 0)) / 100, shipping_charges: (q.subscription ? q.totalPaise - q.subtotalPaise + q.discountPaise + (q.subscriptionDiscountPaise || 0) + (q.paymentDiscountPaise || 0) : q.shippingPaise) / 100,
    length: q.package.length, breadth: q.package.breadth, height: q.package.height, weight: q.lines.reduce((s, l) => s + l.grams * l.quantity, q.package.tareGrams) / 1000 };
}
