import Database from "better-sqlite3";
import path from "node:path";

const file = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");
const db = new Database(file);

const articles = [
  {
    slug: "how-to-brew-assam-tea",
    title: "How to Brew Assam Orthodox Tea: Water Temperature, Leaf Dose, and Infusion Timing",
    summary: "Master the art of brewing whole-leaf Assam orthodox black tea to unlock rich malty depth without excessive astringency.",
    excerpt: "Assam orthodox tea requires mindful temperature control and leaf-to-water ratios to showcase its signature briskness and honeyed malt notes.",
    author_name: "Tashi Bhutia, Master Tea Sommelier",
    cover_image_url: "/images/assam-brewing-guide.jpg",
    status: "published",
    published_at: "2026-03-15 08:00:00",
    seo_title: "How to Brew Assam Orthodox Tea | Himalayan Tea House Brewing Guide",
    seo_description: "A comprehensive connoisseur guide to brewing single-estate Assam orthodox tea: ideal water temperature, steeping times, and mineral balance.",
    canonical_override: null,
    noindex: 0,
    content: `
# How to Brew Assam Orthodox Tea

Assam tea is globally renowned for its bold body, bright amber liquor, and distinctive malty profile. Produced in the low-elevation alluvial plains along the Brahmaputra River, whole-leaf orthodox teas differ dramatically from commodity CTC (crush-tear-curl) grades.

## Essential Steeping Parameters

* **Leaf Dose:** 2.5 grams (approx. 1 rounded teaspoon) per 200 ml of filtered water
* **Water Temperature:** 95°C to 98°C (just off the boil)
* **Steep Duration:** 3 to 4 minutes for first infusion; 4 to 5 minutes for second infusion
* **Vessel:** Preheated glazed ceramic or porcelain teapot

## Water Quality & Mineral Balance

Always brew with freshly drawn spring water or filtered tap water with a total dissolved solids (TDS) range between 50 and 120 ppm. Water that is too hard mutes the aromatic sweetness of the golden tips, while excessively soft water yields sharp astringency.

## Step-by-Step Brewing Ritual

1. **Warm the Vessel:** Rinse your teapot and teacup with boiling water to maintain thermal stability throughout extraction.
2. **Measure the Leaves:** Place 2.5g of whole leaves into the pot. Observe the dry leaf appearance and inhale the warm aroma before adding water.
3. **Pour Water:** Pour fresh 95°C water directly over the leaves in a gentle spiral. Cover immediately to retain essential volatile oils.
4. **Time Mindfully:** Decant fully at precisely 3.5 minutes. Never leave leaves sitting in residual liquid between infusions.
5. **Evaluate the Liquor:** Note the deep mahogany-orange hue and rich malt notes before taking your first sip.
    `.trim(),
  },
  {
    slug: "darjeeling-first-flush-guide",
    title: "Understanding Darjeeling First Flush: Elevation, Clonal Bushes, and Spring Aromatics",
    summary: "Discover why the spring first flush harvest of Darjeeling is revered worldwide as the 'Champagne of Teas'.",
    excerpt: "Plucked between late February and April following winter dormancy, first flush Darjeeling offers an exquisite light golden liquor with muscatel and floral tones.",
    author_name: "Sunil Pradhan, Estate Director",
    cover_image_url: "/images/darjeeling-first-flush.jpg",
    status: "published",
    published_at: "2026-04-02 09:30:00",
    seo_title: "Darjeeling First Flush Guide: Terroir, Flavour & Clonal Cultivars",
    seo_description: "Learn how high Himalayan elevations, winter dormancy, and clonal bushes shape the floral aromatics and golden hue of spring Darjeeling First Flush.",
    canonical_override: null,
    noindex: 0,
    content: `
# Understanding Darjeeling First Flush

Perched on the steep slopes of the Lesser Himalayas at elevations spanning 3,000 to 6,500 feet, Darjeeling tea gardens produce harvest flushes with unmatched sensory nuance.

## The Spring Awakening

Following months of winter chill, the tea bushes (*Camellia sinensis*) produce their tender first growth during spring. The young leaves and silvery terminal buds are plucked by hand in the early morning fog.

## Key Sensory Characteristics

* **Liquor Hue:** Pale champagne yellow to vibrant spun gold
* **Aroma Profile:** Fresh orchids, meadow grasses, tender muscat grape
* **Taste Profile:** Crisp vegetal freshness, lively brisk acidity, lingering honeysuckle finish

## Brewing Delicate First Flush Teas

Because first flush leaves undergo gentler oxidation than summer teas, water temperatures should be held at **85°C to 90°C** with a steep duration of **2.5 to 3 minutes**. Boiling water above 95°C risks scorching delicate catechins and imparting unnecessary bitterness.
    `.trim(),
  },
  {
    slug: "tea-cupping-guide",
    title: "Professional Tea Cupping: How to Evaluate Dry Leaf, Liquor Clarity, and Wet Leaf Aromatics",
    summary: "Step inside the tasting room: how certified tea tasters assess orthodox teas using standardized sensory protocols.",
    excerpt: "Sensory analysis follows a structured three-stage protocol: dry leaf inspection, liquor appearance and taste, followed by spent wet leaf aroma.",
    author_name: "Tashi Bhutia, Master Tea Sommelier",
    cover_image_url: "/images/cupping-guide.jpg",
    status: "published",
    published_at: "2026-05-10 11:00:00",
    seo_title: "Professional Tea Cupping Protocol | Sensory Evaluation Standards",
    seo_description: "A step-by-step masterclass in orthodox tea cupping: assessing dry leaf grade, liquor clarity, brightness, and wet leaf olfactory notes.",
    canonical_override: null,
    noindex: 0,
    content: `
# Professional Tea Cupping: The 3-Stage Protocol

In orthodox tea evaluation, standardized cupping bowls (typically 150ml with a serrated tasting lid) are used to eliminate variables and spotlight the authentic character of the harvest batch.

## Stage 1: Dry Leaf Examination

Inspect the unprocessed dried leaf for uniformity, style, tip presence, and color:
* **Twist and Tightness:** Well-rolled leaves indicate disciplined manufacturing.
* **Silver and Golden Tips:** Abundant pubescence on terminal buds signifies careful plucking.
* **Aroma:** Inhale deeply to identify clean floral, woody, or malty notes without sour or smoky taint.

## Stage 2: Liquor Appearance & Palate Assessment

* **Hue & Brightness:** Observe the meniscus under clean daylight. Clear, sparkling liquor denotes pristine processing; cloudy liquor may indicate improper withering or sorting.
* **Aspiration:** Slurp the tea with air to atomize droplets across the palate, engaging both retro-nasal olfactory receptors and taste buds.
* **Body & Mouthfeel:** Assess astringency, viscosity, and persistence of the finish.

## Stage 3: Wet Leaf (Spent Infusion)

The spent leaf reveals the true story of oxidation and terroir:
* Coppery-bright wet leaves denote clean orthodox black tea fermentation.
* Olive-green tones are typical of delicate first flush teas.
* Any dull or blackened fragments indicate temperature abuse during firing.
    `.trim(),
  },
  {
    slug: "orthodox-vs-ctc-tea",
    title: "Orthodox vs. CTC Tea: Manufacturing, Flavour Profiles, and Terroir Expression",
    summary: "Explore the fundamental differences between traditional whole-leaf orthodox manufacturing and machine-processed CTC tea.",
    excerpt: "Orthodox tea honors leaf integrity through gentle rolling, while CTC is designed for rapid brewing, intense tannin extraction, and milk chai blending.",
    author_name: "Anita Roy, Sourcing Specialist",
    cover_image_url: "/images/orthodox-vs-ctc.jpg",
    status: "published",
    published_at: "2026-06-20 14:15:00",
    seo_title: "Orthodox vs. CTC Tea: Differences, Processing & Taste Comparison",
    seo_description: "Compare orthodox whole-leaf tea with CTC tea: production methods, flavor complexity, brewing techniques, and best culinary pairings.",
    canonical_override: null,
    noindex: 0,
    content: `
# Orthodox vs. CTC Tea: The Complete Comparison

While both styles originate from the same tea plant, their processing methods diverge completely after the initial withering stage.

## Manufacturing Distinctions

### Orthodox Manufacturing
* **Withering:** Slow moisture reduction over 14–18 hours to make leaves pliable.
* **Rolling:** Gentle circular rolling machines bruise cell walls without shredding the leaf.
* **Oxidation:** Carefully monitored humidity chambers allow nuanced enzyme development.
* **Grading:** Whole leaves (FTGFOP, TGFOP), broken leaves (BOP), and fannings.

### CTC (Crush, Tear, Curl) Manufacturing
* **Rotovane & Rollers:** Withering is followed by counter-rotating cylindrical rollers with serrated teeth.
* **Maceration:** The leaf is instantaneously crushed, torn, and curled into tiny uniform pellets.
* **Oxidation:** Rapid, intense oxidation maximizing dark pigment and soluble tannins.

## Flavour Profiles & Consumption

* **Orthodox:** Complex, layered, nuanced aromatics suited for drinking straight without milk or sweeteners.
* **CTC:** Brisk, astringent, deep red liquor optimized for traditional masala chai, milk, and spices.
    `.trim(),
  },
];

