import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";

export interface SitemapLinkItem {
  title: string;
  url: string;
  description?: string;
  badge?: string;
  lastModified?: string;
}

export interface SitemapSection {
  id: string;
  title: string;
  description: string;
  items: SitemapLinkItem[];
  count: number;
}

export interface PublicSitemapData {
  totalCount: number;
  sections: SitemapSection[];
  generatedAt: string;
}

/**
 * Verified list of core storefront journeys and hub pages.
 * ONLY public storefront pages are permitted here.
 */
const CORE_STOREFRONT_HUBS: SitemapLinkItem[] = [
  {
    title: "Home",
    url: "/",
    description: "Direct-from-origin single-estate orthodox teas harvested in Darjeeling, Assam, Kangra, and Nilgiri.",
    badge: "Home",
  },
  {
    title: "Shop All Teas",
    url: "/shop",
    description: "Explore all single-estate orthodox teas, reserve lots, and fresh harvest arrivals.",
    badge: "Catalog",
  },
  {
    title: "Wholesale & B2B Orders",
    url: "/wholesale",
    description: "Direct estate procurement for specialty tea rooms, boutique cafes, roasters, and hospitality.",
    badge: "Wholesale",
  },
  {
    title: "Discovery Tasting Trials",
    url: "/trials",
    description: "Curated multi-tea flight tasting kits with tea maker tasting notes and cupping cards.",
    badge: "Tasting Kits",
  },
  {
    title: "Blend Lab Atelier",
    url: "/blend-lab",
    description: "Bespoke tea formulation atelier and custom single-estate blending service.",
    badge: "Custom Blends",
  },
  {
    title: "Blend Lab Interactive Builder",
    url: "/blend-lab/start",
    description: "Interactive recipe customizer to create and test tailored orthodox tea batches.",
    badge: "Builder",
  },
  {
    title: "Private Label Tea Studio",
    url: "/private-label",
    description: "End-to-end bespoke tea branding, manufacturing, formulation, and contract packing.",
    badge: "Private Label",
  },
  {
    title: "Packaging Formats & Materials",
    url: "/private-label/packaging",
    description: "Food-safe luxury canisters, barrier pouches, and biodegradable pyramid tea bags.",
    badge: "Packaging",
  },
  {
    title: "Tea Finder Flavour Quiz",
    url: "/tea-finder",
    description: "Interactive flavor palette matcher to discover your ideal harvest flush and regional terroir.",
    badge: "Interactive",
  },
  {
    title: "Compare Cupping Profiles",
    url: "/compare",
    description: "Side-by-side estate comparison and organoleptic tasting metrics.",
    badge: "Analysis",
  },
  {
    title: "Download Product Brochure",
    url: "/brochure",
    description: "Complete single-estate portfolio and harvest dossier in downloadable PDF format.",
    badge: "Brochure",
  },
  {
    title: "Product Feeds & Syndication",
    url: "/feeds",
    description: "Live Google Merchant Center XML, Meta catalog CSV, and OpenAI syndication endpoints.",
    badge: "Feeds",
  },
];

/**
 * Editorial craft, heritage, location and brewing guides.
 */
const CRAFT_AND_EDUCATION_HUBS: SitemapLinkItem[] = [
  {
    title: "Tea Journal & Articles",
    url: "/blog",
    description: "Single-estate stories, harvest reports, tasting notes, and seasonal dispatch chronicles.",
    badge: "Journal",
  },
  {
    title: "Tea Education & Brewing Guide",
    url: "/learn",
    description: "Water temperature, steep timing, and vessel science for orthodox teas.",
    badge: "Brewing Guide",
  },
  {
    title: "Leaf-to-Cup Craft Story",
    url: "/leaf-to-cup",
    description: "From plucking to firing: step-by-step artisanal orthodox tea processing journey.",
    badge: "Craft Story",
  },
  {
    title: "Ways to Make CTC Tea",
    url: "/ways-to-make-ctc-tea",
    description: "Traditional kadak chai brewing methods and regional milk tea techniques.",
    badge: "Recipe Guide",
  },
  {
    title: "Siliguri Origin & Tasting Room",
    url: "/locations/siliguri",
    description: "Foot-of-the-Himalayas processing, vacuum-sealing hub, and tasting salon.",
    badge: "Tasting Room",
  },
  {
    title: "Our Heritage & Estates",
    url: "/about",
    description: "Our founding philosophy: unblended purity, garden provenance, and zero artificial flavorings.",
    badge: "Heritage",
  },
  {
    title: "Brand Identity & Media Kit",
    url: "/brand",
    description: "Master vector logos, typography specifications, and color palette.",
    badge: "Brand Kit",
  },
  {
    title: "Assam vs. Darjeeling Tea: Tasting & Terroir",
    url: "/compare/assam-vs-darjeeling-tea",
    description: "Malty brisk body vs. muscatel floral delicacy organoleptic comparison.",
    badge: "Comparison",
  },
  {
    title: "Orthodox vs. Green Tea: Processing & Leaf",
    url: "/compare/orthodox-vs-green-tea",
    description: "Fully oxidized whole leaf vs. steamed/pan-fired unoxidized leaf.",
    badge: "Comparison",
  },
  {
    title: "First Flush vs. Second Flush: Harvest Seasons",
    url: "/compare/first-flush-vs-second-flush",
    description: "Spring crisp freshness vs. summer muscatel depth and body.",
    badge: "Comparison",
  },
];

