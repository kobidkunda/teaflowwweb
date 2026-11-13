export interface FeedItem {
  id: string; // SKU
  itemGroupId: string; // Product slug
  item_group_id?: string;
  title: string;
  description: string;
  link: string; // Absolute URL
  imageLink: string; // Absolute URL
  image_link?: string;
  availability: "in_stock" | "out_of_stock";
  price: string; // e.g. "1299.00 INR"
  brand: string; // "Himalayan Tea House"
  condition: "new";
  googleProductCategory: string; // "Food, Beverages & Tobacco > Beverages > Tea & Infusions"
  google_product_category?: string;
  productType?: string;
  product_type?: string;
  packagingFormat?: string;
  sizeGrams?: number;
  stock: number;
  stock_count?: number;
  variant_sku?: string;
}

export type FeedCatalogItem = FeedItem;

export interface FeedOptions {
  originUrl?: string;
  baseUrl?: string;
}

export interface OpenAiFeedOptions {
  targetCountries?: string[];
  storeCountry?: string;
  isEligibleSearch?: boolean;
  isEligibleCheckout?: boolean;
  sellerName?: string;
  sellerUrl?: string;
}

export interface OpenAiFeedRecord {
  item_id: string;
  title: string;
  description: string;
  url: string;
  image_url: string;
  price: string;
  availability: "in_stock" | "out_of_stock";
  brand: string;
  seller_name: string;
  target_countries: string[];
  store_country: string;
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;
  item_group_id?: string;
  condition?: "new";
  product_category?: string;
  seller_url?: string;
  weight?: string;
  inventory_quantity?: number;
}