const insertStmt = db.prepare(`
  INSERT INTO blog_posts (
    slug, title, summary, excerpt, content, cover_image_url,
    author_name, status, published_at, seo_title, seo_description,
    canonical_override, noindex, created_at, updated_at
  ) VALUES (
    @slug, @title, @summary, @excerpt, @content, @cover_image_url,
    @author_name, @status, @published_at, @seo_title, @seo_description,
    @canonical_override, @noindex, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
`);

const checkStmt = db.prepare("SELECT id FROM blog_posts WHERE slug = ?");
const updateStmt = db.prepare(`
  UPDATE blog_posts SET
    title = @title, summary = @summary, excerpt = @excerpt, content = @content,
    cover_image_url = @cover_image_url, author_name = @author_name,
    status = @status, published_at = @published_at, seo_title = @seo_title,
    seo_description = @seo_description, canonical_override = @canonical_override,
    noindex = @noindex, updated_at = CURRENT_TIMESTAMP
  WHERE slug = @slug
`);

db.transaction(() => {
  for (const article of articles) {
    const existing = checkStmt.get(article.slug);
    if (existing) {
      updateStmt.run(article);
      console.log(`Updated article: ${article.slug}`);
    } else {
      insertStmt.run(article);
      console.log(`Inserted article: ${article.slug}`);
    }
  }
})();

console.log("Seeded educational articles successfully.");
