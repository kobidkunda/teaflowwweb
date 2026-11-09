import React from "react";
import { headers } from "next/headers";
import { getFeedCatalogData, resolveBaseUrl } from "@/lib/feeds";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { AdminFeedsClient } from "@/components/admin/feeds/AdminFeedsClient";

export const metadata = {
  title: "Product Feeds & Syndication | Himalayan Tea House Admin",
  description:
    "Manage Google Merchant Center and Meta Product Catalog feeds, test access tokens, and inspect live syndicated variants",
};

export default async function AdminFeedsPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ||
    (host && (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("192.168.") || host.includes(":3000")) ? "http" : "https");
  const detectedOrigin = host && !host.startsWith("0.0.0.0") ? `${proto}://${host}` : undefined;

  const baseUrl = resolveBaseUrl(detectedOrigin);
  const items = getFeedCatalogData(baseUrl);
  const configuredToken = process.env.FEED_ACCESS_TOKEN;
  const isTokenProtected = Boolean(configuredToken && configuredToken.trim().length > 0);

  return (
    <AdminAuthGate>
      <AdminFeedsClient
        initialItems={items}
        isTokenProtected={isTokenProtected}
        configuredToken={configuredToken}
        baseUrl={baseUrl}
        detectedOrigin={detectedOrigin}
      />
    </AdminAuthGate>
  );
}
