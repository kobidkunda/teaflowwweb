"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useState, useEffect, useRef } from "react";
import { LocalizedLink as Link, useDisplayMoney } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight, Loader2, Sparkles, Compass } from "lucide-react";

interface ProductPreview {
  id: number;
  name: string;
  slug: string;
  category?: string;
  price?: number;
  elevation?: string;
  harvest_flush?: string;
  primaryImage?: { url: string; alt_text: string } | null;
}

const POPULAR_SEARCHES = [
  "Kadak Chai",
  "Elaichi Chai",
  "Masala Chai",
  "Ginger Chai",
  "Daily Milk Chai",
  "Trial Pack",
];

export interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSearchModal({ isOpen, onClose }: QuickSearchModalProps) {
  const router = useRouter();
  const formatMoney = useDisplayMoney();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<ProductPreview[]>([]);
  const [filteredResults, setFilteredResults] = useState<ProductPreview[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Pre-fetch catalog once when opened for instant, zero-latency search
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    // Fetch catalogue if not already loaded
    if (catalog.length === 0) {
      setLoading(true);
      fetch("/api/products")
        .then((res) => (res.ok ? res.json() : { products: [] }))
        .then((data) => {
          setCatalog(data.products || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
      setQuery("");
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose, catalog.length]);

  // Instant client-side filtering + graceful fallback
  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setFilteredResults([]);
      return;
    }

    const words = trimmed.split(/\s+/);
    const matches = catalog.filter((p) => {
      const searchTarget = `${p.name} ${p.category || ""} ${p.harvest_flush || ""} ${p.elevation || ""}`.toLowerCase();
      return words.every((w) => searchTarget.includes(w));
    });

    setFilteredResults(matches.slice(0, 5));
  }, [query, catalog]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    onClose();
    if (trimmed) {
      router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/shop");
    }
  };

  const handleChipClick = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const displayList = query.trim() ? filteredResults : catalog.slice(0, 4);
  const displayTitle = query.trim()
    ? `Matching Teas (${filteredResults.length})`
    : "Curated Single-Estate Harvests";

  return (
    <div
      className="tf-quick-search-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Search whole-leaf teas"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tf-quick-search-dialog" ref={modalRef}>
        <div className="tf-quick-search-header">
          <form onSubmit={handleSubmit} className="tf-quick-search-form">
            <Search size={20} className="tf-quick-search-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by harvest flush, terroir, tasting note..."
              className="tf-quick-search-input"
              aria-label="Search catalog"
              autoComplete="off"
            />
            {loading && <Loader2 size={18} className="tf-quick-search-spinner animate-spin" />}
            {query && !loading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="tf-quick-search-clear"
                aria-label="Clear query"
              >
                <X size={16} />
              </button>
            )}
          </form>
          <button
            type="button"
            onClick={onClose}
            className="tf-quick-search-close"
            aria-label="Close search (Esc)"
          >
            <X size={18} />
            <span className="tf-quick-search-kbd"> <StorefrontText id="copy_c5b7d0ec4f697629" fallback="ESC" /> </span>
          </button>
        </div>

        <div className="tf-quick-search-body">
          {/* Quick Filter Chips */}
          <div className="tf-quick-search-suggestions">
            <div className="tf-quick-search-subhead">
              <Sparkles size={13} style={{ color: "#b58348" }} />
              <span> <StorefrontText id="copy_f9a2ee1c22e6344e" fallback="Popular Discovery Tags" /> </span>
            </div>
            <div className="tf-quick-search-chips">
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleChipClick(term)}
                  className="tf-quick-search-chip"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Product Results */}
          <div className="tf-quick-search-results">
            <div className="tf-quick-search-subhead">
              <Compass size={13} style={{ color: "#163524" }} />
              <span>{displayTitle}</span>
            </div>

            {query.trim().length > 0 && filteredResults.length === 0 && !loading ? (
              <div className="tf-quick-search-empty">
                <p>No teas match &ldquo;{query}&rdquo;.</p>
                <small>Try searching for &quot;Spring&quot;, &quot;Muscatel&quot;, &quot;Assam&quot;, or &quot;Nilgiri&quot;.</small>
              </div>
            ) : (
              <div className="tf-quick-search-list">
                {displayList.map((product) => (
                  <Link
                    key={product.id}
                    href={`/tea/${product.slug}`}
                    onClick={onClose}
                    className="tf-quick-search-item"
                  >
                    <div className="tf-quick-search-thumb">
                      {product.primaryImage ? (
                        <Image
                          src={product.primaryImage.url}
                          alt={product.primaryImage.alt_text || product.name}
                          width={64}
                          height={64}
                          loading="lazy"
                        />
                      ) : (
                        <div className="tf-quick-search-thumb-placeholder" aria-hidden="true">🍵</div>
                      )}
                    </div>
                    <div className="tf-quick-search-item-info">
                      <h4>{product.name}</h4>
                      <div className="tf-quick-search-item-meta">
                        {product.category && <span>{product.category}</span>}
                        {product.harvest_flush && <span>• {product.harvest_flush}</span>}
                        {product.elevation && <span>• {product.elevation}</span>}
                      </div>
                    </div>
                    {product.price !== undefined && (
                      <div className="tf-quick-search-item-price">
                        {formatMoney(Math.round(Number(product.price) * 100))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="tf-quick-search-footer">
          <button
            type="button"
            onClick={handleSubmit}
            className="tf-quick-search-view-all"
          >
            <span> <StorefrontText id="copy_4bfe925861c763e6" fallback="Explore full collection" /> {query.trim() ? `for "${query.trim()}"` : ""}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
