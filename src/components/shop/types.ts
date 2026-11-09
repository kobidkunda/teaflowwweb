
export type ViewMode = "grid" | "dossier";

export type SortOption =
  | "featured"
  | "price_asc"
  | "price_desc"
  | "elevation_desc"
  | "temp_asc"
  | "name_asc";

export interface ShopFilterState {
  q: string;
  category: string;
  region: string;
  flush: string;
  flavor: string;
  elevation: string;
  featuredOnly: boolean;
  inStockOnly: boolean;
  priceRange?: string;
  sortBy: SortOption;
  viewMode: ViewMode;
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
}
