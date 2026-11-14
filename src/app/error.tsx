"use client";

import { useEffect } from "react";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";

export default function Error({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // When a deployment occurs, older browser sessions have stale chunk hashes.
    // If a chunk fails with ChunkLoadError or dynamic import failure, reload once to fetch fresh assets.
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      /loading chunk|failed to fetch dynamically imported module/i.test(error?.message || "");

    if (isChunkError && typeof window !== "undefined") {
      const storageKey = `chunk_reload_${error?.message || "err"}`;
      const hasReloaded = sessionStorage.getItem(storageKey);
      if (!hasReloaded) {
        sessionStorage.setItem(storageKey, "1");
        window.location.reload();
      }
    }
  }, [error]);

  const handleRetry = () => {
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      /loading chunk|failed to fetch dynamically imported module/i.test(error?.message || "");

    if (isChunkError && typeof window !== "undefined") {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="ritual-container ritual-empty" role="alert">
      <h2>
        <StorefrontText id="copy_32a444239e8c4cd5" fallback="The collection could not be loaded." />
      </h2>
      <p>
        <StorefrontText id="copy_7ba353b04a5b3c44" fallback="Please try again in a moment." />
      </p>
      <button type="button" className="button button-primary" onClick={handleRetry}>
        <StorefrontText id="copy_d8b8392e2c542950" fallback="Try again" />
      </button>
    </div>
  );
}