/**
 * Customer care, trust, and legal policies.
 */
const CUSTOMER_CARE_AND_POLICIES: SitemapLinkItem[] = [
  {
    title: "Contact Us",
    url: "/contact",
    description: "Direct estate inquiries, tasting room appointments, and customer support.",
    badge: "Support",
  },
  {
    title: "Track Your Consignment",
    url: "/track",
    description: "Real-time dispatch and shipment status tracking across India.",
    badge: "Tracking",
  },
  {
    title: "Payment Methods & Discounts",
    url: "/payment-methods",
    description: "Instant prepaid UPI discounts, debit/credit cards, and Cash on Delivery terms.",
    badge: "Payments",
  },
  {
    title: "Shipping & Dispatch Policy",
    url: "/shipping",
    description: "24–48h Siliguri dispatch, safe vacuum packing, and transit timelines.",
    badge: "Shipping",
  },
  {
    title: "14-Day Returns & Freshness Guarantee",
    url: "/returns",
    description: "Our whole-leaf freshness resolution and transit satisfaction guarantee.",
    badge: "Guarantee",
  },
  {
    title: "Privacy Policy",
    url: "/privacy",
    description: "Zero telemetry resale, strict GDPR & Indian DPDP compliance.",
    badge: "Privacy",
  },
  {
    title: "Terms of Service",
    url: "/terms",
    description: "Store terms of supply, digital commerce contracts, and governing law.",
    badge: "Terms",
  },
];

/**
 * Machine-readable indexes and feeds for search engine crawlers and AI systems.
 */
const MACHINE_AND_AI_INDEXES: SitemapLinkItem[] = [
  {
    title: "Google XML Sitemap Protocol",
    url: "/sitemap.xml",
    description: "Standard machine-readable XML sitemap for web search indexers.",
    badge: "XML",
  },
  {
    title: "AI Knowledge Index (llms.txt)",
    url: "/llms.txt",
    description: "Curated plain-text knowledge graph for LLMs and autonomous agents.",
    badge: "AI Index",
  },
  {
    title: "Extended AI Knowledge (llms-full.txt)",
    url: "/llms-full.txt",
    description: "Comprehensive garden, cupping, and brewing dataset for AI systems.",
    badge: "AI Dataset",
  },
  {
    title: "Agent Resource Definition (ai-catalog.json)",
    url: "/ai-catalog.json",
    description: "Structured JSON-LD catalog for intelligent shopping agents.",
    badge: "JSON-LD",
  },
];

/**
 * Collects all public pages into structured, categorized sections for the HTML sitemap.
 * STRICT ENFORCEMENT: Never includes admin, private, internal, or session routes.
 */
