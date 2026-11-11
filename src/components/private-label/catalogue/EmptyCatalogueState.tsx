import { Text as StorefrontText } from "@/components/international/InternationalProvider";
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
      <h3 className={styles.emptyStateTitle}><StorefrontText id="copy_5575fa136da356c7" fallback="No packaging found" /></h3>
      <p className={styles.emptyStateText}><StorefrontText id="copy_ccb8c693a4c54ac2" fallback="No packaging structures match your active filter criteria. Try clearing selected filters or broadening your search terms." />
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
      ><StorefrontText id="copy_209d178dae312190" fallback="Clear All Filters" />
      </button>
    </div>
  );
}
