export interface ComparisonItem {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  teaA: {
    name: string;
    origin: string;
    flavor: string;
    pairing: string;
    sampleSlug: string;
  };
  teaB: {
    name: string;
    origin: string;
    flavor: string;
    pairing: string;
    sampleSlug: string;
  };
}

export const COMPARISONS_DATA: ComparisonItem[] = [
  {
    slug: "assam-vs-darjeeling-tea",
    title: "Assam vs. Darjeeling Tea: Soil, Elevation, Malty Strength vs. Muscatel Nuance",
    subtitle: "Lowland River Alluvium vs. High-Mountain Himalayan Slopes",
    summary:
      "A detailed terroir and flavour comparison between bold, malty Assam whole-leaf orthodox teas and delicate, muscatel-rich Darjeeling harvests.",
    teaA: {
      name: "Assam Orthodox Black",
      origin: "Brahmaputra Valley, Assam (50–120m)",
      flavor: "Deep malt, honey, caramelized dates, brisk body",
      pairing: "Hearty breakfast, dark chocolate, spicy savory pastries",
      sampleSlug: "assam-golden-breakfast",
    },
    teaB: {
      name: "Darjeeling Orthodox Black",
      origin: "Lesser Himalayas, Darjeeling (1,000–2,000m)",
      flavor: "Floral muscatel, green almond, white grape, crisp finish",
      pairing: "Afternoon reflection, mild cheese, fruit tartlets",
      sampleSlug: "darjeeling-spring",
    },
  },
  {
    slug: "orthodox-vs-green-tea",
    title: "Himalayan Orthodox Black vs. High-Mountain Green Tea",
    subtitle: "Fully Oxidized Depth vs. Unoxidized Catechin Freshness",
    summary:
      "Understand the difference in oxidation chemistry, polyphenols, caffeine extraction, and tasting profile between orthodox black and pristine green teas.",
    teaA: {
      name: "Himalayan Orthodox Black",
      origin: "Darjeeling / Assam",
      flavor: "Fully oxidized, amber liquor, floral & malty nuances",
      pairing: "Morning energy, rich savory foods",
      sampleSlug: "summer-chinary-black",
    },
    teaB: {
      name: "High-Mountain Green Tea",
      origin: "Kangra / Nilgiri",
      flavor: "Pan-fired/steamed, jade liquor, sweet pea, vegetative sweetness",
      pairing: "Post-meal digestion, light salads, steamed vegetables",
      sampleSlug: "nilgiri-mist-green",
    },
  },
  {
    slug: "first-flush-vs-second-flush",
    title: "First Flush vs. Second Flush Darjeeling: Spring Freshness vs. Summer Muscatel",
    subtitle: "Vernal Awakening vs. Summer Sun & Leafhopper Nuance",
    summary:
      "Compare spring First Flush (light golden, floral, vegetal snap) with summer Second Flush (amber liquor, ripe fruit, signature muscatel complexity).",
    teaA: {
      name: "Spring First Flush",
      origin: "March–April harvest",
      flavor: "Light champagne hue, fresh peach, spring orchids, crisp briskness",
      pairing: "Delicate pastries, morning meditation",
      sampleSlug: "darjeeling-spring",
    },
    teaB: {
      name: "Summer Second Flush",
      origin: "May–June harvest",
      flavor: "Rich amber liquor, ripe muscat grape, roasted almond, velvety body",
      pairing: "Scones with clotted cream, afternoon tea service",
      sampleSlug: "summer-chinary-black",
    },
  },
];