export function getPublicSitemapData(): PublicSitemapData {
  const db = getDb();
  const sections: SitemapSection[] = [];

  // 1. Storefront & Primary Navigation
  sections.push({
    id: "storefront",
    title: "Storefront & Primary Navigation",
    description: "Main shopping, bespoke blending, wholesale procurement, and catalog hubs.",
    items: CORE_STOREFRONT_HUBS,
    count: CORE_STOREFRONT_HUBS.length,
  });

  // 2. Single-Estate Teas (Products)
  const productItems: SitemapLinkItem[] = [];
  try {
    const hasProducts = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get()
    );
    if (hasProducts) {
      const productCols = new Set(
        (db.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map((c) => c.name)
      );

      const whereClauses: string[] = [enabledProductCondition()];
      if (productCols.has("noindex")) {
        whereClauses.push("noindex = 0");
      }
      if (productCols.has("status")) {
        whereClauses.push("(status = 'published' OR status = 'active' OR status IS NULL)");
      }

      const orderBy = productCols.has("sort_order") ? "sort_order ASC, id ASC" : "id ASC";
      const selectCols = [
        "slug",
        productCols.has("name") ? "name" : "slug as name",
        productCols.has("category") ? "category" : "NULL as category",
        productCols.has("estate") ? "estate" : "NULL as estate",
        productCols.has("elevation_display") ? "elevation_display" : "NULL as elevation_display",
        productCols.has("tasting_notes") ? "tasting_notes" : "NULL as tasting_notes",
        productCols.has("flush") ? "flush" : "NULL as flush",
        productCols.has("harvest_date") ? "harvest_date" : "NULL as harvest_date",
      ].join(", ");

      const rows = db
        .prepare(`SELECT ${selectCols} FROM products WHERE ${whereClauses.join(" AND ")} ORDER BY ${orderBy}`)
        .all() as Array<{
          slug: string;
          name: string;
          category?: string | null;
          estate?: string | null;
          elevation_display?: string | null;
          tasting_notes?: string | null;
          flush?: string | null;
          harvest_date?: string | null;
        }>;

      for (const row of rows) {
        if (!row.slug) continue;
        const details = [row.estate, row.elevation_display, row.tasting_notes].filter(Boolean).join(" · ");
        productItems.push({
          title: row.name || row.slug,
          url: `/tea/${row.slug}`,
          description: details || "Single-estate high-mountain orthodox tea.",
          badge: row.flush || row.category || "Single-Estate",
          lastModified: row.harvest_date || undefined,
        });
      }
    }
  } catch {
    // Graceful fallback if database table not available
  }

  if (productItems.length > 0) {
    sections.push({
      id: "teas",
      title: "Single-Estate Teas & Reserve Lots",
      description: "Direct-from-origin orthodox teas graded and sealed at origin.",
      items: productItems,
      count: productItems.length,
    });
  }

  // 3. Collections & Regional Terroirs (Categories)
  const collectionItems: SitemapLinkItem[] = [];
  try {
    const hasCategories = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'").get()
    );
    if (hasCategories) {
      const catCols = new Set(
        (db.prepare("PRAGMA table_info(categories)").all() as { name: string }[]).map((c) => c.name)
      );

      const whereClauses: string[] = [];
      if (catCols.has("is_active")) whereClauses.push("is_active = 1");
      if (catCols.has("noindex")) whereClauses.push("noindex = 0");
      whereClauses.push(
        "(SELECT COUNT(*) FROM products WHERE (category_id = categories.id OR category = categories.name)) > 0"
      );

      const orderBy = catCols.has("sort_order") ? "sort_order ASC, name ASC" : "name ASC";
      const selectCols = [
        "slug",
        catCols.has("name") ? "name" : "slug as name",
        catCols.has("description") ? "description" : "NULL as description",
      ].join(", ");

      const rows = db
        .prepare(`SELECT ${selectCols} FROM categories WHERE ${whereClauses.join(" AND ")} ORDER BY ${orderBy}`)
        .all() as Array<{ slug: string; name: string; description?: string | null }>;

      for (const row of rows) {
        if (!row.slug) continue;
        collectionItems.push({
          title: row.name || row.slug,
          url: `/collections/${row.slug}`,
          description: row.description || "Curated harvest collection and regional terroir selection.",
          badge: "Collection",
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  if (collectionItems.length > 0) {
    sections.push({
      id: "collections",
      title: "Collections & Regional Terroirs",
      description: "Harvest flushes and regional terroirs from Darjeeling, Assam, and the Nilgiris.",
      items: collectionItems,
      count: collectionItems.length,
    });
  }

  // 4. Tea Craft, Heritage & Education
  const craftItems: SitemapLinkItem[] = [...CRAFT_AND_EDUCATION_HUBS];
  try {
    const hasBlogs = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blog_posts'").get()
    );
    if (hasBlogs) {
      const blogCols = new Set(
        (db.prepare("PRAGMA table_info(blog_posts)").all() as { name: string }[]).map((c) => c.name)
      );

      const whereClauses = ["status = 'published'"];
      if (blogCols.has("noindex")) whereClauses.push("noindex = 0");

      const orderBy = blogCols.has("published_at") ? "published_at DESC" : "id DESC";
      const selectCols = [
        "slug",
        blogCols.has("title") ? "title" : "slug as title",
        blogCols.has("excerpt") ? "excerpt" : blogCols.has("summary") ? "summary as excerpt" : "NULL as excerpt",
        blogCols.has("published_at") ? "published_at" : "NULL as published_at",
      ].join(", ");

      const rows = db
        .prepare(`SELECT ${selectCols} FROM blog_posts WHERE ${whereClauses.join(" AND ")} ORDER BY ${orderBy}`)
        .all() as Array<{ slug: string; title: string; excerpt?: string | null; published_at?: string | null }>;

      for (const row of rows) {
        if (!row.slug) continue;
        craftItems.push({
          title: row.title || row.slug,
          url: `/blog/${row.slug}`,
          description: row.excerpt || "Editorial article and tasting notes.",
          badge: "Article",
          lastModified: row.published_at || undefined,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  sections.push({
    id: "craft-education",
    title: "Tea Craft, Heritage & Education",
    description: "Origin stories, brewing science, and artisanal processing knowledge.",
    items: craftItems,
    count: craftItems.length,
  });

  // 5. Discovery Kits & Packaging Formats
  const discoveryItems: SitemapLinkItem[] = [];
  try {
    // Trials
    const hasTrials = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trials'").get()
    );
    if (hasTrials) {
      const trialCols = new Set(
        (db.prepare("PRAGMA table_info(trials)").all() as { name: string }[]).map((c) => c.name)
      );
      const whereClauses = ["status = 'published'"];
      if (trialCols.has("noindex")) whereClauses.push("noindex = 0");

      const rows = db
        .prepare(
          `SELECT slug, title, tagline, description, published_at FROM trials WHERE ${whereClauses.join(
            " AND "
          )} ORDER BY published_at DESC`
        )
        .all() as Array<{
          slug: string;
          title: string;
          tagline?: string | null;
          description?: string | null;
          published_at?: string | null;
        }>;

      for (const t of rows) {
        if (!t.slug) continue;
        discoveryItems.push({
          title: t.title || t.slug,
          url: `/trials/${t.slug}`,
          description: t.tagline || t.description || "Curated flight tasting kit.",
          badge: "Trial Kit",
          lastModified: t.published_at || undefined,
        });
      }
    }

    // Packaging Variants
    const hasPackaging = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pl_packaging_variants'").get()
    );
    if (hasPackaging) {
      const rows = db
        .prepare(
          "SELECT slug, title, material, closure_type, capacity_description FROM pl_packaging_variants WHERE status = 'published' ORDER BY created_at DESC"
        )
        .all() as Array<{
          slug: string;
          title: string;
          material?: string | null;
          closure_type?: string | null;
          capacity_description?: string | null;
        }>;

      for (const v of rows) {
        if (!v.slug) continue;
        const specs = [v.material, v.closure_type, v.capacity_description].filter(Boolean).join(" · ");
        discoveryItems.push({
          title: v.title || v.slug,
          url: `/private-label/packaging/${v.slug}`,
          description: specs || "Production-ready tea packaging format.",
          badge: "Packaging",
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  if (discoveryItems.length > 0) {
    sections.push({
      id: "discovery-kits",
      title: "Discovery Kits & Packaging Options",
      description: "Flight tasting trial sets and private label packaging formats.",
      items: discoveryItems,
      count: discoveryItems.length,
    });
  }

  // 6. Customer Care, Trust & Policies
  sections.push({
    id: "customer-care",
    title: "Customer Care, Trust & Policies",
    description: "Contact information, dispatch policies, returns assurance, and privacy terms.",
    items: CUSTOMER_CARE_AND_POLICIES,
    count: CUSTOMER_CARE_AND_POLICIES.length,
  });

  // 7. Published Custom CMS Pages
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
          `SELECT slug, title, headline, subtitle, eyebrow, updated_at FROM site_pages WHERE is_published = 1 AND slug NOT IN (${placeholders}) ORDER BY title ASC`
        )
        .all(...coreKnownSlugs) as Array<{
          slug: string;
          title?: string | null;
          headline?: string | null;
          subtitle?: string | null;
          eyebrow?: string | null;
          updated_at?: string | null;
        }>;

      if (customPages.length > 0) {
        const pageItems: SitemapLinkItem[] = [];
        for (const p of customPages) {
          if (!p.slug) continue;
          pageItems.push({
            title: p.title || p.headline || p.slug,
            url: `/pages/${p.slug}`,
            description: p.subtitle || p.eyebrow || "Editorial page.",
            badge: "Page",
            lastModified: p.updated_at || undefined,
          });
        }
        if (pageItems.length > 0) {
          sections.push({
            id: "custom-pages",
            title: "Custom Editorial Pages",
            description: "Additional published resources and editorial features.",
            items: pageItems,
            count: pageItems.length,
          });
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  // 8. Machine-Readable Indexes & AI Feeds
  sections.push({
    id: "machine-indexes",
    title: "Machine-Readable Indexes & AI Feeds",
    description: "Machine-consumable XML sitemap protocol, feeds, and plain-text LLM documentation.",
    items: MACHINE_AND_AI_INDEXES,
    count: MACHINE_AND_AI_INDEXES.length,
  });

  const totalCount = sections.reduce((sum, s) => sum + s.count, 0);

  return {
    totalCount,
    sections,
    generatedAt: new Date().toISOString(),
  };
}
