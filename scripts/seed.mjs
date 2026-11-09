import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Demo/seed data is FICTIONAL catalogue placeholders. It must never run in
// production: seeding would overwrite real catalogue rows (upsert by slug/sku)
// and publish unverified provenance copy. Fenced by NODE_ENV — production
// refuses unless the operator explicitly opts in with ALLOW_DEMO_SEED=1.
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
  console.error(
    "Refusing to seed: NODE_ENV=production without ALLOW_DEMO_SEED=1. " +
      "Demo seed is fenced out of production (see docs/OPERATIONS.md)."
  );
  process.exit(1);
}
const file = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");
const db = new Database(file);
db.pragma("foreign_keys = ON");

const products = [
  // 1. Darjeeling Spring Clonal First Flush
  {
    slug: "darjeeling-spring",
    name: "Darjeeling Spring Clonal First Flush",
    category: "Black",
    origin: "Darjeeling, West Bengal, India",
    estate: "Risheehat Tea Estate (Illustrative demo source — unverified lot)",
    flush: "First Flush",
    harvest_date: "March–April 2026 (Illustrative demo harvest)",
    description: "Plucked during the awakening of spring in the misty upper ridges of the Kurseong East valley. As the winter frost recedes, tender terminal shoots rich in clonal volatile terpenes are harvested by hand in the early morning dew. The liquor is pale amber, brisk, and lively, presenting an unmatched harmony of springtime florals and tender green fruit.",
    tasting_notes: "Wildflower honey, Muscatel grape, green peach, spring pine",
    floral: 5, fruity: 4, malty: 1, body: 2, sweetness: 4, earthy: 1,
    aroma_tags: JSON.stringify(["Muscatel", "Wild Honey", "Spring Peach", "Alpine Orchid", "Dewy Pine"]),
    dry_leaf_appearance: "Well-twisted wiry olive-green whole leaves with a generous bloom of downy silver tips",
    dry_leaf_grade: "FTGFOP1",
    dry_leaf_aroma: "Crisp alpine air, crushed orchid blossoms, and freshly mown mountain meadow",
    liquor_hue_hex: "#e29d42",
    liquor_hue_name: "Sunlit Amber Gold",
    liquor_clarity: "Brilliant crystalline translucence with radiant golden halo",
    liquor_body: "Light to medium-bodied, champagne-like effervescence and brisk, clean astringency",
    wet_leaf_aroma: "Sweet poached stone fruit, dewy marigolds, and pine blossom",
    wet_leaf_oxidation: "Light ~15–20% oxidation; vivid jade-olive leaf matrix with coppery serrated margins",
    brew_temp: 85,
    brew_seconds: 180,
    leaf_dose_grams: 2.5,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Heat fresh filtered spring water to 85°C. Warm your teaware. Steep 2.5g in 200ml for 3 minutes. Decant fully between infusions; add 30s for subsequent steeps.",
    elevation_feet: 5800,
    elevation_display: "4,500 – 6,800 ft (1,370 – 2,070 m)",
    lot_number: "DJ-02/2026 (Demo Lot)",
    cultivar: "Camellia sinensis var. sinensis (AV2 Clonal Selection)",
    estate_story: "Perched in the mist-crowned valley east of Darjeeling town, Risheehat ('Home of the Holy Sages') is celebrated for steep mountain slopes rising above 6,000 feet. Diurnal temperature fluctuations between chilly Himalayan nights and intense daytime sun trigger terpene synthesis in young clonal bushes. Note: Provenance narrative provided for illustrative educational purposes in demo catalog.",
    featured: 1,
    variants: [
      { sku: "DJ-SP-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 129900, stock: 35 },
      { sku: "DJ-SP-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 349900, stock: 18 },
      { sku: "DJ-SP-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 549900, stock: 4 },
      { sku: "DJ-SP-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 999900, stock: 10 },
      { sku: "DJ-SP-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 149900, stock: 25 },
      { sku: "DJ-SP-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 379900, stock: 12 },
      { sku: "DJ-SP-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 589900, stock: 3 },
      { sku: "DJ-SP-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 1069900, stock: 0 },
      { sku: "DJ-SP-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 79900, stock: 40 },
      { sku: "DJ-SP-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 144900, stock: 20 },
    ],
  },

  // 2. Darjeeling Summer Chinary Black (Teabox PDP Reference)
  {
    slug: "summer-chinary-black",
    name: "Darjeeling Summer Chinary Black",
    category: "Black",
    origin: "Darjeeling, West Bengal, India",
    estate: "Risheehat Tea Estate (Illustrative demo source — unverified lot)",
    flush: "Second Flush",
    harvest_date: "June 2026 (Illustrative demo harvest)",
    description: "The quintessential benchmark of second flush Darjeeling, inspired by the renowned Teabox Risheehat Chinary experience. Plucked from century-old heirloom Chinese tea bushes during peak summer sunshine. Celebrated worldwide for its signature ripe muscatel character, caramelized summer raisin sweetness, and warm cedarwood finish.",
    tasting_notes: "Ripe muscatel, summer raisins, dark wildflower honey, cedarwood",
    floral: 3, fruity: 5, malty: 3, body: 4, sweetness: 4, earthy: 2,
    aroma_tags: JSON.stringify(["Ripe Muscatel", "Summer Raisin", "Dark Honey", "Toasted Cedar", "Dried Apricot"]),
    dry_leaf_appearance: "Uniformly twisted chocolate-brown whole leaves interlaced with mature coppery tips",
    dry_leaf_grade: "SFTGFOP1",
    dry_leaf_aroma: "Roasted cocoa nibs, sun-ripened raisins, dried black currants, and aromatic cedar",
    liquor_hue_hex: "#c87533",
    liquor_hue_name: "Radiant Copper Amber",
    liquor_clarity: "Deep luminous clarity with glistening flame-orange refraction at the rim",
    liquor_body: "Full, rounded, velvety mouthfeel with structured vinous tannins",
    wet_leaf_aroma: "Stewed muscatel grape pulp, caramelized black figs, and warm forest floor",
    wet_leaf_oxidation: "Full ~75–80% traditional orthodox oxidation; lustrous dark coppery leaf fragments",
    brew_temp: 90,
    brew_seconds: 240,
    leaf_dose_grams: 2.5,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Bring fresh water to 90°C. Steep 2.5g in 200ml for 4 minutes. Enjoy unadorned in thin porcelain to fully appreciate the complex muscatel esters.",
    elevation_feet: 5600,
    elevation_display: "4,800 – 6,500 ft (1,460 – 1,980 m)",
    lot_number: "DJ-24/2026 (Demo Lot)",
    cultivar: "100% Heritage Chinary (Camellia sinensis var. sinensis)",
    estate_story: "Risheehat's Chinary sections date to the 1860s, planted with original Chinese tea seeds. In June, microclimatic interactions and leafhopper interactions spur the biosynthesis of aromatic monoterpenes, producing the legendary muscatel bouquet. Note: Illustrative demo catalog profiling.",
    featured: 1,
    variants: [
      { sku: "SC-BK-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 119900, stock: 45 },
      { sku: "SC-BK-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 319900, stock: 22 },
      { sku: "SC-BK-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 499900, stock: 15 },
      { sku: "SC-BK-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 899900, stock: 8 },
      { sku: "SC-BK-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 139900, stock: 30 },
      { sku: "SC-BK-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 349900, stock: 2 },
      { sku: "SC-BK-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 539900, stock: 10 },
      { sku: "SC-BK-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 969900, stock: 0 },
      { sku: "SC-BK-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 74900, stock: 50 },
      { sku: "SC-BK-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 134900, stock: 0 },
    ],
  },

  // 3. Assam Heritage Golden Tips
  {
    slug: "assam-golden-tips",
    name: "Assam Heritage Golden Tips",
    category: "Black",
    origin: "Upper Assam, Brahmaputra Valley, India",
    estate: "Hookhmol Tea Estate (Illustrative demo source — unverified lot)",
    flush: "Second Flush",
    harvest_date: "July 2026 (Illustrative demo harvest)",
    description: "An opulent orthodox masterpiece from the rich red loam of Upper Assam. Hand-sorted to contain over 40% shimmering golden trichome tips. Produces a commanding cup boasting rich malt extract, bittersweet baker's chocolate, and thick jaggery sweetness.",
    tasting_notes: "Roasted malt, dark cocoa, molasses, honeyed dates",
    floral: 1, fruity: 2, malty: 5, body: 5, sweetness: 4, earthy: 3,
    aroma_tags: JSON.stringify(["Dense Malt", "Baker's Cocoa", "Jaggery", "Roasted Barley", "Prunes"]),
    dry_leaf_appearance: "Plump orthodox black leaves densely encrusted with luminous fuzzy amber-gold tips",
    dry_leaf_grade: "TGFOP1",
    dry_leaf_aroma: "Pungent sweet malt, toffee brittle, dried black mission figs, and toasted barley",
    liquor_hue_hex: "#882d17",
    liquor_hue_name: "Deep Ruby Mahogany",
    liquor_clarity: "Dense, gleaming clarity with ruby-copper highlights around the cup brim",
    liquor_body: "Heavy-bodied, syrupy and viscous with a bracing, energizing tannic structure",
    wet_leaf_aroma: "Warm roasted chestnuts, molasses treacle, and caramelized malt extract",
    wet_leaf_oxidation: "Complete ~95% orthodox oxidation; uniform reddish-bronze leaf fragments",
    brew_temp: 95,
    brew_seconds: 240,
    leaf_dose_grams: 3.0,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Boil filtered water to 95°C. Infuse 3.0g per 200ml for 4 minutes. Exceptionally delicious black, or paired with a splash of hot creamy milk and raw sugar.",
    elevation_feet: 450,
    elevation_display: "380 – 600 ft (115 – 180 m)",
    lot_number: "AS-08/2026 (Demo Lot)",
    cultivar: "Camellia sinensis var. assamica (P126 Clonal Selection)",
    estate_story: "Nestled along the alluvial banks of the Brahmaputra River, Hookhmol experiences intense monsoonal heat and humidity. The mineral-dense silt soil yields thick, resinous sap that coats the leaves, creating the profound maltiness of legendary orthodox Assam teas. Note: Demo illustrative lot.",
    featured: 1,
    variants: [
      { sku: "AS-GT-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 89900, stock: 50 },
      { sku: "AS-GT-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 239900, stock: 30 },
      { sku: "AS-GT-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 379900, stock: 20 },
      { sku: "AS-GT-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 689900, stock: 12 },
      { sku: "AS-GT-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 109900, stock: 35 },
      { sku: "AS-GT-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 269900, stock: 18 },
      { sku: "AS-GT-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 419900, stock: 3 },
      { sku: "AS-GT-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 749900, stock: 0 },
      { sku: "AS-GT-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 59900, stock: 60 },
      { sku: "AS-GT-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 109900, stock: 35 },
    ],
  },

  // 4. Himalayan Silver Needles Imperial White
  {
    slug: "silver-needles-white",
    name: "Himalayan Silver Needles Imperial White",
    category: "White",
    origin: "Mirik Valley, Darjeeling, India",
    estate: "Rohini Tea Estate (Illustrative demo source — unverified lot)",
    flush: "Early Spring Flush",
    harvest_date: "March 2026 (Illustrative demo harvest)",
    description: "Composed exclusively of plump, unopened terminal leaf buds hand-plucked during a ten-day window in early March. Sun-withered under high mountain ultraviolet light with minimal mechanical handling. Unfurls into a pale champagne nectar redolent of night-blooming jasmine, honeydew melon, and raw honeycomb.",
    tasting_notes: "White jasmine, sweet melon, fresh almond, raw honeycomb",
    floral: 5, fruity: 3, malty: 0, body: 1, sweetness: 5, earthy: 0,
    aroma_tags: JSON.stringify(["White Jasmine", "Honeydew Melon", "Tender Bamboo", "Almond Milk", "Silver Down"]),
    dry_leaf_appearance: "Needle-straight silvery spears enveloped in thick, velvet downy fuzz",
    dry_leaf_grade: "Silver Needles",
    dry_leaf_aroma: "Sweet alpine hay, wild white lily blossoms, and fresh glacial breeze",
    liquor_hue_hex: "#f4e0a5",
    liquor_hue_name: "Pale Sunlit Champagne",
    liquor_clarity: "Pristine transparency with floating silvery trichome particles sparkling in light",
    liquor_body: "Gossamer, ultra-silky texture; zero astringency or bitterness",
    wet_leaf_aroma: "Steamed tender bamboo shoots, fresh honeydew melon rind, and honeysuckle",
    wet_leaf_oxidation: "Natural non-enzymatic minimal oxidation (< 8%); silvery chartreuse whole buds",
    brew_temp: 75,
    brew_seconds: 240,
    leaf_dose_grams: 3.0,
    water_ml: 200,
    steep_count: 4,
    steep_instructions: "Use water cooled to 75°C. Infuse 3.0g whole buds per 200ml for 4 minutes in glass. The buds stand vertically in the water. Yields up to 4 delicate infusions.",
    elevation_feet: 4200,
    elevation_display: "3,500 – 5,500 ft (1,060 – 1,670 m)",
    lot_number: "HN-01/2026 (Demo Lot)",
    cultivar: "Camellia sinensis var. sinensis (AV2 Clonal Bud Selection)",
    estate_story: "Rohini rests along the scenic Mirik river valley. Early spring budding produces an exceptionally dense concentration of protective pubescence to insulate shoots against cold mountain nights, yielding unrivaled sweetness. Note: Illustrative demo tea profile.",
    featured: 1,
    variants: [
      { sku: "SN-WH-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 189900, stock: 20 },
      { sku: "SN-WH-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 509900, stock: 3 },
      { sku: "SN-WH-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 799900, stock: 0 },
      { sku: "SN-WH-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 1499900, stock: 0 },
      { sku: "SN-WH-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 219900, stock: 15 },
      { sku: "SN-WH-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 549900, stock: 2 },
      { sku: "SN-WH-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 849900, stock: 0 },
      { sku: "SN-WH-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 1599900, stock: 0 },
      { sku: "SN-WH-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 119900, stock: 25 },
      { sku: "SN-WH-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 219900, stock: 4 },
    ],
  },

  // 5. Giddapahar High Mountain Oolong
  {
    slug: "giddapahar-oolong",
    name: "Giddapahar High Mountain Oolong",
    category: "Oolong",
    origin: "Kurseong Valley, Darjeeling, India",
    estate: "Giddapahar Tea Estate (Illustrative demo source — unverified lot)",
    flush: "Autumnal Flush",
    harvest_date: "October 2026 (Illustrative demo harvest)",
    description: "An artisan semi-oxidized oolong crafted on the steep rocky slopes of Kurseong. Carefully bruised in bamboo baskets to achieve partial edge-oxidation, then roasted gently over charcoal embers. Evokes sweet roasted walnuts, sun-ripened apricots, and lingering mountain orchid sweetness.",
    tasting_notes: "Roasted walnut, dried apricot, mountain orchid, burnt toffee",
    floral: 4, fruity: 4, malty: 2, body: 3, sweetness: 4, earthy: 3,
    aroma_tags: JSON.stringify(["Roasted Walnut", "Ripe Apricot", "Mountain Orchid", "Burnt Toffee", "Sweet Cedar"]),
    dry_leaf_appearance: "Open-rolled dark amber-green curly leaves with carmine-tinted edges",
    dry_leaf_grade: "FTGFOP1 Oolong",
    dry_leaf_aroma: "Baked stone fruit, toasted hazelnuts, sweet woodsmoke, and wild honey",
    liquor_hue_hex: "#d9822b",
    liquor_hue_name: "Burnished Topaz Gold",
    liquor_clarity: "Radiant, luminous clarity with amber-golden brilliance",
    liquor_body: "Medium-full, buttery texture with deep lingering throat sweetness (Hui Gan)",
    wet_leaf_aroma: "Baked apricot cobbler, honeysuckle nectar, and warm sandalwood",
    wet_leaf_oxidation: "Controlled semi-oxidation (~45–50%); green leaf center with crimson serrated edges",
    brew_temp: 90,
    brew_seconds: 180,
    leaf_dose_grams: 3.0,
    water_ml: 200,
    steep_count: 4,
    steep_instructions: "Heat filtered water to 90°C. Pour over 3.0g leaves in a porcelain or clay pot. Steep 3 minutes for first infusion. Excellent for multiple re-steepings.",
    elevation_feet: 5200,
    elevation_display: "4,800 – 6,000 ft (1,460 – 1,830 m)",
    lot_number: "GP-11/2026 (Demo Lot)",
    cultivar: "Heritage Chinary & T-78 Clonal Hybrid",
    estate_story: "Giddapahar ('Eagle's Cliff') perches on sheer stone crags above Kurseong town. The constant autumn breeze cools the mountain soil rapidly, producing rare concentration of essential oils in mature autumn tea leaves. Note: Demo illustrative lot.",
    featured: 0,
    variants: [
      { sku: "GP-OL-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 149900, stock: 28 },
      { sku: "GP-OL-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 399900, stock: 16 },
      { sku: "GP-OL-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 629900, stock: 10 },
      { sku: "GP-OL-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 1149900, stock: 2 },
      { sku: "GP-OL-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 169900, stock: 22 },
      { sku: "GP-OL-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 439900, stock: 14 },
      { sku: "GP-OL-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 679900, stock: 0 },
      { sku: "GP-OL-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 1229900, stock: 0 },
      { sku: "GP-OL-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 89900, stock: 35 },
      { sku: "GP-OL-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 164900, stock: 18 },
    ],
  },

  // 6. Kangra Valley Spring Green
  {
    slug: "kangra-green",
    name: "Kangra Valley Spring Green",
    category: "Green",
    origin: "Kangra Valley, Himachal Pradesh, India",
    estate: "Wah Tea Estate (Illustrative demo source — unverified lot)",
    flush: "Spring First Flush",
    harvest_date: "April 2026 (Illustrative demo harvest)",
    description: "Cultivated under the dramatic snowfields of the Dhauladhar Himalayan range. Hand-plucked tender green leaves are gently roasted in shallow iron pans to arrest oxidation while developing delicate roasted hazelnut and fresh sugar snap pea nuances. Clean, restorative, and sweet.",
    tasting_notes: "Sweet snap peas, roasted hazelnut, fresh grass, morning dew",
    floral: 3, fruity: 2, malty: 0, body: 2, sweetness: 4, earthy: 2,
    aroma_tags: JSON.stringify(["Snap Pea", "Roasted Hazelnut", "Sweet Meadow Grass", "Mineral Rain", "Steamed Artichoke"]),
    dry_leaf_appearance: "Tightly twisted needle-like jade whole leaves with subtle emerald luster",
    dry_leaf_grade: "Fine Orthodox Green",
    dry_leaf_aroma: "Toasted sesame, roasted chestnut, crisp alfalfa, and cold snowmelt",
    liquor_hue_hex: "#8ca336",
    liquor_hue_name: "Sunlit Jade Green",
    liquor_clarity: "Sparkling crystalline clarity with a soft celadon glow",
    liquor_body: "Silky, light-bodied with refreshing umami and zero harsh bitterness",
    wet_leaf_aroma: "Blanched baby spinach, toasted hazelnut, and dewy meadow grass",
    wet_leaf_oxidation: "Unoxidized (< 2%); uniform bright lime-green leaves",
    brew_temp: 80,
    brew_seconds: 150,
    leaf_dose_grams: 2.5,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Allow boiled water to cool to 80°C. Steep 2.5g in 200ml for 2.5 minutes. Never use boiling water on green leaves to preserve delicate polyphenols.",
    elevation_feet: 4300,
    elevation_display: "4,000 – 4,900 ft (1,220 – 1,490 m)",
    lot_number: "KG-03/2026 (Demo Lot)",
    cultivar: "Camellia sinensis var. sinensis (Kangra Heritage Local Selection)",
    estate_story: "Wah Estate was founded in 1857 against the backdrop of Himachal Pradesh's Dhauladhar mountains. Fed by glacial streams, the region's high natural catechins and slow growth produce teas with unmatched natural sweetness. Note: Illustrative demo copy.",
    featured: 0,
    variants: [
      { sku: "KG-GR-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 79900, stock: 40 },
      { sku: "KG-GR-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 214900, stock: 25 },
      { sku: "KG-GR-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 339900, stock: 18 },
      { sku: "KG-GR-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 619900, stock: 10 },
      { sku: "KG-GR-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 99900, stock: 30 },
      { sku: "KG-GR-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 244900, stock: 3 },
      { sku: "KG-GR-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 379900, stock: 12 },
      { sku: "KG-GR-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 679900, stock: 0 },
      { sku: "KG-GR-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 54900, stock: 45 },
      { sku: "KG-GR-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 99900, stock: 25 },
    ],
  },

  // 7. Assam Golden Breakfast
  {
    slug: "assam-golden-breakfast",
    name: "Assam Golden Breakfast",
    category: "Black",
    origin: "Assam, India",
    estate: "Illustrative estate — replace",
    flush: "Summer",
    harvest_date: "Demo harvest — unverified",
    description: "A generous, malty morning cup designed to be satisfying with or without milk. Hand-selected orthodox grades.",
    tasting_notes: "Malt, caramel, cocoa",
    floral: 1, fruity: 1, malty: 5, body: 5, sweetness: 3, earthy: 3,
    aroma_tags: JSON.stringify(["Malt", "Caramel", "Cocoa", "Toasted Oak"]),
    dry_leaf_appearance: "Wiry orthodox black leaves with dispersed golden flecks",
    dry_leaf_grade: "TGFOP",
    dry_leaf_aroma: "Rich sweet malt, toffee, and toasted brown bread",
    liquor_hue_hex: "#93381e",
    liquor_hue_name: "Burnished Copper",
    liquor_clarity: "Brilliant copper clarity with warm reddish hues",
    liquor_body: "Full-bodied, brisk, and robust",
    wet_leaf_aroma: "Pungent malt, warm brown sugar, and toasted oak",
    wet_leaf_oxidation: "Heavy ~90% orthodox oxidation; dark coppery leaf fragments",
    brew_temp: 95,
    brew_seconds: 240,
    leaf_dose_grams: 3.0,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Brew with boiling water at 95°C for 4 minutes. Ideal for breakfast with milk.",
    elevation_feet: 400,
    elevation_display: "350 – 500 ft (100 – 150 m)",
    lot_number: "AS-GB/2026",
    cultivar: "Assamica clone",
    estate_story: "Alluvial plains of the Brahmaputra River, famous for heavy monsoonal rainfall and robust character. Illustrative demo copy.",
    featured: 1,
    variants: [
      { sku: "AS-GB-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 59900, stock: 40 },
      { sku: "AS-GB-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 159900, stock: 25 },
      { sku: "AS-GB-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 249900, stock: 15 },
      { sku: "AS-GB-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 449900, stock: 8 },
      { sku: "AS-GB-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 79900, stock: 30 },
      { sku: "AS-GB-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 189900, stock: 15 },
      { sku: "AS-GB-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 289900, stock: 4 },
      { sku: "AS-GB-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 509900, stock: 0 },
      { sku: "AS-GB-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 39900, stock: 50 },
      { sku: "AS-GB-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 74900, stock: 25 },
    ],
  },

  // 8. Nilgiri Mist Green
  {
    slug: "nilgiri-mist-green",
    name: "Nilgiri Mist Green",
    category: "Green",
    origin: "Nilgiri, Blue Mountains, India",
    estate: "Illustrative estate — replace",
    flush: "Seasonal",
    harvest_date: "Demo harvest — unverified",
    description: "A fresh green tea concept with a gentle vegetal profile and soft floral finish from southern blue mountains.",
    tasting_notes: "Sweet grass, citrus, pear",
    floral: 2, fruity: 3, malty: 0, body: 2, sweetness: 4, earthy: 1,
    aroma_tags: JSON.stringify(["Sweet Grass", "Citrus", "Pear", "Green Apple"]),
    dry_leaf_appearance: "Neat curly olive-green leaves",
    dry_leaf_grade: "Orthodox Green",
    dry_leaf_aroma: "Crisp clover, sweet grass, and lemon rind",
    liquor_hue_hex: "#a6b847",
    liquor_hue_name: "Sunlit Meadow Lime",
    liquor_clarity: "Clear, pale chartreuse clarity",
    liquor_body: "Light-bodied, soft and refreshing",
    wet_leaf_aroma: "Fresh cut grass, pear skin, and steamed greens",
    wet_leaf_oxidation: "Unoxidized (< 3%); bright jade green leaves",
    brew_temp: 80,
    brew_seconds: 150,
    leaf_dose_grams: 2.5,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Brew at 80°C for 2.5 minutes. Sweet and grassy.",
    elevation_feet: 6500,
    elevation_display: "6,000 – 7,000 ft (1,800 – 2,100 m)",
    lot_number: "NI-MG/2026",
    cultivar: "Southern mountain hybrid",
    estate_story: "Grown at high altitudes in the Nilgiri hills where eucalyptus and mist create fragrant cups. Illustrative demo copy.",
    featured: 1,
    variants: [
      { sku: "NI-MG-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 64900, stock: 35 },
      { sku: "NI-MG-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 174900, stock: 20 },
      { sku: "NI-MG-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 274900, stock: 12 },
      { sku: "NI-MG-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 494900, stock: 6 },
      { sku: "NI-MG-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 84900, stock: 25 },
      { sku: "NI-MG-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 204900, stock: 10 },
      { sku: "NI-MG-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 314900, stock: 2 },
      { sku: "NI-MG-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 554900, stock: 0 },
      { sku: "NI-MG-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 44900, stock: 45 },
      { sku: "NI-MG-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 82900, stock: 20 },
    ],
  },

  // 9. Himalayan White Peony
  {
    slug: "himalayan-white-peony",
    name: "Himalayan White Peony",
    category: "White",
    origin: "Himalayan region, India",
    estate: "Illustrative estate — replace",
    flush: "Spring",
    harvest_date: "Demo harvest — unverified",
    description: "A light, gently sweet white-tea concept for quiet afternoon rituals. Plucked as one bud and two young leaves.",
    tasting_notes: "Melon, blossom, almond",
    floral: 4, fruity: 3, malty: 0, body: 1, sweetness: 5, earthy: 0,
    aroma_tags: JSON.stringify(["Melon", "Blossom", "Almond", "Wild Plum"]),
    dry_leaf_appearance: "Downy silver buds surrounded by olive-grey whole leaves",
    dry_leaf_grade: "White Peony",
    dry_leaf_aroma: "Dry honeysuckle petals, sweet melon, and almond flakes",
    liquor_hue_hex: "#ebd59b",
    liquor_hue_name: "Warm Primrose",
    liquor_clarity: "Luminous pale yellow transparency",
    liquor_body: "Delicate, velvety, and naturally sweet",
    wet_leaf_aroma: "Warm floral nectar, sweet cucumber, and melon rind",
    wet_leaf_oxidation: "Minimal ~10% natural air oxidation",
    brew_temp: 80,
    brew_seconds: 210,
    leaf_dose_grams: 2.5,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Brew at 80°C for 3.5 minutes. Re-steep up to 3 times.",
    elevation_feet: 4800,
    elevation_display: "4,500 – 5,500 ft (1,370 – 1,670 m)",
    lot_number: "HW-WP/2026",
    cultivar: "Chinary clonal",
    estate_story: "Sub-Himalayan gentle microclimates allow tender spring buds to dry naturally in mountain air. Illustrative demo copy.",
    featured: 0,
    variants: [
      { sku: "HW-WP-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 109900, stock: 25 },
      { sku: "HW-WP-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 299900, stock: 12 },
      { sku: "HW-WP-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 469900, stock: 5 },
      { sku: "HW-WP-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 849900, stock: 0 },
      { sku: "HW-WP-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 129900, stock: 20 },
      { sku: "HW-WP-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 329900, stock: 8 },
      { sku: "HW-WP-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 509900, stock: 2 },
      { sku: "HW-WP-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 919900, stock: 0 },
      { sku: "HW-WP-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 69900, stock: 30 },
      { sku: "HW-WP-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 129900, stock: 15 },
    ],
  },

  // 10. Masala Chai Reserve
  {
    slug: "masala-chai-reserve",
    name: "Masala Chai Reserve",
    category: "Chai",
    origin: "Indian blend, India",
    estate: "Blended product — illustrative",
    flush: "Not applicable",
    harvest_date: "Not applicable",
    description: "A warming black tea and whole spice blend concept, created for slow, comforting milk chai rituals with crushed spices.",
    tasting_notes: "Cardamom, cinnamon, ginger",
    floral: 1, fruity: 0, malty: 5, body: 5, sweetness: 4, earthy: 4,
    aroma_tags: JSON.stringify(["Cardamom", "Cinnamon", "Ginger", "Cloves", "Sweet Milk"]),
    dry_leaf_appearance: "Dark granulated CTC tea interspersed with cracked green cardamom pods and cinnamon bark",
    dry_leaf_grade: "BOP / CTC Spiced",
    dry_leaf_aroma: "Aromatic crushed green cardamom, sweet Ceylon cinnamon, and hot black pepper",
    liquor_hue_hex: "#7a2b16",
    liquor_hue_name: "Rich Spiced Mahogany",
    liquor_clarity: "Dense, deep mahogany liquor",
    liquor_body: "Full, rich, and spice-warming",
    wet_leaf_aroma: "Simmered spiced milk, fragrant cardamom oils, and bold black tea malt",
    wet_leaf_oxidation: "Full 100% oxidation black base",
    brew_temp: 100,
    brew_seconds: 300,
    leaf_dose_grams: 3.5,
    water_ml: 200,
    steep_count: 1,
    steep_instructions: "Bring equal parts water and whole milk to a rolling boil. Add 3.5g spiced blend per 200ml. Simmer 5 minutes. Strain and sweeten to taste.",
    elevation_feet: 500,
    elevation_display: "Alluvial plains curation",
    lot_number: "CH-MR/2026",
    cultivar: "Blended Indian cultivars",
    estate_story: "A celebration of traditional Indian roadside dhaba chai culture using high-grade single-estate dust and orthodox spices. Illustrative demo copy.",
    featured: 1,
    variants: [
      { sku: "CH-MR-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 54900, stock: 50 },
      { sku: "CH-MR-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 144900, stock: 30 },
      { sku: "CH-MR-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 229900, stock: 20 },
      { sku: "CH-MR-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 409900, stock: 15 },
      { sku: "CH-MR-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 74900, stock: 40 },
      { sku: "CH-MR-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 174900, stock: 20 },
      { sku: "CH-MR-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 269900, stock: 3 },
      { sku: "CH-MR-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 469900, stock: 0 },
      { sku: "CH-MR-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 37900, stock: 60 },
      { sku: "CH-MR-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 69900, stock: 35 },
    ],
  },

  // 11. The Discovery Flight
  {
    slug: "discovery-flight",
    name: "The Discovery Flight",
    category: "Gifts",
    origin: "Curated Indian selection",
    estate: "Multiple illustrative sources",
    flush: "Assorted",
    harvest_date: "See individual teas",
    description: "An introductory tasting assortment concept presented as an elegant gift. Contains samples of signature Darjeeling, Assam, and Himalayan whites.",
    tasting_notes: "Floral, malty, spiced assortment",
    floral: 3, fruity: 3, malty: 3, body: 3, sweetness: 3, earthy: 2,
    aroma_tags: JSON.stringify(["Floral", "Malty", "Spiced", "Stone Fruit"]),
    dry_leaf_appearance: "Assortment of three signature orthodox leaves",
    dry_leaf_grade: "Gourmet Flight",
    dry_leaf_aroma: "Harmonious bouquet of fresh flowers, cocoa, and spices",
    liquor_hue_hex: "#b87333",
    liquor_hue_name: "Golden Copper Flight",
    liquor_clarity: "Crystalline varied liquor shades",
    liquor_body: "Medium, varied textures across tasting flights",
    wet_leaf_aroma: "Aromatic diverse spent tea leaves",
    wet_leaf_oxidation: "Varied light, medium, and heavy oxidations",
    brew_temp: 90,
    brew_seconds: 180,
    leaf_dose_grams: 2.5,
    water_ml: 200,
    steep_count: 3,
    steep_instructions: "Brew each tin per its individual guide included in the tasting flight box.",
    elevation_feet: 5000,
    elevation_display: "Various high-altitude Himalayan gardens",
    lot_number: "GF-DF/2026",
    cultivar: "Assorted heritage cultivars",
    estate_story: "A curated flight demonstrating the rich geographic diversity of Indian tea traditions. Illustrative demo copy.",
    featured: 1,
    variants: [
      { sku: "GF-DF-POUCH-100G", packaging_format: "loose_leaf_pouch", grams: 100, servings: 50, price_paise: 129900, stock: 30 },
      { sku: "GF-DF-POUCH-300G", packaging_format: "loose_leaf_pouch", grams: 300, servings: 150, price_paise: 349900, stock: 20 },
      { sku: "GF-DF-POUCH-500G", packaging_format: "loose_leaf_pouch", grams: 500, servings: 250, price_paise: 549900, stock: 12 },
      { sku: "GF-DF-POUCH-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, servings: 500, price_paise: 999900, stock: 5 },
      { sku: "GF-DF-TIN-100G", packaging_format: "luxury_tin", grams: 100, servings: 50, price_paise: 149900, stock: 25 },
      { sku: "GF-DF-TIN-300G", packaging_format: "luxury_tin", grams: 300, servings: 150, price_paise: 379900, stock: 15 },
      { sku: "GF-DF-TIN-500G", packaging_format: "luxury_tin", grams: 500, servings: 250, price_paise: 589900, stock: 4 },
      { sku: "GF-DF-TIN-1KG", packaging_format: "luxury_tin", grams: 1000, servings: 500, price_paise: 1069900, stock: 0 },
      { sku: "GF-DF-BAGS-25", packaging_format: "pyramid_bags", grams: 50, servings: 25, price_paise: 79900, stock: 40 },
      { sku: "GF-DF-BAGS-50", packaging_format: "pyramid_bags", grams: 100, servings: 50, price_paise: 144900, stock: 20 },
    ],
  },
];

const insertProduct = db.prepare(`
  INSERT INTO products (
    slug, name, category, origin, estate, flush, harvest_date,
    description, tasting_notes, floral, fruity, malty, body,
    sweetness, earthy, aroma_tags,
    dry_leaf_appearance, dry_leaf_grade, dry_leaf_aroma,
    liquor_hue_hex, liquor_hue_name, liquor_clarity, liquor_body,
    wet_leaf_aroma, wet_leaf_oxidation,
    brew_temp, brew_seconds,
    leaf_dose_grams, water_ml, steep_count, steep_instructions,
    elevation_feet, elevation_display, lot_number, cultivar, estate_story,
    featured
  ) VALUES (
    @slug, @name, @category, @origin, @estate, @flush, @harvest_date,
    @description, @tasting_notes, @floral, @fruity, @malty, @body,
    @sweetness, @earthy, @aroma_tags,
    @dry_leaf_appearance, @dry_leaf_grade, @dry_leaf_aroma,
    @liquor_hue_hex, @liquor_hue_name, @liquor_clarity, @liquor_body,
    @wet_leaf_aroma, @wet_leaf_oxidation,
    @brew_temp, @brew_seconds,
    @leaf_dose_grams, @water_ml, @steep_count, @steep_instructions,
    @elevation_feet, @elevation_display, @lot_number, @cultivar, @estate_story,
    @featured
  ) ON CONFLICT(slug) DO UPDATE SET
    name=excluded.name, category=excluded.category, origin=excluded.origin,
    estate=excluded.estate, flush=excluded.flush, harvest_date=excluded.harvest_date,
    description=excluded.description, tasting_notes=excluded.tasting_notes,
    floral=excluded.floral, fruity=excluded.fruity, malty=excluded.malty, body=excluded.body,
    sweetness=excluded.sweetness, earthy=excluded.earthy, aroma_tags=excluded.aroma_tags,
    dry_leaf_appearance=excluded.dry_leaf_appearance, dry_leaf_grade=excluded.dry_leaf_grade,
    dry_leaf_aroma=excluded.dry_leaf_aroma,
    liquor_hue_hex=excluded.liquor_hue_hex, liquor_hue_name=excluded.liquor_hue_name,
    liquor_clarity=excluded.liquor_clarity, liquor_body=excluded.liquor_body,
    wet_leaf_aroma=excluded.wet_leaf_aroma, wet_leaf_oxidation=excluded.wet_leaf_oxidation,
    brew_temp=excluded.brew_temp, brew_seconds=excluded.brew_seconds,
    leaf_dose_grams=excluded.leaf_dose_grams, water_ml=excluded.water_ml,
    steep_count=excluded.steep_count, steep_instructions=excluded.steep_instructions,
    elevation_feet=excluded.elevation_feet, elevation_display=excluded.elevation_display,
    lot_number=excluded.lot_number, cultivar=excluded.cultivar, estate_story=excluded.estate_story,
    featured=excluded.featured
`);

const getProduct = db.prepare("SELECT id FROM products WHERE slug=?");

const insertVariant = db.prepare(`
  INSERT INTO variants (
    product_id, sku, packaging_format, grams, servings, price_paise, stock
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?
  ) ON CONFLICT(sku) DO UPDATE SET
    product_id=excluded.product_id,
    packaging_format=excluded.packaging_format,
    grams=excluded.grams,
    servings=excluded.servings,
    price_paise=excluded.price_paise,
    stock=excluded.stock
`);

db.transaction(() => {
  for (const p of products) {
    const { variants, ...row } = p;
    insertProduct.run(row);
    const id = getProduct.get(p.slug).id;
    for (const v of variants) {
      insertVariant.run(
        id,
        v.sku,
        v.packaging_format,
        v.grams,
        v.servings,
        v.price_paise,
        v.stock
      );
    }
  }
})();

// Backfill category links for freshly seeded rows (idempotent).
try {
  const slugify = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "uncategorised";
  const hasCategories = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'").get();
  if (hasCategories) {
    const distinct = db.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> ''").all();
    const ins = db.prepare("INSERT OR IGNORE INTO categories (slug, name) VALUES (?, ?)");
    const link = db.prepare("UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = ?) WHERE category = ? AND (category_id IS NULL)");
    for (const row of distinct) {
      const slug = slugify(String(row.category));
      ins.run(slug, String(row.category).slice(0, 60));
      link.run(slug, row.category);
    }
  }
  const hasSliders = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (hasSliders && db.prepare("SELECT COUNT(*) AS n FROM sliders").get().n === 0) {
    db.prepare("INSERT INTO sliders (title, subtitle, image_url, cta_label, cta_href, sort_order, is_active) VALUES (?,?,?,?,?,?,?)").run(
      "A quieter way to discover fine tea", "Illustrative homepage slot — replace with verified campaign.",
      "/hero-tea.png", "Shop tea", "/shop", 0, 1
    );
  }
  const hasCoupons = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='coupons'").get();
  if (hasCoupons) {
    db.prepare("INSERT OR IGNORE INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES (?,?,?,?,?)").run(
      "WELCOME10", "percent", 10, 0, 1
    );
  }

  // Backfill dynamic media uploads, product images, categories, sliders & site placements (idempotent).
  const hasMediaUploads = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media_uploads'").get();
  if (hasMediaUploads) {
    const uploadsDir = path.resolve(process.cwd(), "public/uploads");
    const getFileSize = (name) => {
      try {
        return fs.statSync(path.join(uploadsDir, name)).size;
      } catch {
        return 102400;
      }
    };

    const demoAssets = [
      {
        filename: "ritual-hero.webp",
        original_name: "ritual-hero.webp",
        alt_text: "Decorative AI illustration of a ceramic tea cup, loose leaves and a botanical branch.",
        caption: "Closer to the garden, better in the cup hero visual",
        mime_type: "image/webp",
        sort_order: 0,
      },
      {
        filename: "ritual-story.webp",
        original_name: "ritual-story.webp",
        alt_text: "Decorative AI image of hands holding tea overlooking a mountain landscape.",
        caption: "Hands holding warm tea overlooking misty mountains at dawn",
        mime_type: "image/webp",
        sort_order: 1,
      },
      {
        filename: "hero-himalayan-tea.jpg",
        original_name: "hero-himalayan-tea.jpg",
        alt_text: "Fine tea cup against misty mountain shapes",
        caption: "High-altitude harvest in the morning mist",
        mime_type: "image/jpeg",
        sort_order: 2,
      },
      {
        filename: "bento-plantation.jpg",
        original_name: "bento-plantation.jpg",
        alt_text: "Lush single-estate tea bushes nestled in Himalayan ridges",
        caption: "Single estate terroir nestled in the Himalayan foothills",
        mime_type: "image/jpeg",
        sort_order: 1,
      },
      {
        filename: "bento-pluck.jpg",
        original_name: "bento-pluck.jpg",
        alt_text: "Freshly plucked two leaves and a bud in morning sun",
        caption: "Hand-crafted tender spring shoot plucking",
        mime_type: "image/jpeg",
        sort_order: 2,
      },
      {
        filename: "bento-blossom.jpg",
        original_name: "bento-blossom.jpg",
        alt_text: "Delicate wild Himalayan tea flowers in mountain bloom",
        caption: "Biodiverse estate terroir and natural pollination",
        mime_type: "image/jpeg",
        sort_order: 3,
      },
      {
        filename: "product-darjeeling-tin.jpg",
        original_name: "product-darjeeling-tin.jpg",
        alt_text: "Himalayan Tea House Darjeeling Luxury Caddy",
        caption: "Darjeeling single-estate luxury tin presentation",
        mime_type: "image/jpeg",
        sort_order: 10,
      },
      {
        filename: "product-assam-tin.jpg",
        original_name: "product-assam-tin.jpg",
        alt_text: "Himalayan Tea House Assam Orthodox Caddy",
        caption: "Brahmaputra valley orthodox malt reserve tin",
        mime_type: "image/jpeg",
        sort_order: 11,
      },
      {
        filename: "product-nilgiri-tin.jpg",
        original_name: "product-nilgiri-tin.jpg",
        alt_text: "Himalayan Tea House High-Grown Green & Oolong Caddy",
        caption: "High-mountain pristine garden selection tin",
        mime_type: "image/jpeg",
        sort_order: 12,
      },
      {
        filename: "product-herbal-tin.jpg",
        original_name: "product-herbal-tin.jpg",
        alt_text: "Himalayan Tea House Rare White & Botanical Caddy",
        caption: "Sun-dried silver needles and botanical infusion tin",
        mime_type: "image/jpeg",
        sort_order: 13,
      },
      {
        filename: "cat-black-tea.jpg",
        original_name: "cat-black-tea.jpg",
        alt_text: "Orthodox Black Tea collection",
        caption: "Rich orthodox black teas from premier estates",
        mime_type: "image/jpeg",
        sort_order: 20,
      },
      {
        filename: "cat-green-tea.jpg",
        original_name: "cat-green-tea.jpg",
        alt_text: "Himalayan High-Grown Green Tea",
        caption: "Steamed and pan-fired antioxidant rich green teas",
        mime_type: "image/jpeg",
        sort_order: 21,
      },
      {
        filename: "cat-oolong-tea.jpg",
        original_name: "cat-oolong-tea.jpg",
        alt_text: "Semi-oxidized Himalayan Oolong Tea",
        caption: "Artisanally rolled floral and fruity oolongs",
        mime_type: "image/jpeg",
        sort_order: 22,
      },
      {
        filename: "cat-herbal-infusions.jpg",
        original_name: "cat-herbal-infusions.jpg",
        alt_text: "Himalayan Herbal & White Tea",
        caption: "Naturally sweet and caffeine-free botanical infusions",
        mime_type: "image/jpeg",
        sort_order: 23,
      },
    ];

    const mediaStmt = db.prepare(`
      INSERT INTO media_uploads (
        filename, original_name, url, alt_text, caption, mime_type, file_size, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(filename) DO UPDATE SET
        original_name = excluded.original_name,
        url = excluded.url,
        alt_text = excluded.alt_text,
        caption = excluded.caption,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        sort_order = excluded.sort_order,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const a of demoAssets) {
      const size = getFileSize(a.filename);
      const url = `/uploads/${a.filename}`;
      mediaStmt.run(a.filename, a.original_name, url, a.alt_text, a.caption, a.mime_type, size, a.sort_order);
    }

    const getMedia = db.prepare("SELECT id, url, alt_text FROM media_uploads WHERE filename = ?");

    // Seed product_images
    const hasProductImages = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_images'").get();
    if (hasProductImages) {
      const productMap = [
        { tea_key: "darjeeling-spring", main: "product-darjeeling-tin.jpg", alt: "Darjeeling Spring Clonal First Flush Luxury Tin", gallery: "bento-pluck.jpg", gallAlt: "Harvesting tender spring terminal buds" },
        { tea_key: "summer-chinary-black", main: "product-darjeeling-tin.jpg", alt: "Darjeeling Summer Chinary Black Luxury Tin", gallery: "bento-plantation.jpg", gallAlt: "Risheehat south-facing summer ridges" },
        { tea_key: "assam-golden-breakfast", main: "product-assam-tin.jpg", alt: "Assam Golden Breakfast Orthodox Tin" },
        { tea_key: "assam-golden-tips", main: "product-assam-tin.jpg", alt: "Assam Golden Tips Single Estate Tin" },
        { tea_key: "masala-chai-reserve", main: "product-assam-tin.jpg", alt: "Masala Chai Reserve Spiced Orthodox Blend" },
        { tea_key: "kangra-green", main: "product-nilgiri-tin.jpg", alt: "Kangra Spring Green Orthodox Tea" },
        { tea_key: "nilgiri-mist-green", main: "product-nilgiri-tin.jpg", alt: "Nilgiri Frost Mist Green Tea Tin" },
        { tea_key: "giddapahar-oolong", main: "product-nilgiri-tin.jpg", alt: "Giddapahar Estate Himalayan Oolong Tin" },
        { tea_key: "himalayan-white-peony", main: "product-herbal-tin.jpg", alt: "Himalayan White Peony Spring Infusion" },
        { tea_key: "silver-needles-white", main: "product-herbal-tin.jpg", alt: "Imperial Silver Needles Sun-Dried White Tea" },
        { tea_key: "discovery-flight", main: "product-herbal-tin.jpg", alt: "Himalayan Terroir Discovery Sampler Flight", gallery: "bento-blossom.jpg", gallAlt: "Single-estate sampler tea flight" },
      ];

      const insertProdImg = db.prepare(`
        INSERT INTO product_images (product_id, media_id, url, alt_text, sort_order, is_primary)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const mapping of productMap) {
        const prod = getProduct.get(mapping.tea_key);
        if (!prod) continue;
        const mainMedia = getMedia.get(mapping.main);
        if (!mainMedia) continue;

        db.prepare("DELETE FROM product_images WHERE product_id = ?").run(prod.id);
        insertProdImg.run(prod.id, mainMedia.id, mainMedia.url, mapping.alt || mainMedia.alt_text, 0, 1);

        if (mapping.gallery) {
          const gallMedia = getMedia.get(mapping.gallery);
          if (gallMedia) {
            insertProdImg.run(prod.id, gallMedia.id, gallMedia.url, mapping.gallAlt || gallMedia.alt_text, 1, 0);
          }
        }
      }
    }

    // Seed site_placements
    const hasPlacements = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_placements'").get();
    if (hasPlacements) {
      const heroMedia = getMedia.get("ritual-hero.webp") || getMedia.get("hero-himalayan-tea.jpg");
      const storyMedia = getMedia.get("ritual-story.webp") || getMedia.get("bento-plantation.jpg");

      const upsertPlacement = db.prepare(`
        INSERT INTO site_placements (section_key, media_id, image_url, alt_text, title, subtitle, cta_label, cta_href, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(section_key) DO UPDATE SET
          media_id = excluded.media_id,
          image_url = excluded.image_url,
          alt_text = excluded.alt_text,
          title = excluded.title,
          subtitle = excluded.subtitle,
          cta_label = excluded.cta_label,
          cta_href = excluded.cta_href,
          updated_at = CURRENT_TIMESTAMP
      `);

      if (heroMedia) {
        upsertPlacement.run(
          "home_hero",
          heroMedia.id,
          heroMedia.url,
          "Decorative AI illustration of a ceramic tea cup, loose leaves and a botanical branch.",
          "Closer to the garden.",
          "Explore extraordinary tea through the language of origin, season and taste. A contemporary tea store made for slow moments.",
          "Shop tea",
          "/shop"
        );
      }
      if (storyMedia) {
        upsertPlacement.run(
          "home_story",
          storyMedia.id,
          storyMedia.url,
          "Decorative AI image of hands holding tea overlooking a mountain landscape.",
          "A little curious?",
          "A cup of tea is an invitation to slow down. Discover the flavours you love, explore the details behind each tea and make a small daily ritual your own.",
          "Discover our story",
          "/about"
        );
      }
    }

    // Link category covers
    if (hasCategories) {
      const catMediaMap = [
        { cat_key: "black", file: "cat-black-tea.jpg" },
        { cat_key: "green", file: "cat-green-tea.jpg" },
        { cat_key: "oolong", file: "cat-oolong-tea.jpg" },
        { cat_key: "white", file: "cat-herbal-infusions.jpg" },
      ];
      const updateCat = db.prepare("UPDATE categories SET media_id = ?, cover_image_url = ? WHERE slug = ?");
      for (const c of catMediaMap) {
        const m = getMedia.get(c.file);
        if (m) {
          updateCat.run(m.id, m.url, c.cat_key);
        }
      }
    }

    // Link slider image
    if (hasSliders) {
      const heroMedia = getMedia.get("hero-himalayan-tea.jpg");
      if (heroMedia) {
        db.prepare("UPDATE sliders SET media_id = ?, image_url = ? WHERE sort_order = 0").run(
          heroMedia.id,
          heroMedia.url
        );
      }
    }
  }
} catch {
  /* seed extras are best-effort; catalogue above is authoritative */
}

db.close();
console.log("Seeded", products.length, "illustrative products with 10 variants each. No provenance claims are verified.");
