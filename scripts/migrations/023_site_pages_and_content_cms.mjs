// 023: Site Pages CMS, Content Blocks & Universal Storefront Content Architecture
export function up(db) {
  // 1. Create site_pages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      eyebrow TEXT NOT NULL DEFAULT '',
      headline TEXT NOT NULL DEFAULT '',
      subtitle TEXT NOT NULL DEFAULT '',
      hero_image_url TEXT NOT NULL DEFAULT '',
      hero_media_id INTEGER,
      body_markdown TEXT NOT NULL DEFAULT '',
      sections_json TEXT NOT NULL DEFAULT '[]',
      meta_title TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_site_pages_slug ON site_pages(slug);
    CREATE INDEX IF NOT EXISTS idx_site_pages_published ON site_pages(is_published);
  `);

  // 2. Create site_content_blocks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_content_blocks (
      key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'text',
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 3. Seed default content blocks
  const defaultBlocks = [
    ["announcement.text", "FREE SHIPPING ON ORDERS ABOVE ₹999", "text", "Top marquee announcement line"],
    ["announcement.highlight", "✨ FREE SHIPPING ON ORDERS ABOVE ₹999", "text", "Top announcement highlight pill"],
    ["announcement.link_url", "/shop", "text", "Top announcement destination URL"],
    ["announcement.link_label", "Shop Now", "text", "Top announcement link text"],
    ["announcement.wholesale_label", "🌿 Wholesale & Bulk Orders", "text", "Top announcement wholesale button label"],
    ["announcement.enabled", "1", "boolean", "Show or hide top announcement marquee"],
    ["footer.text", "Single-estate loose leaf teas direct from small Himalayan tea makers.", "text", "Storefront footer brief bio"],
    ["footer.copyright", "© Himalayan Tea House Private Limited. All rights reserved.", "text", "Footer copyright notice"],
    ["footer.disclosure", "Direct from origin. Graded and packaged at our Siliguri headquarters.", "text", "Footer legal disclosure"],
    ["brand.story_badge", "Origin & Provenance", "text", "Editorial eyebrow for brand story"],
    ["brand.tagline", "Orthodox & CTC Teas from Origin", "text", "Brand tagline"],
    ["contact.hours", "Monday – Saturday, 09:00 to 18:00 IST", "text", "Customer support operating hours"],
    ["contact.hours_weekend", "Sunday: Reserved for quiet estate visits", "text", "Customer support weekend hours"],
    ["shipping.dispatch_commitment", "Dispatched from our central Siliguri facility within 24 to 48 hours of lot grading to guarantee absolute freshness.", "text", "Shipping dispatch commitment copy"],
    ["shipping.free_threshold_display", "₹1,500.00", "text", "Formatted free shipping threshold"],
    ["shipping.flat_fee_display", "₹99.00", "text", "Formatted flat rate shipping fee"],
    ["returns.window_days", "14", "number", "Returns and freshness guarantee window in days"],
    ["returns.summary", "14-day freshness and transit resolution guarantee. Unopened tins or items damaged in transit are replaced or refunded upon inspection.", "text", "Summary of returns policy"],
  ];

  const blockStmt = db.prepare(`
    INSERT OR IGNORE INTO site_content_blocks (key, content, content_type, description, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  for (const [key, content, type, desc] of defaultBlocks) {
    blockStmt.run(key, content, type, desc);
  }

  // 4. Seed initial default pages
  const defaultPages = [
    {
      slug: "about",
      title: "About Us",
      eyebrow: "Origin & Provenance",
      headline: "Direct From the High Himalayas",
      subtitle: "Bridging high-mountain tea artisans and mindful connoisseurs through radical freshness and transparent estate traceability.",
      hero_image_url: "/uploads/clean_mountain_sunrise_banner.webp",
      body_markdown: "Himalayan Tea House was established with a singular conviction: tea tastes extraordinary when it is consumed as fresh as possible, directly from the garden where it was plucked.",
      sections_json: JSON.stringify([
        {
          id: "philosophy",
          heading: "Our Sourcing Philosophy",
          body: "We bypass conventional brokerages. We partner directly with historic heritage estates in Darjeeling, the alluvial valleys of Upper Assam, the glacial runoff terraces of Kangra, and the blue mountain peaks of Nilgiri.",
        },
        {
          id: "hub",
          heading: "The Siliguri Sourcing & Tasting Hub",
          body: "Located at the crossroads of the Eastern Himalayas on Hill Cart Road in Siliguri, West Bengal, our central tasting room and packaging facility operates in immediate proximity to the tea gardens. Every harvest lot is cupped, graded, and vacuum-sealed at origin within hours of plucking.",
        },
        {
          id: "truth",
          heading: "Truth in Every Tin",
          items: [
            "Single-Estate Purity: No mysterious multi-origin blending; every tin is traceable to its estate, invoice, and harvest flush.",
            "Zero Artificial Additives: We do not spray synthetic flavoring oils or artificial aromas. The fragrance in your cup comes purely from the leaf, cultivar, and soil.",
            "Fair Garden Economics: Direct purchasing ensures partner garden workers and managers receive fair compensation that supports regenerative agriculture.",
          ],
        },
      ]),
      meta_title: "About Himalayan Tea House — Provenance, Heritage & Estates",
      meta_description: "Learn about our direct-from-origin sourcing model: partner gardens across Darjeeling, Assam, Kangra, and Nilgiri, vacuum packaging at our Siliguri headquarters.",
      is_published: 1,
    },
    {
      slug: "contact",
      title: "Contact Us",
      eyebrow: "Customer Care & Headquarters",
      headline: "Connect With Our Tea Masters",
      subtitle: "Questions regarding brewing parameters, order status, private tasting bookings, or garden partnerships? We are here to assist.",
      hero_image_url: "",
      body_markdown: "Our central tasting room and dispatch facility is located in Siliguri, West Bengal.",
      sections_json: JSON.stringify([
        {
          id: "tasting_room",
          heading: "Siliguri Tasting Room & Office",
          body: "Hill Cart Road, Near Tea Auction Centre, Matigara, Siliguri, West Bengal — 734010, India.",
          hours: "Monday – Saturday, 09:00 to 18:00 IST",
        },
        {
          id: "channels",
          heading: "Direct Contact Channels",
          email: "support@himalayantea.com",
          phone: "+91-353-2570112",
          whatsapp: "+91 98320 12345",
        },
      ]),
      meta_title: "Contact Us — Tasting Room & Sourcing Headquarters",
      meta_description: "Contact Himalayan Tea House in Siliguri, West Bengal. Customer inquiries, private tea tasting reservations, and wholesale partnerships.",
      is_published: 1,
    },
    {
      slug: "shipping",
      title: "Shipping Policy",
      eyebrow: "Origin Logistics",
      headline: "Direct-from-Origin Shipping Policy",
      subtitle: "Dispatched from our central Siliguri facility within 24 to 48 hours of lot grading to guarantee absolute freshness.",
      hero_image_url: "",
      body_markdown: "Every order is packaged at origin in nitrogen-flushed or vacuum-sealed pouches and double-walled luxury tins before dispatch.",
      sections_json: JSON.stringify([
        {
          id: "domestic_rates",
          heading: "Domestic Shipping Rates & Thresholds (India)",
          free_threshold: "₹1,500.00",
          flat_fee: "₹99.00",
          body: "Free shipping is automatically applied on all orders of ₹1,500.00 or greater across all serviceable pin codes in India. A flat fee of ₹99.00 applies to orders below ₹1,500.00.",
        },
        {
          id: "transit_times",
          heading: "Estimated Delivery Timelines",
          timelines: [
            "Kolkata & Northeast India: 2–3 business days",
            "Delhi NCR, Mumbai, Bengaluru, Hyderabad, Chennai: 3–5 business days",
            "Rest of India (Regional & Tier 2/3): 4–7 business days",
          ],
        },
      ]),
      meta_title: "Shipping & Transit Policy — Origin Packaging & Delivery",
      meta_description: "Review shipping rates, transit timelines, and vacuum packaging standards across India and global destinations from our Siliguri hub.",
      is_published: 1,
    },
    {
      slug: "returns",
      title: "Returns & Freshness Guarantee",
      eyebrow: "Customer Assurance",
      headline: "14-Day Freshness Guarantee",
      subtitle: "We pride ourselves on the pristine condition of our garden harvests. If something is not right, we resolve it promptly.",
      hero_image_url: "",
      body_markdown: "Because loose-leaf orthodox tea is an agricultural food item, standard consumables cannot be returned once unsealed unless defective or damaged in transit. Within 14 days of delivery, you are fully covered.",
      sections_json: JSON.stringify([
        {
          id: "guarantee",
          heading: "Our Quality Commitment",
          window_days: 14,
          covered: [
            "Transit damage or compromised seals",
            "Wrong harvest lot or variant dispatched",
            "Unopened items in original sealed packaging",
          ],
        },
      ]),
      meta_title: "Returns & Freshness Guarantee Policy",
      meta_description: "Review our 14-day freshness and transit damage guarantee. Hassle-free replacements and refunds for Himalayan Tea House customers.",
      is_published: 1,
    },
    {
      slug: "privacy",
      title: "Privacy Policy",
      eyebrow: "Data Protection & Ethics",
      headline: "Privacy & Data Protection Policy",
      subtitle: "We respect your personal privacy and treat your data with the same care and integrity we bring to our single-estate teas.",
      hero_image_url: "",
      body_markdown: "Himalayan Tea House Private Limited complies with applicable data protection laws. We never sell or rent your personal information to third-party data brokers.",
      sections_json: JSON.stringify([
        {
          id: "collection",
          heading: "Information We Collect",
          items: [
            "Contact and shipping details for order fulfillment.",
            "Payment confirmation identifiers (we do not store raw credit card numbers or CVVs).",
            "Anonymized device and performance signals for site reliability.",
          ],
        },
      ]),
      meta_title: "Privacy Policy — Himalayan Tea House",
      meta_description: "Learn how Himalayan Tea House protects your personal information, handles orders, and respects your privacy.",
      is_published: 1,
    },
    {
      slug: "terms",
      title: "Terms of Service",
      eyebrow: "Legal & Commerce Agreement",
      headline: "Terms & Conditions of Purchase",
      subtitle: "Standard operating terms governing orders, catalog accuracy, and customer accounts on Himalayan Tea House.",
      hero_image_url: "",
      body_markdown: "By accessing or placing an order on Himalayan Tea House, you agree to be bound by these Terms of Service.",
      sections_json: JSON.stringify([
        {
          id: "orders",
          heading: "Orders, Pricing & Taxes",
          body: "All prices are listed in Indian Rupees (INR) and are inclusive of applicable Goods and Services Tax (GST). We reserve the right to correct pricing errors and cancel unfulfillable orders.",
        },
      ]),
      meta_title: "Terms of Service — Himalayan Tea House",
      meta_description: "Terms and conditions of purchase, catalog accuracy, order fulfillment, and legal policies for Himalayan Tea House.",
      is_published: 1,
    },
    {
      slug: "brand",
      title: "Brand Identity & Master Logo Kit",
      eyebrow: "Verified Sourcing & Identity System",
      headline: "Teafloww Brand Identity & Master Logo Kit",
      subtitle: "Official Teafloww branding assets, color palettes, and all vector logo formats for packaging, print, and digital media.",
      hero_image_url: "",
      body_markdown: "Our identity reflects the tranquil fog, high elevations, and deep forest greens of the Himalayan foothills.",
      sections_json: JSON.stringify([]),
      meta_title: "Brand Assets & Identity — Master Vector Logo Kit",
      meta_description: "Official Teafloww branding assets, color palettes, and vector logo formats.",
      is_published: 1,
    },
    {
      slug: "wholesale",
      title: "Wholesale & Bulk Orders",
      eyebrow: "B2B & Estate Partnerships",
      headline: "Direct-from-Origin Wholesale Teas",
      subtitle: "Specialty cafes, boutique hotels, and tea retailers: source fresh, single-estate Himalayan teas directly from our Siliguri hub.",
      hero_image_url: "",
      body_markdown: "We supply micro-lot orthodox teas, premium CTC blends, and custom packaging for wholesale partners across India and worldwide.",
      sections_json: JSON.stringify([]),
      meta_title: "Wholesale Orthodox Teas — Direct Estate Partnerships",
      meta_description: "Source premium single-estate Himalayan loose leaf teas for cafes, hotels, and retail.",
      is_published: 1,
    },
    {
      slug: "leaf-to-cup",
      title: "Leaf to Cup",
      eyebrow: "The Craft of Orthodox Tea",
      headline: "From High-Mountain Garden to Your Cup",
      subtitle: "Discover the delicate seven-step artisanal process that transforms two leaves and a bud into extraordinary orthodox tea.",
      hero_image_url: "/uploads/gardens_to_cup.jpg",
      body_markdown: "Orthodox tea manufacture is an art perfected over centuries in the mist-shrouded valleys of Darjeeling and the Himalayan foothills.",
      sections_json: JSON.stringify([]),
      meta_title: "Leaf to Cup — The Artisanal Tea Making Process",
      meta_description: "Follow the journey from tea garden harvesting to precision withering, rolling, oxidation, drying, and grading.",
      is_published: 1,
    },
    {
      slug: "gifts",
      title: "Tea Gifts & Atelier",
      eyebrow: "Curated Collections",
      headline: "Artisanal Tea Gifts from the Himalayas",
      subtitle: "Handcrafted wooden presentation boxes, multi-flush discovery flights, and bespoke gifting sets.",
      hero_image_url: "",
      body_markdown: "Give the gift of pure Himalayan provenance. Our curated discovery flights and luxury tin sets make unforgettable gifts.",
      sections_json: JSON.stringify([]),
      meta_title: "Tea Gifts & Curated Tasting Flights — Himalayan Tea House",
      meta_description: "Explore luxury tea gift boxes, reserve flights, and seasonal presents.",
      is_published: 1,
    },
    {
      slug: "locations-siliguri",
      title: "Siliguri Tasting Room & Hub",
      eyebrow: "Headquarters & Tasting Room",
      headline: "Our Sourcing Center in Siliguri",
      subtitle: "Located at the foot of Darjeeling, our Siliguri facility cups hundreds of harvest lots daily.",
      hero_image_url: "",
      body_markdown: "Hill Cart Road, Near Tea Auction Centre, Matigara, Siliguri, West Bengal — 734010. Visitors welcome by appointment for private cupping sessions.",
      sections_json: JSON.stringify([]),
      meta_title: "Siliguri Tasting Room & Sourcing Hub — Himalayan Tea House",
      meta_description: "Visit our central tasting room and packaging facility in Siliguri, West Bengal.",
      is_published: 1,
    },
    {
      slug: "tea-finder",
      title: "Tea Sommelier Finder",
      eyebrow: "Personalized Recommendation",
      headline: "Find Your Perfect Himalayan Tea",
      subtitle: "Answer a few quick questions about your flavor preferences, brewing habits, and caffeine tolerance to find your ideal cup.",
      hero_image_url: "",
      body_markdown: "Our sommelier algorithm matches you with authentic single-estate lots based on palate profile and time of day.",
      sections_json: JSON.stringify([]),
      meta_title: "Tea Sommelier Finder — Personalized Recommendations",
      meta_description: "Find your ideal loose-leaf tea based on your taste preferences and brewing style.",
      is_published: 1,
    },
  ];

  const pageStmt = db.prepare(`
    INSERT OR IGNORE INTO site_pages (
      slug, title, eyebrow, headline, subtitle, hero_image_url,
      body_markdown, sections_json, meta_title, meta_description, is_published,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      datetime('now'), datetime('now')
    )
  `);

  for (const p of defaultPages) {
    pageStmt.run(
      p.slug,
      p.title,
      p.eyebrow,
      p.headline,
      p.subtitle,
      p.hero_image_url,
      p.body_markdown,
      p.sections_json,
      p.meta_title,
      p.meta_description,
      p.is_published
    );
  }
}

export function down() {}
