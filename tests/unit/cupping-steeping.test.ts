import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CuppingProfile,
  clampSensoryScore,
  calculateScorePercentage,
} from "../../src/components/CuppingProfile";
import {
  SteepingGuide,
  calculateSteepingMetrics,
  formatBrewDuration,
} from "../../src/components/SteepingGuide";

import { parseAromaTags } from "../../src/lib/products";
import type { Product } from "../../src/lib/products";

// Sample mock product fixture matching seeded connoisseur data
const mockProduct: Product = {
  id: 101,
  slug: "darjeeling-spring-first-flush",
  name: "Darjeeling Spring Clonal First Flush",
  category: "Black",
  category_id: 1,
  origin: "Darjeeling, West Bengal, India",
  estate: "Risheehat Tea Estate",
  flush: "First Flush",
  harvest_date: "March–April 2026",
  description: "Tender terminal shoots harvested in the misty upper ridges of Kurseong East valley.",
  tasting_notes: "Wildflower honey, Muscatel grape, green peach, spring pine",
  floral: 5,
  fruity: 4,
  malty: 1,
  body: 2,
  sweetness: 4,
  earthy: 1,
  aroma_tags: ["Muscatel", "Wild Honey", "Spring Peach", "Alpine Orchid", "Dewy Pine"],
  dry_leaf_appearance: "Well-twisted wiry olive-green whole leaves with a generous bloom of downy silver tips",
  dry_leaf_grade: "FTGFOP1",
  dry_leaf_aroma: "Crisp alpine air, crushed orchid blossoms, and freshly mown mountain meadow",
  liquor_hue_hex: "#e29d42",
  liquor_hue_name: "Sunlit Amber Gold",
  liquor_clarity: "Brilliant crystalline translucence with radiant golden halo",
  liquor_body: "Light to medium-bodied, champagne-like effervescence and brisk, clean astringency",
  wet_leaf_aroma: "Sweet poached stone fruit, dewy marigolds, and pine blossom",
  wet_leaf_oxidation: "Light ~15–20% oxidation; vivid jade-olive leaf matrix",
  brew_temp: 85,
  brew_seconds: 180,
  leaf_dose_grams: 2.5,
  water_ml: 200,
  steep_count: 3,
  steep_instructions: "Heat fresh filtered spring water to 85°C. Steep 2.5g in 200ml for 3 minutes. Decant fully; add 30s for subsequent steeps.",
  elevation_feet: 5800,
  elevation_display: "4,500 – 6,800 ft (1,370 – 2,070 m)",
  lot_number: "DJ/EX-02/2026 (Demo Lot)",
  cultivar: "Camellia sinensis var. sinensis (AV2 Clonal Selection)",
  estate_story: "Perched in the mist-crowned valley east of Darjeeling town, celebrated for steep slopes rising above 6,000 feet.",
  featured: 1,
  variants: [],
};

