"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import {
  Plus,
  Sliders,
  ExternalLink,
  RefreshCw,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  Calendar,
  LayoutGrid,
  List,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Clock,
} from "lucide-react";
import type { Slider } from "@/lib/sliders";

type StatusFilter = "all" | "live" | "scheduled" | "hidden" | "expired";
type PageTargetFilter = "all" | "home" | "shop";
type ViewMode = "cards" | "table";

const isUploadedOrExternal = (url?: string | null) =>
  Boolean(url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/uploads/")));

export default function AdminSlidersPage() {
  return (
    <AdminAuthGate>
      <SlidersListContent />
    </AdminAuthGate>
  );
}

function SlidersListContent() {
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & View State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageTargetFilter, setPageTargetFilter] = useState<PageTargetFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Quick Preview Modal state
  const [previewSlider, setPreviewSlider] = useState<Slider | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const loadSliders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/sliders?limit=100", { credentials: "same-origin" });
      if (res.ok) {
        const data = (await res.json()) as { sliders?: Slider[] };
        setSliders(data.sliders || []);
      } else {
        setErrorMessage("Failed to load sliders. Please retry.");
      }
    } catch {
      setErrorMessage("Network error loading sliders.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSliders();
  }, [loadSliders]);

  // Keyboard shortcut: Press '/' to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (previewSlider) setPreviewSlider(null);
        else if (document.activeElement === searchInputRef.current) {
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewSlider]);

  // Determine timing status of slider
  const getSliderTiming = useCallback((slider: Slider) => {
    const now = Date.now();
    const startsAt = slider.starts_at ? new Date(slider.starts_at).getTime() : null;
    const endsAt = slider.ends_at ? new Date(slider.ends_at).getTime() : null;

    if (slider.is_active === 0) return "hidden";
    if (startsAt && startsAt > now) return "scheduled";
    if (endsAt && endsAt < now) return "expired";
    return "live";
  }, []);

  // Inline status toggle
  const handleToggleStatus = async (slider: Slider) => {
    const nextStatus = slider.is_active === 1 ? 0 : 1;
    setTogglingId(slider.id);

    // Optimistic UI
    setSliders((prev) =>
      prev.map((s) => (s.id === slider.id ? { ...s, is_active: nextStatus } : s))
    );

    try {
      const res = await fetch(`/api/admin/sliders/${slider.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });

      if (!res.ok) {
        // Rollback
        setSliders((prev) =>
          prev.map((s) => (s.id === slider.id ? { ...s, is_active: slider.is_active } : s))
        );
        showToast(`Failed to update slider status.`);
      } else {
        showToast(
          `Slider #${slider.id} is now ${nextStatus === 1 ? "Active on Storefront" : "Hidden"}.`
        );
      }
    } catch {
      // Rollback
      setSliders((prev) =>
        prev.map((s) => (s.id === slider.id ? { ...s, is_active: slider.is_active } : s))
      );
      showToast("Network error updating status.");
    } finally {
      setTogglingId(null);
    }
  };

  // Reorder sort order
  const handleMoveOrder = async (slider: Slider, direction: "up" | "down") => {
    const sorted = [...sliders].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const currentIndex = sorted.findIndex((s) => s.id === slider.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const targetSlider = sorted[targetIndex];
    const newOrder = targetSlider.sort_order;
    const oldOrder = slider.sort_order;

    // Swap order values or adjust
    const updatedSliderOrder = direction === "up" ? Math.max(0, newOrder) : newOrder + 1;

    setSliders((prev) =>
      prev.map((s) => (s.id === slider.id ? { ...s, sort_order: updatedSliderOrder } : s))
    );

    try {
      await fetch(`/api/admin/sliders/${slider.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: updatedSliderOrder }),
      });
      showToast(`Updated sequence order for #${slider.id}.`);
    } catch {
      // Rollback
      setSliders((prev) =>
        prev.map((s) => (s.id === slider.id ? { ...s, sort_order: oldOrder } : s))
      );
    }
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const total = sliders.length;
    let live = 0;
    let scheduled = 0;
    let hidden = 0;
    let expired = 0;

    for (const s of sliders) {
      const timing = getSliderTiming(s);
      if (timing === "live") live++;
      else if (timing === "scheduled") scheduled++;
      else if (timing === "hidden") hidden++;
      else if (timing === "expired") expired++;
    }

    return { total, live, scheduled, hidden, expired };
  }, [sliders, getSliderTiming]);

  // Filtering & Search
  const filteredSliders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return sliders.filter((s) => {
      if (q) {
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesSubtitle = s.subtitle.toLowerCase().includes(q);
        const matchesCta = s.cta_label.toLowerCase().includes(q);
        const matchesHref = s.cta_href.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubtitle && !matchesCta && !matchesHref) return false;
      }

      const timing = getSliderTiming(s);
      if (statusFilter === "live" && timing !== "live") return false;
      if (statusFilter === "scheduled" && timing !== "scheduled") return false;
      if (statusFilter === "hidden" && s.is_active === 1) return false;
      if (statusFilter === "expired" && timing !== "expired") return false;

      if (pageTargetFilter === "home" && s.page_target !== "home" && s.page_target !== "all") return false;
      if (pageTargetFilter === "shop" && s.page_target !== "shop" && s.page_target !== "all") return false;

      return true;
    });
  }, [sliders, searchQuery, statusFilter, pageTargetFilter, getSliderTiming]);

  const sortedSliders = useMemo(() => {
    return [...filteredSliders].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }, [filteredSliders]);

  return (
    <div className="admin-sliders-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: "#1d2a24",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <CheckCircle2 size={16} color="#85e89d" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <nav aria-label="Breadcrumb" style={{ marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#697a55",
              }}
            >
              Storefront &amp; Catalog
            </span>
          </nav>
          <h1
            style={{
              margin: "0 0 6px 0",
              fontSize: "clamp(24px, 3vw, 32px)",
              color: "#1d2a24",
              fontFamily: "Georgia, serif",
              letterSpacing: "-0.02em",
            }}
          >
            Homepage Hero Sliders
          </h1>
          <p style={{ margin: 0, color: "#5d6056", fontSize: 14, maxWidth: 640 }}>
            Curate prominent visual hero banners, seasonal flush campaigns, call-to-action buttons, and time-gated schedules.
          </p>
        </div>

        {/* Header Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              fontSize: 13,
              borderColor: "#c7c1b5",
              background: "#ffffff",
            }}
            title="Preview storefront homepage in new tab"
          >
            <ExternalLink size={14} />
            <span>Storefront Preview</span>
          </a>

          <button
            type="button"
            onClick={() => void loadSliders(true)}
            disabled={isRefreshing}
            className="button button-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              fontSize: 13,
              borderColor: "#c7c1b5",
              background: "#ffffff",
            }}
            aria-label="Refresh slider list"
          >
            <RefreshCw size={14} className={isRefreshing ? "spin-animation" : ""} />
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/sliders/new"
            className="button button-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 40,
              fontSize: 13,
              background: "#1d2a24",
              color: "#ffffff",
              boxShadow: "0 2px 6px rgba(29, 42, 36, 0.2)",
            }}
          >
            <Plus size={16} />
            <span>New Hero Slider</span>
          </Link>
        </div>
      </header>

      {/* KPI Metric Summary Cards */}
      <section
        aria-label="Hero Slider Statistics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(35, 72, 58, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#23483a",
            }}
          >
            <Sliders size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Total Sliders
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(46, 125, 50, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2e7d32",
            }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Live on Storefront
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.live} <span style={{ fontSize: 12, fontWeight: 400, color: "#6a6e64" }}>/ {stats.total}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(184, 134, 11, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8a6625",
            }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Scheduled Future
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.scheduled}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "rgba(106, 110, 100, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6a6e64",
            }}
          >
            <Clock size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6a6e64", fontWeight: 600, textTransform: "uppercase" }}>
              Drafts &amp; Expired
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1d2a24", lineHeight: 1.2 }}>
              {stats.hidden + stats.expired}
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Toolbar */}
      <section
        aria-label="Filter and View Controls"
        style={{
          background: "#ffffff",
          border: "1px solid #d9d4c8",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#7e8278",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headline title, subtitle, CTA... (Press '/' to focus)"
              aria-label="Search hero sliders"
              style={{
                width: "100%",
                padding: "9px 36px 9px 36px",
                border: "1px solid #c9c2b6",
                borderRadius: 6,
                fontSize: 13,
                background: "#faf7f2",
                minHeight: 40,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: 0,
                  padding: 4,
                  cursor: "pointer",
                  color: "#6a6e64",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter by slider status"
              style={{
                padding: "6px 10px",
                fontSize: 12,
                border: "1px solid #c9c2b6",
                borderRadius: 4,
                background: "#ffffff",
                minHeight: 38,
              }}
            >
              <option value="all">All Sliders ({sliders.length})</option>
              <option value="live">Live Now ({stats.live})</option>
              <option value="scheduled">Scheduled ({stats.scheduled})</option>
              <option value="hidden">Hidden / Draft ({stats.hidden})</option>
              <option value="expired">Expired ({stats.expired})</option>
            </select>
          </div>

          {/* Page Target Filter */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6a6e64", fontWeight: 500 }}>Target:</span>
            <select
              value={pageTargetFilter}
              onChange={(e) => setPageTargetFilter(e.target.value as PageTargetFilter)}
              aria-label="Filter by target page"
              style={{
                padding: "6px 10px",
                fontSize: 12,
                border: "1px solid #c9c2b6",
                borderRadius: 4,
                background: "#ffffff",
                minHeight: 38,
              }}
            >
              <option value="all">All Pages</option>
              <option value="home">Homepage (/) Only</option>
              <option value="shop">Shop (/shop) Only</option>
            </select>
          </div>

          {/* View Toggle */}
          <div
            role="group"
            aria-label="Slider Layout View"
            style={{
              display: "inline-flex",
              border: "1px solid #c9c2b6",
              borderRadius: 6,
              background: "#ede9df",
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-pressed={viewMode === "cards"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                border: 0,
                borderRadius: 4,
                background: viewMode === "cards" ? "#ffffff" : "transparent",
                color: viewMode === "cards" ? "#1d2a24" : "#6a6e64",
                boxShadow: viewMode === "cards" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer",
              }}
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                border: 0,
                borderRadius: 4,
                background: viewMode === "table" ? "#ffffff" : "transparent",
                color: viewMode === "table" ? "#1d2a24" : "#6a6e64",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                cursor: "pointer",
              }}
            >
              <List size={14} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#6a6e64" }}>
          <p role="status">Loading hero sliders…</p>
        </div>
      ) : errorMessage ? (
        <div
          role="alert"
          style={{
            padding: 24,
            background: "#fdf3f2",
            border: "1px solid #f0b2aa",
            borderRadius: 8,
            color: "#a42a1b",
            textAlign: "center",
          }}
        >
          <AlertCircle size={24} style={{ margin: "0 auto 8px" }} />
          <p style={{ margin: 0, fontWeight: 600 }}>{errorMessage}</p>
          <button
            type="button"
            onClick={() => void loadSliders()}
            className="button button-outline"
            style={{ marginTop: 12 }}
          >
            Retry
          </button>
        </div>
      ) : sortedSliders.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <Sliders size={36} color="#8a6625" style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 18, color: "#1d2a24", margin: "0 0 6px 0", fontFamily: "Georgia, serif" }}>
            No Hero Sliders Found
          </h2>
          <p style={{ color: "#6a6e64", fontSize: 13, maxWidth: 440, margin: "0 auto 20px" }}>
            {searchQuery || statusFilter !== "all"
              ? "No sliders matched your search filter criteria. Try adjusting your query."
              : "No sliders currently created. Add your first hero slider to showcase seasonal harvests."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="button button-outline"
            >
              Clear Filters
            </button>
          ) : (
            <Link href="/admin/sliders/new" className="button button-primary">
              <Plus size={15} /> Create First Slider
            </Link>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* Visual Cards Grid View */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 20,
          }}
        >
          {sortedSliders.map((slider) => {
            const timing = getSliderTiming(slider);
            const isToggling = togglingId === slider.id;

            return (
              <div
                key={slider.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #d9d4c8",
                  borderRadius: 8,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  transition: "box-shadow 200ms ease",
                }}
              >
                {/* Visual Banner Header with live image */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 8",
                    background: "#18241e",
                    overflow: "hidden",
                  }}
                >
                  {slider.image_url && (
                    <Image
                      src={slider.image_url}
                      alt={slider.title}
                      fill
                      sizes="400px"
                      style={{ objectFit: "cover" }}
                      unoptimized={isUploadedOrExternal(slider.image_url)}
                    />
                  )}
                  {/* Overlay gradient */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to top, rgba(13,21,17,0.92) 0%, rgba(13,21,17,0.3) 60%, rgba(13,21,17,0.1) 100%)",
                    }}
                  />

                  {/* Top Badge: Order & Quick Preview */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      right: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        padding: "3px 8px",
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(4px)",
                        color: "#ffffff",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                      }}
                    >
                      #{slider.sort_order}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPreviewSlider(slider)}
                      title="Quick full-screen banner inspection"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        background: "rgba(0,0,0,0.65)",
                        backdropFilter: "blur(4px)",
                        color: "#ffffff",
                        border: 0,
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      <Eye size={12} />
                      <span>Inspect</span>
                    </button>
                  </div>

                  {/* Bottom Text and FG Card in Image */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 12,
                      left: 14,
                      right: 14,
                      zIndex: 2,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.15em",
                          color: "#d9a566",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        HERO BANNER
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontFamily: "Georgia, serif",
                          fontWeight: 700,
                          lineHeight: 1.25,
                          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {slider.title}
                      </div>
                    </div>

                    {/* Floating Foreground Card Preview */}
                    {Boolean(slider.fg_image_url) && (
                      <div
                        style={{
                          position: "relative",
                          width: 80,
                          height: 50,
                          borderRadius: 4,
                          overflow: "hidden",
                          border: "1px solid rgba(255, 255, 255, 0.4)",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                          flexShrink: 0,
                          background: "#23342b",
                        }}
                        title="Foreground Card (FG)"
                      >
                        <Image
                          src={slider.fg_image_url!}
                          alt="FG Card"
                          fill
                          sizes="80px"
                          style={{ objectFit: "cover" }}
                          unoptimized={isUploadedOrExternal(slider.fg_image_url)}
                        />
                        <span
                          style={{
                            position: "absolute",
                            bottom: 2,
                            right: 2,
                            background: "rgba(0,0,0,0.75)",
                            color: "#d9a566",
                            fontSize: 8,
                            fontWeight: 700,
                            padding: "1px 3px",
                            borderRadius: 2,
                          }}
                        >
                          FG Card
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Subtitle */}
                  {slider.subtitle && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "#5d6056",
                        lineHeight: 1.45,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {slider.subtitle}
                    </p>
                  )}

                  {/* Target page pill */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        background: slider.page_target === "shop" ? "#e8effc" : slider.page_target === "all" ? "#f3e8ff" : "#f0fdf4",
                        color: slider.page_target === "shop" ? "#1e40af" : slider.page_target === "all" ? "#6b21a8" : "#166534",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {slider.page_target === "shop" ? "🛍️ Shop Target" : slider.page_target === "all" ? "🌐 All Pages" : "🏠 Homepage"}
                    </span>
                    {slider.category_slug && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          background: "#fef3c7",
                          color: "#92400e",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        🏷️ {slider.category_slug}
                      </span>
                    )}
                  </div>

                  {/* CTA info pill */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "#faf7f2",
                      border: "1px solid #ede8de",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "#6a6e64" }}>CTA Button:</span>
                    <span style={{ fontWeight: 600, color: "#1d2a24" }}>
                      {slider.cta_label || "No Label"} →{" "}
                      <span style={{ color: "#697a55" }}>{slider.cta_href || "/"}</span>
                    </span>
                  </div>

                  {/* Schedule Window if present */}
                  {(slider.starts_at || slider.ends_at) && (
                    <div style={{ fontSize: 11, color: "#7e8278", display: "flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={13} />
                      <span>
                        {slider.starts_at ? new Date(slider.starts_at).toLocaleDateString() : "Immediate"} –{" "}
                        {slider.ends_at ? new Date(slider.ends_at).toLocaleDateString() : "Permanent"}
                      </span>
                    </div>
                  )}

                  {/* Status & Reorder Bar */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 12,
                      borderTop: "1px solid #ede8de",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {/* Status Pill & Inline Toggle */}
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(slider)}
                      disabled={isToggling}
                      title="Click to toggle active status"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        border: 0,
                        cursor: "pointer",
                        background:
                          slider.is_active === 1
                            ? timing === "live"
                              ? "rgba(46, 125, 50, 0.1)"
                              : "rgba(184, 134, 11, 0.12)"
                            : "#ede8de",
                        color:
                          slider.is_active === 1
                            ? timing === "live"
                              ? "#2e7d32"
                              : "#8a6625"
                            : "#7e8278",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background:
                            slider.is_active === 1
                              ? timing === "live"
                                ? "#2e7d32"
                                : "#8a6625"
                              : "#7e8278",
                        }}
                      />
                      <span>
                        {slider.is_active === 1
                          ? timing === "live"
                            ? "Active"
                            : timing === "scheduled"
                            ? "Scheduled"
                            : "Expired"
                          : "Hidden"}
                      </span>
                    </button>

                    {/* Sequence Reorder Buttons */}
                    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#7e8278" }}>Order:</span>
                      <button
                        type="button"
                        onClick={() => void handleMoveOrder(slider, "up")}
                        title="Move slider earlier in rotation"
                        style={{
                          padding: 3,
                          background: "#faf7f2",
                          border: "1px solid #d9d4c8",
                          borderRadius: 4,
                          cursor: "pointer",
                          color: "#2d3129",
                        }}
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMoveOrder(slider, "down")}
                        title="Move slider later in rotation"
                        style={{
                          padding: 3,
                          background: "#faf7f2",
                          border: "1px solid #d9d4c8",
                          borderRadius: 4,
                          cursor: "pointer",
                          color: "#2d3129",
                        }}
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Action Links */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    borderTop: "1px solid #ede8de",
                    background: "#faf7f2",
                  }}
                >
                  <Link
                    href={`/admin/sliders/${slider.id}`}
                    style={{
                      padding: "9px 0",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#23483a",
                      textDecoration: "none",
                      borderRight: "1px solid #ede8de",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <Eye size={13} />
                    <span>Details</span>
                  </Link>

                  <Link
                    href={`/admin/sliders/${slider.id}/edit`}
                    style={{
                      padding: "9px 0",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8a6625",
                      textDecoration: "none",
                      borderRight: "1px solid #ede8de",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <Edit size={13} />
                    <span>Edit</span>
                  </Link>

                  <Link
                    href={`/admin/sliders/${slider.id}/delete`}
                    style={{
                      padding: "9px 0",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#a42a1b",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ overflowX: "auto", background: "#ffffff", borderRadius: 8, border: "1px solid #d9d4c8" }}>
          <table className="admin-table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Order</th>
                <th style={{ width: 100 }}>Preview</th>
                <th>Headline &amp; Subtitle</th>
                <th>Call To Action</th>
                <th>Schedule</th>
                <th>Status</th>
                <th style={{ textAlign: "right", width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSliders.map((slider) => {
                const timing = getSliderTiming(slider);
                return (
                  <tr key={slider.id}>
                    <td style={{ fontWeight: 700, color: "#1d2a24", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>#{slider.sort_order}</span>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <button
                            type="button"
                            onClick={() => void handleMoveOrder(slider, "up")}
                            style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}
                          >
                            <ChevronUp size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveOrder(slider, "down")}
                            style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}
                          >
                            <ChevronDown size={11} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div
                          style={{
                            width: 68,
                            height: 42,
                            position: "relative",
                            borderRadius: 4,
                            overflow: "hidden",
                            background: "#18241e",
                          }}
                          title="Background Photography (BG)"
                        >
                          {slider.image_url && (
                            <Image
                              src={slider.image_url}
                              alt="BG"
                              fill
                              sizes="68px"
                              style={{ objectFit: "cover" }}
                              unoptimized={isUploadedOrExternal(slider.image_url)}
                            />
                          )}
                          <span
                            style={{
                              position: "absolute",
                              bottom: 2,
                              left: 2,
                              fontSize: 8,
                              fontWeight: 700,
                              background: "rgba(0,0,0,0.7)",
                              color: "#fff",
                              padding: "1px 3px",
                              borderRadius: 2,
                            }}
                          >
                            BG
                          </span>
                        </div>
                        {Boolean(slider.fg_image_url) && (
                          <div
                            style={{
                              width: 68,
                              height: 42,
                              position: "relative",
                              borderRadius: 4,
                              overflow: "hidden",
                              background: "#23342b",
                              border: "1px solid #d9d4c8",
                            }}
                            title="Foreground Card Photography (FG)"
                          >
                            <Image
                              src={slider.fg_image_url!}
                              alt="FG"
                              fill
                              sizes="68px"
                              style={{ objectFit: "cover" }}
                              unoptimized={isUploadedOrExternal(slider.fg_image_url)}
                            />
                            <span
                              style={{
                                position: "absolute",
                                bottom: 2,
                                left: 2,
                                fontSize: 8,
                                fontWeight: 700,
                                background: "rgba(138,102,37,0.85)",
                                color: "#fff",
                                padding: "1px 3px",
                                borderRadius: 2,
                              }}
                            >
                              FG
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: "#1d2a24" }}>{slider.title}</span>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "1px 6px",
                            background: slider.page_target === "shop" ? "#e8effc" : slider.page_target === "all" ? "#f3e8ff" : "#f0fdf4",
                            color: slider.page_target === "shop" ? "#1e40af" : slider.page_target === "all" ? "#6b21a8" : "#166534",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          {slider.page_target === "shop" ? "🛍️ Shop" : slider.page_target === "all" ? "🌐 All" : "🏠 Home"}
                          {slider.category_slug ? ` · ${slider.category_slug}` : ""}
                        </span>
                      </div>
                      {slider.subtitle && (
                        <div style={{ fontSize: 12, color: "#6a6e64", maxWidth: 360 }}>{slider.subtitle}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{slider.cta_label || "None"}</div>
                      <div style={{ fontSize: 11, color: "#697a55" }}>{slider.cta_href || "/"}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 11, color: "#5d6056" }}>
                        {slider.starts_at || slider.ends_at ? (
                          <>
                            {slider.starts_at ? new Date(slider.starts_at).toLocaleDateString() : "Immediate"}
                            {" → "}
                            {slider.ends_at ? new Date(slider.ends_at).toLocaleDateString() : "Permanent"}
                          </>
                        ) : (
                          "Always Active"
                        )}
                      </div>
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(slider)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          border: 0,
                          cursor: "pointer",
                          background:
                            slider.is_active === 1
                              ? timing === "live"
                                ? "rgba(46, 125, 50, 0.1)"
                                : "rgba(184, 134, 11, 0.12)"
                              : "#ede8de",
                          color:
                            slider.is_active === 1
                              ? timing === "live"
                                ? "#2e7d32"
                                : "#8a6625"
                              : "#7e8278",
                        }}
                      >
                        {slider.is_active === 1
                          ? timing === "live"
                            ? "Active"
                            : timing === "scheduled"
                            ? "Scheduled"
                            : "Expired"
                          : "Hidden"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <Link
                          href={`/admin/sliders/${slider.id}`}
                          title="View Details"
                          style={{ padding: 4, color: "#23483a" }}
                        >
                          <Eye size={15} />
                        </Link>
                        <Link
                          href={`/admin/sliders/${slider.id}/edit`}
                          title="Edit Slider"
                          style={{ padding: 4, color: "#8a6625" }}
                        >
                          <Edit size={15} />
                        </Link>
                        <Link
                          href={`/admin/sliders/${slider.id}/delete`}
                          title="Delete Slider"
                          style={{ padding: 4, color: "#a42a1b" }}
                        >
                          <Trash2 size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Preview Modal */}
      {previewSlider && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setPreviewSlider(null)}
        >
          <div
            style={{
              background: "#18241e",
              borderRadius: 12,
              maxWidth: 900,
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.15)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                color: "#ffffff",
              }}
            >
              <div id="preview-modal-title" style={{ fontSize: 14, fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                <Sparkles size={16} color="#d9a566" />
                <span>Storefront Hero Simulation — #{previewSlider.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSlider(null)}
                aria-label="Close preview"
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#ffffff",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Simulated Banner */}
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "2.4 / 1",
                minHeight: 340,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "36px 48px",
              }}
            >
              {previewSlider.image_url && (
                <Image
                  src={previewSlider.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  style={{ objectFit: "cover" }}
                  unoptimized={isUploadedOrExternal(previewSlider.image_url)}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(13,21,17,0.95) 0%, rgba(13,21,17,0.5) 50%, rgba(13,21,17,0.2) 100%)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  display: "grid",
                  gridTemplateColumns: previewSlider.fg_image_url ? "1.3fr 0.7fr" : "1fr",
                  gap: 24,
                  alignItems: "end",
                  width: "100%",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      color: "#d9a566",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    THE TEAFLOWW COLLECTION
                  </div>
                  <h2
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 26,
                      fontWeight: 700,
                      color: "#ffffff",
                      margin: "0 0 10px 0",
                      lineHeight: 1.25,
                    }}
                  >
                    {previewSlider.title}
                  </h2>
                  {previewSlider.subtitle && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.85)",
                        lineHeight: 1.5,
                        margin: "0 0 16px 0",
                      }}
                    >
                      {previewSlider.subtitle}
                    </p>
                  )}
                  {previewSlider.cta_label && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 18px",
                        background: "#ffffff",
                        color: "#1d2a24",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      <span>{previewSlider.cta_label}</span>
                      <span aria-hidden="true">→</span>
                    </span>
                  )}
                </div>

                {/* Right Column: Floating Foreground Card Preview */}
                {Boolean(previewSlider.fg_image_url || previewSlider.card_title || previewSlider.card_tag) && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div
                      style={{
                        position: "relative",
                        width: 260,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid rgba(212, 175, 55, 0.35)",
                        boxShadow: "0 10px 24px rgba(0,0,0,0.55)",
                        background: "rgba(14, 28, 20, 0.82)",
                        backdropFilter: "blur(16px)",
                        padding: "10px 12px",
                        display: "grid",
                        gridTemplateColumns: "70px 1fr",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      {/* Left: Tin Visual & Badge */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div
                          style={{
                            fontSize: 7,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 4px",
                            background: "rgba(217, 165, 102, 0.25)",
                            color: "#d9a566",
                            border: "1px solid rgba(217, 165, 102, 0.4)",
                            borderRadius: 4,
                            marginBottom: 4,
                            textAlign: "center",
                            width: "100%",
                          }}
                        >
                          {previewSlider.card_badge || "ESTATE HARVEST"}
                        </div>
                        <div
                          style={{
                            position: "relative",
                            width: 65,
                            height: 80,
                            borderRadius: 6,
                            overflow: "hidden",
                            background: "#192821",
                          }}
                        >
                          {previewSlider.fg_image_url ? (
                            <Image
                              src={previewSlider.fg_image_url}
                              alt="Foreground card"
                              fill
                              sizes="65px"
                              style={{ objectFit: "cover" }}
                              unoptimized={isUploadedOrExternal(previewSlider.fg_image_url)}
                            />
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                fontSize: 9,
                                color: "rgba(255,255,255,0.7)",
                              }}
                            >
                              🍵 Tin Photo
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Card Details Stack */}
                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
                        <div>
                          <div
                            style={{
                              fontSize: 7.5,
                              color: "#d9a566",
                              fontWeight: 600,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              marginBottom: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {previewSlider.card_tag || "2026 First Flush · Margaret's Hope"}
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "#ffffff",
                              lineHeight: 1.2,
                              marginBottom: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {previewSlider.card_title || previewSlider.title.split("—")[0].trim() || "Darjeeling First Flush"}
                          </div>
                          <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>
                            {previewSlider.card_subtitle || "Single Estate · 6,800 ft"}
                          </div>
                          {(previewSlider.card_quote || previewSlider.cta_label) && (
                            <div
                              style={{
                                fontSize: 7.5,
                                fontStyle: "italic",
                                color: "rgba(255,255,255,0.88)",
                                lineHeight: 1.2,
                                marginBottom: 3,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              &ldquo;{previewSlider.card_quote || previewSlider.cta_label}&rdquo;
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 7,
                              color: "#b9dec6",
                              background: "rgba(35, 72, 58, 0.7)",
                              padding: "2px 5px",
                              borderRadius: 4,
                              display: "inline-block",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginBottom: 3,
                            }}
                          >
                            {previewSlider.card_tasting_notes || "Muscatel • Wild Orchid"}
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 7.5,
                              fontWeight: 700,
                              color: "#1d2a24",
                              background: "#d9a566",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            <span>{previewSlider.card_cta_label || "View Harvest"}</span>
                            <span>→</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 20px",
                background: "rgba(0,0,0,0.3)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Target link: {previewSlider.cta_href || "/"} · Order sequence: #{previewSlider.sort_order}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  href={`/admin/sliders/${previewSlider.id}/edit`}
                  className="button button-outline"
                  style={{
                    fontSize: 12,
                    color: "#ffffff",
                    borderColor: "rgba(255,255,255,0.3)",
                    background: "transparent",
                  }}
                >
                  Edit Slider
                </Link>
                <button
                  type="button"
                  onClick={() => setPreviewSlider(null)}
                  className="button button-primary"
                  style={{ fontSize: 12, background: "#ffffff", color: "#1d2a24" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
