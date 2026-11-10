import React from "react";
import styles from "../styles/PrivateLabel.module.css";

export function EmptyCatalogueState({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <div
      data-testid="empty-state"
      className={`${styles.emptyStateContainer} empty-catalogue`}
      role="status"
    >
      <div style={{ fontSize: "2.5rem", marginBottom: "12px" }} aria-hidden="true">
        &#128269;
      </div>
      <h3 className={styles.emptyStateTitle}>No packaging found</h3>
      <p className={styles.emptyStateText}>
        No packaging structures match your active filter criteria. Try clearing selected filters or broadening your search terms.
      </p>
      <button
        type="button"
        onClick={onReset}
        className={styles.cardActionLink}
        style={{
          border: "none",
          cursor: "pointer",
          padding: "10px 24px",
          minHeight: "44px",
        }}
      >
        Clear All Filters
      </button>
    </div>
  );
}
