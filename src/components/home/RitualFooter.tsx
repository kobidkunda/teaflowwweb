import React from "react";
import { Footer } from "@/components/Footer";
import type { HomepageContent } from "@/lib/homepageSchema";
import type { SiteNavigation } from "@/lib/contentBlocks";

export function RitualFooter({
  content,
  navigation,
}: {
  content?: HomepageContent | null;
  navigation?: SiteNavigation | null;
}) {
  // Editorial isolation: If content is explicitly null and no navigation provided (e.g. test isolation),
  // suppress invented copy.
  if (!content && !navigation) {
    return (
      <footer className="ritual-footer footer tf-footer tf-site-footer" aria-label="Site footer">
        <div className="tf-footer-wrapper">
          <nav aria-label="Footer navigation" />
        </div>
      </footer>
    );
  }

  return <Footer content={content} navigation={navigation} />;
}
