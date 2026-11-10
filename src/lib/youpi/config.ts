import { getDb } from "@/lib/db";
import { YoupiPaymentClient } from "./client";

export interface YoupiRuntimeConfig {
  enabled: boolean;
  apiUrl: string;
  checkoutUrl: string;
  adminUrl: string;
  merchantId: string;
  apiKey: string;
  webhookSecret: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
}

export function getYoupiConfig(): YoupiRuntimeConfig {
  let dbMap = new Map<string, string>();
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT key, value FROM store_settings WHERE key LIKE 'youpi_%'"
      )
      .all() as Array<{ key: string; value: string }>;
    dbMap = new Map(rows.map((r) => [r.key, r.value]));
  } catch {
    // DB might be unavailable during early test initialization
  }

  const enabled = dbMap.get("youpi_enabled") !== "0";

  const apiUrl =
    dbMap.get("youpi_api_url") ||
    process.env.YOUPI_API_URL ||
    process.env.BASE_PAYMENT_API_URL ||
    "https://pay-api.biolastic.co.in";

  const checkoutUrl =
    dbMap.get("youpi_checkout_url") ||
    process.env.YOUPI_CHECKOUT_URL ||
    process.env.BASE_CHECKOUT_URL ||
    "https://pay.biolastic.co.in";

  const adminUrl =
    dbMap.get("youpi_admin_url") ||
    process.env.YOUPI_ADMIN_URL ||
    process.env.BASE_ADMIN_URL ||
    "https://pay-admin.biolastic.co.in";

  const merchantId =
    dbMap.get("youpi_merchant_id") ||
    process.env.YOUPI_MERCHANT_ID ||
    "00000000-0000-0000-0000-000000000001";

  const apiKey =
    dbMap.get("youpi_api_token") ||
    process.env.YOUPI_API_TOKEN ||
    process.env.ADMIN_API_TOKEN ||
    "";

  const webhookSecret =
    dbMap.get("youpi_webhook_secret") ||
    process.env.YOUPI_WEBHOOK_SECRET ||
    "12ce536e9cff839f2ab5a1cbfb5af3ceb4bb0ea56b06b3f5b890acde47908667";

  return {
    enabled,
    apiUrl: apiUrl.replace(/\/+$/, ""),
    checkoutUrl: checkoutUrl.replace(/\/+$/, ""),
    adminUrl: adminUrl.replace(/\/+$/, ""),
    merchantId,
    apiKey,
    webhookSecret,
    apiKeyConfigured: Boolean(apiKey),
    webhookSecretConfigured: Boolean(webhookSecret),
  };
}

export function getActiveYoupiClient(timeoutMs = 10000): YoupiPaymentClient {
  const config = getYoupiConfig();
  return new YoupiPaymentClient({
    apiUrl: config.apiUrl,
    checkoutUrl: config.checkoutUrl,
    adminUrl: config.adminUrl,
    merchantId: config.merchantId,
    apiKey: config.apiKey,
    webhookSecret: config.webhookSecret,
    timeoutMs,
  });
}
