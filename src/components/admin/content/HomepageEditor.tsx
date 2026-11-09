"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Save,
  Sparkles,
  Compass,
  Package,
  FlaskConical,
  BookOpen,
  ShieldCheck,
  Quote,
  Mail,
  Navigation as NavIcon,
  Eye,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Columns,
  ChevronRight,
  HelpCircle,
  X,
} from "lucide-react";
import { homepageSchema, type HomepageContent } from "@/lib/homepageSchema";
import type { HomepageTab, CategoryOption } from "./homepage/types";
import { HeroTab } from "./homepage/HeroTab";
import { DiscoveryTab } from "./homepage/DiscoveryTab";
import { ShelfTab } from "./homepage/ShelfTab";
import { TrialsTab } from "./homepage/TrialsTab";
import { StoryTab } from "./homepage/StoryTab";
import { BenefitsTab } from "./homepage/BenefitsTab";
import { ReviewsTab } from "./homepage/ReviewsTab";
import { NewsletterTab } from "./homepage/NewsletterTab";
import { NavigationTab } from "./homepage/NavigationTab";
import { LiveHomepagePreview } from "./homepage/LiveHomepagePreview";

const TAB_CONFIG: Array<{
  id: HomepageTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: (content: HomepageContent) => string | null;
}> = [
  { id: "hero", label: "Hero & Brand", icon: Sparkles },
  {
    id: "discovery",
    label: "Discovery Panels",
    icon: Compass,
    badge: (c) => `${c.discovery.tiles.length}`,
  },
  { id: "shelf", label: "Curated Shelf", icon: Package },
  {
    id: "trials",
    label: "Trials Flights",
    icon: FlaskConical,
    badge: (c) => (c.trials?.enabled !== false ? "On" : "Off"),
  },
  { id: "story", label: "Artisan Story", icon: BookOpen },
  {
    id: "benefits",
    label: "Value Pillars",
    icon: ShieldCheck,
    badge: (c) => `${c.benefits?.length ?? 0}`,
  },
  {
    id: "reviews",
    label: "Customer Stories",
    icon: Quote,
    badge: (c) => `${c.reviews?.entries?.filter((e) => e.approved).length ?? 0} active`,
  },
  {
    id: "newsletter",
    label: "Tea Circle",
    icon: Mail,
    badge: (c) => (c.newsletter?.enabled ? "On" : "Off"),
  },
  { id: "navigation", label: "Nav & Links", icon: NavIcon },
  { id: "preview", label: "Visual Preview", icon: Eye },
];

