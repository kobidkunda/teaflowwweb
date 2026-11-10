import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/admin",
        "/checkout/",
        "/checkout",
        "/cart/",
        "/cart",
        "/order/",
        "/order",
        "/account/",
        "/account",
        "/login",
        "/purchase/",
        "/purchase",
        "/api/",
        "/track",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
