// 062: TeaFloww B2B Business Acquisition (/start-tea-business, /tea-traders)
// Tables: b2b_settings, b2b_offers, b2b_page_content, b2b_claims,
//         b2b_leads, b2b_lead_events, b2b_quotes, b2b_integration_outbox
// Additive, versioned, idempotent for SQLite.

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS b2b_settings (
      id TEXT PRIMARY KEY,
      business_landing_enabled INTEGER NOT NULL DEFAULT 1,
      leads_enabled INTEGER NOT NULL DEFAULT 1,
      whatsapp_enabled INTEGER NOT NULL DEFAULT 1,
      whatsapp_e164 TEXT DEFAULT '917001304853',
      support_hours TEXT NOT NULL DEFAULT 'Mon-Sat 9:00 AM - 7:00 PM IST',
      starter_hero_image_url TEXT NOT NULL DEFAULT '/images/hero-himalayan-tea.webp',
      trader_hero_image_url TEXT NOT NULL DEFAULT '/images/cupping-guide.webp',
      proof_image_1_url TEXT NOT NULL DEFAULT '/images/orthodox-vs-ctc.webp',
      proof_image_2_url TEXT NOT NULL DEFAULT '/images/private-label/teafloww-reserve-front-v2.webp',
      crm_webhook_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS b2b_offers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE CHECK(code IN ('bulk_supply','ready_retail','private_label')),
      eyebrow_en TEXT NOT NULL,
      eyebrow_hi TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_hi TEXT NOT NULL,
      description_en TEXT NOT NULL,
      description_hi TEXT NOT NULL,
      cta_label_en TEXT NOT NULL,
      cta_label_hi TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'package' CHECK(icon IN ('package','shopping-bag','pen-tool')),
      image_url TEXT DEFAULT NULL,
      image_alt_en TEXT DEFAULT NULL,
      image_alt_hi TEXT DEFAULT NULL,
      sku_ids_json TEXT NOT NULL DEFAULT '[]',
      moq_text_en TEXT DEFAULT NULL,
      moq_text_hi TEXT DEFAULT NULL,
      pricing_mode TEXT NOT NULL DEFAULT 'request_quote' CHECK(pricing_mode IN ('request_quote','approved_display_price')),
      service_scope_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      approved_at TEXT DEFAULT NULL,
      approved_by TEXT DEFAULT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS b2b_page_content (
      id TEXT PRIMARY KEY,
      segment TEXT NOT NULL CHECK(segment IN ('starter','trader')),
      locale TEXT NOT NULL CHECK(locale IN ('en','hi')),
      eyebrow TEXT NOT NULL,
      headline TEXT NOT NULL,
      intro TEXT NOT NULL,
      primary_cta TEXT NOT NULL,
      secondary_cta TEXT NOT NULL,
      hero_image_url TEXT NOT NULL,
      hero_image_alt TEXT NOT NULL,
      process_intro TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      proof_title TEXT NOT NULL,
      proof_body TEXT NOT NULL,
      proof_items_json TEXT NOT NULL DEFAULT '[]',
      form_heading TEXT NOT NULL,
      form_subhead TEXT NOT NULL,
      faq_json TEXT NOT NULL,
      seo_title TEXT NOT NULL,
      seo_description TEXT NOT NULL,
      approved_at TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(segment, locale)
    );

    CREATE TABLE IF NOT EXISTS b2b_claims (
      claim_key TEXT PRIMARY KEY,
      exact_copy_en TEXT NOT NULL,
      exact_copy_hi TEXT NOT NULL,
      evidence_source TEXT NOT NULL,
      evidence_owner TEXT NOT NULL,
      allowed_channels_json TEXT NOT NULL DEFAULT '["web","sales"]',
      active INTEGER NOT NULL DEFAULT 1,
      approved_at TEXT DEFAULT NULL,
      valid_until TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS b2b_leads (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE,
      request_fingerprint TEXT NOT NULL,
      segment TEXT NOT NULL CHECK(segment IN ('starter','trader')),
      interest TEXT NOT NULL CHECK(interest IN ('bulk_supply','ready_retail','private_label','unsure')),
      quantity_band TEXT NOT NULL CHECK(quantity_band IN ('25-49','50-99','100-249','250-plus','unsure')),
      pincode TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      company TEXT DEFAULT NULL,
      note TEXT DEFAULT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contact_attempted','qualified','disqualified','quote_sent','won','lost')),
      qualification_reason TEXT DEFAULT NULL,
      owner_id TEXT DEFAULT NULL,
      contact_consent_at TEXT NOT NULL,
      marketing_consent_at TEXT DEFAULT NULL,
      utm_source TEXT DEFAULT NULL,
      utm_medium TEXT DEFAULT NULL,
      utm_campaign TEXT DEFAULT NULL,
      utm_content TEXT DEFAULT NULL,
      utm_term TEXT DEFAULT NULL,
      gclid TEXT DEFAULT NULL,
      gbraid TEXT DEFAULT NULL,
      wbraid TEXT DEFAULT NULL,
      fbclid TEXT DEFAULT NULL,
      first_contact_at TEXT DEFAULT NULL,
      qualified_at TEXT DEFAULT NULL,
      quoted_at TEXT DEFAULT NULL,
      won_at TEXT DEFAULT NULL,
      lost_at TEXT DEFAULT NULL,
      quoted_amount_paise INTEGER DEFAULT NULL,
      first_order_id TEXT DEFAULT NULL,
      deletion_requested_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_b2b_leads_created ON b2b_leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_b2b_leads_segment_status ON b2b_leads(segment, status);
    CREATE INDEX IF NOT EXISTS idx_b2b_leads_campaign ON b2b_leads(utm_campaign, created_at);

    CREATE TABLE IF NOT EXISTS b2b_lead_events (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES b2b_leads(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      actor_id TEXT DEFAULT NULL,
      metadata_json TEXT DEFAULT NULL,
      external_key TEXT UNIQUE DEFAULT NULL,
      event_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_b2b_lead_events_lead ON b2b_lead_events(lead_id, event_time DESC);

    CREATE TABLE IF NOT EXISTS b2b_quotes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES b2b_leads(id) ON DELETE CASCADE,
      quote_number TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL DEFAULT 1,
      line_items_json TEXT NOT NULL,
      freight_paise INTEGER NOT NULL DEFAULT 0,
      tax_paise INTEGER NOT NULL DEFAULT 0,
      total_paise INTEGER NOT NULL DEFAULT 0,
      freight_terms TEXT NOT NULL,
      valid_until TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','expired','cancelled')),
      created_by TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_b2b_quotes_lead ON b2b_quotes(lead_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS b2b_integration_outbox (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done','dead_letter')),
      last_error TEXT DEFAULT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_b2b_outbox_status ON b2b_integration_outbox(status, created_at);
  `);

  // Seed singleton settings
  db.prepare(`
    INSERT INTO b2b_settings (
      id, business_landing_enabled, leads_enabled, whatsapp_enabled, whatsapp_e164,
      support_hours, starter_hero_image_url, trader_hero_image_url,
      proof_image_1_url, proof_image_2_url, crm_webhook_enabled
    ) VALUES (
      'default', 1, 1, 1, '917001304853',
      'Mon-Sat 9:00 AM - 7:00 PM IST',
      '/images/hero-himalayan-tea.webp',
      '/images/cupping-guide.webp',
      '/images/orthodox-vs-ctc.webp',
      '/images/private-label/teafloww-reserve-front-v2.webp',
      0
    )
    ON CONFLICT(id) DO NOTHING
  `).run();

  // Seed 3 approved offers
  const nowIso = new Date().toISOString();
  const insertOffer = db.prepare(`
    INSERT INTO b2b_offers (
      id, code, eyebrow_en, eyebrow_hi, title_en, title_hi,
      description_en, description_hi, cta_label_en, cta_label_hi,
      icon, image_url, image_alt_en, image_alt_hi,
      sku_ids_json, moq_text_en, moq_text_hi, pricing_mode,
      service_scope_json, active, approved_at, approved_by, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'system_seed', ?)
    ON CONFLICT(id) DO NOTHING
  `);

  insertOffer.run(
    "bulk_supply",
    "bulk_supply",
    "01 · BULK",
    "01 · थोक सप्लाई",
    "Tea in 25kg sacks",
    "25kg बोरी में थोक चाय",
    "Explore 25kg bulk sack options and grades suited to your customers, quoted by volume and destination.",
    "अपने ग्राहकों के अनुसार 25kg थोक बोरी और चाय ग्रेड के विकल्प देखें, मात्रा और पिन कोड के अनुसार कोटेशन पाएं।",
    "Explore bulk quote",
    "थोक कोटेशन लें",
    "package",
    "/images/orthodox-vs-ctc.webp",
    "Assam and Himalayan bulk tea grades prepared for wholesale evaluation",
    "थोक मूल्यांकन के लिए असम और हिमालयी चाय ग्रेड",
    "[]",
    "Minimums confirmed per grade and route in written quotation",
    "न्यूनतम मात्रा ग्रेड और रूट के अनुसार लिखित कोटेशन में तय होती है",
    "request_quote",
    JSON.stringify(["25kg sack supply", "Grade & cup profile discussion", "Sample evaluation"]),
    nowIso,
    1
  );

  insertOffer.run(
    "ready_retail",
    "ready_retail",
    "02 · RETAIL",
    "02 · रिटेल पैक",
    "250g to 1kg pouches",
    "250g से 1kg रिटेल पैक",
    "Explore selected ready TeaFloww retail packs (250g, 500g, 1kg) for local distribution and resale.",
    "स्थानीय वितरण और रीसेल के लिए तैयार 250g, 500g और 1kg TeaFloww रिटेल पैक देखें।",
    "Explore retail quote",
    "रिटेल कोटेशन लें",
    "shopping-bag",
    "/images/private-label/teafloww-reserve-front-v2.webp",
    "TeaFloww retail tea pouch format example",
    "TeaFloww रिटेल चाय पाउच पैक का उदाहरण",
    "[]",
    "Minimums depend on pack size and destination",
    "न्यूनतम ऑर्डर पैक साइज और डिलीवरी स्थान पर निर्भर करता है",
    "request_quote",
    JSON.stringify(["250g / 500g / 1kg formats", "Resale margin discussion", "Freight-inclusive quote"]),
    nowIso,
    2
  );

  insertOffer.run(
    "private_label",
    "private_label",
    "03 · YOUR BRAND",
    "03 · आपका अपना ब्रांड",
    "Private-label tea",
    "प्राइवेट-लेबल चाय ब्रांड",
    "Discuss tea selection, label artwork coordination, packaging formats, printing and launch-planning support.",
    "चाय चयन, लेबल डिज़ाइन समन्वय, पैकेजिंग, प्रिंटिंग और लॉन्च प्लानिंग सपोर्ट पर चर्चा करें।",
    "Discuss private label",
    "अपने ब्रांड पर बात करें",
    "pen-tool",
    "/images/private-label/pouch-concept.webp",
    "Private-label tea packaging concept example",
    "प्राइवेट-लेबल चाय पैकेजिंग कॉन्सेप्ट उदाहरण",
    "[]",
    "MOQ depends on pouch format and print method",
    "MOQ पैक फॉर्मेट और प्रिंटिंग तकनीक के अनुसार तय होता है",
    "request_quote",
    JSON.stringify(["Tea sourcing", "Artwork & label coordination", "Packaging & print guidance"]),
    nowIso,
    3
  );

  // Seed page content for starter/trader x en/hi
  const insertPage = db.prepare(`
    INSERT INTO b2b_page_content (
      id, segment, locale, eyebrow, headline, intro,
      primary_cta, secondary_cta, hero_image_url, hero_image_alt,
      process_intro, steps_json, proof_title, proof_body, proof_items_json,
      form_heading, form_subhead, faq_json, seo_title, seo_description, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  const starterStepsEn = [
    { title: "Your market", body: "Tell us your city, buyer type and intended format." },
    { title: "Your tea", body: "Discuss tea grades, taste profile and available samples." },
    { title: "Your pack", body: "Choose bulk 25kg, ready retail packs or your own brand." },
    { title: "Clear quotation", body: "Review MOQ, tax, freight and service scope in writing." },
    { title: "Next step", body: "Approve sample, artwork or a confirmed commercial order." },
  ];

  const starterStepsHi = [
    { title: "आपका बाज़ार", body: "अपना शहर, ग्राहक वर्ग और पसंदीदा पैक फॉर्मेट बताएं।" },
    { title: "आपकी चाय", body: "चाय ग्रेड, स्वाद प्रोफ़ाइल और उपलब्ध सैंपल पर चर्चा करें।" },
    { title: "आपका पैक", body: "25kg थोक, तैयार रिटेल पैक या अपना ब्रांड चुनें।" },
    { title: "स्पष्ट कोटेशन", body: "MOQ, टैक्स, भाड़ा और सेवा दायरा लिखित में देखें।" },
    { title: "अगला कदम", body: "सैंपल, आर्टवर्क या कमर्शियल ऑर्डर को मंज़ूरी दें।" },
  ];

  const starterFaqEn = [
    {
      q: "Can I start without a tea brand or logo?",
      a: "Yes. Explain your planned business; our team can discuss applicable brand-design options, packaging coordination and fees.",
    },
    {
      q: "Can I choose my own tea packaging?",
      a: "Packaging methods and sizes (25kg bulk sacks or 250g/500g/1kg pouches) can be discussed. Each format has its own order minimum and print requirements.",
    },
    {
      q: "How much does it cost to start?",
      a: "There is no universal fixed figure. Tea grade, pack format, quantity, tax, print work and delivery are covered in your tailored written quote.",
    },
    {
      q: "Can I order samples before a bulk commitment?",
      a: "Yes. Ask about currently available sampling options, applicable fees and shipping terms during your consultation.",
    },
    {
      q: "How is shipping calculated?",
      a: "Freight depends on your destination pincode and total shipment weight. Your written quotation includes applicable freight terms.",
    },
  ];

  const starterFaqHi = [
    {
      q: "क्या मैं बिना ब्रांड या लोगो के चाय का बिज़नेस शुरू कर सकता हूँ?",
      a: "हाँ। अपनी योजना बताएं; हमारी टीम उपलब्ध ब्रांड-डिज़ाइन विकल्पों, पैकेजिंग समन्वय और शुल्क पर चर्चा कर सकती है।",
    },
    {
      q: "क्या मैं अपनी पसंद की चाय पैकेजिंग चुन सकता हूँ?",
      a: "पैकेजिंग के तरीके और साइज़ (25kg थोक बोरी या 250g/500g/1kg पाउच) पर चर्चा की जा सकती है। हर फॉर्मेट के अपने न्यूनतम ऑर्डर और प्रिंटिंग नियम होते हैं।",
    },
    {
      q: "शुरुआत करने में कितना खर्च आता है?",
      a: "कोई एक तय राशि नहीं है। चाय ग्रेड, पैक फॉर्मेट, मात्रा, टैक्स, प्रिंटिंग और डिलीवरी खर्च आपके लिखित कोटेशन में स्पष्ट किए जाते हैं।",
    },
    {
      q: "क्या बड़े ऑर्डर से पहले सैंपल मँगवाया जा सकता है?",
      a: "हाँ। बातचीत के दौरान उपलब्ध सैंपल विकल्पों, लागू शुल्क और शिपिंग शर्तों के बारे में पूछें।",
    },
    {
      q: "शिपिंग का खर्च कैसे तय होता है?",
      a: "भाड़ा आपके डिलीवरी पिन कोड और कुल वज़न पर निर्भर करता है। आपके लिखित कोटेशन में भाड़े की शर्तें शामिल होती हैं।",
    },
  ];

  const traderFaqEn = [
    {
      q: "Can I specify tea grade and cup profile?",
      a: "Yes. Include your target grade or send your specification for review. Any sample-matching terms are confirmed separately.",
    },
    {
      q: "Can I add my own branded packs?",
      a: "Private-label formats are available for discussion. MOQ and fees depend on pack size, artwork and print method.",
    },
    {
      q: "How do I compare landed cost?",
      a: "Share your order quantity band and destination pincode. The commercial quotation breaks down product, taxes and freight.",
    },
    {
      q: "Is the next lot guaranteed to be identical?",
      a: "Agree acceptance specifications and sample approvals with our sourcing team; absolute batch-identical guarantees are not made without lot review.",
    },
  ];

  const traderFaqHi = [
    {
      q: "क्या मैं चाय का ग्रेड और कप प्रोफ़ाइल बता सकता हूँ?",
      a: "हाँ। अपना लक्षित ग्रेड या स्पेसिफिकेशन साझा करें। सैंपल-मैचिंग की शर्तें अलग से कन्फर्म की जाती हैं।",
    },
    {
      q: "क्या मैं अपने ब्रांड के पैक बनवा सकता हूँ?",
      a: "प्राइवेट-लेबल फॉर्मेट पर चर्चा उपलब्ध है। MOQ और शुल्क पैक साइज़, आर्टवर्क और प्रिंटिंग तरीके पर निर्भर करते हैं।",
    },
    {
      q: "मैं लैंडेड कॉस्ट की तुलना कैसे करूँ?",
      a: "अपनी अनुमानित मात्रा और डिलीवरी पिन कोड साझा करें। कमर्शियल कोटेशन में उत्पाद, टैक्स और भाड़े का विवरण दिया जाता है।",
    },
    {
      q: "क्या अगला लॉट बिल्कुल एक जैसा होगा?",
      a: "हमारी सोर्सिंग टीम के साथ स्वीकृति मानदंड और सैंपल अप्रूवल तय करें; बिना लॉट समीक्षा के शत-प्रतिशत समानता की गारंटी नहीं दी जाती।",
    },
  ];

  const proofItemsEn = [
    {
      title: "Siliguri-based sourcing",
      caption: "CTC & orthodox grade evaluation from Siliguri trade hub.",
      imageUrl: "/images/orthodox-vs-ctc.webp",
      alt: "Loose orthodox and CTC tea leaves for grade comparison",
      sourceOwner: "TeaFloww Operations",
      approvedAt: nowIso,
    },
    {
      title: "Bulk + retail pack formats",
      caption: "25kg sack options alongside 250g, 500g and 1kg pouch formats.",
      imageUrl: "/images/private-label/teafloww-reserve-front-v2.webp",
      alt: "TeaFloww retail pouch packaging example",
      sourceOwner: "TeaFloww Packaging",
      approvedAt: nowIso,
    },
  ];

  const proofItemsHi = [
    {
      title: "सिलीगुड़ी से सोर्सिंग",
      caption: "सिलीगुड़ी ट्रेड हब से CTC और ऑर्थोडॉक्स ग्रेड का मूल्यांकन।",
      imageUrl: "/images/orthodox-vs-ctc.webp",
      alt: "ग्रेड तुलना के लिए ऑर्थोडॉक्स और CTC चाय पत्ती",
      sourceOwner: "TeaFloww Operations",
      approvedAt: nowIso,
    },
    {
      title: "थोक और रिटेल पैक फॉर्मेट",
      caption: "25kg बोरी के साथ 250g, 500g और 1kg पाउच विकल्प।",
      imageUrl: "/images/private-label/teafloww-reserve-front-v2.webp",
      alt: "TeaFloww रिटेल पाउच पैकेजिंग उदाहरण",
      sourceOwner: "TeaFloww Packaging",
      approvedAt: nowIso,
    },
  ];

  insertPage.run(
    "starter:en",
    "starter",
    "en",
    "SILIGURI · BUSINESS STARTER",
    "Your tea business starts here.",
    "Explore tea supply, retail pouches, branding and practical launch-planning support from Siliguri. Tell us what you want to build.",
    "Plan My Tea Business",
    "See the 3 Ways to Start",
    "/images/hero-himalayan-tea.webp",
    "TeaFloww tea sourcing and packaging showcase in Siliguri",
    "A clear way to explore your first tea trading order.",
    JSON.stringify(starterStepsEn),
    "From tea selection to your own product.",
    "Discuss grade, pack format, branding and destination before you commit to a production quotation.",
    JSON.stringify(proofItemsEn),
    "Tell us about your tea business",
    "A few details help us assess format, MOQ and delivery. Final terms arrive in a written quote.",
    JSON.stringify(starterFaqEn),
    "Start a Tea Business | TeaFloww Siliguri",
    "Explore tea supply, 25kg bulk options, retail packs and branding support for your new tea business. Request a quote from TeaFloww Siliguri.",
    nowIso
  );

  insertPage.run(
    "starter:hi",
    "starter",
    "hi",
    "सिलीगुड़ी · नया चाय बिज़नेस",
    "आपका चाय का बिज़नेस यहाँ से शुरू होता है।",
    "सिलीगुड़ी से थोक चाय सप्लाई, रिटेल पाउच, ब्रांडिंग और लॉन्च प्लानिंग सपोर्ट के विकल्प देखें। हमें बताएं कि आप क्या बनाना चाहते हैं।",
    "मेरे बिज़नेस का कोटेशन लें",
    "शुरुआत के 3 तरीके देखें",
    "/images/hero-himalayan-tea.webp",
    "सिलीगुड़ी में TeaFloww चाय सोर्सिंग और पैकेजिंग प्रदर्शन",
    "अपने पहले चाय व्यापार ऑर्डर को समझने का आसान तरीका।",
    JSON.stringify(starterStepsHi),
    "चाय के चयन से आपके अपने प्रोडक्ट तक।",
    "कमर्शियल कोटेशन से पहले ग्रेड, पैक फॉर्मेट, ब्रांडिंग और डिलीवरी स्थान पर चर्चा करें।",
    JSON.stringify(proofItemsHi),
    "अपने चाय बिज़नेस के बारे में बताएं",
    "कुछ जानकारी हमें सही फॉर्मेट, MOQ और डिलीवरी का आकलन करने में मदद करती है। अंतिम शर्तें लिखित कोटेशन में मिलती हैं।",
    JSON.stringify(starterFaqHi),
    "चाय का बिज़नेस शुरू करें | TeaFloww सिलीगुड़ी",
    "अपने नए चाय बिज़नेस के लिए थोक चाय सप्लाई, 25kg विकल्प, रिटेल पैक और ब्रांडिंग सपोर्ट देखें। TeaFloww सिलीगुड़ी से कोटेशन मांगें।",
    nowIso
  );

  insertPage.run(
    "trader:en",
    "trader",
    "en",
    "SILIGURI · TRADE SUPPLY",
    "Source tea. Add your label. Grow your range.",
    "Compare bulk 25kg formats, ready retail packs and private-label options. Share your grade, order size and destination for a commercial quote.",
    "Get Wholesale Quote",
    "Review Supply Options",
    "/images/cupping-guide.webp",
    "Tea cupping and grade evaluation at TeaFloww",
    "A quotation process built around real commercial requirements.",
    JSON.stringify(starterStepsEn),
    "Make the specifications clear before ordering.",
    "Review grade, taste requirements, artwork, production minimums, freight and sample approvals with the trade team.",
    JSON.stringify(proofItemsEn),
    "Request a quote for your next tea lot",
    "Share your planned volume and pincode so we can prepare a freight-aware commercial quotation.",
    JSON.stringify(traderFaqEn),
    "Wholesale Tea Supply & Private Label | TeaFloww",
    "Request trade pricing for 25kg bulk tea, retail pouches and private-label packaging. Discuss volume and delivery with TeaFloww Siliguri.",
    nowIso
  );

  insertPage.run(
    "trader:hi",
    "trader",
    "hi",
    "सिलीगुड़ी · ट्रेड सप्लाई",
    "चाय सोर्स करें। अपना लेबल जोड़ें। रेंज बढ़ाएं।",
    "25kg थोक फॉर्मेट, तैयार रिटेल पैक और प्राइवेट-लेबल विकल्पों की तुलना करें। कमर्शियल कोटेशन के लिए ग्रेड, मात्रा और पिन कोड साझा करें।",
    "थोक कोटेशन प्राप्त करें",
    "सप्लाई विकल्प देखें",
    "/images/cupping-guide.webp",
    "TeaFloww में चाय कपिंग और ग्रेड मूल्यांकन",
    "वास्तविक व्यापारिक ज़रूरतों के अनुसार कोटेशन प्रक्रिया।",
    JSON.stringify(starterStepsHi),
    "ऑर्डर से पहले सभी मानदंड स्पष्ट करें।",
    "हमारी ट्रेड टीम के साथ ग्रेड, स्वाद, आर्टवर्क, न्यूनतम ऑर्डर, भाड़ा और सैंपल अप्रूवल की समीक्षा करें।",
    JSON.stringify(proofItemsHi),
    "अपने अगले चाय लॉट के लिए कोटेशन मांगें",
    "अपनी अनुमानित मात्रा और डिलीवरी पिन कोड साझा करें ताकि हम भाड़े सहित कमर्शियल कोटेशन तैयार कर सकें।",
    JSON.stringify(traderFaqHi),
    "थोक चाय सप्लाई और प्राइवेट लेबल | TeaFloww",
    "25kg थोक चाय, रिटेल पाउच और प्राइवेट-लेबल पैकेजिंग के लिए ट्रेड रेट पूछें। TeaFloww सिलीगुड़ी से मात्रा और डिलीवरी पर बात करें।",
    nowIso
  );

  // Seed safe commercial claims
  const insertClaim = db.prepare(`
    INSERT INTO b2b_claims (
      claim_key, exact_copy_en, exact_copy_hi, evidence_source, evidence_owner,
      allowed_channels_json, active, approved_at
    ) VALUES (?, ?, ?, ?, ?, '["web","sales"]', 1, ?)
    ON CONFLICT(claim_key) DO NOTHING
  `);

  insertClaim.run(
    "siliguri_origin",
    "Tea sourcing and packaging options from Siliguri.",
    "सिलीगुड़ी से चाय सोर्सिंग और पैकेजिंग के विकल्प।",
    "TeaFloww Siliguri Office & Works",
    "Business Owner",
    nowIso
  );
  insertClaim.run(
    "quote_terms_notice",
    "Custom packaging and blend development are subject to minimums, sample approval and availability. Prices, freight, tax and delivery dates are confirmed in your quotation.",
    "कस्टम पैकेजिंग और ब्लेंड डेवलपमेंट न्यूनतम मात्रा, सैंपल अप्रूवल और उपलब्धता के अधीन हैं। कीमत, भाड़ा, टैक्स और डिलीवरी तारीख आपके कोटेशन में कन्फर्म की जाती है।",
    "Commercial Fact Gate G-03/G-04/G-06",
    "Operations & Finance",
    nowIso
  );
  insertClaim.run(
    "sample_bridge_notice",
    "Tell us what you want to test. We can discuss current sampling options and applicable fees.",
    "बताएं कि आप क्या टेस्ट करना चाहते हैं। हम उपलब्ध सैंपल विकल्पों और लागू शुल्क पर चर्चा कर सकते हैं।",
    "Commercial Fact Gate G-05",
    "Operations",
    nowIso
  );
}
