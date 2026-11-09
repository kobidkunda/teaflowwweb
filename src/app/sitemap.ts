import type { MetadataRoute } from "next";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return getCatalogSitemapEntries();
}
