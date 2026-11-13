"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, ArrowUpRight, FileCode, Bot, Rss, FileText, Layers, CheckCircle2 } from "lucide-react";
import type { PublicSitemapData } from "@/lib/seo/htmlSitemap";

export function SitemapExplorer({ initialData }: { initialData: PublicSitemapData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string>("all");

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter sections and items based on search query and active section pill
  const filteredSections = useMemo(() => {
    return initialData.sections
      .filter((section) => {
        if (activeSectionId === "all") return true;
        return section.id === activeSectionId;
      })
      .map((section) => {
        if (!normalizedQuery) return section;

        const matchingItems = section.items.filter((item) => {
          return (
            item.title.toLowerCase().includes(normalizedQuery) ||
            item.url.toLowerCase().includes(normalizedQuery) ||
            (item.description && item.description.toLowerCase().includes(normalizedQuery)) ||
            (item.badge && item.badge.toLowerCase().includes(normalizedQuery))
          );
        });

        return {
          ...section,
          items: matchingItems,
          count: matchingItems.length,
        };
      })
      .filter((section) => section.items.length > 0);
  }, [initialData.sections, activeSectionId, normalizedQuery]);

  const totalVisibleCount = useMemo(() => {
    return filteredSections.reduce((sum, s) => sum + s.items.length, 0);
  }, [filteredSections]);

  return (
    <div className="tf-sitemap-explorer">
      {/* Controls: Search Bar & Machine Protocols Bar */}
      <div className="tf-sitemap-controls-card">
        <div className="tf-sitemap-search-row">
          <div className="tf-sitemap-search-box" role="search">
            <Search className="tf-sitemap-search-icon" size={18} aria-hidden={true} />
            <input
              type="search"
              aria-label="Search all public pages and teas"
              placeholder="Filter pages, teas, flushes, brewing guides, policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tf-sitemap-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search input"
                className="tf-sitemap-clear-btn"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick links to machine feeds */}
          <div className="tf-sitemap-machine-pills" role="region" aria-label="Machine indexes and feeds">
            <Link href="/sitemap.xml" className="tf-sitemap-machine-pill" title="Machine-readable XML sitemap for search engines">
              <FileCode size={13} aria-hidden={true} />
              <span>XML Sitemap</span>
            </Link>
            <Link href="/llms.txt" className="tf-sitemap-machine-pill" title="Plain-text knowledge base for LLMs">
              <Bot size={13} aria-hidden={true} />
              <span>llms.txt</span>
            </Link>
            <Link href="/feeds" className="tf-sitemap-machine-pill" title="Product feed syndication">
              <Rss size={13} aria-hidden={true} />
              <span>Feeds</span>
            </Link>
            <Link href="/brochure" className="tf-sitemap-machine-pill" title="Download catalog brochure PDF">
              <FileText size={13} aria-hidden={true} />
              <span>Brochure (PDF)</span>
            </Link>
          </div>
        </div>

        {/* Section Filter Pills */}
        <div className="tf-sitemap-filter-pills" role="tablist" aria-label="Filter by page category">
          <button
            type="button"
            role="tab"
            aria-selected={activeSectionId === "all"}
            onClick={() => setActiveSectionId("all")}
            className={`tf-sitemap-pill ${activeSectionId === "all" ? "active" : ""}`}
          >
            <Layers size={13} aria-hidden={true} />
            <span>All Sections</span>
            <span className="tf-sitemap-pill-count">{initialData.totalCount}</span>
          </button>

          {initialData.sections.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSectionId === section.id}
              onClick={() => setActiveSectionId(section.id)}
              className={`tf-sitemap-pill ${activeSectionId === section.id ? "active" : ""}`}
            >
              <span>{section.title}</span>
              <span className="tf-sitemap-pill-count">{section.count}</span>
            </button>
          ))}
        </div>

        {/* Live Status Bar */}
        <div className="tf-sitemap-status-bar" aria-live="polite">
          <div className="tf-sitemap-status-text">
            <CheckCircle2 size={14} className="tf-sitemap-status-icon" aria-hidden={true} />
            <span>
              {normalizedQuery
                ? `Found ${totalVisibleCount} matching public ${totalVisibleCount === 1 ? "page" : "pages"} for "${searchQuery}"`
                : `Cataloging ${totalVisibleCount} verified public pages across ${filteredSections.length} sections`}
            </span>
          </div>

          <div className="tf-sitemap-status-badge">
            <span>Only Public Pages</span>
          </div>
        </div>
      </div>

      {/* Main Sections Directory */}
      {filteredSections.length === 0 ? (
        <div className="tf-sitemap-empty-state">
          <Search size={36} className="tf-sitemap-empty-icon" aria-hidden={true} />
          <h3>No matching pages found</h3>
          <p>
            No public page matched <strong>&ldquo;{searchQuery}&rdquo;</strong>. Try searching for &ldquo;Darjeeling&rdquo;, &ldquo;Shipping&rdquo;, &ldquo;Wholesale&rdquo;, or &ldquo;Blend Lab&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveSectionId("all");
            }}
            className="tf-sitemap-reset-btn"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="tf-sitemap-sections-container">
          {filteredSections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className="tf-sitemap-section-block"
              aria-labelledby={`heading-${section.id}`}
            >
              <div className="tf-sitemap-section-header">
                <div>
                  <h2 id={`heading-${section.id}`} className="tf-sitemap-section-title">
                    {section.title}
                  </h2>
                  <p className="tf-sitemap-section-desc">{section.description}</p>
                </div>
                <span className="tf-sitemap-section-badge">
                  {section.items.length} {section.items.length === 1 ? "link" : "links"}
                </span>
              </div>

              <ul className="tf-sitemap-cards-grid" role="list">
                {section.items.map((item, idx) => (
                  <li key={`${item.url}-${idx}`} className="tf-sitemap-card-item">
                    <Link
                      href={item.url}
                      className="tf-sitemap-card-link"
                      aria-label={`${item.title} — ${item.badge || "Page"}`}
                    >
                      <div className="tf-sitemap-card-top">
                        {item.badge && <span className="tf-sitemap-card-badge">{item.badge}</span>}
                        <ArrowUpRight size={15} className="tf-sitemap-card-arrow" aria-hidden={true} />
                      </div>

                      <h3 className="tf-sitemap-card-title">{item.title}</h3>

                      {item.description && (
                        <p className="tf-sitemap-card-desc">{item.description}</p>
                      )}

                      <div className="tf-sitemap-card-url">
                        <code>{item.url}</code>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
