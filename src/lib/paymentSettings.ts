import { z } from "zod";
import { getDb } from "@/lib/db";

export const paymentSettingsSchema = z.object({
  payment_mode: z.enum(["test", "production"]).default("test"),
  razorpay_enabled: z.boolean().default(true),
  // Active/Legacy fields for backwards compatibility
  razorpay_key_id: z.string().max(100).optional(),
  razorpay_key_secret: z.string().max(200).optional(),
  razorpay_webhook_secret: z.string().max(200).optional(),
  // Dedicated Test Mode credentials
  razorpay_test_key_id: z.string().max(100).optional(),
  razorpay_test_key_secret: z.string().max(200).optional(),
  razorpay_test_webhook_secret: z.string().max(200).optional(),
  // Dedicated Production Mode credentials
  razorpay_prod_key_id: z.string().max(100).optional(),
  razorpay_prod_key_secret: z.string().max(200).optional(),
  razorpay_prod_webhook_secret: z.string().max(200).optional(),
  // Cash on Delivery
  cod_enabled: z.boolean().default(true),
  cod_fee_rupees: z.coerce.number().min(0).default(50),
  cod_min_rupees: z.coerce.number().min(0).default(100),
  cod_max_rupees: z.coerce.number().min(0).default(5000),
  // Payment Method Discounts & Incentives
  upi_discount_enabled: z.boolean().default(true),
  upi_discount_type: z.enum(["percentage", "flat"]).default("percentage"),
  upi_discount_value: z.coerce.number().min(0).max(100).default(2),
  upi_discount_max_rupees: z.coerce.number().min(0).default(150),
  card_discount_enabled: z.boolean().default(true),
  card_discount_type: z.enum(["percentage", "flat"]).default("percentage"),
  card_discount_value: z.coerce.number().min(0).max(100).default(1),
  card_discount_max_rupees: z.coerce.number().min(0).default(100),
  netbanking_discount_enabled: z.boolean().default(true),
  netbanking_discount_type: z.enum(["percentage", "flat"]).default("percentage"),
  netbanking_discount_value: z.coerce.number().min(0).max(100).default(1),
  netbanking_discount_max_rupees: z.coerce.number().min(0).default(100),
  prepaid_discount_enabled: z.boolean().default(true),
  prepaid_discount_type: z.enum(["percentage", "flat"]).default("percentage"),
  prepaid_discount_value: z.coerce.number().min(0).max(100).default(1),
  prepaid_discount_max_rupees: z.coerce.number().min(0).default(100),
  min_order_for_discount_rupees: z.coerce.number().min(0).default(0),
  payment_discount_badge_text: z.string().max(100).default("⚡ Instant 2% Off with UPI · 1% Off on Cards"),
});

export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;

export type PaymentSettings = PaymentSettingsInput & {
  active_key_id: string;
  active_secret_configured: boolean;
  active_webhook_configured: boolean;
  razorpay_secret_configured: boolean;
  razorpay_webhook_configured: boolean;
  razorpay_test_secret_configured: boolean;
  razorpay_test_webhook_configured: boolean;
  razorpay_prod_secret_configured: boolean;
  razorpay_prod_webhook_configured: boolean;
  webhook_url: string;
  cod_fee_paise: number;
};

