import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(path.resolve("./data/store.sqlite"));

// 1. Enrich how-to-brew-assam-tea
const assamContent = `
# How to Brew Assam Orthodox Tea

Assam tea is globally renowned for its bold body, bright amber liquor, and distinctive malty profile. Produced in the low-elevation alluvial plains along the Brahmaputra River, whole-leaf orthodox teas differ dramatically from commodity CTC (crush-tear-curl) grades.

\`\`\`figure
{
  "url": "/images/assam-brewing-guide.jpg",
  "caption": "Hand-crafted whole leaf Assam orthodox with characteristic golden tips",
  "credit": "Teafloww Single-Estate Archives"
}
\`\`\`

## Interactive Steeping Assistant

Use the live timer below to precisely calibrate water temperature, leaf dose, and extraction duration.

\`\`\`steep-guide
{
  "title": "Assam Orthodox Steeping Ritual",
  "temp_c": 96,
  "time_seconds": 210,
  "dose_g": 2.5,
  "water_ml": 200,
  "steeps": 3,
  "tips": "Always preheat your teapot with boiling water. Decant completely at 3.5 minutes to avoid bitterness."
}
\`\`\`

## Sensory Flavour Profile & Cupping Radar

Assam orthodox whole leaves are distinguished by heavy caramel malt, honeycomb sweetness, and brisk liquor body.

\`\`\`tasting-radar
{
  "title": "Assam Orthodox Cupping Radar",
  "scores": {
    "malty": 5,
    "body": 5,
    "sweetness": 4,
    "floral": 2,
    "fruity": 2,
    "earthy": 3
  }
}
\`\`\`

## Terroir & Elevation Comparison

Unlike the misty 6,000 ft peaks of Darjeeling, Assam tea flourishes in rich alluvial plains with heavy monsoon precipitation.

\`\`\`chart
{
  "type": "bar",
  "title": "Regional Terroir Elevation (ft)",
  "subtitle": "Comparison of tea-growing elevations across Eastern India",
  "data": [
    {"label": "Brahmaputra Valley (Assam)", "value": 600, "unit": "ft"},
    {"label": "Dooars Alluvial Plains", "value": 750, "unit": "ft"},
    {"label": "Terai Foothills", "value": 1100, "unit": "ft"},
    {"label": "Darjeeling Valley", "value": 4500, "unit": "ft"},
    {"label": "Darjeeling High Peak", "value": 6800, "unit": "ft"}
  ],
  "unit": "ft"
}
\`\`\`

## Recommended Garden Lot Pairing

To experience this profile at its peak, we recommend our single-estate Assam Heritage Golden Tips.

\`\`\`product
{
  "slug": "assam-golden-tips",
  "highlight": "Master Blender Recommendation"
}
\`\`\`

\`\`\`callout
{
  "type": "tip",
  "title": "Master Blender Steeping Secret",
  "text": "Never leave orthodox leaves sitting in residual liquid between infusions. Decant 100% of the liquor into a serving pitcher to preserve the fresh aroma of subsequent steeps."
}
\`\`\`

## Step-by-Step Brewing Ritual

1. **Warm the Vessel:** Rinse your teapot and teacup with boiling water to maintain thermal stability throughout extraction.
2. **Measure the Leaves:** Place 2.5g of whole leaves into the pot. Observe the dry leaf appearance and inhale the warm aroma before adding water.
3. **Pour Water:** Pour fresh 95°C-98°C water directly over the leaves in a gentle spiral. Cover immediately to retain essential volatile oils.
4. **Time Mindfully:** Decant fully at precisely 3.5 minutes.
5. **Evaluate the Liquor:** Note the deep mahogany-orange hue and rich malt notes before taking your first sip.
`.trim();

// 2. Enrich darjeeling-first-flush-guide
const darjeelingContent = `
# Understanding Darjeeling First Flush: Elevation, Clonal Bushes, and Spring Aromatics

Known as the champagne of teas, Darjeeling First Flush is harvested between late February and April following the mountain spring thaw. The tender first growth leaves yield an ethereal, light golden liquor teeming with floral notes, muscatel grape, and fresh spring greens.

\`\`\`figure
{
  "url": "/images/darjeeling-first-flush.jpg",
  "caption": "Delicate two leaves and a bud harvested from high-elevation Darjeeling bushes",
  "credit": "Teafloww Single-Estate Archives"
}
\`\`\`

## Precision Steeping Parameters

First Flush leaves are delicate and require cooler water than autumnal teas to protect volatile linalool floral aromatics.

\`\`\`steep-guide
{
  "title": "Spring First Flush Infusion Guide",
  "temp_c": 88,
  "time_seconds": 180,
  "dose_g": 2.5,
  "water_ml": 200,
  "steeps": 3,
  "tips": "Water temperature must not exceed 90°C. Boiling water scorches tender spring buds and unleashes astringency."
}
\`\`\`

## Sensory Flavour Wheel & Cupping Radar

First Flush tea cupping emphasizes high floral perfume, muscatel grape sweetness, and a light-to-medium champagne body.

\`\`\`tasting-radar
{
  "title": "Spring Blossom Sensory Cupping Radar",
  "scores": {
    "floral": 5,
    "fruity": 5,
    "sweetness": 4,
    "body": 3,
    "malty": 1,
    "earthy": 1
  }
}
\`\`\`

## Elevation & Aroma Volatiles

Darjeeling’s extreme elevation creates daily temperature swings that force bushes into slow growth, concentrating aromatic secondary metabolites.

\`\`\`chart
{
  "type": "bar",
  "title": "Aroma Ester Concentration by Harvest Season (%)",
  "subtitle": "Volatile terpene alcohol levels across flushes",
  "data": [
    {"label": "Spring First Flush", "value": 88, "unit": "%"},
    {"label": "Summer Second Flush (Muscatel)", "value": 76, "unit": "%"},
    {"label": "Monsoon Flush", "value": 34, "unit": "%"},
    {"label": "Autumnal Harvest", "value": 62, "unit": "%"}
  ],
  "unit": "%"
}
\`\`\`

## Featured Tea Pairing

\`\`\`product
{
  "slug": "darjeeling-spring",
  "highlight": "Featured Spring Lot"
}
\`\`\`

\`\`\`callout
{
  "type": "origin",
  "title": "Single-Estate Terroir Note",
  "text": "Darjeeling clonal cultivars (such as AV2 and B157) harvested at elevations above 5,000 feet yield distinct floral notes reminiscent of white lilies and raw Himalayan wildflower honey."
}
\`\`\`
`.trim();

db.prepare("UPDATE blog_posts SET content = ?, cover_image_url = ? WHERE slug = 'how-to-brew-assam-tea'").run(
  assamContent,
  "/images/assam-brewing-guide.jpg"
);

db.prepare("UPDATE blog_posts SET content = ?, cover_image_url = ? WHERE slug = 'darjeeling-first-flush-guide'").run(
  darjeelingContent,
  "/images/darjeeling-first-flush.jpg"
);

console.log("Successfully enriched sample articles with interactive widgets!");