describe("Suite 1: Steeping Multiplier Math & Calculations", () => {
  it("calculates 1 cup baseline leaf dose and water volume accurately", () => {
    const metrics = calculateSteepingMetrics(1, 2.5, 200);
    expect(metrics.servings).toBe(1);
    expect(metrics.leafGrams).toBe(2.5);
    expect(metrics.waterMl).toBe(200);
    expect(metrics.leafGramsDisplay).toBe("2.5g");
    expect(metrics.waterMlDisplay).toBe("200ml");
  });

  it("scales leaf dose and water volume for 2 cups proportionally", () => {
    const metrics = calculateSteepingMetrics(2, 2.5, 200);
    expect(metrics.servings).toBe(2);
    expect(metrics.leafGrams).toBe(5.0);
    expect(metrics.waterMl).toBe(400);
    expect(metrics.leafGramsDisplay).toBe("5.0g");
    expect(metrics.waterMlDisplay).toBe("400ml");
  });

  it("scales leaf dose and water volume for 3 cups proportionally", () => {
    const metrics = calculateSteepingMetrics(3, 2.5, 200);
    expect(metrics.servings).toBe(3);
    expect(metrics.leafGrams).toBe(7.5);
    expect(metrics.waterMl).toBe(600);
    expect(metrics.leafGramsDisplay).toBe("7.5g");
    expect(metrics.waterMlDisplay).toBe("600ml");
  });

  it("scales leaf dose and water volume for 4 cups (maximum boundary)", () => {
    const metrics = calculateSteepingMetrics(4, 2.5, 200);
    expect(metrics.servings).toBe(4);
    expect(metrics.leafGrams).toBe(10.0);
    expect(metrics.waterMl).toBe(800);
    expect(metrics.leafGramsDisplay).toBe("10.0g");
    expect(metrics.waterMlDisplay).toBe("800ml");
  });

  it("clamps lower boundary: servings cannot be decremented below 1 cup", () => {
    const mZero = calculateSteepingMetrics(0, 2.5, 200);
    expect(mZero.servings).toBe(1);
    expect(mZero.leafGrams).toBe(2.5);
    expect(mZero.waterMl).toBe(200);

    const mNegative = calculateSteepingMetrics(-3, 2.5, 200);
    expect(mNegative.servings).toBe(1);
    expect(mNegative.leafGrams).toBe(2.5);
  });

  it("clamps upper boundary: servings cannot exceed 4 cups", () => {
    const mFive = calculateSteepingMetrics(5, 2.5, 200);
    expect(mFive.servings).toBe(4);
    expect(mFive.leafGrams).toBe(10.0);
    expect(mFive.waterMl).toBe(800);

    const mTen = calculateSteepingMetrics(10, 2.5, 200);
    expect(mTen.servings).toBe(4);
    expect(mTen.leafGrams).toBe(10.0);
    expect(mTen.waterMl).toBe(800);
  });

  it("maintains single-decimal precision for leaf doses avoiding floating point drift", () => {
    // 3 * 2.3 = 6.8999999999999995 in naive JS float
    const metrics = calculateSteepingMetrics(3, 2.3, 200);
    expect(metrics.leafGrams).toBe(6.9);
    expect(metrics.leafGramsDisplay).toBe("6.9g");
    expect(metrics.leafGramsDisplay).not.toMatch(/\d+\.\d{3,}g/);
  });

  it("formats brew duration into human-readable minutes and seconds", () => {
    expect(formatBrewDuration(180)).toBe("3 min (180s)");
    expect(formatBrewDuration(240)).toBe("4 min (240s)");
    expect(formatBrewDuration(150)).toBe("2 min 30s (150s)");
    expect(formatBrewDuration(45)).toBe("45s");
    expect(formatBrewDuration(0)).toBe("3 min (180s)"); // fallback
  });
});

describe("Suite 2: Sensory Score Clamping & Cupping Logic", () => {
  it("clamps valid integer scores within 0 to 5", () => {
    expect(clampSensoryScore(0)).toBe(0);
    expect(clampSensoryScore(3)).toBe(3);
    expect(clampSensoryScore(5)).toBe(5);
  });

  it("clamps negative values to 0", () => {
    expect(clampSensoryScore(-1)).toBe(0);
    expect(clampSensoryScore(-99)).toBe(0);
  });

  it("clamps values greater than 5 to 5", () => {
    expect(clampSensoryScore(6)).toBe(5);
    expect(clampSensoryScore(100)).toBe(5);
  });

  it("handles null, undefined, NaN, and string scores safely", () => {
    expect(clampSensoryScore(null)).toBe(0);
    expect(clampSensoryScore(undefined)).toBe(0);
    expect(clampSensoryScore("not-a-number")).toBe(0);
    expect(clampSensoryScore("4")).toBe(4);
    expect(clampSensoryScore(3.7)).toBe(4);
  });

  it("computes accurate proportional progressbar percentages", () => {
    expect(calculateScorePercentage(0)).toBe(0);
    expect(calculateScorePercentage(1)).toBe(20);
    expect(calculateScorePercentage(2.5)).toBe(60); // rounds to 3 => 60%
    expect(calculateScorePercentage(3)).toBe(60);
    expect(calculateScorePercentage(5)).toBe(100);
  });
});

describe("Suite 3: Aroma Tags Parsing & Chip Sanitization", () => {
  it("deserializes JSON array string correctly", () => {
    const raw = JSON.stringify(["Muscatel", "Spring Peach", "Wild Honey"]);
    const tags = parseAromaTags(raw);
    expect(tags).toEqual(["Muscatel", "Spring Peach", "Wild Honey"]);
  });

  it("passes native string arrays untouched while trimming whitespace", () => {
    const tags = parseAromaTags(["  Muscatel  ", "Woody ", ""]);
    expect(tags).toEqual(["Muscatel", "Woody"]);
  });

  it("parses comma-separated fallback string when JSON parsing fails", () => {
    const tags = parseAromaTags("Peach, Honey, Pine, Orchids");
    expect(tags).toEqual(["Peach", "Honey", "Pine", "Orchids"]);
  });

  it("returns empty array for null, undefined, empty string, or empty JSON array", () => {
    expect(parseAromaTags(null)).toEqual([]);
    expect(parseAromaTags(undefined)).toEqual([]);
    expect(parseAromaTags("")).toEqual([]);
    expect(parseAromaTags("   ")).toEqual([]);
    expect(parseAromaTags("[]")).toEqual([]);
  });

  it("handles single aroma tag cleanly without malformed markup", () => {
    const tags = parseAromaTags(JSON.stringify(["Muscatel"]));
    expect(tags).toHaveLength(1);
    expect(tags[0]).toBe("Muscatel");
  });
});

