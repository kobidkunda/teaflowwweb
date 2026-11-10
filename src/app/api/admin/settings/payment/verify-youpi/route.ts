import { NextResponse } from "next/server";
import { guard, conflict } from "@/lib/adminHttp";
import { getActiveYoupiClient, getYoupiConfig } from "@/lib/youpi/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const config = getYoupiConfig();
    const client = getActiveYoupiClient(5000);

    // 1. Check health
    const health = await client.checkHealth();

    // 2. Try admin settings query if API token is configured
    let merchantInfo: Record<string, unknown> | null = null;
    let authStatus = "unverified";
    if (config.apiKey) {
      try {
        merchantInfo = await client.checkAdminSettings();
        authStatus = "authenticated";
      } catch (err: unknown) {
        authStatus = `auth_error: ${(err as Error)?.message || "failed"}`;
      }
    }

    return NextResponse.json({
      ok: true,
      health,
      authStatus,
      config: {
        apiUrl: config.apiUrl,
        checkoutUrl: config.checkoutUrl,
        adminUrl: config.adminUrl,
        merchantId: config.merchantId,
        apiKeyConfigured: config.apiKeyConfigured,
        webhookSecretConfigured: config.webhookSecretConfigured,
      },
    });
  } catch (err: unknown) {
    return conflict(
      (err as Error)?.message || "Unable to reach YouPI gateway API."
    );
  }
}
