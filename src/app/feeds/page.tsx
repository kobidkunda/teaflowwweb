import React from "react";
import type { Metadata } from "next";
import { getFeedCatalogData, resolveBaseUrl } from "@/lib/feeds";
import { FeedsClient } from "@/components/feeds/FeedsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Product Feeds & Syndication",
  description:
    "Live, scheduled catalog feeds for Google Merchant Center and Meta (Facebook & Instagram) Catalog.",
};

export default function FeedsPage() {
  const publicBaseUrl = resolveBaseUrl();
  const items = getFeedCatalogData(publicBaseUrl);
  const isTokenProtected = Boolean((process.env.FEED_ACCESS_TOKEN || "").trim());

  return (
    <div className="container page-shell feeds-page" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <FeedsClient items={items} isTokenProtected={isTokenProtected} publicBaseUrl={publicBaseUrl} />
    </div>
  );
}