export function getActiveRazorpayCredentials(): {
  mode: "test" | "production";
  keyId: string;
  keySecret: string;
  webhookSecret: string;
} {
  let mode: "test" | "production" = "test";
  let keyId = "";
  let keySecret = "";
  let webhookSecret = "";

  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM store_settings WHERE key LIKE 'razorpay_%' OR key = 'payment_mode'").all() as Array<{
      key: string;
      value: string;
    }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const dbMode = map.get("payment_mode") as "test" | "production" | undefined;
    const envMode = process.env.RAZORPAY_MODE as "test" | "production" | undefined;
    mode = dbMode || envMode || ((process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_") ? "test" : "test");

    if (mode === "test") {
      keyId = map.get("razorpay_test_key_id") || process.env.RAZORPAY_TEST_KEY_ID || map.get("razorpay_key_id") || process.env.RAZORPAY_KEY_ID || "";
      keySecret = map.get("razorpay_test_key_secret") || process.env.RAZORPAY_TEST_KEY_SECRET || map.get("razorpay_key_secret") || process.env.RAZORPAY_KEY_SECRET || "";
      webhookSecret = map.get("razorpay_test_webhook_secret") || process.env.RAZORPAY_TEST_WEBHOOK_SECRET || map.get("razorpay_webhook_secret") || process.env.RAZORPAY_WEBHOOK_SECRET || "";
    } else {
      keyId = map.get("razorpay_prod_key_id") || process.env.RAZORPAY_PROD_KEY_ID || map.get("razorpay_key_id") || process.env.RAZORPAY_KEY_ID || "";
      keySecret = map.get("razorpay_prod_key_secret") || process.env.RAZORPAY_PROD_KEY_SECRET || map.get("razorpay_key_secret") || process.env.RAZORPAY_KEY_SECRET || "";
      webhookSecret = map.get("razorpay_prod_webhook_secret") || process.env.RAZORPAY_PROD_WEBHOOK_SECRET || map.get("razorpay_webhook_secret") || process.env.RAZORPAY_WEBHOOK_SECRET || "";
    }
  } catch {
    // Fallback if db is unavailable in early init
    const envMode = (process.env.RAZORPAY_MODE as "test" | "production") || "test";
    mode = envMode;
    if (mode === "test") {
      keyId = process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
      keySecret = process.env.RAZORPAY_TEST_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
      webhookSecret = process.env.RAZORPAY_TEST_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || "";
    } else {
      keyId = process.env.RAZORPAY_PROD_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
      keySecret = process.env.RAZORPAY_PROD_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
      webhookSecret = process.env.RAZORPAY_PROD_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || "";
    }
  }

  return { mode, keyId, keySecret, webhookSecret };
}

