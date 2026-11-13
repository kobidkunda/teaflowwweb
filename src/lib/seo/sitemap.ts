import { enabledProductCondition } from "@/lib/productAvailability";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "./site";
import type { MetadataRoute } from "next";

export interface SitemapEntry {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

/**
 * Gathers all indexable, canonical public URLs across products, categories,
 * educational articles, comparisons, and core trust pages with real lastmod timestamps.
 */
export function getCatalogSitemapEntries(): MetadataRoute.Sitemap {
  const db = getDb();
  const siteUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  const now = new Date();
  const staticLastMod = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Core Primary Storefront Hubs
  entries.push(
    {
      url: `${siteUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/sitemap`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/wholesale`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/brochure`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: staticLastMod,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/leaf-to-cup`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/ways-to-make-ctc-tea`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/compare`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/locations/siliguri`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/shipping`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/returns`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: staticLastMod,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: staticLastMod,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/feeds`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/brand`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/gifts`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/tea-finder`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/private-label`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/private-label/packaging`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blend-lab`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blend-lab/start`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/trials`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/payment-methods`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.5,
    }
  );

  // 2. Active Products
  try {
    const hasSeo = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get()
    );
    if (hasSeo) {
      const productCols = new Set(
        (db.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map((c) => c.name)
      );
      const noindexClause = `WHERE ${enabledProductCondition()}${productCols.has("noindex") ? " AND noindex = 0" : ""}`;
      const products = db
        .prepare(`SELECT slug, harvest_date, id FROM products ${noindexClause} ORDER BY id ASC`)
        .all() as Array<{ slug: string; harvest_date?: string; id: number }>;

      for (const p of products) {
        let pDate = staticLastMod;
        if (p.harvest_date) {
          const parsed = new Date(p.harvest_date);
          if (!isNaN(parsed.getTime())) {
            pDate = parsed;
          }
        }
        entries.push({
          url: `${siteUrl}/tea/${p.slug}`,
          lastModified: pDate,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  // 3. Active Categories / Collections
  try {
    const hasCat = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'").get()
    );
    if (hasCat) {
      const catCols = new Set(
        (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map((c) => c.name)
      );
      const whereConditions = ["is_active = 1"];
      if (catCols.has("noindex")) {
        whereConditions.push("noindex = 0");
      }
      // Only include active categories that have products associated with them to prevent thin duplicate pages
      whereConditions.push("(SELECT COUNT(*) FROM products WHERE (category_id = categories.id OR category = categories.name)) > 0");
      const categories = db
        .prepare(`SELECT slug, created_at FROM categories WHERE ${whereConditions.join(" AND ")} ORDER BY sort_order ASC`)
        .all() as Array<{ slug: string; created_at?: string }>;

      for (const c of categories) {
        let cDate = staticLastMod;
        if (c.created_at) {
          const parsed = new Date(c.created_at);
          if (!isNaN(parsed.getTime())) {
            cDate = parsed;
          }
        }
        entries.push({
          url: `${siteUrl}/collections/${c.slug}`,
          lastModified: cDate,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  // 4. Published Educational Blog Guides
  try {
    const hasBlogs = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blog_posts'").get()
    );
    if (hasBlogs) {
      const blogCols = new Set(
        (db.prepare("PRAGMA table_info(blog_posts)").all() as { name: string }[]).map((c) => c.name)
      );
      const whereConditions = ["status = 'published'"];
      if (blogCols.has("noindex")) {
        whereConditions.push("noindex = 0");
      }
      const blogs = db
        .prepare(`SELECT slug, published_at, updated_at FROM blog_posts WHERE ${whereConditions.join(" AND ")} ORDER BY published_at DESC`)
        .all() as Array<{ slug: string; published_at?: string; updated_at?: string }>;

      for (const b of blogs) {
        let bDate = staticLastMod;
        const rawDate = b.updated_at || b.published_at;
        if (rawDate) {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            bDate = parsed;
          }
        }
        entries.push({
          url: `${siteUrl}/blog/${b.slug}`,
          lastModified: bDate,
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  // 5. Comparison Pages
  const comparisons = [
    "assam-vs-darjeeling-tea",
    "orthodox-vs-green-tea",
    "first-flush-vs-second-flush",
  ];
  for (const cmp of comparisons) {
    entries.push({
      url: `${siteUrl}/compare/${cmp}`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // 6. Published Private Label Packaging Formats
  try {
    const hasPack = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pl_packaging_variants'").get()
    );
    if (hasPack) {
      const packVariants = db
        .prepare("SELECT slug, updated_at, created_at FROM pl_packaging_variants WHERE status = 'published' ORDER BY created_at DESC")
        .all() as Array<{ slug: string; updated_at?: string; created_at?: string }>;

      for (const v of packVariants) {
        let vDate = staticLastMod;
        const rawDate = v.updated_at || v.created_at;
        if (rawDate) {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            vDate = parsed;
          }
        }
        entries.push({
          url: `${siteUrl}/private-label/packaging/${v.slug}`,
          lastModified: vDate,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  // 7. Published Discovery Kit Trials
  try {
    const hasTrials = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trials'").get()
    );
    if (hasTrials) {
      const trialCols = new Set(
        (db.prepare("PRAGMA table_info(trials)").all() as { name: string }[]).map((c) => c.name)
      );
      const whereConditions = ["status = 'published'"];
      if (trialCols.has("noindex")) {
        whereConditions.push("noindex = 0");
      }
      const trials = db
        .prepare(`SELECT slug, updated_at, created_at FROM trials WHERE ${whereConditions.join(" AND ")} ORDER BY published_at DESC`)
        .all() as Array<{ slug: string; updated_at?: string; created_at?: string }>;

      for (const t of trials) {
        let tDate = staticLastMod;
        const rawDate = t.updated_at || t.created_at;
        if (rawDate) {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            tDate = parsed;
          }
        }
        entries.push({
          url: `${siteUrl}/trials/${t.slug}`,
          lastModified: tDate,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  // 8. Published Custom CMS Pages
  try {
    const hasPages = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_pages'").get()
    );
    if (hasPages) {
      const coreKnownSlugs = [
        "about",
        "contact",
        "shipping",
        "returns",
        "privacy",
        "terms",
        "brand",
        "wholesale",
        "leaf-to-cup",
        "gifts",
        "locations-siliguri",
        "tea-finder",
        "ways-to-make-ctc-tea",
      ];
      const placeholders = coreKnownSlugs.map(() => "?").join(",");
      const customPages = db
        .prepare(
          `SELECT slug, updated_at, created_at FROM site_pages WHERE is_published = 1 AND slug NOT IN (${placeholders})`
        )
        .all(...coreKnownSlugs) as Array<{ slug: string; updated_at?: string; created_at?: string }>;

      for (const p of customPages) {
        let pDate = staticLastMod;
        const rawDate = p.updated_at || p.created_at;
        if (rawDate) {
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            pDate = parsed;
          }
        }
        entries.push({
          url: `${siteUrl}/pages/${p.slug}`,
          lastModified: pDate,
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  return entries;
}