export function HomepageEditor() {
  const [content, setContent] = useState<HomepageContent | null>(null);
  const [initialContent, setInitialContent] = useState<HomepageContent | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [activeTab, setActiveTab] = useState<HomepageTab>("hero");
  const [splitView, setSplitView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Check if content is dirty (unsaved changes)
  const isDirty = Boolean(
    content &&
      initialContent &&
      JSON.stringify(content) !== JSON.stringify(initialContent)
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [homeRes, catRes] = await Promise.all([
        fetch("/api/admin/homepage"),
        fetch("/api/admin/categories"),
      ]);

      if (!homeRes.ok) throw new Error("Could not load homepage content.");
      const homeData = await homeRes.json();

      if (!homeData.content) {
        setNotice({
          type: "error",
          message:
            "Homepage content unavailable in database. Ensure migrations are applied.",
        });
      } else {
        setContent(homeData.content);
        setInitialContent(structuredClone(homeData.content));
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.items ?? catData.categories ?? []);
      }
    } catch {
      setNotice({
        type: "error",
        message: "Failed to load homepage configuration. Please refresh and try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!content) return;
    setNotice(null);

    // Validate using Zod schema
    const parsed = homepageSchema.safeParse(content);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const issuePath = firstIssue?.path?.join(" ➔ ") || "Field";
      const issueMsg = firstIssue?.message || "Invalid value";

      // Attempt to auto-switch to the relevant tab
      const rootPart = String(firstIssue?.path?.[0] || "");
      if (
        [
          "hero",
          "discovery",
          "shelf",
          "trials",
          "story",
          "benefits",
          "reviews",
          "newsletter",
          "navigation",
          "footer_links",
          "brand",
          "tagline",
          "disclosure",
          "footer_text",
        ].includes(rootPart)
      ) {
        if (rootPart === "brand" || rootPart === "tagline") setActiveTab("hero");
        else if (
          rootPart === "navigation" ||
          rootPart === "footer_links" ||
          rootPart === "disclosure" ||
          rootPart === "footer_text"
        )
          setActiveTab("navigation");
        else setActiveTab(rootPart as HomepageTab);
      }

      setNotice({
        type: "error",
        message: `Validation error at ${issuePath}: ${issueMsg}`,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save rejected by server.");
      }

      const updated = (await res.json()).content;
      setContent(updated);
      setInitialContent(structuredClone(updated));
      setNotice({
        type: "success",
        message:
          "Homepage experience successfully published! Changes are now active on the live storefront.",
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to publish homepage. Your edits remain in this editor.",
      });
    } finally {
      setSaving(false);
    }
  }, [content]);

  // Keyboard shortcut listener: Cmd+S / Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Content update callback for sub-tabs
  const handleContentUpdate = useCallback(
    (updater: (prev: HomepageContent) => HomepageContent) => {
      setContent((prev) => (prev ? updater(prev) : prev));
    },
    []
  );

  // Revert / Discard edits
  function handleDiscard() {
    if (initialContent) {
      setContent(structuredClone(initialContent));
      setNotice({ type: "info", message: "Edits discarded. Reverted to last published state." });
    }
    setShowDiscardModal(false);
  }

  if (loading) {
    return (
      <div className="hp-loading-screen" role="status">
        <div className="hp-loading-spinner" />
        <p>Loading Himalayan Tea House homepage content…</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="hp-error-screen" role="alert">
        <AlertCircle size={40} className="hp-error-icon" />
        <h2>Unable to Load Homepage Experience</h2>
        <p>{notice?.message || "Please verify database connection and credentials."}</p>
        <button type="button" className="hp-action-btn primary mt-4" onClick={() => void loadData()}>
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="hp-manager-root">
      {/* Executive Command Header */}
      <header className="hp-exec-header">
        <div className="hp-exec-header-left">
          <nav className="hp-breadcrumbs" aria-label="Breadcrumbs">
            <span>Editorial & Content</span>
            <ChevronRight size={13} className="hp-bc-sep" />
            <span className="hp-bc-curr">Homepage Experience Manager</span>
          </nav>

          <div className="hp-title-row">
            <h1 className="hp-page-title">Homepage Visual Director</h1>
            <div className="hp-status-pills">
              {isDirty ? (
                <span className="hp-status-pill dirty" title="You have unsaved edits">
                  <span className="hp-dot amber" /> Unsaved Edits
                </span>
              ) : (
                <span className="hp-status-pill synced" title="Synced with live storefront">
                  <span className="hp-dot green" /> Published & Synced
                </span>
              )}
              <span className="hp-shortcut-hint">⌘S to save</span>
            </div>
          </div>
        </div>

        <div className="hp-exec-header-actions">
          {/* Discard changes */}
          {isDirty && (
            <button
              type="button"
              className="hp-top-btn ghost"
              onClick={() => setShowDiscardModal(true)}
              disabled={saving}
              title="Discard unsaved edits"
            >
              <RotateCcw size={15} />
              <span>Discard</span>
            </button>
          )}

          {/* Toggle Split-Screen Canvas */}
          <button
            type="button"
            className={`hp-top-btn split-toggle ${splitView ? "active" : ""}`}
            onClick={() => setSplitView(!splitView)}
            title="Toggle side-by-side interactive preview"
          >
            <Columns size={15} />
            <span>{splitView ? "Full Editor" : "Split Canvas"}</span>
          </button>

          {/* Live Storefront Link */}
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hp-top-btn outline"
            title="Open live storefront in new tab"
          >
            <ExternalLink size={15} />
            <span>View Live Site</span>
          </Link>

          {/* Save / Publish Button */}
          <button
            type="button"
            className="hp-top-btn primary save-btn"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? "Publishing…" : "Publish Homepage"}</span>
          </button>
        </div>
      </header>

      {/* Floating / Sticky Alert Toast */}
      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={`hp-notice-toast ${notice.type}`}
        >
          <div className="hp-notice-content">
            {notice.type === "success" && <CheckCircle2 size={18} />}
            {notice.type === "error" && <AlertCircle size={18} />}
            {notice.type === "info" && <HelpCircle size={18} />}
            <span className="hp-notice-text">{notice.message}</span>
          </div>
          <button
            type="button"
            className="hp-notice-dismiss"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Primary Section Tabs Bar */}
      <nav className="hp-tabs-nav" role="tablist" aria-label="Homepage Sections">
        <div className="hp-tabs-list">
          {TAB_CONFIG.map((tab) => {
            const IconComp = tab.icon;
            const isCurrent = activeTab === tab.id;
            const badgeValue = tab.badge ? tab.badge(content) : null;

            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`panel-${tab.id}`}
                aria-selected={isCurrent}
                className={`hp-tab-btn ${isCurrent ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "preview") setSplitView(false);
                }}
              >
                <IconComp size={16} className="hp-tab-icon" />
                <span className="hp-tab-label">{tab.label}</span>
                {badgeValue && <span className="hp-tab-badge">{badgeValue}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Workspace: Split Canvas or Single Panel */}
      <main className={`hp-workspace-grid ${splitView ? "split-active" : "single-active"}`}>
        {/* Editor Form Panel */}
        <section
          className={`hp-editor-pane ${activeTab === "preview" && !splitView ? "hidden" : ""}`}
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === "hero" && (
            <HeroTab content={content} onChange={handleContentUpdate} disabled={saving} />
          )}
          {activeTab === "discovery" && (
            <DiscoveryTab
              content={content}
              categories={categories}
              onChange={handleContentUpdate}
              disabled={saving}
            />
          )}
          {activeTab === "shelf" && (
            <ShelfTab content={content} onChange={handleContentUpdate} disabled={saving} />
          )}
          {activeTab === "trials" && (
            <TrialsTab content={content} onChange={handleContentUpdate} />
          )}
          {activeTab === "story" && (
            <StoryTab content={content} onChange={handleContentUpdate} disabled={saving} />
          )}
          {activeTab === "benefits" && (
            <BenefitsTab content={content} onChange={handleContentUpdate} disabled={saving} />
          )}
          {activeTab === "reviews" && (
            <ReviewsTab content={content} onChange={handleContentUpdate} disabled={saving} />
          )}
          {activeTab === "newsletter" && (
            <NewsletterTab content={content} onChange={handleContentUpdate} disabled={saving} />
          )}
          {activeTab === "navigation" && (
            <NavigationTab content={content} onChange={handleContentUpdate} disabled={saving} />
          )}

          {/* Sticky Bottom Save Affordance inside editor pane */}
          <div className="hp-bottom-save-bar">
            <div className="hp-bottom-status">
              {isDirty ? (
                <span className="text-amber-800">
                  ● You have unsaved edits in this session
                </span>
              ) : (
                <span className="text-emerald-800">
                  ✓ All sections are in sync with live storefront
                </span>
              )}
            </div>
            <div className="hp-bottom-actions">
              {isDirty && (
                <button
                  type="button"
                  className="hp-action-btn ghost"
                  onClick={() => setShowDiscardModal(true)}
                  disabled={saving}
                >
                  Discard Edits
                </button>
              )}
              <button
                type="button"
                className="hp-action-btn primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                <Save size={16} />
                <span>{saving ? "Publishing…" : "Publish Homepage"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Live Preview Canvas Panel (Visible in Split View or when Preview tab active) */}
        {(splitView || activeTab === "preview") && (
          <aside
            className={`hp-preview-pane ${activeTab === "preview" ? "full-preview" : "split-preview"}`}
            aria-label="Live Storefront Preview"
          >
            <LiveHomepagePreview content={content} categories={categories} />
          </aside>
        )}
      </main>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div className="hp-modal-backdrop" role="dialog" aria-modal="true">
          <div className="hp-modal-box">
            <div className="hp-modal-head">
              <AlertCircle size={22} className="text-amber-600" />
              <h3>Discard Unsaved Homepage Edits?</h3>
            </div>
            <p className="hp-modal-body">
              This action will revert all uncommitted changes back to the database version.
              Any modified headlines, images, or testimonials will be lost.
            </p>
            <div className="hp-modal-actions">
              <button
                type="button"
                className="hp-action-btn ghost"
                onClick={() => setShowDiscardModal(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="hp-action-btn danger"
                onClick={handleDiscard}
              >
                Discard Edits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Scoped Luxury CMS Styles */}
      <style>{`
        .hp-manager-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          color: var(--ink, #171713);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 1440px;
          margin: 0 auto;
        }

        /* Executive Header */
        .hp-exec-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          padding: 16px 20px;
          background: #fbf8f1;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .hp-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #7b8075;
          margin-bottom: 4px;
        }

        .hp-bc-sep {
          color: #aeb3a7;
        }

        .hp-bc-curr {
          color: var(--forest, #1d2a24);
          font-weight: 600;
        }

        .hp-title-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .hp-page-title {
          font-family: Georgia, serif;
          font-size: 24px;
          font-weight: 600;
          color: var(--forest, #1d2a24);
          margin: 0;
          line-height: 1.2;
        }

        .hp-status-pills {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hp-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
          border: 1px solid transparent;
        }

        .hp-status-pill.dirty {
          background: rgba(179, 107, 61, 0.12);
          color: #944e22;
          border-color: rgba(179, 107, 61, 0.3);
        }

        .hp-status-pill.synced {
          background: rgba(35, 72, 58, 0.1);
          color: #23483a;
          border-color: rgba(35, 72, 58, 0.25);
        }

        .hp-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .hp-dot.amber {
          background: #b36b3d;
          box-shadow: 0 0 0 2px rgba(179, 107, 61, 0.25);
        }

        .hp-dot.green {
          background: #23483a;
        }

        .hp-shortcut-hint {
          font-size: 11px;
          color: #8c9285;
          background: #ede8dc;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #d9d4c8;
        }

        .hp-exec-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .hp-top-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
          transition: all 140ms ease;
          min-height: 38px;
        }

        .hp-top-btn.ghost {
          background: transparent;
          border: 1px solid var(--admin-border, #d9d4c8);
          color: #5d6156;
        }

        .hp-top-btn.ghost:hover {
          background: #ede9df;
          color: #171713;
        }

        .hp-top-btn.split-toggle {
          background: #f1ecdf;
          border: 1px solid #d9d4c8;
          color: var(--forest, #1d2a24);
        }

        .hp-top-btn.split-toggle.active {
          background: var(--forest, #1d2a24);
          color: #ffffff;
          border-color: var(--forest, #1d2a24);
        }

        .hp-top-btn.outline {
          background: #ffffff;
          border: 1px solid #c9c3b5;
          color: var(--pine, #23483a);
        }

        .hp-top-btn.outline:hover {
          border-color: var(--pine, #23483a);
          background: #f7f4ec;
        }

        .hp-top-btn.primary {
          background: var(--pine, #23483a);
          color: #ffffff;
          border: 1px solid #1a362b;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        }

        .hp-top-btn.primary:hover:not(:disabled) {
          background: #193329;
        }

        .hp-top-btn.primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Toast Notifications */
        .hp-notice-toast {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          border-radius: 6px;
          font-size: 13px;
          animation: hpSlideDown 200ms ease;
        }

        @keyframes hpSlideDown {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hp-notice-toast.success {
          background: rgba(35, 72, 58, 0.12);
          border: 1px solid rgba(35, 72, 58, 0.35);
          color: #1a392e;
        }

        .hp-notice-toast.error {
          background: rgba(143, 47, 42, 0.12);
          border: 1px solid rgba(143, 47, 42, 0.35);
          color: #832521;
        }

        .hp-notice-toast.info {
          background: rgba(179, 145, 86, 0.15);
          border: 1px solid rgba(179, 145, 86, 0.4);
          color: #634d1f;
        }

        .hp-notice-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .hp-notice-dismiss {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          opacity: 0.7;
        }

        .hp-notice-dismiss:hover {
          opacity: 1;
        }

        /* Tabs Bar */
        .hp-tabs-nav {
          background: #fbf8f1;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 6px;
          overflow-x: auto;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .hp-tabs-list {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: max-content;
        }

        .hp-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #55594f;
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 140ms ease;
          white-space: nowrap;
        }

        .hp-tab-btn:hover {
          background: #efebe1;
          color: var(--forest, #1d2a24);
        }

        .hp-tab-btn.active {
          background: var(--forest, #1d2a24);
          color: #ffffff;
          font-weight: 600;
        }

        .hp-tab-btn.active .hp-tab-icon {
          color: var(--admin-sidebar-accent, #b39156);
        }

        .hp-tab-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.08);
          color: inherit;
        }

        .hp-tab-btn.active .hp-tab-badge {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        /* Main Workspace */
        .hp-workspace-grid {
          display: grid;
          gap: 20px;
        }

        .hp-workspace-grid.single-active {
          grid-template-columns: 1fr;
        }

        .hp-workspace-grid.split-active {
          grid-template-columns: 55% 45%;
        }

        .hp-editor-pane {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .hp-editor-pane.hidden {
          display: none;
        }

        .hp-preview-pane {
          min-width: 0;
        }

        .hp-preview-pane.split-preview {
          position: sticky;
          top: 80px;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          background: #fbf8f1;
        }

        /* Section Intro */
        .hp-section-intro {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 20px;
          background: #fbf8f1;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
        }

        .hp-section-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: rgba(35, 72, 58, 0.1);
          color: var(--pine, #23483a);
          flex-shrink: 0;
        }

        .hp-section-intro h3 {
          font-family: Georgia, serif;
          font-size: 18px;
          font-weight: 600;
          color: var(--forest, #1d2a24);
          margin: 0 0 4px;
        }

        .hp-section-intro p {
          font-size: 13px;
          color: #63665e;
          margin: 0;
          line-height: 1.45;
        }

        /* 2 Column Layout */
        .hp-two-col-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .hp-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Cards */
        .hp-card {
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .hp-card-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          letter-spacing: 0.02em;
          margin: 0 0 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hp-card-desc {
          font-size: 12px;
          color: #6e7267;
          margin: -8px 0 14px;
          line-height: 1.4;
        }

        /* Inputs & Form Elements */
        .hp-field-group {
          margin-bottom: 16px;
        }

        .hp-field-group:last-child {
          margin-bottom: 0;
        }

        .hp-sublabel {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #494d43;
          margin-bottom: 6px;
        }

        .hp-input,
        .hp-textarea,
        .hp-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #c9c3b5;
          border-radius: 5px;
          background: #ffffff;
          color: var(--ink, #171713);
          font-size: 13px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .hp-input:focus,
        .hp-textarea:focus,
        .hp-select:focus {
          border-color: var(--pine, #23483a);
          outline: none;
          box-shadow: 0 0 0 2px rgba(35, 72, 58, 0.2);
        }

        .hp-input.sm {
          padding: 7px 10px;
          font-size: 12px;
        }

        .hp-input.input-error {
          border-color: #8f2f2a !important;
          background: #fffafa;
        }

        .hp-textarea {
          resize: vertical;
          min-height: 60px;
          line-height: 1.45;
        }

        .hp-hint {
          font-size: 11px;
          color: #7d8276;
          margin-top: 5px;
          margin-bottom: 0;
        }

        .hp-error-hint {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #8f2f2a;
          margin-top: 6px;
          margin-bottom: 0;
        }

        .req-star {
          color: #b33830;
          margin-left: 2px;
        }

        .hp-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .hp-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
        }

        /* Action Buttons */
        .hp-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 5px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 140ms ease;
          min-height: 36px;
        }

        .hp-action-btn.primary {
          background: var(--pine, #23483a);
          color: #ffffff;
        }

        .hp-action-btn.primary:hover:not(:disabled) {
          background: #183329;
        }

        .hp-action-btn.ghost {
          background: transparent;
          border-color: #d9d4c8;
          color: #555850;
        }

        .hp-action-btn.ghost:hover {
          background: #f1ede3;
        }

        .hp-action-btn.danger {
          background: #8f2f2a;
          color: #ffffff;
        }

        .hp-action-btn.danger:hover {
          background: #772622;
        }

        .hp-action-btn.add-item-btn {
          background: rgba(35, 72, 58, 0.08);
          border-color: rgba(35, 72, 58, 0.25);
          color: var(--pine, #23483a);
        }

        .hp-action-btn.add-item-btn:hover {
          background: rgba(35, 72, 58, 0.16);
        }

        /* Image Field with Picker */
        .hp-img-field {
          background: #faf8f3;
          border: 1px solid #dfdad0;
          border-radius: 6px;
          padding: 16px;
        }

        .hp-img-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .hp-img-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
        }

        .hp-img-badge {
          font-size: 10px;
          font-weight: 600;
          background: #ede8dc;
          color: #63665e;
          padding: 2px 7px;
          border-radius: 10px;
        }

        .hp-img-desc {
          font-size: 12px;
          color: #6a6e63;
          margin: 0 0 12px;
        }

        .hp-img-preview-box {
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          overflow: hidden;
          background: #ffffff;
          margin-bottom: 12px;
          position: relative;
        }

        .hp-img-preview-inner {
          position: relative;
          width: 100%;
          height: 180px;
        }

        .hp-img-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .hp-img-overlay-actions {
          position: absolute;
          top: 8px;
          right: 8px;
        }

        .hp-img-icon-btn {
          background: rgba(23, 23, 19, 0.75);
          color: #ffffff;
          border: none;
          padding: 4px 8px;
          font-size: 11px;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .hp-img-icon-btn:hover {
          background: rgba(23, 23, 19, 0.9);
        }

        .hp-img-empty-box {
          height: 130px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f7f4ec;
          color: #8c9085;
          text-align: center;
          padding: 12px;
        }

        .hp-img-empty-icon {
          color: #b1b5aa;
          margin-bottom: 6px;
        }

        .hp-img-empty-text {
          font-size: 12px;
          font-weight: 600;
          color: #55594f;
          margin: 0;
        }

        .hp-img-empty-sub {
          font-size: 11px;
          color: #8c9085;
          margin-top: 2px;
        }

        .hp-img-controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hp-img-btn-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hp-action-btn.media-lib-btn {
          background: #ffffff;
          border: 1px solid #c9c3b5;
          color: var(--pine, #23483a);
        }

        .hp-action-btn.upload-btn {
          background: #ffffff;
          border: 1px solid #c9c3b5;
          color: #44473e;
        }

        .hp-action-btn.toggle-input-btn {
          background: transparent;
          border: 1px solid #dcd7ce;
          color: #7b8074;
          font-size: 11px;
        }

        .hp-upload-error-banner {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: rgba(143, 47, 42, 0.1);
          color: #8f2f2a;
          border: 1px solid rgba(143, 47, 42, 0.25);
          border-radius: 4px;
          font-size: 12px;
        }

        /* Link Control */
        .hp-link-card {
          border: 1px solid #dfdad0;
          border-radius: 6px;
          padding: 14px;
          background: #faf8f3;
          margin-bottom: 12px;
        }

        .hp-link-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .hp-link-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--forest, #1d2a24);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .req-pill {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          background: rgba(179, 107, 61, 0.15);
          color: #b36b3d;
          padding: 2px 5px;
          border-radius: 4px;
        }

        .hp-link-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .hp-link-presets {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .hp-preset-title {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #7b8075;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .hp-preset-pills {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }

        .hp-preset-pill {
          background: #ede8dc;
          border: 1px solid #d9d4c8;
          border-radius: 12px;
          font-size: 10px;
          color: #4f5349;
          padding: 2px 7px;
          cursor: pointer;
        }

        .hp-preset-pill.active {
          background: var(--pine, #23483a);
          color: #ffffff;
          border-color: var(--pine, #23483a);
        }

        /* Discovery Tiles Grid */
        .hp-tiles-manager {
          margin-top: 10px;
        }

        .hp-tiles-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .hp-tiles-header h4 {
          font-size: 14px;
          font-weight: 700;
          margin: 0;
        }

        .hp-tiles-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .hp-tile-editor-card {
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 16px;
        }

        .hp-tile-editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .hp-tile-badge {
          font-size: 11px;
          font-weight: 700;
          background: #ede8dc;
          padding: 3px 8px;
          border-radius: 4px;
          color: var(--forest, #1d2a24);
        }

        .hp-tile-remove-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: #8f2f2a;
          font-size: 11px;
          cursor: pointer;
        }

        .hp-tile-remove-btn:hover {
          text-decoration: underline;
        }

        .hp-tone-options {
          display: flex;
          gap: 8px;
        }

        .hp-tone-btn {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid #d9d4c8;
          border-radius: 5px;
          background: #faf8f5;
          font-size: 11px;
          cursor: pointer;
        }

        .hp-tone-btn.active {
          border-color: var(--pine, #23483a);
          background: rgba(35, 72, 58, 0.08);
          font-weight: 600;
        }

        .hp-tone-swatch {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 1px solid rgba(0, 0, 0, 0.2);
        }

        .hp-tone-swatch.dark {
          background: #1d2a24;
        }

        .hp-tone-swatch.light {
          background: #fbf8f1;
        }

        /* Value Guidance (Benefits) */
        .hp-benefits-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .hp-benefits-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .hp-benefit-card {
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 16px;
        }

        .hp-benefit-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .hp-benefit-num {
          font-size: 11px;
          font-weight: 700;
          background: #ede8dc;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .hp-icon-picker {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .hp-icon-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 4px;
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          background: #faf8f4;
          color: #555850;
          cursor: pointer;
        }

        .hp-icon-option:hover {
          background: #ede8dc;
        }

        .hp-icon-option.selected {
          border-color: var(--pine, #23483a);
          background: rgba(35, 72, 58, 0.12);
          color: var(--pine, #23483a);
          box-shadow: 0 0 0 1px var(--pine, #23483a);
        }

        .hp-icon-name {
          font-size: 10px;
          font-weight: 600;
        }

        /* Reviews / Testimonials */
        .hp-compliance-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 18px;
          background: rgba(179, 145, 86, 0.12);
          border: 1px solid rgba(179, 145, 86, 0.4);
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 12px;
        }

        .hp-compliance-icon {
          color: #8c6a29;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .hp-compliance-text strong {
          display: block;
          color: #6d531d;
          margin-bottom: 2px;
        }

        .hp-compliance-text p {
          margin: 0;
          color: #55441d;
          line-height: 1.4;
        }

        .hp-reviews-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .hp-reviews-counts {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hp-reviews-stat-pill {
          font-size: 11px;
          font-weight: 600;
          background: #ede8dc;
          color: #55594e;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .hp-reviews-stack {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .hp-review-card {
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 16px;
        }

        .hp-review-card.is-approved {
          border-left: 4px solid var(--pine, #23483a);
        }

        .hp-review-card.is-draft {
          border-left: 4px solid #b36b3d;
        }

        .hp-review-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .hp-review-status-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hp-review-num {
          font-size: 11px;
          font-weight: 700;
          color: #7b8075;
        }

        .hp-approval-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .hp-approval-pill.approved {
          background: rgba(35, 72, 58, 0.12);
          color: #23483a;
        }

        .hp-approval-pill.draft {
          background: rgba(179, 107, 61, 0.12);
          color: #944e22;
        }

        .hp-review-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .hp-switch-wrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 12px;
        }

        .hp-switch-wrap input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .hp-switch-slider {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
          background: #d6d0c2;
          border-radius: 20px;
          transition: background 150ms ease;
        }

        .hp-switch-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background: #ffffff;
          border-radius: 50%;
          transition: transform 150ms ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .hp-switch-wrap input:checked + .hp-switch-slider {
          background: var(--pine, #23483a);
        }

        .hp-switch-wrap input:checked + .hp-switch-slider:before {
          transform: translateX(16px);
        }

        .hp-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Navigation Links Table */
        .hp-links-mgr-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .hp-links-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hp-link-row {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #faf8f5;
          padding: 8px 10px;
          border: 1px solid #e2ddd4;
          border-radius: 6px;
        }

        .hp-link-drag-idx {
          font-size: 11px;
          font-weight: 700;
          color: #8c9085;
          width: 18px;
        }

        .hp-link-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .hp-link-del-btn {
          background: transparent;
          border: none;
          color: #944e22;
          cursor: pointer;
          padding: 4px;
        }

        .hp-link-del-btn:hover {
          color: #8f2f2a;
        }

        .hp-route-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .hp-route-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f1ede3;
          border: 1px solid #d9d4c8;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
        }

        .hp-route-pill code {
          color: var(--pine, #23483a);
          font-family: monospace;
          background: rgba(255, 255, 255, 0.7);
          padding: 1px 4px;
          border-radius: 3px;
        }

        /* Bottom Sticky Save Bar */
        .hp-bottom-save-bar {
          position: sticky;
          bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: rgba(251, 248, 241, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          z-index: 15;
          margin-top: 10px;
        }

        .hp-bottom-status {
          font-size: 12px;
          font-weight: 600;
        }

        .hp-bottom-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Modal */
        .hp-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(23, 23, 19, 0.5);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .hp-modal-box {
          background: #ffffff;
          border-radius: 8px;
          padding: 24px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          border: 1px solid #d9d4c8;
        }

        .hp-modal-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .hp-modal-head h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: var(--forest, #1d2a24);
        }

        .hp-modal-body {
          font-size: 13px;
          color: #555850;
          line-height: 1.5;
          margin: 0 0 20px;
        }

        .hp-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        /* Live Preview Simulation Styling */
        .hp-preview-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #e5dfd2;
          border-radius: 8px;
          overflow: hidden;
        }

        .hp-preview-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: #1d2a24;
          color: #ffffff;
          font-size: 12px;
        }

        .hp-preview-bar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hp-preview-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          color: var(--admin-sidebar-accent, #b39156);
        }

        .hp-preview-mode-desc {
          color: #aeb7aa;
          font-size: 11px;
        }

        .hp-preview-bar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hp-device-toggle {
          display: flex;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 2px;
        }

        .hp-device-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 3px;
          border: none;
          background: transparent;
          color: #aeb7aa;
          font-size: 11px;
          cursor: pointer;
        }

        .hp-device-btn.active {
          background: #ffffff;
          color: #1d2a24;
          font-weight: 600;
        }

        .hp-preview-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #e6ebe5;
          cursor: pointer;
        }

        .hp-canvas-stage {
          flex: 1;
          display: flex;
          justify-content: center;
          padding: 20px 10px;
          overflow-y: auto;
        }

        .hp-canvas-stage.desktop {
          padding: 16px;
        }

        .hp-canvas-device-frame.desktop {
          width: 100%;
          background: #f6f1e7;
          border-radius: 6px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .hp-canvas-device-frame.mobile {
          width: 390px;
          min-height: 720px;
          background: #f6f1e7;
          border-radius: 36px;
          border: 10px solid #232520;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          position: relative;
        }

        .hp-iphone-notch {
          width: 120px;
          height: 18px;
          background: #232520;
          margin: 0 auto 6px;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
        }

        /* Mock Storefront Visuals */
        .hp-storefront-mockup {
          background: #f6f1e7;
          color: #171713;
          font-family: Georgia, serif;
          font-size: 12px;
          line-height: 1.4;
        }

        .mock-header {
          padding: 12px 18px;
          border-bottom: 1px solid #e6dfd2;
          background: #f6f1e7;
        }

        .mock-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mock-brand {
          display: flex;
          flex-direction: column;
        }

        .mock-brand-name {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        .mock-brand-tagline {
          font-size: 7px;
          letter-spacing: 0.16em;
          color: #7b8075;
        }

        .mock-nav-links {
          display: flex;
          gap: 12px;
          font-size: 11px;
          font-family: -apple-system, sans-serif;
        }

        .mock-hero {
          padding: 24px 18px;
        }

        .mock-hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: center;
        }

        .hp-canvas-device-frame.mobile .mock-hero-grid {
          grid-template-columns: 1fr;
        }

        .mock-eyebrow {
          font-size: 8px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #7b8075;
          margin: 0 0 6px;
          font-family: -apple-system, sans-serif;
        }

        .mock-hero-title {
          font-size: 20px;
          font-weight: 400;
          margin: 0 0 8px;
          line-height: 1.15;
        }

        .mock-hero-title em {
          font-style: italic;
          color: #b36b3d;
        }

        .mock-hero-desc {
          font-size: 11px;
          color: #55594f;
          margin: 0 0 14px;
          font-family: -apple-system, sans-serif;
        }

        .mock-hero-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .mock-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 10px;
          font-family: -apple-system, sans-serif;
          font-weight: 600;
          border-radius: 3px;
        }

        .mock-btn-primary {
          background: #1d2a24;
          color: #ffffff;
        }

        .mock-btn-outline {
          border: 1px solid #1d2a24;
          color: #1d2a24;
        }

        .mock-hero-visual {
          position: relative;
          height: 160px;
          border-radius: 4px;
          overflow: hidden;
          background: #e2dbcb;
        }

        .mock-hero-img {
          object-fit: cover;
        }

        .mock-img-placeholder {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8c9085;
          font-size: 10px;
          font-family: -apple-system, sans-serif;
          text-align: center;
          padding: 8px;
        }

        /* Mock Discovery */
        .mock-discovery {
          padding: 20px 18px;
          border-top: 1px solid #e6dfd2;
        }

        .mock-sec-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 14px;
        }

        .mock-sec-title {
          font-size: 16px;
          font-weight: 400;
          margin: 0;
        }

        .mock-sec-title em {
          font-style: italic;
          color: #b36b3d;
        }

        .mock-sec-desc {
          font-size: 10px;
          color: #6a6e64;
          font-family: -apple-system, sans-serif;
          max-width: 200px;
          margin: 0;
        }

        .mock-discovery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
        }

        .mock-tile {
          position: relative;
          height: 120px;
          border-radius: 4px;
          overflow: hidden;
          background: #23483a;
        }

        .mock-tile-bg {
          object-fit: cover;
          opacity: 0.85;
        }

        .mock-tile-copy {
          position: relative;
          z-index: 2;
          padding: 10px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .mock-tile.tone-dark .mock-tile-copy {
          color: #ffffff;
        }

        .mock-tile.tone-dark .mock-eyebrow {
          color: rgba(255, 255, 255, 0.7);
        }

        .mock-tile.tone-light .mock-tile-copy {
          color: #171713;
        }

        .mock-tile-copy h3 {
          font-size: 12px;
          margin: 0 0 4px;
        }

        .mock-tile-cta {
          font-size: 9px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-family: -apple-system, sans-serif;
        }

        /* Mock Shelf */
        .mock-shelf {
          padding: 20px 18px;
          border-top: 1px solid #e6dfd2;
        }

        .mock-shelf-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .mock-product-card {
          background: #ffffff;
          border: 1px solid #e2dbcb;
          border-radius: 4px;
          overflow: hidden;
        }

        .mock-prod-img-box {
          position: relative;
          height: 100px;
          background: #f7f4ec;
        }

        .mock-prod-img {
          object-fit: cover;
        }

        .mock-prod-info {
          padding: 8px;
        }

        .mock-prod-info h4 {
          font-size: 11px;
          margin: 0 0 3px;
        }

        .mock-prod-price {
          font-size: 10px;
          font-weight: 600;
          color: #1d2a24;
          margin: 0 0 6px;
          font-family: -apple-system, sans-serif;
        }

        .mock-btn-add {
          display: block;
          text-align: center;
          padding: 4px;
          font-size: 9px;
          font-weight: 600;
          background: #1d2a24;
          color: #ffffff;
          border-radius: 3px;
          font-family: -apple-system, sans-serif;
        }

        /* Mock Story */
        .mock-story {
          padding: 20px 18px;
          border-top: 1px solid #e6dfd2;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          align-items: center;
        }

        .hp-canvas-device-frame.mobile .mock-story {
          grid-template-columns: 1fr;
        }

        .mock-story-visual {
          position: relative;
          height: 140px;
          border-radius: 4px;
          overflow: hidden;
        }

        .mock-story-img {
          object-fit: cover;
        }

        .mock-story-caption {
          position: absolute;
          bottom: 6px;
          left: 6px;
          right: 6px;
          font-size: 8px;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.6);
          padding: 4px 6px;
          border-radius: 3px;
          margin: 0;
        }

        .mock-story-copy {
          position: relative;
        }

        .mock-story-leaf-icon {
          position: absolute;
          top: -10px;
          right: 0;
          color: rgba(35, 72, 58, 0.1);
        }

        .mock-story-desc {
          font-size: 10px;
          color: #55594e;
          margin: 0 0 10px;
          font-family: -apple-system, sans-serif;
        }

        /* Mock Benefits */
        .mock-benefits {
          padding: 16px 18px;
          border-top: 1px solid #e6dfd2;
          background: #ede8dc;
        }

        .mock-benefits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }

        .mock-benefit-card {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .mock-benefit-icon {
          color: #23483a;
          flex-shrink: 0;
        }

        .mock-benefit-card h5 {
          font-size: 10px;
          margin: 0 0 2px;
          font-family: Georgia, serif;
        }

        .mock-benefit-card p {
          font-size: 9px;
          color: #5d6156;
          margin: 0;
          font-family: -apple-system, sans-serif;
        }

        /* Mock Community */
        .mock-community {
          padding: 20px 18px;
          border-top: 1px solid #e6dfd2;
        }

        .mock-reviews-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }

        .mock-review-card {
          background: #ffffff;
          border: 1px solid #e2dbcb;
          border-radius: 4px;
          padding: 10px;
          margin: 0;
        }

        .mock-quote-icon {
          color: #b39156;
          margin-bottom: 4px;
        }

        .mock-review-card blockquote {
          font-size: 10px;
          font-style: italic;
          margin: 0 0 6px;
        }

        .mock-review-card figcaption {
          font-size: 8px;
          font-family: -apple-system, sans-serif;
          color: #7b8075;
          font-weight: 600;
        }

        .mock-draft-badge {
          color: #b36b3d;
        }

        .mock-reviews-empty {
          text-align: center;
          padding: 16px;
          color: #7b8075;
        }

        /* Mock Newsletter */
        .mock-newsletter {
          position: relative;
          padding: 24px 18px;
          background: #1d2a24;
          color: #ffffff;
          overflow: hidden;
        }

        .mock-nl-bg {
          object-fit: cover;
          opacity: 0.25;
        }

        .mock-nl-content {
          position: relative;
          z-index: 2;
          text-align: center;
          max-width: 320px;
          margin: 0 auto;
        }

        .mock-nl-content h2 {
          font-size: 14px;
          margin: 0 0 6px;
        }

        .mock-nl-content p {
          font-size: 10px;
          color: #d1d8ce;
          margin: 0 0 10px;
          font-family: -apple-system, sans-serif;
        }

        .mock-nl-form {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
        }

        .mock-nl-input {
          flex: 1;
          padding: 5px 8px;
          font-size: 10px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
        }

        .mock-nl-btn {
          padding: 5px 10px;
          font-size: 10px;
          background: #b39156;
          color: #ffffff;
          border: none;
          border-radius: 3px;
          font-weight: 600;
        }

        .mock-nl-consent {
          font-size: 8px;
          color: #aeb7aa;
        }

        /* Mock Footer */
        .mock-footer {
          padding: 20px 18px;
          background: #ede8dc;
          border-top: 1px solid #d9d1c0;
        }

        .mock-footer-inner {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .mock-footer-text {
          font-size: 9px;
          color: #63665e;
          margin: 4px 0 0;
          font-family: -apple-system, sans-serif;
        }

        .mock-footer-nav {
          display: flex;
          gap: 10px;
          font-size: 9px;
          font-family: -apple-system, sans-serif;
        }

        .mock-footer-disclosure {
          font-size: 8px;
          color: #7b8075;
          margin: 12px 0 0;
          padding-top: 8px;
          border-top: 1px solid #d9d1c0;
          font-family: -apple-system, sans-serif;
        }

        /* Loading / Error States */
        .hp-loading-screen,
        .hp-error-screen {
          padding: 80px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .hp-loading-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(35, 72, 58, 0.2);
          border-top-color: var(--pine, #23483a);
          border-radius: 50%;
          animation: hpSpin 800ms linear infinite;
          margin-bottom: 16px;
        }

        @keyframes hpSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .hp-error-icon {
          color: #8f2f2a;
          margin-bottom: 12px;
        }

        /* Responsive Breakpoints */
        @media (max-width: 960px) {
          .hp-workspace-grid.split-active {
            grid-template-columns: 1fr;
          }
          .hp-two-col-layout {
            grid-template-columns: 1fr;
          }
          .hp-tiles-grid,
          .hp-benefits-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .hp-exec-header {
            flex-direction: column;
            align-items: stretch;
          }
          .hp-exec-header-actions {
            justify-content: stretch;
          }
          .hp-exec-header-actions .hp-top-btn {
            flex: 1;
            justify-content: center;
          }
          .hp-grid-2,
          .hp-grid-3 {
            grid-template-columns: 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hp-notice-toast,
          .hp-tab-btn,
          .hp-top-btn,
          .hp-action-btn,
          .hp-switch-slider,
          .hp-loading-spinner {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