export function getPaymentSettings(baseUrl = "https://teafloww.com"): PaymentSettings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM store_settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const rzpEnabled = map.get("razorpay_enabled") !== "0";
  const activeCreds = getActiveRazorpayCredentials();

  // Test mode values
  const rzpTestKeyId = map.get("razorpay_test_key_id") || process.env.RAZORPAY_TEST_KEY_ID || "";
  const rzpTestSecret = map.get("razorpay_test_key_secret") || process.env.RAZORPAY_TEST_KEY_SECRET || "";
  const rzpTestWebhook = map.get("razorpay_test_webhook_secret") || process.env.RAZORPAY_TEST_WEBHOOK_SECRET || "";

  // Prod mode values
  const rzpProdKeyId = map.get("razorpay_prod_key_id") || process.env.RAZORPAY_PROD_KEY_ID || "";
  const rzpProdSecret = map.get("razorpay_prod_key_secret") || process.env.RAZORPAY_PROD_KEY_SECRET || "";
  const rzpProdWebhook = map.get("razorpay_prod_webhook_secret") || process.env.RAZORPAY_PROD_WEBHOOK_SECRET || "";

  // Fallback legacy
  const rzpLegacyKeyId = map.get("razorpay_key_id") || process.env.RAZORPAY_KEY_ID || activeCreds.keyId;
  const rzpLegacySecret = map.get("razorpay_key_secret") || process.env.RAZORPAY_KEY_SECRET || activeCreds.keySecret;
  const rzpLegacyWebhook = map.get("razorpay_webhook_secret") || process.env.RAZORPAY_WEBHOOK_SECRET || activeCreds.webhookSecret;

  const codEnabled = map.get("cod_enabled") !== "0";
  const codFeePaise = Number(map.get("cod_fee_paise") || "5000");
  const codMinPaise = Number(map.get("cod_min_paise") || "10000");
  const codMaxPaise = Number(map.get("cod_max_paise") || "500000");

  const normalizedBase = (process.env.APP_BASE_URL || baseUrl).replace(/\/+$/, "");

  return {
    payment_mode: activeCreds.mode,
    razorpay_enabled: rzpEnabled,
    razorpay_key_id: rzpLegacyKeyId,
    razorpay_key_secret: rzpLegacySecret ? "••••••••••••" : "",
    razorpay_webhook_secret: rzpLegacyWebhook ? "••••••••••••" : "",
    razorpay_secret_configured: Boolean(rzpLegacySecret),
    razorpay_webhook_configured: Boolean(rzpLegacyWebhook),

    razorpay_test_key_id: rzpTestKeyId || (activeCreds.mode === "test" ? rzpLegacyKeyId : ""),
    razorpay_test_key_secret: rzpTestSecret ? "••••••••••••" : "",
    razorpay_test_webhook_secret: rzpTestWebhook ? "••••••••••••" : "",
    razorpay_test_secret_configured: Boolean(rzpTestSecret || (activeCreds.mode === "test" && rzpLegacySecret)),
    razorpay_test_webhook_configured: Boolean(rzpTestWebhook || (activeCreds.mode === "test" && rzpLegacyWebhook)),

    razorpay_prod_key_id: rzpProdKeyId,
    razorpay_prod_key_secret: rzpProdSecret ? "••••••••••••" : "",
    razorpay_prod_webhook_secret: rzpProdWebhook ? "••••••••••••" : "",
    razorpay_prod_secret_configured: Boolean(rzpProdSecret),
    razorpay_prod_webhook_configured: Boolean(rzpProdWebhook),

    active_key_id: activeCreds.keyId,
    active_secret_configured: Boolean(activeCreds.keySecret),
    active_webhook_configured: Boolean(activeCreds.webhookSecret),

    webhook_url: `${normalizedBase}/api/webhooks/razorpay`,
    cod_enabled: codEnabled,
    cod_fee_rupees: Math.round(codFeePaise / 100),
    cod_fee_paise: codFeePaise,
    cod_min_rupees: Math.round(codMinPaise / 100),
    cod_max_rupees: Math.round(codMaxPaise / 100),

    // Payment Method Discounts & Incentives
    upi_discount_enabled: map.get("upi_discount_enabled") !== "0",
    upi_discount_type: (map.get("upi_discount_type") as "percentage" | "flat") || "percentage",
    upi_discount_value: Number(map.get("upi_discount_value") ?? "2"),
    upi_discount_max_rupees: Number(map.get("upi_discount_max_rupees") ?? "150"),

    card_discount_enabled: map.get("card_discount_enabled") !== "0",
    card_discount_type: (map.get("card_discount_type") as "percentage" | "flat") || "percentage",
    card_discount_value: Number(map.get("card_discount_value") ?? "1"),
    card_discount_max_rupees: Number(map.get("card_discount_max_rupees") ?? "100"),

    netbanking_discount_enabled: map.get("netbanking_discount_enabled") !== "0",
    netbanking_discount_type: (map.get("netbanking_discount_type") as "percentage" | "flat") || "percentage",
    netbanking_discount_value: Number(map.get("netbanking_discount_value") ?? "1"),
    netbanking_discount_max_rupees: Number(map.get("netbanking_discount_max_rupees") ?? "100"),

    prepaid_discount_enabled: map.get("prepaid_discount_enabled") === "1",
    prepaid_discount_type: (map.get("prepaid_discount_type") as "percentage" | "flat") || "percentage",
    prepaid_discount_value: Number(map.get("prepaid_discount_value") ?? "0"),
    prepaid_discount_max_rupees: Number(map.get("prepaid_discount_max_rupees") ?? "0"),

    min_order_for_discount_rupees: Number(map.get("min_order_for_discount_rupees") ?? "0"),
    payment_discount_badge_text: map.get("payment_discount_badge_text") || "⚡ Instant 2% Off with UPI · 1% Off on Cards",
  };
}