describe("Suite 5: Component HTML Rendering & Semantic Accessibility", () => {
  it("renders CuppingProfile with all 3 stages, 6 sensory bars, and aroma chips", () => {
    const html = renderToStaticMarkup(
      React.createElement(CuppingProfile, { product: mockProduct })
    );

    // Stage 1: Dry Leaf
    expect(html).toMatch(/dry leaf/i);
    expect(html).toMatch(/FTGFOP1/);
    expect(html).toMatch(/appearance/i);
    expect(html).toMatch(/aroma/i);

    // Stage 2: Liquor
    expect(html).toMatch(/liquor/i);
    expect(html).toMatch(/data-testid="liquor-swatch"/);
    expect(html).toMatch(/liquor-swatch/);
    expect(html).toMatch(/background-color:#e29d42/i);
    expect(html).toMatch(/Sunlit Amber Gold/);
    expect(html).toMatch(/clarity/i);
    expect(html).toMatch(/body/i);

    // Stage 3: Wet Leaf
    expect(html).toMatch(/wet leaf/i);
    expect(html).toMatch(/spent leaf/i);
    expect(html).toMatch(/oxidation/i);

    // 6-Axis Sensory Profile
    expect(html).toMatch(/data-testid="taste-map"/);
    expect(html).toMatch(/taste-map/);
    expect(html).toMatch(/Floral/);
    expect(html).toMatch(/Fruity/);
    expect(html).toMatch(/Malty/);
    expect(html).toMatch(/Body/);
    expect(html).toMatch(/Sweetness/);
    expect(html).toMatch(/Earthy/);
    expect(html).toMatch(/role="progressbar"/);
    expect(html).toMatch(/aria-valuenow="5"/); // Floral is 5
    expect(html).toMatch(/aria-valuenow="4"/); // Fruity is 4

    // Aroma tags
    expect(html).toMatch(/data-testid="aroma-tag"/);
    expect(html).toMatch(/aroma-tag/);
    expect(html).toMatch(/Muscatel/);
    expect(html).toMatch(/Wild Honey/);

    // Tasting notes uppercase
    expect(html).toMatch(/data-testid="pdp-notes"/);
    expect(html).toMatch(/WILDFLOWER HONEY/);
  });

  it("renders SteepingGuide with interactive serving multiplier, scaled values, and invariants", () => {
    const html = renderToStaticMarkup(
      React.createElement(SteepingGuide, { product: mockProduct })
    );

    // Header & multiplier controls
    expect(html).toMatch(/steeping guide/i);
    expect(html).toMatch(/data-testid="cup-multiplier"/);
    expect(html).toMatch(/data-cups="1"/);
    expect(html).toMatch(/data-cups="2"/);
    expect(html).toMatch(/data-cups="3"/);
    expect(html).toMatch(/data-cups="4"/);
    expect(html).toMatch(/aria-label="Decrease servings"/);
    expect(html).toMatch(/aria-label="Increase servings"/);

    // Baseline values for 1 cup
    expect(html).toMatch(/2\.5g/);
    expect(html).toMatch(/200ml/);

    // Invariants
    expect(html).toMatch(/85°C/);
    expect(html).toMatch(/3 min \(180s\)/);

    // Resteeping & Teaware
    expect(html).toMatch(/3 Infusions/);
    expect(html).toMatch(/re-steep/i);
    expect(html).not.toMatch(/porcelain/i);
    expect(html).not.toMatch(/Recommended Teaware/i);
  });

  it("handles empty / fallback props defensively across all three components", () => {
    const cuppingHtml = renderToStaticMarkup(
      React.createElement(CuppingProfile)
    );
    expect(cuppingHtml).toMatch(/dry leaf/i);
    expect(cuppingHtml).toMatch(/liquor/i);
    expect(cuppingHtml).toMatch(/wet leaf/i);

    const steepingHtml = renderToStaticMarkup(
      React.createElement(SteepingGuide)
    );
    expect(steepingHtml).toMatch(/steeping guide/i);
    expect(steepingHtml).toMatch(/2\.5g/);
    expect(steepingHtml).toMatch(/200ml/);


  });
});
