export interface CtcMethodStage {
  step: string;
  id: string;
  name: string;
  tagline: string;
  eyebrow: string;
  title: string;
  description: string;
  insight: string;
  topBadge: string;
  caption: string;
  image: string;
  alt: string;
  accentBg: string;
  flavorNotes: string[];
  brewTimeMinutes: number;
  idealTemp: string;
  flameLevel: "Low Simmer" | "Rolling Boil" | "Gentle Steep" | "High Flame" | "Chilled Aeration";
  ratios: {
    baseServings: number;
    waterMl: number;
    milkMl: number;
    ctcGrams: number;
    ctcTeaspoons: string;
    sweetenerDefault: string;
    spiceNotes: string;
  };
  steps: string[];
  equipment: string[];
  pairing: string;
}