export function updatePaymentSettings(rawInput: unknown): PaymentSettings {
  const parsed = paymentSettingsSchema.parse(rawInput);
  const db = getDb();

  const updates: Array<[string, string]> = [
    ["payment_mode", parsed.payment_mode],
    ["razorpay_enabled", parsed.razorpay_enabled ? "1" : "0"],
    ["cod_enabled", parsed.cod_enabled ? "1" : "0"],
    ["cod_fee_paise", String(Math.round(parsed.cod_fee_rupees * 100))],
    ["cod_min_paise", String(Math.round(parsed.cod_min_rupees * 100))],
    ["cod_max_paise", String(Math.round(parsed.cod_max_rupees * 100))],
    ["upi_discount_enabled", parsed.upi_discount_enabled ? "1" : "0"],
    ["upi_discount_type", parsed.upi_discount_type],
    ["upi_discount_value", String(parsed.upi_discount_value)],
    ["upi_discount_max_rupees", String(parsed.upi_discount_max_rupees)],
    ["card_discount_enabled", parsed.card_discount_enabled ? "1" : "0"],
    ["card_discount_type", parsed.card_discount_type],
    ["card_discount_value", String(parsed.card_discount_value)],
    ["card_discount_max_rupees", String(parsed.card_discount_max_rupees)],
    ["netbanking_discount_enabled", parsed.netbanking_discount_enabled ? "1" : "0"],
    ["netbanking_discount_type", parsed.netbanking_discount_type],
    ["netbanking_discount_value", String(parsed.netbanking_discount_value)],
    ["netbanking_discount_max_rupees", String(parsed.netbanking_discount_max_rupees)],
    ["prepaid_discount_enabled", parsed.prepaid_discount_enabled ? "1" : "0"],
    ["prepaid_discount_type", parsed.prepaid_discount_type],
    ["prepaid_discount_value", String(parsed.prepaid_discount_value)],
    ["prepaid_discount_max_rupees", String(parsed.prepaid_discount_max_rupees)],
    ["min_order_for_discount_rupees", String(parsed.min_order_for_discount_rupees)],
    ["payment_discount_badge_text", parsed.payment_discount_badge_text],
  ];

  // If specific test/prod keys provided, save them
  if (parsed.razorpay_test_key_id !== undefined) {
    updates.push(["razorpay_test_key_id", parsed.razorpay_test_key_id.trim()]);
  }
  if (parsed.razorpay_prod_key_id !== undefined) {
    updates.push(["razorpay_prod_key_id", parsed.razorpay_prod_key_id.trim()]);
  }

  // Handle active/legacy razorpay_key_id
  if (parsed.razorpay_key_id !== undefined) {
    const trimmed = parsed.razorpay_key_id.trim();
    updates.push(["razorpay_key_id", trimmed]);
    if (parsed.payment_mode === "test" && parsed.razorpay_test_key_id === undefined) {
      updates.push(["razorpay_test_key_id", trimmed]);
    } else if (parsed.payment_mode === "production" && parsed.razorpay_prod_key_id === undefined) {
      updates.push(["razorpay_prod_key_id", trimmed]);
    }
  }

  // Secrets: Test mode
  if (parsed.razorpay_test_key_secret && !parsed.razorpay_test_key_secret.startsWith("•••")) {
    updates.push(["razorpay_test_key_secret", parsed.razorpay_test_key_secret.trim()]);
  }
  if (parsed.razorpay_test_webhook_secret && !parsed.razorpay_test_webhook_secret.startsWith("•••")) {
    updates.push(["razorpay_test_webhook_secret", parsed.razorpay_test_webhook_secret.trim()]);
  }

  // Secrets: Production mode
  if (parsed.razorpay_prod_key_secret && !parsed.razorpay_prod_key_secret.startsWith("•••")) {
    updates.push(["razorpay_prod_key_secret", parsed.razorpay_prod_key_secret.trim()]);
  }
  if (parsed.razorpay_prod_webhook_secret && !parsed.razorpay_prod_webhook_secret.startsWith("•••")) {
    updates.push(["razorpay_prod_webhook_secret", parsed.razorpay_prod_webhook_secret.trim()]);
  }

  // Legacy fallback secret updates
  if (parsed.razorpay_key_secret && !parsed.razorpay_key_secret.startsWith("•••")) {
    const trimmed = parsed.razorpay_key_secret.trim();
    updates.push(["razorpay_key_secret", trimmed]);
    if (parsed.payment_mode === "test" && !parsed.razorpay_test_key_secret) {
      updates.push(["razorpay_test_key_secret", trimmed]);
    } else if (parsed.payment_mode === "production" && !parsed.razorpay_prod_key_secret) {
      updates.push(["razorpay_prod_key_secret", trimmed]);
    }
  }

  if (parsed.razorpay_webhook_secret && !parsed.razorpay_webhook_secret.startsWith("•••")) {
    const trimmed = parsed.razorpay_webhook_secret.trim();
    updates.push(["razorpay_webhook_secret", trimmed]);
    if (parsed.payment_mode === "test" && !parsed.razorpay_test_webhook_secret) {
      updates.push(["razorpay_test_webhook_secret", trimmed]);
    } else if (parsed.payment_mode === "production" && !parsed.razorpay_prod_webhook_secret) {
      updates.push(["razorpay_prod_webhook_secret", trimmed]);
    }
  }

  const upsert = db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const [key, val] of updates) {
      upsert.run(key, val);
    }

    // Synchronize COD settings into commerce_markets for 'IN'
    try {
      const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code = 'IN'").get() as { document: string } | undefined;
      if (inRow && inRow.document) {
        const doc = JSON.parse(inRow.document);
        if (doc.cod) {
          doc.cod.enabled = parsed.cod_enabled;
          doc.cod.feePaise = Math.round(parsed.cod_fee_rupees * 100);
          doc.cod.minPaise = Math.round(parsed.cod_min_rupees * 100);
          doc.cod.maxPaise = Math.round(parsed.cod_max_rupees * 100);
          db.prepare(
            "UPDATE commerce_markets SET document = ?, version = version + 1 WHERE code = 'IN'"
          ).run(JSON.stringify(doc));
        }
      }
    } catch {}
  })();

  return getPaymentSettings();
}

