"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect } from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import {
  Rss,
  Table,
  Copy,
  Check,
  Download,
  ExternalLink,
  Shield,
  ShieldAlert,
  Info,
  CheckCircle,
  Search,
} from "lucide-react";
import type { FeedItem } from "@/lib/feedTypes";
import { isPrivateHost } from "@/lib/feedsHost";

interface FeedsClientProps {
  items: FeedItem[];
  isTokenProtected: boolean;
  publicBaseUrl?: string;
}

export function FeedsClient({ items, isTokenProtected, publicBaseUrl }: FeedsClientProps) {
  const [origin, setOrigin] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const totalVariants = items.length;
  const uniqueProducts = new Set(items.map((i) => i.itemGroupId)).size;
  const inStockCount = items.filter((i) => i.availability === "in_stock").length;
  const outOfStockCount = items.filter((i) => i.availability === "out_of_stock").length;

  const isOriginPrivate = !origin || isPrivateHost(origin);
  const effectivePublicOrigin = (
    !isOriginPrivate ? origin : (publicBaseUrl || "https://teafloww.com")
  ).replace(/\/+$/, "");

  const buildUrl = (path: string, download = false) => {
    // For downloads, use relative URL with base_url parameter so it downloads from current server
    // For live copy/scheduled fetch, use public canonical domain so Googlebot can crawl it
    const base = download ? path : `${effectivePublicOrigin}${path}`;
    const params = new URLSearchParams();
    if (download) {
      params.set("download", "1");
      params.set("base_url", effectivePublicOrigin);
    }
    if (tokenInput.trim()) {
      params.set("token", tokenInput.trim());
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.itemGroupId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="feeds-management-view">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: "20px" }}>
        <Link href="/"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span aria-current="page" style={{ fontWeight: 600 }}> <StorefrontText id="copy_e98f3fd41a4da40e" fallback="Product Feeds" /> </span>
      </nav>

      {/* Header */}
      <header style={{ marginBottom: "32px" }}>
        <p className="eyebrow" style={{ marginBottom: "8px" }}>Syndication &amp; Commerce Catalog</p>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", marginBottom: "12px" }}> <StorefrontText id="copy_e98f3fd41a4da40e" fallback="Product Feeds" /> </h1>
        <p style={{ maxWidth: "780px", color: "var(--ink)", opacity: 0.85, fontSize: "16px", lineHeight: 1.6 }}> <StorefrontText id="copy_cfb0d96b49699c39" fallback="Automated, live catalog endpoints for" /> <strong> <StorefrontText id="copy_c84de92a0ac6a883" fallback="Google Merchant Center" /> </strong> <StorefrontText id="copy_6201111b83a0cb5b" fallback="and" /> <strong> <StorefrontText id="copy_d74a2ea2a83eb09a" fallback="Meta Catalog" /> </strong> (Facebook &amp; Instagram Shops). Synchronize single-estate tea variants, real-time pricing, stock availability, and image metadata with zero manual effort.
        </p>
      </header>

      {/* Overview Metric Badges */}
      <section
        aria-label="Feed health and catalog metrics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "36px",
        }}
      >
        <div style={{ background: "white", padding: "18px 20px", borderRadius: "8px", border: "1px solid var(--stone)" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5a6655", marginBottom: "6px" }}> <StorefrontText id="copy_8d67950d1f6917cb" fallback="Total SKUs / Variants" /> </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--forest)" }}>{totalVariants}</div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}> <StorefrontText id="copy_fb3b7e31308a8569" fallback="Across" /> {uniqueProducts} <StorefrontText id="copy_85aa1aa80c24ff2e" fallback="tea lines" /> </div>
        </div>

        <div style={{ background: "white", padding: "18px 20px", borderRadius: "8px", border: "1px solid var(--stone)" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5a6655", marginBottom: "6px" }}> <StorefrontText id="copy_64254d0b795cfb28" fallback="In Stock" /> </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#23483a" }}>{inStockCount}</div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}> <StorefrontText id="copy_9763b0d6a3f97b82" fallback="Marked in_stock" /> </div>
        </div>

        <div style={{ background: "white", padding: "18px 20px", borderRadius: "8px", border: "1px solid var(--stone)" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5a6655", marginBottom: "6px" }}> <StorefrontText id="copy_58d68e7eecc7e366" fallback="Out of Stock" /> </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: outOfStockCount > 0 ? "#b36b3d" : "#5a6655" }}>
            {outOfStockCount}
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}> <StorefrontText id="copy_2a2d2a1eae1f1119" fallback="Marked out_of_stock" /> </div>
        </div>

        <div style={{ background: "white", padding: "18px 20px", borderRadius: "8px", border: "1px solid var(--stone)" }}>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5a6655", marginBottom: "6px" }}> <StorefrontText id="copy_4c67bef41ef14807" fallback="Access Security" /> </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            {isTokenProtected ? (
              <>
                <ShieldAlert size={20} color="#b36b3d" />
                <span style={{ fontWeight: 600, color: "#b36b3d", fontSize: "16px" }}> <StorefrontText id="copy_da72aac93c712156" fallback="Token Protected" /> </span>
              </>
            ) : (
              <>
                <Shield size={20} color="#23483a" />
                <span style={{ fontWeight: 600, color: "#23483a", fontSize: "16px" }}> <StorefrontText id="copy_982c9a2fa1a352ea" fallback="Public Access" /> </span>
              </>
            )}
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
            {isTokenProtected ? "FEED_ACCESS_TOKEN active" : "Crawler ready"}
          </div>
        </div>
      </section>

      {/* Token Parameter Tester (if protected or for testing) */}
      <section
        style={{
          background: "var(--paper2)",
          border: "1px solid var(--stone)",
          borderRadius: "8px",
          padding: "20px 24px",
          marginBottom: "36px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Info size={20} style={{ color: "var(--pine)", marginTop: "2px", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "6px" }}> <StorefrontText id="copy_dcda7c29f816b309" fallback="Feed Access Token (Optional)" /> </h2>
            <p style={{ fontSize: "13px", color: "var(--ink)", opacity: 0.8, marginBottom: "12px" }}>
              {isTokenProtected
                ? "This server requires an authorization token for external crawler requests. Provide your token below to automatically append it to the feed URLs and download links."
                : "The server is currently running in public mode. If you configure FEED_ACCESS_TOKEN in your environment, pass your secret token here to verify secured feed URLs."}
            </p>
            <div style={{ display: "flex", gap: "10px", maxWidth: "540px" }}>
              <input
                type="text"
                placeholder="Enter feed token (e.g., secret-feed-key)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid var(--stone)",
                  background: "white",
                  fontSize: "14px",
                }}
                aria-label="Feed access token"
              />
              {tokenInput && (
                <button
                  type="button"
                  onClick={() => setTokenInput("")}
                  className="button button-outline"
                  style={{ minHeight: "38px", padding: "8px 14px" }}
                > <StorefrontText id="copy_83b12c2216efb4fd" fallback="Clear" /> </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Feed Channels Grid */}
      <section aria-label="Available product feeds" style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "24px", marginBottom: "20px" }}> <StorefrontText id="copy_42670de79c84470b" fallback="Available Live Feeds" /> </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
          
          {/* Channel 1: Google Merchant Center (XML) */}
          <article
            style={{
              background: "white",
              borderRadius: "8px",
              border: "1px solid var(--stone)",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "#e8ede7", padding: "10px", borderRadius: "6px", color: "var(--forest)" }}>
                  <Rss size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: "20px", margin: 0 }}> <StorefrontText id="copy_c84de92a0ac6a883" fallback="Google Merchant Center" /> </h3>
                  <span style={{ fontSize: "12px", color: "#666" }}> <StorefrontText id="copy_6fc006d7bb5a8c65" fallback="RSS 2.0 XML with Google Namespace" /> </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: "#e8ede7",
                  color: "var(--forest)",
                  letterSpacing: "0.05em",
                }}
              > <StorefrontText id="copy_d8020c789089e08b" fallback="XML FEED" /> </span>
            </div>

            <p style={{ fontSize: "14px", color: "#444", marginBottom: "20px", flexGrow: 1 }}> <StorefrontText id="copy_8f9287b92294f40a" fallback="Official RSS 2.0 feed with" /> <code>xmlns:g=&quot;http://base.google.com/ns/1.0&quot;</code> <StorefrontText id="copy_af3a6b4bd79e833c" fallback="attributes. Compatible with Google Shopping, Free Listings, Performance Max campaigns, and Meta Catalog automated sync." /> </p>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#5a6655", marginBottom: "6px" }}> <StorefrontText id="copy_1d91030ea3810937" fallback="Live Feed URL (Scheduled Fetch)" /> </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--paper)",
                  border: "1px solid var(--stone)",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  gap: "8px",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--forest)",
                    fontFamily: "monospace",
                  }}
                >
                  {buildUrl("/feeds/google.xml")}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(buildUrl("/feeds/google.xml"), "google-xml")}
                  className="icon-button"
                  title="Copy XML URL"
                  aria-label="Copy Google Merchant XML feed URL"
                  style={{ padding: "4px" }}
                >
                  {copiedKey === "google-xml" ? <Check size={16} color="#23483a" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => copyToClipboard(buildUrl("/feeds/google.xml"), "google-xml")}
                className="button button-primary"
                style={{ flex: 1, minHeight: "40px" }}
              >
                {copiedKey === "google-xml" ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedKey === "google-xml" ? "Copied URL!" : "Copy Live URL"}</span>
              </button>
              <a
                href={buildUrl("/feeds/google.xml", true)}
                download="google-merchant-feed.xml"
                className="button button-outline"
                style={{ minHeight: "40px", padding: "10px 16px" }}
                title="Download XML File"
              >
                <Download size={16} />
                <span> <StorefrontText id="copy_5a3e760522e7314e" fallback="Download XML" /> </span>
              </a>
              <a
                href={buildUrl("/feeds/google.xml")}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-cream"
                style={{ minHeight: "40px", padding: "10px 14px" }}
                title="View in new tab"
                aria-label="View Google Merchant XML in new browser tab"
              >
                <ExternalLink size={16} />
              </a>
            </div>

            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #eee", fontSize: "12px", color: "#666" }}>
              <strong> <StorefrontText id="copy_77d5aa1023fd7a88" fallback="Endpoint Alias:" /> </strong> <code>/api/feeds/google-merchant</code>
            </div>
          </article>

          {/* Channel 2: Meta Catalog (CSV) */}
          <article
            style={{
              background: "white",
              borderRadius: "8px",
              border: "1px solid var(--stone)",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "#e8ede7", padding: "10px", borderRadius: "6px", color: "var(--forest)" }}>
                  <Table size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: "20px", margin: 0 }}> <StorefrontText id="copy_d9115da483e5fd1c" fallback="Meta Product Catalog" /> </h3>
                  <span style={{ fontSize: "12px", color: "#666" }}> <StorefrontText id="copy_411f43c7be75abd7" fallback="RFC 4180 CSV Spreadsheet" /> </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: "#e8ede7",
                  color: "var(--forest)",
                  letterSpacing: "0.05em",
                }}
              > <StorefrontText id="copy_fc5936e952b7309e" fallback="CSV FEED" /> </span>
            </div>

            <p style={{ fontSize: "14px", color: "#444", marginBottom: "20px", flexGrow: 1 }}>
              Formatted CSV data feed adhering to Facebook &amp; Instagram Commerce Manager standards. Includes standard headers: <code>id</code>, <code>title</code>, <code>description</code>, <code>availability</code>, <code>price</code>, <code>link</code>, <code>image_link</code> <StorefrontText id="copy_4aa9bfd2f175a94a" fallback=", and" /> <code>google_product_category</code>.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#5a6655", marginBottom: "6px" }}> <StorefrontText id="copy_8dd25149adb8be68" fallback="Live Feed URL (Data Feed Sync)" /> </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--paper)",
                  border: "1px solid var(--stone)",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  gap: "8px",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "var(--forest)",
                    fontFamily: "monospace",
                  }}
                >
                  {buildUrl("/feeds/catalog.csv")}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(buildUrl("/feeds/catalog.csv"), "meta-csv")}
                  className="icon-button"
                  title="Copy CSV URL"
                  aria-label="Copy Meta Catalog CSV feed URL"
                  style={{ padding: "4px" }}
                >
                  {copiedKey === "meta-csv" ? <Check size={16} color="#23483a" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => copyToClipboard(buildUrl("/feeds/catalog.csv"), "meta-csv")}
                className="button button-primary"
                style={{ flex: 1, minHeight: "40px" }}
              >
                {copiedKey === "meta-csv" ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedKey === "meta-csv" ? "Copied URL!" : "Copy Live URL"}</span>
              </button>
              <a
                href={buildUrl("/feeds/catalog.csv", true)}
                download="catalog-feed.csv"
                className="button button-outline"
                style={{ minHeight: "40px", padding: "10px 16px" }}
                title="Download CSV File"
              >
                <Download size={16} />
                <span> <StorefrontText id="copy_a4023b89022f326c" fallback="Download CSV" /> </span>
              </a>
              <a
                href={buildUrl("/feeds/catalog.csv")}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-cream"
                style={{ minHeight: "40px", padding: "10px 14px" }}
                title="View in new tab"
                aria-label="View Meta Catalog CSV in new browser tab"
              >
                <ExternalLink size={16} />
              </a>
            </div>

            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #eee", fontSize: "12px", color: "#666" }}>
              <strong> <StorefrontText id="copy_77d5aa1023fd7a88" fallback="Endpoint Alias:" /> </strong> <code>/api/feeds/meta</code>
            </div>
          </article>
        </div>
      </section>

      {/* Setup & Integration Guides */}
      <section aria-label="Platform Setup Instructions" style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "24px", marginBottom: "20px" }}> <StorefrontText id="copy_d10b3526227f69c1" fallback="Integration Instructions" /> </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px" }}>
          
          <div style={{ background: "white", padding: "24px", borderRadius: "8px", border: "1px solid var(--stone)" }}>
            <h3 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <CheckCircle size={18} color="#23483a" />
              <span> <StorefrontText id="copy_52bb6a54d0f44adc" fallback="Google Merchant Center Setup" /> </span>
            </h3>
            <ol style={{ paddingLeft: "20px", fontSize: "14px", lineHeight: 1.7, color: "#333", margin: 0 }}>
              <li> <StorefrontText id="copy_efbf1948fcdc041f" fallback="Sign in to your" /> <strong> <StorefrontText id="copy_c84de92a0ac6a883" fallback="Google Merchant Center" /> </strong> <StorefrontText id="copy_ef05bb229d8aad72" fallback="dashboard." /> </li>
              <li> <StorefrontText id="copy_5060552031a7d1da" fallback="Navigate to" /> <strong> <StorefrontText id="copy_4edc8bfafc6bd936" fallback="Products" /> </strong> &gt; <strong> <StorefrontText id="copy_06a7b164556d30dd" fallback="Feeds" /> </strong> <StorefrontText id="copy_069a0d4f476a4a13" fallback="and click the" /> <strong>+</strong> <StorefrontText id="copy_f68e87df3a5b2f86" fallback="icon to add a primary feed." /> </li>
              <li> <StorefrontText id="copy_db9710f0d3e812ef" fallback="Select your target country (e.g. India) and language (English)." /> </li>
              <li> <StorefrontText id="copy_c7f937836f5d82d5" fallback="Choose" /> <strong> <StorefrontText id="copy_24ca3962a32733eb" fallback="Scheduled fetch" /> </strong> <StorefrontText id="copy_8cb0925d8e7fbd33" fallback="as the feed input method." /> </li>
              <li> <StorefrontText id="copy_3f15a4d5b5304f27" fallback="Paste the live XML URL:" /> <code>{origin ? `${origin}/feeds/google.xml` : "/feeds/google.xml"}</code></li>
              <li> <StorefrontText id="copy_6daa1e32a4457180" fallback="Set fetch frequency to" /> <strong> <StorefrontText id="copy_b36c2611dcdfa190" fallback="Daily" /> </strong> <StorefrontText id="copy_cb83740a24f771a0" fallback="(recommended: 02:00 AM) and save." /> </li>
            </ol>
          </div>

          <div style={{ background: "white", padding: "24px", borderRadius: "8px", border: "1px solid var(--stone)" }}>
            <h3 style={{ fontSize: "18px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <CheckCircle size={18} color="#23483a" />
              <span> <StorefrontText id="copy_7711cc1da6276da5" fallback="Meta Commerce Manager Setup" /> </span>
            </h3>
            <ol style={{ paddingLeft: "20px", fontSize: "14px", lineHeight: 1.7, color: "#333", margin: 0 }}>
              <li> <StorefrontText id="copy_ed077f3d8125d60d" fallback="Open" /> <strong> <StorefrontText id="copy_0aa9a4356e3f51a8" fallback="Meta Business Suite" /> </strong> &gt; <strong> <StorefrontText id="copy_96934a804314fa7b" fallback="Commerce Manager" /> </strong>.</li>
              <li> <StorefrontText id="copy_d7553f020948385a" fallback="Select your tea catalog, then go to" /> <strong> <StorefrontText id="copy_3877d14889a9909b" fallback="Catalog" /> </strong> &gt; <strong> <StorefrontText id="copy_fee47c958ac2dade" fallback="Data Sources" /> </strong>.</li>
              <li> <StorefrontText id="copy_c7f937836f5d82d5" fallback="Choose" /> <strong> <StorefrontText id="copy_43a97d8e51e07564" fallback="Data feed" /> </strong> &gt; <strong> <StorefrontText id="copy_94d6ab26ebb2be4e" fallback="Use a URL" /> </strong>.</li>
              <li> <StorefrontText id="copy_677d99fa997cf31e" fallback="Paste the live CSV feed URL:" /> <code>{origin ? `${origin}/feeds/catalog.csv` : "/feeds/catalog.csv"}</code></li>
              <li> <StorefrontText id="copy_97d12ca2a7fea56e" fallback="Set default currency to" /> <strong> <StorefrontText id="copy_a7c07c281fad3bc0" fallback="INR" /> </strong> <StorefrontText id="copy_4d8d62fdbb616619" fallback="and schedule automatic daily refreshes." /> </li>
              <li> <StorefrontText id="copy_95ba4ed9329f4a25" fallback="Click" /> <strong> <StorefrontText id="copy_865e89de78d94c74" fallback="Upload" /> </strong> <StorefrontText id="copy_4cf62f0b36bbf1c1" fallback="to complete the catalog onboarding." /> </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Catalog Feed Preview Table */}
      <section aria-label="Live feed data preview" style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "24px", margin: 0 }}> <StorefrontText id="copy_a6f95f05751a9e13" fallback="Feed Data Sample" /> </h2>
            <p style={{ fontSize: "13px", color: "#666", margin: "4px 0 0 0" }}> <StorefrontText id="copy_d604310a789a1848" fallback="Showing" /> {filteredItems.length} of {items.length} <StorefrontText id="copy_989ee290bdd8833d" fallback="items mapped from database" /> </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid var(--stone)", borderRadius: "4px", padding: "6px 10px", width: "min(100%, 280px)" }}>
            <Search size={16} color="#666" style={{ marginRight: "8px" }} />
            <input
              type="text"
              placeholder="Search preview by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: "13px", width: "100%", background: "transparent" }}
              aria-label="Filter preview table"
            />
          </div>
        </div>

        <div style={{ overflowX: "auto", background: "white", border: "1px solid var(--stone)", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--paper2)", borderBottom: "1px solid var(--stone)", color: "#5a6655" }}>
                <th style={{ padding: "12px 16px" }}> <StorefrontText id="copy_ef0fae0b9b4820ba" fallback="SKU (ID)" /> </th>
                <th style={{ padding: "12px 16px" }}> <StorefrontText id="copy_7e8cd2056da73a7f" fallback="Title" /> </th>
                <th style={{ padding: "12px 16px" }}> <StorefrontText id="copy_93c91c851e7acc17" fallback="Price" /> </th>
                <th style={{ padding: "12px 16px" }}> <StorefrontText id="copy_12f67f8539c46701" fallback="Availability" /> </th>
                <th style={{ padding: "12px 16px" }}> <StorefrontText id="copy_d5cade7ef3191690" fallback="Stock" /> </th>
                <th style={{ padding: "12px 16px" }}> <StorefrontText id="copy_090ed4316f1d99fd" fallback="Brand" /> </th>
                <th style={{ padding: "12px 16px" }}> <StorefrontText id="copy_a6a32dbc5618ea39" fallback="Link" /> </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 10).map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: "var(--forest)" }}>
                    {item.id}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                    {item.title}
                  </td>
                  <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontWeight: 600 }}>
                    {item.price}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: item.availability === "in_stock" ? "#e6f2eb" : "#fbeae8",
                        color: item.availability === "in_stock" ? "#1b4d2e" : "#b02a1a",
                      }}
                    >
                      {item.availability}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{item.stock}</td>
                  <td style={{ padding: "12px 16px", color: "#666" }}>{item.brand}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--amber)", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <span> <StorefrontText id="copy_dcc839a4015c4b7d" fallback="View" /> </span>
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#666" }}>
                    No matching items found for &quot;{searchQuery}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredItems.length > 10 && (
            <div style={{ padding: "12px 16px", background: "var(--paper)", borderTop: "1px solid var(--stone)", fontSize: "12px", color: "#666", textAlign: "center" }}> <StorefrontText id="copy_cee9cc852ea582c1" fallback="Showing first 10 of" /> {filteredItems.length} <StorefrontText id="copy_9c9be4354aba43c2" fallback="items. Download complete feed files above for the full catalog dataset." /> </div>
          )}
        </div>
      </section>
    </div>
  );
}
