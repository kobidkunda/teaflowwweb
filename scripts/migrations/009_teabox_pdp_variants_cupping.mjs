// 009: Teabox PDP multi-dimensional variants, cupping profile, steeping guide & terroir dossier.
// Additive, versioned, 100% idempotent via PRAGMA table_info.

export function up(db) {
  // 1. Guard and add variants columns
  const variantCols = new Set(
    db.prepare("PRAGMA table_info(variants)").all().map((c) => c.name)
  );
  if (!variantCols.has("packaging_format")) {
    db.exec("ALTER TABLE variants ADD COLUMN packaging_format TEXT NOT NULL DEFAULT 'loose_leaf_pouch';");
  }
  if (!variantCols.has("servings")) {
    db.exec("ALTER TABLE variants ADD COLUMN servings INTEGER NOT NULL DEFAULT 50;");
  }

  // 2. Guard and add products columns (21 new columns)
  const productCols = new Set(
    db.prepare("PRAGMA table_info(products)").all().map((c) => c.name)
  );
  const newProductCols = [
    { name: "dry_leaf_appearance", ddl: "ALTER TABLE products ADD COLUMN dry_leaf_appearance TEXT DEFAULT '';" },
    { name: "dry_leaf_grade", ddl: "ALTER TABLE products ADD COLUMN dry_leaf_grade TEXT DEFAULT '';" },
    { name: "dry_leaf_aroma", ddl: "ALTER TABLE products ADD COLUMN dry_leaf_aroma TEXT DEFAULT '';" },
    { name: "liquor_hue_hex", ddl: "ALTER TABLE products ADD COLUMN liquor_hue_hex TEXT DEFAULT '#b36b3d';" },
    { name: "liquor_hue_name", ddl: "ALTER TABLE products ADD COLUMN liquor_hue_name TEXT DEFAULT '';" },
    { name: "liquor_clarity", ddl: "ALTER TABLE products ADD COLUMN liquor_clarity TEXT DEFAULT '';" },
    { name: "liquor_body", ddl: "ALTER TABLE products ADD COLUMN liquor_body TEXT DEFAULT '';" },
    { name: "wet_leaf_aroma", ddl: "ALTER TABLE products ADD COLUMN wet_leaf_aroma TEXT DEFAULT '';" },
    { name: "wet_leaf_oxidation", ddl: "ALTER TABLE products ADD COLUMN wet_leaf_oxidation TEXT DEFAULT '';" },
    { name: "sweetness", ddl: "ALTER TABLE products ADD COLUMN sweetness INTEGER NOT NULL DEFAULT 0;" },
    { name: "earthy", ddl: "ALTER TABLE products ADD COLUMN earthy INTEGER NOT NULL DEFAULT 0;" },
    { name: "aroma_tags", ddl: "ALTER TABLE products ADD COLUMN aroma_tags TEXT DEFAULT '[]';" },
    { name: "leaf_dose_grams", ddl: "ALTER TABLE products ADD COLUMN leaf_dose_grams REAL DEFAULT 2.5;" },
    { name: "water_ml", ddl: "ALTER TABLE products ADD COLUMN water_ml INTEGER DEFAULT 200;" },
    { name: "steep_count", ddl: "ALTER TABLE products ADD COLUMN steep_count INTEGER DEFAULT 3;" },
    { name: "steep_instructions", ddl: "ALTER TABLE products ADD COLUMN steep_instructions TEXT DEFAULT '';" },
    { name: "elevation_feet", ddl: "ALTER TABLE products ADD COLUMN elevation_feet INTEGER DEFAULT 0;" },
    { name: "elevation_display", ddl: "ALTER TABLE products ADD COLUMN elevation_display TEXT DEFAULT '';" },
    { name: "lot_number", ddl: "ALTER TABLE products ADD COLUMN lot_number TEXT DEFAULT '';" },
    { name: "cultivar", ddl: "ALTER TABLE products ADD COLUMN cultivar TEXT DEFAULT '';" },
    { name: "estate_story", ddl: "ALTER TABLE products ADD COLUMN estate_story TEXT DEFAULT '';" },
  ];

  for (const col of newProductCols) {
    if (!productCols.has(col.name)) {
      db.exec(col.ddl);
    }
  }

  // 3. Normalization for existing records
  db.exec("UPDATE variants SET packaging_format = 'loose_leaf_pouch' WHERE packaging_format IS NULL OR packaging_format = '';");
  db.exec(`UPDATE variants SET servings = CASE
    WHEN grams >= 1000 THEN 500
    WHEN grams >= 500 THEN 250
    WHEN grams >= 300 THEN 150
    WHEN grams >= 250 THEN 125
    WHEN grams >= 100 THEN 50
    WHEN grams >= 50 THEN 25
    ELSE MAX(1, CAST(grams / 2 AS INTEGER))
  END WHERE servings IS NULL OR servings = 0 OR (servings = 50 AND grams <> 100);`);
  db.exec("UPDATE products SET aroma_tags = '[]' WHERE aroma_tags IS NULL OR aroma_tags = '';");

  // 4. Backfill existing products with cupping & terroir attributes if present
  const updateProduct = db.prepare(`
    UPDATE products SET
      sweetness = ?, earthy = ?, aroma_tags = ?,
      dry_leaf_appearance = ?, dry_leaf_grade = ?, dry_leaf_aroma = ?,
      liquor_hue_hex = ?, liquor_hue_name = ?, liquor_clarity = ?, liquor_body = ?,
      wet_leaf_aroma = ?, wet_leaf_oxidation = ?,
      leaf_dose_grams = ?, water_ml = ?, steep_count = ?, steep_instructions = ?,
      elevation_feet = ?, elevation_display = ?, lot_number = ?, cultivar = ?, estate_story = ?
    WHERE slug = ?
  `);

  const backfills = [
    {
      slug: "darjeeling-spring",
      sweetness: 4, earthy: 1,
      aroma_tags: JSON.stringify(["Muscatel", "Wild Honey", "Spring Peach", "Alpine Orchid", "Dewy Pine"]),
      dry_leaf_appearance: "Well-twisted wiry olive-green whole leaves with a generous bloom of downy silver tips",
      dry_leaf_grade: "FTGFOP1",
      dry_leaf_aroma: "Crisp alpine air, crushed orchid blossoms, and freshly mown mountain meadow",
      liquor_hue_hex: "#e29d42", liquor_hue_name: "Sunlit Amber Gold",
      liquor_clarity: "Brilliant crystalline translucence with radiant golden halo",
      liquor_body: "Light to medium-bodied, champagne-like effervescence and brisk, clean astringency",
      wet_leaf_aroma: "Sweet poached stone fruit, dewy marigolds, and pine blossom",
      wet_leaf_oxidation: "Light ~15–20% oxidation; vivid jade-olive leaf matrix with coppery serrated margins",
      leaf_dose_grams: 2.5, water_ml: 200, steep_count: 3,
      steep_instructions: "Heat fresh filtered spring water to 85°C. Warm your teaware. Steep 2.5g in 200ml for 3 minutes. Decant fully between infusions; add 30s for subsequent steeps.",
      elevation_feet: 5800, elevation_display: "4,500 – 6,800 ft (1,370 – 2,070 m)",
      lot_number: "DJ-02/2026 (Demo Lot)", cultivar: "Camellia sinensis var. sinensis (AV2 Clonal Selection)",
      estate_story: "Perched in the mist-crowned valley east of Darjeeling town, Risheehat ('Home of the Holy Sages') is celebrated for steep mountain slopes rising above 6,000 feet. Diurnal temperature fluctuations between chilly Himalayan nights and intense daytime sun trigger terpene synthesis in young clonal bushes. Note: Provenance narrative provided for illustrative educational purposes in demo catalog.",
    },
    {
      slug: "summer-chinary-black",
      sweetness: 4, earthy: 2,
      aroma_tags: JSON.stringify(["Ripe Muscatel", "Summer Raisin", "Dark Honey", "Toasted Cedar", "Dried Apricot"]),
      dry_leaf_appearance: "Uniformly twisted chocolate-brown whole leaves interlaced with mature coppery tips",
      dry_leaf_grade: "SFTGFOP1",
      dry_leaf_aroma: "Roasted cocoa nibs, sun-ripened raisins, dried black currants, and aromatic cedar",
      liquor_hue_hex: "#c87533", liquor_hue_name: "Radiant Copper Amber",
      liquor_clarity: "Deep luminous clarity with glistening flame-orange refraction at the rim",
      liquor_body: "Full, rounded, velvety mouthfeel with structured vinous tannins",
      wet_leaf_aroma: "Stewed muscatel grape pulp, caramelized black figs, and warm forest floor",
      wet_leaf_oxidation: "Full ~75–80% traditional orthodox oxidation; lustrous dark coppery leaf fragments",
      leaf_dose_grams: 2.5, water_ml: 200, steep_count: 3,
      steep_instructions: "Bring fresh water to 90°C. Steep 2.5g in 200ml for 4 minutes. Enjoy unadorned in thin porcelain to fully appreciate the complex muscatel esters.",
      elevation_feet: 5600, elevation_display: "4,800 – 6,500 ft (1,460 – 1,980 m)",
      lot_number: "DJ-24/2026 (Demo Lot)", cultivar: "100% Heritage Chinary (Camellia sinensis var. sinensis)",
      estate_story: "Risheehat's Chinary sections date to the 1860s, planted with original Chinese tea seeds. In June, microclimatic interactions and leafhopper interactions spur the biosynthesis of aromatic monoterpenes, producing the legendary muscatel bouquet. Note: Illustrative demo catalog profiling.",
    },
    {
      slug: "assam-golden-tips",
      sweetness: 4, earthy: 3,
      aroma_tags: JSON.stringify(["Dense Malt", "Baker's Cocoa", "Jaggery", "Roasted Barley", "Prunes"]),
      dry_leaf_appearance: "Plump orthodox black leaves densely encrusted with luminous fuzzy amber-gold tips",
      dry_leaf_grade: "TGFOP1",
      dry_leaf_aroma: "Pungent sweet malt, toffee brittle, dried black mission figs, and toasted barley",
      liquor_hue_hex: "#882d17", liquor_hue_name: "Deep Ruby Mahogany",
      liquor_clarity: "Dense, gleaming clarity with ruby-copper highlights around the cup brim",
      liquor_body: "Heavy-bodied, syrupy and viscous with a bracing, energizing tannic structure",
      wet_leaf_aroma: "Warm roasted chestnuts, molasses treacle, and caramelized malt extract",
      wet_leaf_oxidation: "Complete ~95% orthodox oxidation; uniform reddish-bronze leaf fragments",
      leaf_dose_grams: 3.0, water_ml: 200, steep_count: 3,
      steep_instructions: "Boil filtered water to 95°C. Infuse 3.0g per 200ml for 4 minutes. Exceptionally delicious black, or paired with a splash of hot creamy milk and raw sugar.",
      elevation_feet: 450, elevation_display: "380 – 600 ft (115 – 180 m)",
      lot_number: "AS-08/2026 (Demo Lot)", cultivar: "Camellia sinensis var. assamica (P126 Clonal Selection)",
      estate_story: "Nestled along the alluvial banks of the Brahmaputra River, Hookhmol experiences intense monsoonal heat and humidity. The mineral-dense silt soil yields thick, resinous sap that coats the leaves, creating the profound maltiness of legendary orthodox Assam teas. Note: Demo illustrative lot.",
    },
    {
      slug: "silver-needles-white",
      sweetness: 5, earthy: 0,
      aroma_tags: JSON.stringify(["White Jasmine", "Honeydew Melon", "Tender Bamboo", "Almond Milk", "Silver Down"]),
      dry_leaf_appearance: "Needle-straight silvery spears enveloped in thick, velvet downy fuzz",
      dry_leaf_grade: "Silver Needles",
      dry_leaf_aroma: "Sweet alpine hay, wild white lily blossoms, and fresh glacial breeze",
      liquor_hue_hex: "#f4e0a5", liquor_hue_name: "Pale Sunlit Champagne",
      liquor_clarity: "Pristine transparency with floating silvery trichome particles sparkling in light",
      liquor_body: "Gossamer, ultra-silky texture; zero astringency or bitterness",
      wet_leaf_aroma: "Steamed tender bamboo shoots, fresh honeydew melon rind, and honeysuckle",
      wet_leaf_oxidation: "Natural non-enzymatic minimal oxidation (< 8%); silvery chartreuse whole buds",
      leaf_dose_grams: 3.0, water_ml: 200, steep_count: 4,
      steep_instructions: "Use water cooled to 75°C. Infuse 3.0g whole buds per 200ml for 4 minutes in glass. The buds stand vertically in the water. Yields up to 4 delicate infusions.",
      elevation_feet: 4200, elevation_display: "3,500 – 5,500 ft (1,060 – 1,670 m)",
      lot_number: "HN-01/2026 (Demo Lot)", cultivar: "Camellia sinensis var. sinensis (AV2 Clonal Bud Selection)",
      estate_story: "Rohini rests along the scenic Mirik river valley. Early spring budding produces an exceptionally dense concentration of protective pubescence to insulate shoots against cold mountain nights, yielding unrivaled sweetness. Note: Illustrative demo tea profile.",
    },
    {
      slug: "giddapahar-oolong",
      sweetness: 4, earthy: 3,
      aroma_tags: JSON.stringify(["Roasted Walnut", "Ripe Apricot", "Mountain Orchid", "Burnt Toffee", "Sweet Cedar"]),
      dry_leaf_appearance: "Open-rolled dark amber-green curly leaves with carmine-tinted edges",
      dry_leaf_grade: "FTGFOP1 Oolong",
      dry_leaf_aroma: "Baked stone fruit, toasted hazelnuts, sweet woodsmoke, and wild honey",
      liquor_hue_hex: "#d9822b", liquor_hue_name: "Burnished Topaz Gold",
      liquor_clarity: "Radiant, luminous clarity with amber-golden brilliance",
      liquor_body: "Medium-full, buttery texture with deep lingering throat sweetness (Hui Gan)",
      wet_leaf_aroma: "Baked apricot cobbler, honeysuckle nectar, and warm sandalwood",
      wet_leaf_oxidation: "Controlled semi-oxidation (~45–50%); green leaf center with crimson serrated edges",
      leaf_dose_grams: 3.0, water_ml: 200, steep_count: 4,
      steep_instructions: "Heat filtered water to 90°C. Pour over 3.0g leaves in a porcelain or clay pot. Steep 3 minutes for first infusion. Excellent for multiple re-steepings.",
      elevation_feet: 5200, elevation_display: "4,800 – 6,000 ft (1,460 – 1,830 m)",
      lot_number: "GP-11/2026 (Demo Lot)", cultivar: "Heritage Chinary & T-78 Clonal Hybrid",
      estate_story: "Giddapahar ('Eagle's Cliff') perches on sheer stone crags above Kurseong town. The constant autumn breeze cools the mountain soil rapidly, producing rare concentration of essential oils in mature autumn tea leaves. Note: Demo illustrative lot.",
    },
    {
      slug: "kangra-green",
      sweetness: 4, earthy: 2,
      aroma_tags: JSON.stringify(["Snap Pea", "Roasted Hazelnut", "Sweet Meadow Grass", "Mineral Rain", "Steamed Artichoke"]),
      dry_leaf_appearance: "Tightly twisted needle-like jade whole leaves with subtle emerald luster",
      dry_leaf_grade: "Fine Orthodox Green",
      dry_leaf_aroma: "Toasted sesame, roasted chestnut, crisp alfalfa, and cold snowmelt",
      liquor_hue_hex: "#8ca336", liquor_hue_name: "Sunlit Jade Green",
      liquor_clarity: "Sparkling crystalline clarity with a soft celadon glow",
      liquor_body: "Silky, light-bodied with refreshing umami and zero harsh bitterness",
      wet_leaf_aroma: "Blanched baby spinach, toasted hazelnut, and dewy meadow grass",
      wet_leaf_oxidation: "Unoxidized (< 2%); uniform bright lime-green leaves",
      leaf_dose_grams: 2.5, water_ml: 200, steep_count: 3,
      steep_instructions: "Allow boiled water to cool to 80°C. Steep 2.5g in 200ml for 2.5 minutes. Never use boiling water on green leaves to preserve delicate polyphenols.",
      elevation_feet: 4300, elevation_display: "4,000 – 4,900 ft (1,220 – 1,490 m)",
      lot_number: "KG-03/2026 (Demo Lot)", cultivar: "Camellia sinensis var. sinensis (Kangra Heritage Local Selection)",
      estate_story: "Wah Estate was founded in 1857 against the backdrop of Himachal Pradesh's Dhauladhar mountains. Fed by glacial streams, the region's high natural catechins and slow growth produce teas with unmatched natural sweetness. Note: Illustrative demo copy.",
    },
    {
      slug: "assam-golden-breakfast",
      sweetness: 3, earthy: 3,
      aroma_tags: JSON.stringify(["Malt", "Caramel", "Cocoa", "Toasted Oak"]),
      dry_leaf_appearance: "Wiry orthodox black leaves with dispersed golden flecks",
      dry_leaf_grade: "TGFOP",
      dry_leaf_aroma: "Rich sweet malt, toffee, and toasted brown bread",
      liquor_hue_hex: "#93381e", liquor_hue_name: "Burnished Copper",
      liquor_clarity: "Brilliant copper clarity with warm reddish hues",
      liquor_body: "Full-bodied, brisk, and robust",
      wet_leaf_aroma: "Pungent malt, warm brown sugar, and toasted oak",
      wet_leaf_oxidation: "Heavy ~90% orthodox oxidation; dark coppery leaf fragments",
      leaf_dose_grams: 3.0, water_ml: 200, steep_count: 3,
      steep_instructions: "Brew with boiling water at 95°C for 4 minutes. Ideal for breakfast with milk.",
      elevation_feet: 400, elevation_display: "350 – 500 ft (100 – 150 m)",
      lot_number: "AS-GB/2026", cultivar: "Assamica clone",
      estate_story: "Alluvial plains of the Brahmaputra River, famous for heavy monsoonal rainfall and robust character. Illustrative demo copy.",
    },
    {
      slug: "nilgiri-mist-green",
      sweetness: 4, earthy: 1,
      aroma_tags: JSON.stringify(["Sweet Grass", "Citrus", "Pear", "Green Apple"]),
      dry_leaf_appearance: "Neat curly olive-green leaves",
      dry_leaf_grade: "Orthodox Green",
      dry_leaf_aroma: "Crisp clover, sweet grass, and lemon rind",
      liquor_hue_hex: "#a6b847", liquor_hue_name: "Sunlit Meadow Lime",
      liquor_clarity: "Clear, pale chartreuse clarity",
      liquor_body: "Light-bodied, soft and refreshing",
      wet_leaf_aroma: "Fresh cut grass, pear skin, and steamed greens",
      wet_leaf_oxidation: "Unoxidized (< 3%); bright jade green leaves",
      leaf_dose_grams: 2.5, water_ml: 200, steep_count: 3,
      steep_instructions: "Brew at 80°C for 2.5 minutes. Sweet and grassy.",
      elevation_feet: 6500, elevation_display: "6,000 – 7,000 ft (1,800 – 2,100 m)",
      lot_number: "NI-MG/2026", cultivar: "Southern mountain hybrid",
      estate_story: "Grown at high altitudes in the Nilgiri hills where eucalyptus and mist create fragrant cups. Illustrative demo copy.",
    },
    {
      slug: "himalayan-white-peony",
      sweetness: 5, earthy: 0,
      aroma_tags: JSON.stringify(["Melon", "Blossom", "Almond", "Wild Plum"]),
      dry_leaf_appearance: "Downy silver buds surrounded by olive-grey whole leaves",
      dry_leaf_grade: "White Peony",
      dry_leaf_aroma: "Dry honeysuckle petals, sweet melon, and almond flakes",
      liquor_hue_hex: "#ebd59b", liquor_hue_name: "Warm Primrose",
      liquor_clarity: "Luminous pale yellow transparency",
      liquor_body: "Delicate, velvety, and naturally sweet",
      wet_leaf_aroma: "Warm floral nectar, sweet cucumber, and melon rind",
      wet_leaf_oxidation: "Minimal ~10% natural air oxidation",
      leaf_dose_grams: 2.5, water_ml: 200, steep_count: 3,
      steep_instructions: "Brew at 80°C for 3.5 minutes. Re-steep up to 3 times.",
      elevation_feet: 4800, elevation_display: "4,500 – 5,500 ft (1,370 – 1,670 m)",
      lot_number: "HW-WP/2026", cultivar: "Chinary clonal",
      estate_story: "Sub-Himalayan gentle microclimates allow tender spring buds to dry naturally in mountain air. Illustrative demo copy.",
    },
    {
      slug: "masala-chai-reserve",
      sweetness: 4, earthy: 4,
      aroma_tags: JSON.stringify(["Cardamom", "Cinnamon", "Ginger", "Cloves", "Sweet Milk"]),
      dry_leaf_appearance: "Dark granulated CTC tea interspersed with cracked green cardamom pods and cinnamon bark",
      dry_leaf_grade: "BOP / CTC Spiced",
      dry_leaf_aroma: "Aromatic crushed green cardamom, sweet Ceylon cinnamon, and hot black pepper",
      liquor_hue_hex: "#7a2b16", liquor_hue_name: "Rich Spiced Mahogany",
      liquor_clarity: "Dense, deep mahogany liquor",
      liquor_body: "Full, rich, and spice-warming",
      wet_leaf_aroma: "Simmered spiced milk, fragrant cardamom oils, and bold black tea malt",
      wet_leaf_oxidation: "Full 100% oxidation black base",
      leaf_dose_grams: 3.5, water_ml: 200, steep_count: 1,
      steep_instructions: "Bring equal parts water and whole milk to a rolling boil. Add 3.5g spiced blend per 200ml. Simmer 5 minutes. Strain and sweeten to taste.",
      elevation_feet: 500, elevation_display: "Alluvial plains curation",
      lot_number: "CH-MR/2026", cultivar: "Blended Indian cultivars",
      estate_story: "A celebration of traditional Indian roadside dhaba chai culture using high-quality single-estate dust and orthodox spices. Illustrative demo copy.",
    },
    {
      slug: "discovery-flight",
      sweetness: 3, earthy: 2,
      aroma_tags: JSON.stringify(["Floral", "Malty", "Spiced", "Stone Fruit"]),
      dry_leaf_appearance: "Assortment of three signature orthodox leaves",
      dry_leaf_grade: "Gourmet Flight",
      dry_leaf_aroma: "Harmonious bouquet of fresh flowers, cocoa, and spices",
      liquor_hue_hex: "#b87333", liquor_hue_name: "Golden Copper Flight",
      liquor_clarity: "Crystalline varied liquor shades",
      liquor_body: "Medium, varied textures across tasting flights",
      wet_leaf_aroma: "Aromatic diverse spent tea leaves",
      wet_leaf_oxidation: "Varied light, medium, and heavy oxidations",
      leaf_dose_grams: 2.5, water_ml: 200, steep_count: 3,
      steep_instructions: "Brew each tin per its individual guide included in the tasting flight box.",
      elevation_feet: 5000, elevation_display: "Various high-altitude Himalayan gardens",
      lot_number: "GF-DF/2026", cultivar: "Assorted heritage cultivars",
      estate_story: "A curated flight demonstrating the rich geographic diversity of Indian tea traditions. Illustrative demo copy.",
    },
  ];

  for (const b of backfills) {
    updateProduct.run(
      b.sweetness, b.earthy, b.aroma_tags,
      b.dry_leaf_appearance, b.dry_leaf_grade, b.dry_leaf_aroma,
      b.liquor_hue_hex, b.liquor_hue_name, b.liquor_clarity, b.liquor_body,
      b.wet_leaf_aroma, b.wet_leaf_oxidation,
      b.leaf_dose_grams, b.water_ml, b.steep_count, b.steep_instructions,
      b.elevation_feet, b.elevation_display, b.lot_number, b.cultivar, b.estate_story,
      b.slug
    );
  }
}

export function down() {}