export function calculatePaymentMethodDiscountPaise(
  method: "prepaid" | "upi" | "card" | "netbanking" | "cod",
  merchandisePaise: number,
  settings: PaymentSettings
): { discountPaise: number; label: string; ratePercent?: number } {
  if (method === "cod" || merchandisePaise <= 0) {
    return { discountPaise: 0, label: "No payment discount" };
  }
  const minOrderPaise = Math.round(settings.min_order_for_discount_rupees * 100);
  if (merchandisePaise < minOrderPaise) {
    return { discountPaise: 0, label: "Order below minimum for discount" };
  }

  let enabled = false;
  let type: "percentage" | "flat" = "percentage";
  let value = 0;
  let maxRupees = 0;
  let label = "Prepaid Discount";

  if (method === "upi") {
    enabled = settings.upi_discount_enabled;
    type = settings.upi_discount_type;
    value = settings.upi_discount_value;
    maxRupees = settings.upi_discount_max_rupees;
    label = "⚡ Instant UPI / QR Discount";
  } else if (method === "card") {
    enabled = settings.card_discount_enabled;
    type = settings.card_discount_type;
    value = settings.card_discount_value;
    maxRupees = settings.card_discount_max_rupees;
    label = "💳 Card Payment Discount";
  } else if (method === "netbanking") {
    enabled = settings.netbanking_discount_enabled;
    type = settings.netbanking_discount_type;
    value = settings.netbanking_discount_value;
    maxRupees = settings.netbanking_discount_max_rupees;
    label = "🏦 Net Banking Discount";
  } else {
    enabled = settings.prepaid_discount_enabled;
    type = settings.prepaid_discount_type;
    value = settings.prepaid_discount_value;
    maxRupees = settings.prepaid_discount_max_rupees;
    label = "⚡ Prepaid Order Discount";
  }

  if (!enabled || value <= 0) {
    return { discountPaise: 0, label };
  }

  let calculatedPaise = 0;
  if (type === "percentage") {
    calculatedPaise = Math.round((merchandisePaise * value) / 100);
  } else {
    calculatedPaise = Math.round(value * 100);
  }

  if (maxRupees > 0) {
    const maxPaise = Math.round(maxRupees * 100);
    calculatedPaise = Math.min(calculatedPaise, maxPaise);
  }

  calculatedPaise = Math.min(calculatedPaise, merchandisePaise);

  return {
    discountPaise: calculatedPaise,
    label: type === "percentage" ? `${label} (${value}%)` : `${label} (₹${value} off)`,
    ratePercent: type === "percentage" ? value : undefined,
  };
}
