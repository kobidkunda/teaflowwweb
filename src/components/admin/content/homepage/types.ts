import type { HomepageContent } from "@/lib/homepageSchema";

export type HomepageTab =
  | "hero"
  | "discovery"
  | "shelf"
  | "trials"
  | "story"
  | "benefits"
  | "reviews"
  | "newsletter"
  | "navigation"
  | "preview";

export interface CategoryOption {
  id: number;
  name: string;
}

export type { HomepageContent };
