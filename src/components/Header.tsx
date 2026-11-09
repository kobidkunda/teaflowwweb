"use client";

import React from "react";
import { StorefrontHeader, DEFAULT_BRAND, DEFAULT_TAGLINE, DEFAULT_NAV } from "@/components/StorefrontHeader";
import type { AnnouncementData } from "@/components/StorefrontHeader";
import type { HomepageContent } from "@/lib/homepageSchema";
import type { SiteNavigation } from "@/lib/contentBlocks";

export { DEFAULT_BRAND, DEFAULT_TAGLINE, DEFAULT_NAV };

export function Header({
  content,
  announcement,
  navigation,
}: {
  content?: HomepageContent | null;
  announcement?: AnnouncementData | null;
  navigation?: SiteNavigation | null;
}) {
  return (
    <StorefrontHeader
      content={content}
      announcement={announcement}
      navigation={navigation}
      showAnnouncement={true}
    />
  );
}
