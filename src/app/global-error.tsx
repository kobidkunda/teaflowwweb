"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center" }}>
          <h2> <StorefrontText id="copy_ab827e3fe17da220" fallback="Something went wrong" /> </h2>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: "8px 16px", marginTop: 16, cursor: "pointer" }}
          > <StorefrontText id="copy_d8b8392e2c542950" fallback="Try again" /> </button>
        </div>
      </body>
    </html>
  );
}
