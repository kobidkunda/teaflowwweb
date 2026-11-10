import { z } from "zod";
export const LANGUAGES = [
  { code: "en", name: "English", dir: "ltr" }, { code: "hi", name: "हिन्दी", dir: "ltr" },
  { code: "bn", name: "বাংলা", dir: "ltr" }, { code: "ar", name: "العربية", dir: "rtl" },
  { code: "fr", name: "Français", dir: "ltr" }, { code: "de", name: "Deutsch", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" }, { code: "pt", name: "Português", dir: "ltr" },
  { code: "ja", name: "日本語", dir: "ltr" }, { code: "zh-CN", name: "简体中文", dir: "ltr" },
] as const;
export const localeSchema = z.enum(["en", "hi", "bn", "ar", "fr", "de", "es", "pt", "ja", "zh-CN"]);
export const countrySchema = z.string().regex(/^[A-Z]{2}$/);
export const currencySchema = z.string().regex(/^[A-Z]{3}$/).refine(v => Intl.supportedValuesOf("currency").includes(v), "Unsupported currency");
const amount = z.number().int().min(0).max(100_000_000);
export const marketSchema = z.object({
  code: countrySchema, name: z.string().trim().min(1).max(100), providerId: z.string().max(30).default(""),
  covered: z.boolean().default(false), enabled: z.boolean().default(false),
  currency: currencySchema.default("INR"), language: localeSchema.default("en"),
  approvedCurrencies: z.array(currencySchema).max(30).default(["INR"]),
  taxApproved: z.boolean().default(false), taxPercent: z.number().min(0).max(100).default(0),
  taxInclusive: z.boolean().default(true), exportApproved: z.boolean().default(false),
  duties: z.enum(["recipient", "included"]).default("recipient"),
  shipping: z.enum(["live", "flat", "included"]).default("live"), flatPaise: amount.default(9900),
  freeAbovePaise: amount.nullable().default(null), handlingPaise: amount.default(0), subsidyPaise: amount.default(0),
  fxMarkupBps: z.number().int().min(0).max(3000).default(0), roundingMinor: z.number().int().min(1).max(1000).default(1),
  blockedPostcodes: z.array(z.string().max(20)).max(500).default([]), blockedStates: z.array(z.string().max(100)).max(100).default([]),
  deliveryOverrides: z.array(z.object({ postcodes: z.array(z.string().max(20)).max(500).default([]), states: z.array(z.string().max(100)).max(100).default([]), flatPaise: amount, freeAbovePaise: amount.nullable().default(null) }).strict().refine(r => r.postcodes.length + r.states.length > 0, "Choose PIN codes or states.")).max(100).default([]),
  blockedSkus: z.array(z.string().max(100)).max(1000).default([]),
  cod: z.object({ enabled: z.boolean().default(false), postcodes: z.array(z.string().regex(/^\d{6}$/)).max(1000).default([]),
    minPaise: amount.default(0), maxPaise: amount.default(100000), feePaise: amount.default(0), blockedSkus: z.array(z.string().max(100)).max(1000).default([]) }).default({ enabled: false, postcodes: [], minPaise: 0, maxPaise: 100000, feePaise: 0, blockedSkus: [] }),
}).strict();
export type Market = z.infer<typeof marketSchema>;
export const packageSchema = z.object({
  pickupPostcode: z.string().regex(/^\d{6}$/), pickupLocation: z.string().min(1).max(100),
  length: z.number().positive().max(200), breadth: z.number().positive().max(200), height: z.number().positive().max(200),
  tareGrams: z.number().int().min(0).max(10000), maxGrams: z.number().int().positive().max(50000).default(50000),
  hsn: z.string().regex(/^\d{6,10}$/), origin: z.literal("IN").default("IN"),
}).strict();
export type Package = z.infer<typeof packageSchema>;
export const addressSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address").max(254),
  phone: z.string().regex(/^\+?[\d ()-]{7,25}$/, "Please enter a valid phone number"),
  line1: z.string().trim().min(5, "Street address must be at least 5 characters").max(180),
  line2: z.string().trim().max(180).default(""),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().min(1, "State or region is required").max(80),
  postcode: z.string().trim().max(20),
  country: countrySchema,
}).strip().superRefine((v, ctx) => {
  if (v.country === "IN" && !/^\d{6}$/.test(v.postcode))
    ctx.addIssue({ code: "custom", path: ["postcode"], message: "Enter a six-digit PIN code." });
});
export const quoteSchema = z.object({ address: addressSchema, currency: currencySchema, locale: localeSchema.default("en"),
  method: z.enum(["prepaid", "upi", "card", "netbanking", "cod"]).default("prepaid"), coupon: z.string().trim().max(24).default(""),
  items: z.array(z.object({ variantId: z.number().int().min(0).default(0), trialId: z.string().trim().min(1).max(100).optional(), quantity: z.number().int().min(1).max(20) }).strict().refine(l => l.trialId ? l.variantId === 0 : l.variantId > 0, "Choose a product variant or tasting kit.")).min(1).max(30),
}).strict();
export type QuoteInput = z.infer<typeof quoteSchema>;
export class CommerceError extends Error {}
export type QuoteLine = { trialId?: string; trialTracked?: boolean; variantId: number; quantity: number; pricePaise: number; grams: number; sku: string; name: string };
export type Quote = { subscription?: import("@/lib/subscriptions/model").SubscriptionQuote; subscriptionDiscountPaise?: number; id: string; owner: string; fingerprint: string; input: QuoteInput; lines: QuoteLine[]; marketVersion: number;
  currency: string; rate: string; rateId: string | null; expires: number; created: number; carrier: string; carrierCostPaise: number;
  dutiesPaise: number; subtotalPaise: number; discountPaise: number; paymentDiscountPaise?: number; shippingPaise: number; taxPaise: number; totalPaise: number;
  analyticsTaxMinor?: number; components: { merchandise: number; shipping: number; duties: number; tax: number; cod: number; paymentDiscount?: number }; totalMinor: number; package: Package;
};
