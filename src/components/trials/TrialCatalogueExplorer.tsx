"use client";

import React, { useMemo, useRef, useState } from "react";
import { ChevronRight, Search, RotateCcw, LoaderCircle } from "lucide-react";
import type { TrialPublicDto } from "@/lib/trials/types";
import { filterTrialCards } from "@/lib/trials/storefront-helpers";
import { TrialCard } from "./TrialCard";
import styles from "./TrialsCollection.module.css";

export interface TrialCatalogueExplorerProps {
  initialTrials: TrialPublicDto[];
  total: number;
  initialSearch?: string;
}

const filters = [
  { id: "all", label: "All trials" },
  { id: "tea-stall", label: "Tea Stall" },
  { id: "flavoured", label: "Flavoured" },
  { id: "cafe", label: "Café" },
];

export function TrialCatalogueExplorer({ initialTrials, total, initialSearch = "" }: TrialCatalogueExplorerProps) {
  const [trials, setTrials] = useState(initialTrials);
  const [catalogueTotal, setCatalogueTotal] = useState(total);
  const [search, setSearch] = useState(initialSearch);
  const [selectedTag, setSelectedTag] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadingRef = useRef(false);
  const offset = useRef(initialTrials.length);
  const visibleTrials = useMemo(() => filterTrialCards(trials, selectedTag, search), [trials, selectedTag, search]);
  const hasMore = offset.current < catalogueTotal;

  async function loadMore() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/trials?limit=24&offset=${offset.current}&sort_by=published_at&sort_dir=desc`);
      if (!response.ok) throw new Error("Catalogue unavailable");
      const result: { trials: TrialPublicDto[]; total: number } = await response.json();
      if (!Array.isArray(result.trials) || !Number.isInteger(result.total)) throw new Error("Invalid catalogue");
      setTrials((previous) => {
        const ids = new Set(previous.map((trial) => trial.id));
        return [...previous, ...result.trials.filter((trial) => !ids.has(trial.id))];
      });
      offset.current += result.trials.length;
      setCatalogueTotal(result.total);
    } catch {
      setError("We couldn’t load the next kits. Please try again.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  function reset() { setSearch(""); setSelectedTag("all"); }

  return (
    <div className={styles.explorer}>
      <aside className={styles.sidebar} aria-label="Browse trial kits">
        <h2>Explore kits</h2>
        <div className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Search trials" placeholder="Search kits"
            value={search} onChange={(event) => setSearch(event.target.value)} aria-controls="trial-results" />
        </div>
        <div className={styles.filters} role="group" aria-label="Filter trial types">
          {filters.map((filter) => (
            <button key={filter.id} type="button" aria-pressed={selectedTag === filter.id}
              onClick={() => setSelectedTag(filter.id)}>
              {filter.label}<ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className={styles.sideNote}>
          <p>A little guide</p>
          <span>Start with the teas inside. Pick the combination you’re curious to try.</span>
          <a href="#how-it-works">How to choose a kit <ChevronRight size={14} aria-hidden="true" /></a>
        </div>
      </aside>
      <div className={styles.collection}>
        <div className={styles.collectionHeading}>
          <p className={styles.eyebrow}>Find your next favourite</p>
          <h2>Explore the trial collection.</h2>
          <p>See every tea inside. Choose the kit for your kettle.</p>
        </div>
        <div className={styles.resultsBar}>
          <p role="status" aria-live="polite" aria-atomic="true">
            Showing <b>{visibleTrials.length}</b> {visibleTrials.length === 1 ? "trial kit" : "trial kits"}
            {hasMore && <span> from {trials.length} loaded</span>}
          </p>
          {(search || selectedTag !== "all") && <button type="button" onClick={reset}><RotateCcw size={13} aria-hidden="true" />Reset filters</button>}
        </div>
        <div id="trial-results" aria-busy={loading}>
          {visibleTrials.length > 0 ? (
            <div className={styles.grid} data-single={visibleTrials.length === 1}>{visibleTrials.map((trial) => <TrialCard key={trial.id} trial={trial} />)}</div>
          ) : (
            <div className={styles.empty} data-testid="empty-trials">
              <Search size={26} aria-hidden="true" />
              <h3>{trials.length ? "No trial kits match your criteria" : "Your next discovery is on its way."}</h3>
              <p>{trials.length ? "Try another tea name or browse all available kits." : "There are no published trial kits right now. Explore the tea shop while we prepare the collection."}</p>
              {trials.length ? <button type="button" className={styles.kitButton} onClick={reset}>View all trials</button> : <a className={styles.kitButton} href="/shop">Explore the tea shop</a>}
            </div>
          )}
        </div>
        {(hasMore || error) && <div className={styles.loadMore}>
          <p>Search and filters apply to loaded kits. Load more to explore the rest of the collection.</p>
          {error && <p role="alert">{error}</p>}
          <button type="button" className={styles.kitButton} disabled={loading} onClick={loadMore}>
            {loading && <LoaderCircle size={16} aria-hidden="true" />}{loading ? "Loading kits…" : error ? "Try again" : "Load more kits"}
          </button>
        </div>}
      </div>
    </div>
  );
}
