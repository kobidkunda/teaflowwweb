"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  Download,
  ExternalLink,
  ShieldCheck,
  Globe,
  Search,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import type { FeedItem } from "@/lib/feedTypes";
import { isPrivateHost } from "@/lib/feedsHost";

export interface AdminFeedsClientProps {
  initialItems: FeedItem[];
  isTokenProtected: boolean;
  configuredToken?: string;
  baseUrl: string;
  detectedOrigin?: string;
}

export function AdminFeedsClient({
  initialItems,
  isTokenProtected,
  configuredToken,
  baseUrl,
  detectedOrigin,
}: AdminFeedsClientProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testToken, setTestToken] = useState(configuredToken || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [activeGuideTab, setActiveGuideTab] = useState<"google" | "meta">("google");

  const [domainMode, setDomainMode] = useState<"public" | "current" | "custom">("public");
  const [clientOrigin, setClientOrigin] = useState<string>(detectedOrigin || "");
  const [customOrigin, setCustomOrigin] = useState<string>("");

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin) {
      setClientOrigin(window.location.origin);
    }
  }, []);

  const publicDomain =
    baseUrl &&
    !isPrivateHost(baseUrl) &&
    !baseUrl.includes("0.0.0.0")
      ? baseUrl
      : "https://teafloww.com";

  const currentServerOrigin =
    clientOrigin || (detectedOrigin && !detectedOrigin.includes("0.0.0.0") ? detectedOrigin : "");

  const activeBaseUrl =
    domainMode === "current" && currentServerOrigin
      ? currentServerOrigin
      : domainMode === "custom" && customOrigin.trim()
      ? customOrigin.trim().replace(/\/+$/, "")
      : publicDomain;

  const isCurrentPrivate = isPrivateHost(activeBaseUrl);

  // Catalog summary metrics
  const totalVariants = initialItems.length;
  const uniqueProducts = useMemo(() => {
    return new Set(initialItems.map((item) => item.itemGroupId)).size;
  }, [initialItems]);

  const inStockCount = useMemo(() => {
    return initialItems.filter((item) => item.availability === "in_stock").length;
  }, [initialItems]);

  const outOfStockCount = totalVariants - inStockCount;
  const inStockPercentage = totalVariants > 0 ? Math.round((inStockCount / totalVariants) * 100) : 0;

  // Build endpoint query params for active testing on current server
  const buildEndpointUrl = (path: string, isDownload = false) => {
    const params = new URLSearchParams();
    if (isDownload) {
      params.set("download", "1");
    }
    if (testToken.trim()) {
      params.set("token", testToken.trim());
    }
    // Pass explicit base_url so that the generated XML/CSV items match the selected domain
    if (activeBaseUrl) {
      params.set("base_url", activeBaseUrl);
    }
    const q = params.toString();
    return q ? `${path}?${q}` : path;
  };

  // Resolved feed URLs with optional testing token
  const tokenQuery = testToken.trim() ? `?token=${encodeURIComponent(testToken.trim())}` : "";

  const googleXmlUrl = `${activeBaseUrl}/feeds/google.xml${tokenQuery}`;
  const googleXmlDownloadUrl = buildEndpointUrl("/feeds/google.xml", true);
  const googleApiAliasUrl = `${activeBaseUrl}/api/feeds/google-merchant${tokenQuery}`;
  const googleXmlInspectUrl = buildEndpointUrl("/feeds/google.xml", false);

  const metaCsvUrl = `${activeBaseUrl}/feeds/catalog.csv${tokenQuery}`;
  const metaCsvDownloadUrl = buildEndpointUrl("/feeds/catalog.csv", true);
  const metaApiAliasUrl = `${activeBaseUrl}/api/feeds/meta${tokenQuery}`;
  const metaCsvInspectUrl = buildEndpointUrl("/feeds/catalog.csv", false);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback if clipboard API is restricted
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  // Filtered variant table
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return initialItems.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.availability === statusFilter;
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.productType && item.productType.toLowerCase().includes(q)) ||
        (item.packagingFormat && item.packagingFormat.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [initialItems, searchQuery, statusFilter]);

  return (
    <div className="admin-feeds-container">
      {/* Page Header */}
      <div className="admin-feeds-header">
        <div>
          <div className="admin-badge-row">
            <span className="admin-tag-badge">Syndication</span>
            {isTokenProtected ? (
              <span className="admin-status-badge secure">
                <ShieldCheck size={13} aria-hidden="true" />
                Token Protected
              </span>
            ) : (
              <span className="admin-status-badge public">
                <Globe size={13} aria-hidden="true" />
                Public Access
              </span>
            )}
          </div>
          <h1 className="admin-feeds-title">Product Feeds &amp; Syndication</h1>
          <p className="admin-feeds-subtitle">
            Manage scheduled catalog synchronization for Google Merchant Center and Meta Product Catalog (Facebook &amp; Instagram Shopping).
          </p>
        </div>
        <div className="admin-feeds-header-actions">
          <Link
            href="/feeds"
            target="_blank"
            rel="noopener noreferrer"
            className="button button-cream admin-header-btn"
          >
            <ExternalLink size={16} aria-hidden="true" />
            <span>Public Feeds Page</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Summary */}
      <div className="admin-kpi-grid" role="region" aria-label="Catalog Syndication Metrics">
        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap">
            <Layers size={20} aria-hidden="true" />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Syndicated Variants</span>
            <div className="kpi-value">{totalVariants}</div>
            <span className="kpi-footnote">Across {uniqueProducts} orthodox tea lots</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap success">
            <CheckCircle2 size={20} aria-hidden="true" />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">In-Stock Availability</span>
            <div className="kpi-value">{inStockPercentage}%</div>
            <span className="kpi-footnote">{inStockCount} units ready for immediate fulfillment</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap warning">
            <Package size={20} aria-hidden="true" />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Out-of-Stock Units</span>
            <div className="kpi-value">{outOfStockCount}</div>
            <span className="kpi-footnote">Flagged as <code>out_of_stock</code> to crawlers</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className={`kpi-icon-wrap ${isTokenProtected ? "secure" : "info"}`}>
            {isTokenProtected ? <ShieldCheck size={20} aria-hidden="true" /> : <Globe size={20} aria-hidden="true" />}
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Security Gate</span>
            <div className="kpi-value" style={{ fontSize: "1.15rem", fontWeight: 700 }}>
              {isTokenProtected ? "Secured" : "Open Public"}
            </div>
            <span className="kpi-footnote">
              {isTokenProtected ? "FEED_ACCESS_TOKEN verified" : "Permits all automated bots"}
            </span>
          </div>
        </div>
      </div>

      {/* Public Accessibility & Domain Selector Card */}
      <div className="admin-domain-card" role="region" aria-label="Syndication Domain & Crawler Accessibility">
        <div className="domain-card-header">
          <div className="domain-icon-wrap">
            <Globe size={20} aria-hidden="true" />
          </div>
          <div>
            <h3 className="domain-title">Syndication Domain &amp; Crawler Accessibility</h3>
            <p className="domain-desc">
              Google Merchant Center &amp; Meta Commerce Manager fetch feeds via cloud crawlers (e.g. <code>Googlebot-Image</code>) and require a publicly reachable URL over the internet.
            </p>
          </div>
        </div>

        <div className="domain-selector-body">
          <div className="domain-tabs-row" role="radiogroup" aria-label="Select target domain for feed URLs">
            <button
              type="button"
              role="radio"
              aria-checked={domainMode === "public"}
              className={`domain-tab-btn ${domainMode === "public" ? "active" : ""}`}
              onClick={() => setDomainMode("public")}
            >
              <span className="domain-tab-title">Public Production URL</span>
              <span className="domain-tab-val">{publicDomain}</span>
              <span className="domain-tab-badge">Google &amp; Meta Standard</span>
            </button>

            {currentServerOrigin && (
              <button
                type="button"
                role="radio"
                aria-checked={domainMode === "current"}
                className={`domain-tab-btn ${domainMode === "current" ? "active" : ""}`}
                onClick={() => setDomainMode("current")}
              >
                <span className="domain-tab-title">Current Host / Dev Server</span>
                <span className="domain-tab-val">{currentServerOrigin}</span>
                <span className="domain-tab-badge local">Local Verification</span>
              </button>
            )}

            <button
              type="button"
              role="radio"
              aria-checked={domainMode === "custom"}
              className={`domain-tab-btn ${domainMode === "custom" ? "active" : ""}`}
              onClick={() => setDomainMode("custom")}
            >
              <span className="domain-tab-title">Custom Public Tunnel / Domain</span>
              <span className="domain-tab-val">{customOrigin || "e.g. https://...ngrok.app"}</span>
              <span className="domain-tab-badge custom">Tunnel / Staging</span>
            </button>
          </div>

          {domainMode === "custom" && (
            <div className="custom-domain-input-box">
              <label htmlFor="custom-domain-input" className="token-label">
                Enter Public HTTPS URL (e.g. Cloudflare Tunnel, Ngrok, or Staging Domain)
              </label>
              <input
                id="custom-domain-input"
                type="url"
                placeholder="https://your-tunnel.ngrok-free.app"
                value={customOrigin}
                onChange={(e) => setCustomOrigin(e.target.value)}
                className="token-input"
              />
              <p className="token-hint">
                All feed URLs below will automatically update to use this public domain for testing Google Merchant Center scheduled fetches live from your machine.
              </p>
            </div>
          )}

          {domainMode === "current" && (
            <div className="domain-warning-callout">
              <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                <strong>Note for Google Merchant Center:</strong> <code>{currentServerOrigin}</code> is on a private network or local host. Google Merchant Center crawlers will fail to connect unless accessed via a verified public domain or tunnel. Use this mode for local validation or browser testing.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Feed Endpoints Grid */}
      <div className="admin-feeds-endpoints-grid">
        {/* Card 1: Google Merchant Center XML */}
        <div className="feed-endpoint-card">
          <div className="endpoint-card-header">
            <div className="endpoint-title-row">
              <span className="endpoint-icon-box xml">
                <FileCode size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 className="endpoint-name">Google Merchant Center</h2>
                <span className="endpoint-format-tag">RSS 2.0 XML with <code>xmlns:g</code></span>
              </div>
            </div>
            <span className="endpoint-channel-tag">Primary Feed</span>
          </div>

          <p className="endpoint-description">
            Compliant with Google Merchant Center Product Specification. Validates against Google RSS 2.0 namespaces with decimal INR prices, orthodox tea taxonomy, and real-time inventory availability.
          </p>

          <div className="endpoint-url-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label className="url-label" htmlFor="google-feed-url" style={{ marginBottom: 0 }}>
                Live Feed URL
              </label>
              {isCurrentPrivate ? (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(220, 100, 30, 0.12)",
                    color: "#b36b3d",
                  }}
                  title="Private LAN IPs cannot be crawled by Google Merchant Center bots"
                >
                  Private LAN (Not Google Crawlable)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(35, 72, 58, 0.12)",
                    color: "#23483a",
                  }}
                  title="Public URL ready for Google Merchant Center Scheduled Fetch"
                >
                  Publicly Available
                </span>
              )}
            </div>
            <div className="url-input-group">
              <input
                id="google-feed-url"
                type="text"
                readOnly
                value={googleXmlUrl}
                className="url-display-input"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(googleXmlUrl, "google-url")}
                className="button button-outline copy-btn"
                aria-label="Copy Google Merchant XML URL"
              >
                {copiedKey === "google-url" ? (
                  <>
                    <Check size={15} className="text-success" aria-hidden="true" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} aria-hidden="true" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="endpoint-crawler-alias">
            <span className="alias-label">Crawler Alias:</span>
            <code className="alias-code">{googleApiAliasUrl}</code>
            <button
              type="button"
              onClick={() => copyToClipboard(googleApiAliasUrl, "google-alias")}
              className="alias-copy-btn"
              title="Copy Crawler Alias"
            >
              {copiedKey === "google-alias" ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            </button>
          </div>

          <div className="endpoint-actions-bar">
            <a
              href={googleXmlDownloadUrl}
              download="google-merchant.xml"
              className="button button-primary action-btn"
            >
              <Download size={15} aria-hidden="true" />
              <span>Download XML</span>
            </a>
            <a
              href={googleXmlInspectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline action-btn"
              title="Inspect raw XML on current server"
            >
              <ExternalLink size={15} aria-hidden="true" />
              <span>Inspect Raw XML</span>
            </a>
          </div>

          <div className="endpoint-features-list">
            <span className="feature-pill">g:id</span>
            <span className="feature-pill">g:title</span>
            <span className="feature-pill">g:price (INR)</span>
            <span className="feature-pill">g:availability</span>
            <span className="feature-pill">g:google_product_category</span>
            <span className="feature-pill">g:brand</span>
          </div>
        </div>

        {/* Card 2: Meta Catalog CSV */}
        <div className="feed-endpoint-card">
          <div className="endpoint-card-header">
            <div className="endpoint-title-row">
              <span className="endpoint-icon-box csv">
                <FileSpreadsheet size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 className="endpoint-name">Meta Product Catalog</h2>
                <span className="endpoint-format-tag">RFC 4180 CSV Export</span>
              </div>
            </div>
            <span className="endpoint-channel-tag">Social Commerce</span>
          </div>

          <p className="endpoint-description">
            Formatted for Meta Commerce Manager (Facebook &amp; Instagram Shops). Includes comma-escaped columns with doubled double-quotes, canonical tea links, and tea-tin fallback imagery.
          </p>

          <div className="endpoint-url-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label className="url-label" htmlFor="meta-feed-url" style={{ marginBottom: 0 }}>
                Live Feed URL
              </label>
              {isCurrentPrivate ? (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(220, 100, 30, 0.12)",
                    color: "#b36b3d",
                  }}
                  title="Private LAN IPs cannot be crawled by Meta Catalog bots"
                >
                  Private LAN (Not Meta Crawlable)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(35, 72, 58, 0.12)",
                    color: "#23483a",
                  }}
                  title="Public URL ready for Meta Commerce Manager Scheduled Fetch"
                >
                  Publicly Available
                </span>
              )}
            </div>
            <div className="url-input-group">
              <input
                id="meta-feed-url"
                type="text"
                readOnly
                value={metaCsvUrl}
                className="url-display-input"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(metaCsvUrl, "meta-url")}
                className="button button-outline copy-btn"
                aria-label="Copy Meta Catalog CSV URL"
              >
                {copiedKey === "meta-url" ? (
                  <>
                    <Check size={15} className="text-success" aria-hidden="true" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} aria-hidden="true" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="endpoint-crawler-alias">
            <span className="alias-label">Crawler Alias:</span>
            <code className="alias-code">{metaApiAliasUrl}</code>
            <button
              type="button"
              onClick={() => copyToClipboard(metaApiAliasUrl, "meta-alias")}
              className="alias-copy-btn"
              title="Copy Crawler Alias"
            >
              {copiedKey === "meta-alias" ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            </button>
          </div>

          <div className="endpoint-actions-bar">
            <a
              href={metaCsvDownloadUrl}
              download="meta-catalog.csv"
              className="button button-primary action-btn"
            >
              <Download size={15} aria-hidden="true" />
              <span>Download CSV</span>
            </a>
            <a
              href={metaCsvInspectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline action-btn"
              title="Inspect raw CSV on current server"
            >
              <ExternalLink size={15} aria-hidden="true" />
              <span>Inspect Raw CSV</span>
            </a>
          </div>

          <div className="endpoint-features-list">
            <span className="feature-pill">id</span>
            <span className="feature-pill">title</span>
            <span className="feature-pill">description</span>
            <span className="feature-pill">availability</span>
            <span className="feature-pill">price</span>
            <span className="feature-pill">brand</span>
            <span className="feature-pill">link</span>
          </div>
        </div>
      </div>

      {/* Security Gate & Token Configuration Tester */}
      <div className="admin-token-card" role="region" aria-label="Security Token Settings">
        <div className="token-card-header">
          <div className="token-header-info">
            <div className="token-icon-wrap">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="token-title">Feed Security &amp; Access Token</h3>
              <p className="token-desc">
                When enabled, feed requests without a matching token receive HTTP 401 Unauthorized to prevent scraping.
              </p>
            </div>
          </div>
          <div className="token-status-pill">
            {isTokenProtected ? (
              <span className="badge-secure">Active Gate (Secure)</span>
            ) : (
              <span className="badge-public">Open to Public Bots</span>
            )}
          </div>
        </div>

        <div className="token-config-body">
          <div className="token-tester-form">
            <label htmlFor="test-token-input" className="token-label">
              Test or Append Feed Token (Query Parameter <code>?token=...</code>)
            </label>
            <div className="token-input-row">
              <input
                id="test-token-input"
                type="text"
                placeholder={isTokenProtected ? "Enter secret feed token..." : "Enter temporary test token..."}
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
                className="token-input"
              />
              {configuredToken && testToken !== configuredToken && (
                <button
                  type="button"
                  onClick={() => setTestToken(configuredToken)}
                  className="button button-cream"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  <span>Reset to Configured Token</span>
                </button>
              )}
            </div>
            <p className="token-hint">
              Setting a value updates all copyable URLs above with <code>?token=...</code> so you can paste authenticated URLs directly into Google Merchant Center or Meta Commerce Manager.
            </p>
          </div>

          <div className="token-instructions-box">
            <h4 className="instructions-title">How to configure in production:</h4>
            <ol className="instructions-list">
              <li>
                Add <code>FEED_ACCESS_TOKEN=&quot;your-secure-random-secret&quot;</code> to your deployment environment variables or <code>.env</code>.
              </li>
              <li>
                Configure your Google Merchant Center or Meta Scheduled Fetch with the generated secure URL (containing <code>?token=...</code>).
              </li>
              <li>
                All verification utilizes constant-time string comparison (<code>crypto.timingSafeEqual</code>) to prevent timing side-channel attacks.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Live Catalog Feed Inspector Table */}
      <div className="admin-catalog-inspector-card" role="region" aria-label="Syndicated Variants Audit">
        <div className="inspector-header">
          <div>
            <h3 className="inspector-title">Live Catalog Syndication Inspector</h3>
            <p className="inspector-desc">
              Inspect active orthodox tea variants currently emitted in both Google Merchant XML and Meta CSV feeds.
            </p>
          </div>
          <div className="inspector-controls">
            {/* Search Box */}
            <div className="inspector-search-wrap">
              <Search size={16} className="search-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by tea, variant ID, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="inspector-search-input"
                aria-label="Search syndicated variants"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="search-clear-btn"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Availability Filter Chips */}
            <div className="inspector-filter-chips" role="radiogroup" aria-label="Filter by stock availability">
              <button
                type="button"
                className={`chip-btn ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
                aria-checked={statusFilter === "all"}
                role="radio"
              >
                All ({totalVariants})
              </button>
              <button
                type="button"
                className={`chip-btn ${statusFilter === "in_stock" ? "active" : ""}`}
                onClick={() => setStatusFilter("in_stock")}
                aria-checked={statusFilter === "in_stock"}
                role="radio"
              >
                In Stock ({inStockCount})
              </button>
              <button
                type="button"
                className={`chip-btn ${statusFilter === "out_of_stock" ? "active" : ""}`}
                onClick={() => setStatusFilter("out_of_stock")}
                aria-checked={statusFilter === "out_of_stock"}
                role="radio"
              >
                Out of Stock ({outOfStockCount})
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="table-responsive">
          <table className="admin-table feed-variants-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: "22%" }}>Feed ID (g:id)</th>
                <th scope="col" style={{ width: "32%" }}>Syndicated Title &amp; SKU</th>
                <th scope="col" style={{ width: "16%" }}>Category / Type</th>
                <th scope="col" style={{ width: "14%" }}>Price (g:price)</th>
                <th scope="col" style={{ width: "16%" }}>Stock &amp; Availability</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    <AlertCircle size={22} className="empty-icon" aria-hidden="true" />
                    <p>No variants match your search filter.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isInStock = item.availability === "in_stock";
                  return (
                    <tr key={item.id}>
                      <td className="item-id-cell">
                        <code className="feed-id-code">{item.id}</code>
                        <div className="cell-subtext">Parent: {item.itemGroupId}</div>
                      </td>
                      <td>
                        <div className="item-title-text">{item.title}</div>
                        <div className="cell-subtext">
                          Format: <code>{item.packagingFormat || "loose_leaf_pouch"}</code> ({item.sizeGrams || 100}g)
                          <span className="bullet">·</span>
                          <a
                            href={`/tea/${item.itemGroupId}?sku=${encodeURIComponent(item.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="preview-link"
                          >
                            Storefront <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        </div>
                      </td>
                      <td>
                        <span className="category-pill">{item.productType || "Tea"}</span>
                      </td>
                      <td className="price-cell">
                        <span className="price-formatted">{item.price}</span>
                      </td>
                      <td>
                        <div className="stock-status-cell">
                          <span className={`status-badge ${isInStock ? "in-stock" : "out-of-stock"}`}>
                            {isInStock ? "in_stock" : "out_of_stock"}
                          </span>
                          <span className="stock-count-text">
                            {item.stock} {item.stock === 1 ? "unit" : "units"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="inspector-footer">
          <span>Showing {filteredItems.length} of {totalVariants} syndicated items</span>
        </div>
      </div>

      {/* Platform Setup Guides */}
      <div className="admin-guides-card" role="region" aria-label="Platform Setup Instructions">
        <div className="guides-header">
          <div className="guides-header-title">
            <HelpCircle size={18} aria-hidden="true" />
            <h3>Platform Configuration Guides</h3>
          </div>
          <div className="guide-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeGuideTab === "google"}
              className={`guide-tab-btn ${activeGuideTab === "google" ? "active" : ""}`}
              onClick={() => setActiveGuideTab("google")}
            >
              Google Merchant Center
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGuideTab === "meta"}
              className={`guide-tab-btn ${activeGuideTab === "meta" ? "active" : ""}`}
              onClick={() => setActiveGuideTab("meta")}
            >
              Meta Commerce Manager
            </button>
          </div>
        </div>

        <div className="guide-content-body">
          {activeGuideTab === "google" ? (
            <div className="guide-panel" role="tabpanel">
              <h4>Configuring Google Merchant Center Scheduled Fetch</h4>
              <ol className="guide-steps-list">
                <li>
                  Sign in to your <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer">Google Merchant Center</a> account.
                </li>
                <li>
                  Navigate to <strong>Products</strong> &gt; <strong>Feeds</strong> &gt; Click the <strong>+</strong> button to create a primary feed.
                </li>
                <li>
                  Select your target country (e.g. <strong>India</strong>) and primary language (e.g. <strong>English</strong>).
                </li>
                <li>
                  Select <strong>Scheduled Fetch</strong> as the input method.
                </li>
                <li>
                  Enter a feed file name (e.g. <code>himalayan-teas-feed.xml</code>) and paste the live URL:
                  <div className="guide-url-preview">
                    <code>{googleXmlUrl}</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(googleXmlUrl, "guide-google-url")}
                      className="button button-cream"
                    >
                      {copiedKey === "guide-google-url" ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                      <span>{copiedKey === "guide-google-url" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </li>
                <li>
                  Set the fetch frequency to <strong>Daily</strong> (recommended: 02:00 AM UTC) to ensure inventory and pricing changes synchronize automatically.
                </li>
              </ol>
            </div>
          ) : (
            <div className="guide-panel" role="tabpanel">
              <h4>Configuring Meta Commerce Manager (Facebook / Instagram Shopping)</h4>
              <ol className="guide-steps-list">
                <li>
                  Sign in to <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer">Meta Commerce Manager</a> and choose your catalog.
                </li>
                <li>
                  Go to <strong>Catalog</strong> &gt; <strong>Data Sources</strong> &gt; Click <strong>Add Products</strong> &gt; Select <strong>Data Feed</strong>.
                </li>
                <li>
                  Choose <strong>Scheduled Feed</strong> for automated synchronization.
                </li>
                <li>
                  Paste the live CSV Feed URL:
                  <div className="guide-url-preview">
                    <code>{metaCsvUrl}</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(metaCsvUrl, "guide-meta-url")}
                      className="button button-cream"
                    >
                      {copiedKey === "guide-meta-url" ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                      <span>{copiedKey === "guide-meta-url" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </li>
                <li>
                  Set the schedule to <strong>Daily</strong> and currency to <strong>INR</strong>.
                </li>
                <li>
                  Complete setup to activate Instagram Shop and Facebook Store product tagging across your catalog.
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Scoped CSS for Admin Feeds Page */}
      <style>{`
        .admin-feeds-container {
          padding: 24px 32px 64px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .admin-feeds-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .admin-badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .admin-tag-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 4px;
          background: #e6dfd1;
          color: #4a4437;
        }

        .admin-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
        }

        .admin-status-badge.secure {
          background: #e3ede6;
          color: #1d533a;
        }

        .admin-status-badge.public {
          background: #e5edf5;
          color: #215582;
        }

        .admin-feeds-title {
          font-family: var(--font-playfair, Georgia, serif);
          font-size: 1.85rem;
          font-weight: 700;
          color: #171713;
          margin: 0 0 6px;
        }

        .admin-feeds-subtitle {
          color: #555044;
          font-size: 0.95rem;
          margin: 0;
          max-width: 800px;
          line-height: 1.5;
        }

        .admin-feeds-header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .admin-header-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          font-size: 0.9rem;
          font-weight: 600;
        }

        /* KPI Cards */
        .admin-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }

        .admin-kpi-card {
          background: #fbf8f1;
          border: 1px solid #d9d4c8;
          border-radius: 8px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .kpi-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: #ede8dc;
          color: #555044;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .kpi-icon-wrap.success {
          background: #e3ede6;
          color: #1d533a;
        }

        .kpi-icon-wrap.warning {
          background: #faefe1;
          color: #8c5214;
        }

        .kpi-icon-wrap.secure {
          background: #e3ede6;
          color: #1d533a;
        }

        .kpi-icon-wrap.info {
          background: #e5edf5;
          color: #215582;
        }

        .kpi-details {
          display: flex;
          flex-direction: column;
        }

        .kpi-label {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #6d6657;
          margin-bottom: 2px;
        }

        .kpi-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: #171713;
          line-height: 1.2;
        }

        .kpi-footnote {
          font-size: 0.78rem;
          color: #7d7565;
          margin-top: 3px;
        }

        /* Endpoints Grid */
        .admin-feeds-endpoints-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
          gap: 24px;
          margin-bottom: 28px;
        }

        @media (max-width: 600px) {
          .admin-feeds-endpoints-grid {
            grid-template-columns: 1fr;
          }
        }

        .feed-endpoint-card {
          background: #fbf8f1;
          border: 1px solid #d9d4c8;
          border-radius: 10px;
          padding: 24px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
          display: flex;
          flex-direction: column;
        }

        .endpoint-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          gap: 12px;
        }

        .endpoint-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .endpoint-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .endpoint-icon-box.xml {
          background: #e8efe8;
          color: #23483a;
        }

        .endpoint-icon-box.csv {
          background: #edf0f5;
          color: #215582;
        }

        .endpoint-name {
          font-size: 1.15rem;
          font-weight: 700;
          color: #171713;
          margin: 0 0 2px;
        }

        .endpoint-format-tag {
          font-size: 0.78rem;
          color: #665f50;
        }

        .endpoint-channel-tag {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          border-radius: 4px;
          background: #ede9df;
          color: #4a4437;
        }

        .endpoint-description {
          font-size: 0.88rem;
          color: #555044;
          line-height: 1.5;
          margin: 0 0 16px;
        }

        .endpoint-url-box {
          margin-bottom: 12px;
        }

        .url-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #4a4437;
          margin-bottom: 6px;
        }

        .url-input-group {
          display: flex;
          gap: 8px;
        }

        .url-display-input {
          flex: 1;
          font-family: monospace;
          font-size: 0.82rem;
          padding: 8px 12px;
          background: #ffffff;
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          color: #2c2923;
        }

        .copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          font-size: 0.82rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .endpoint-crawler-alias {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: #665f50;
          margin-bottom: 18px;
          background: #f4efe4;
          padding: 6px 10px;
          border-radius: 6px;
        }

        .alias-label {
          font-weight: 600;
          white-space: nowrap;
        }

        .alias-code {
          flex: 1;
          font-family: monospace;
          font-size: 0.78rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #3b362c;
        }

        .alias-copy-btn {
          background: none;
          border: none;
          padding: 3px 6px;
          cursor: pointer;
          color: #665f50;
          display: inline-flex;
          align-items: center;
          border-radius: 4px;
        }

        .alias-copy-btn:hover {
          color: #171713;
          background: #e6dfd1;
        }

        .endpoint-actions-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 8px 14px;
        }

        .endpoint-features-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px dashed #d9d4c8;
        }

        .feature-pill {
          font-size: 0.75rem;
          font-family: monospace;
          padding: 2px 7px;
          background: #ede9df;
          color: #4a4437;
          border-radius: 4px;
        }

        /* Domain Selector Card */
        .admin-domain-card {
          background: #fbf8f1;
          border: 1px solid #d9d4c8;
          border-radius: 10px;
          padding: 22px 24px;
          margin-bottom: 28px;
        }

        .domain-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .domain-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 6px;
          background: #e5edf5;
          color: #215582;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .domain-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #171713;
          margin: 0 0 2px;
        }

        .domain-desc {
          font-size: 0.85rem;
          color: #665f50;
          margin: 0;
          line-height: 1.4;
        }

        .domain-selector-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .domain-tabs-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
        }

        .domain-tab-btn {
          background: #ffffff;
          border: 1px solid #d9d4c8;
          border-radius: 8px;
          padding: 12px 16px;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: all 0.15s ease-in-out;
        }

        .domain-tab-btn:hover {
          border-color: #23483a;
          background: #fdfcf9;
        }

        .domain-tab-btn.active {
          border-color: #23483a;
          background: #f3f7f4;
          box-shadow: 0 0 0 2px rgba(35, 72, 58, 0.2);
        }

        .domain-tab-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: #171713;
        }

        .domain-tab-val {
          font-family: monospace;
          font-size: 0.8rem;
          color: #23483a;
          word-break: break-all;
        }

        .domain-tab-badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          background: #e3ede6;
          color: #1d533a;
          margin-top: 4px;
          width: fit-content;
        }

        .domain-tab-badge.local {
          background: #faefe1;
          color: #8c5214;
        }

        .domain-tab-badge.custom {
          background: #edf0f5;
          color: #215582;
        }

        .custom-domain-input-box {
          background: #f4efe4;
          border: 1px solid #e3dcce;
          border-radius: 6px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .domain-warning-callout {
          background: #faefe1;
          border: 1px solid #ecd8c0;
          border-radius: 6px;
          padding: 10px 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.82rem;
          color: #6d4111;
          line-height: 1.45;
        }

        /* Token Security Card */
        .admin-token-card {
          background: #fbf8f1;
          border: 1px solid #d9d4c8;
          border-radius: 10px;
          padding: 22px 24px;
          margin-bottom: 28px;
        }

        .token-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .token-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .token-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 6px;
          background: #e3ede6;
          color: #1d533a;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .token-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #171713;
          margin: 0 0 2px;
        }

        .token-desc {
          font-size: 0.85rem;
          color: #665f50;
          margin: 0;
        }

        .badge-secure {
          display: inline-block;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 4px 10px;
          background: #e3ede6;
          color: #1d533a;
          border-radius: 20px;
        }

        .badge-public {
          display: inline-block;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 4px 10px;
          background: #e5edf5;
          color: #215582;
          border-radius: 20px;
        }

        .token-config-body {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .token-config-body {
            grid-template-columns: 1fr;
          }
        }

        .token-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #3b362c;
          margin-bottom: 8px;
        }

        .token-input-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .token-input {
          flex: 1;
          font-family: monospace;
          font-size: 0.88rem;
          padding: 9px 12px;
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          background: #ffffff;
        }

        .token-hint {
          font-size: 0.78rem;
          color: #776f5f;
          margin: 0;
          line-height: 1.4;
        }

        .token-instructions-box {
          background: #f4efe4;
          border: 1px solid #e3dcce;
          border-radius: 6px;
          padding: 14px 18px;
        }

        .instructions-title {
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #4a4437;
          margin: 0 0 8px;
        }

        .instructions-list {
          margin: 0;
          padding-left: 18px;
          font-size: 0.82rem;
          color: #555044;
          line-height: 1.5;
        }

        .instructions-list li {
          margin-bottom: 4px;
        }

        /* Inspector Card */
        .admin-catalog-inspector-card {
          background: #fbf8f1;
          border: 1px solid #d9d4c8;
          border-radius: 10px;
          margin-bottom: 28px;
          overflow: hidden;
        }

        .inspector-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid #d9d4c8;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
        }

        .inspector-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #171713;
          margin: 0 0 2px;
        }

        .inspector-desc {
          font-size: 0.85rem;
          color: #665f50;
          margin: 0;
        }

        .inspector-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .inspector-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          color: #888070;
          pointer-events: none;
        }

        .inspector-search-input {
          padding: 7px 30px 7px 32px;
          font-size: 0.82rem;
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          background: #ffffff;
          width: 250px;
        }

        .search-clear-btn {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          font-size: 16px;
          color: #888070;
          cursor: pointer;
        }

        .inspector-filter-chips {
          display: flex;
          gap: 4px;
          background: #ede8dc;
          padding: 3px;
          border-radius: 6px;
        }

        .chip-btn {
          background: none;
          border: none;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          color: #555044;
          transition: all 0.15s ease;
        }

        .chip-btn.active {
          background: #ffffff;
          color: #171713;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .table-responsive {
          overflow-x: auto;
        }

        .feed-variants-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .feed-variants-table th {
          background: #ede9df;
          color: #3b362c;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 10px 14px;
          border-bottom: 1px solid #d9d4c8;
        }

        .feed-variants-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #e6e0d2;
          vertical-align: middle;
        }

        .feed-id-code {
          font-family: monospace;
          font-size: 0.8rem;
          background: #ede8dc;
          padding: 2px 6px;
          border-radius: 4px;
          color: #2c2923;
        }

        .item-title-text {
          font-weight: 600;
          color: #171713;
          margin-bottom: 2px;
        }

        .cell-subtext {
          font-size: 0.75rem;
          color: #776f5f;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .bullet {
          color: #b0a795;
        }

        .preview-link {
          color: #23483a;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }

        .preview-link:hover {
          text-decoration: underline;
        }

        .category-pill {
          display: inline-block;
          font-size: 0.78rem;
          background: #ede8dc;
          padding: 3px 8px;
          border-radius: 4px;
          color: #4a4437;
        }

        .price-cell {
          font-family: monospace;
          font-weight: 700;
          font-size: 0.88rem;
          color: #171713;
        }

        .stock-status-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .status-badge {
          display: inline-block;
          width: fit-content;
          font-size: 0.72rem;
          font-weight: 700;
          font-family: monospace;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .status-badge.in-stock {
          background: #e3ede6;
          color: #1d533a;
        }

        .status-badge.out-of-stock {
          background: #faebeb;
          color: #8a2424;
        }

        .stock-count-text {
          font-size: 0.75rem;
          color: #776f5f;
        }

        .empty-table-cell {
          text-align: center;
          padding: 32px 16px;
          color: #776f5f;
        }

        .empty-icon {
          margin: 0 auto 8px;
          color: #a69e8d;
        }

        .inspector-footer {
          padding: 12px 24px;
          background: #f7f3e9;
          border-top: 1px solid #d9d4c8;
          font-size: 0.78rem;
          color: #665f50;
        }

        /* Guides Card */
        .admin-guides-card {
          background: #fbf8f1;
          border: 1px solid #d9d4c8;
          border-radius: 10px;
          padding: 24px;
        }

        .guides-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #d9d4c8;
          padding-bottom: 14px;
          margin-bottom: 18px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .guides-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #171713;
        }

        .guides-header-title h3 {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0;
        }

        .guide-tabs {
          display: flex;
          gap: 4px;
          background: #ede8dc;
          padding: 3px;
          border-radius: 6px;
        }

        .guide-tab-btn {
          background: none;
          border: none;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 4px;
          cursor: pointer;
          color: #555044;
          transition: all 0.15s ease;
        }

        .guide-tab-btn.active {
          background: #ffffff;
          color: #171713;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .guide-panel h4 {
          font-size: 0.95rem;
          font-weight: 700;
          color: #171713;
          margin: 0 0 12px;
        }

        .guide-steps-list {
          margin: 0;
          padding-left: 20px;
          font-size: 0.88rem;
          color: #4a4437;
          line-height: 1.6;
        }

        .guide-steps-list li {
          margin-bottom: 10px;
        }

        .guide-steps-list a {
          color: #23483a;
          text-decoration: underline;
        }

        .guide-url-preview {
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f4efe4;
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          padding: 6px 10px;
          width: fit-content;
          max-width: 100%;
        }

        .guide-url-preview code {
          font-family: monospace;
          font-size: 0.8rem;
          color: #171713;
          word-break: break-all;
        }

        .text-success {
          color: #1d533a;
        }
      `}</style>
    </div>
  );
}
