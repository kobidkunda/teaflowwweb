export interface FeedItem {
  id: string; // SKU
  itemGroupId: string; // Product slug
  item_group_id?: string;
  entityType?: "product" | "trial" | "packaging";
  title: string;
  description: string;
  link: string; // Absolute URL
  imageLink: string; // Absolute URL
  image_link?: string;
  availability: "in_stock" | "out_of_stock";
  price: string; // e.g. "1299.00 INR"
  salePrice?: string; // e.g. "999.00 INR"
  brand: string; // e.g. "TeaFloww"
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
  shippingPrice?: string; // e.g. "0.00 INR" or "149.00 INR"
  shippingCountry?: string; // e.g. "IN"
  minHandlingTime?: number;
  maxHandlingTime?: number;
  minTransitTime?: number;
  maxTransitTime?: number;
  acceptsReturns?: boolean;
  returnWindowDays?: number;
  returnFees?: string;
  returnPolicyUrl?: string;
  returnPolicyLabel?: string;
  reviewCount?: number;
  starRating?: number;
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
  sale_price?: string;
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
  shipping?: string;
  shipping_price?: string;
  delivery_estimate?: string;
  min_handling_time?: number;
  max_handling_time?: number;
  min_transit_time?: number;
  max_transit_time?: number;
  accepts_returns?: boolean;
  return_window?: number;
  return_policy?: string;
  review_count?: number;
  star_rating?: string;
}

export type GoogleLocalPickupMethod =
  | "buy"
  | "reserve"
  | "ship to store"
  | "not supported";

export type GoogleLocalPickupSla =
  | "same_day"
  | "next_day"
  | "2-day"
  | "3-day"
  | "4-day"
  | "5-day"
  | "6-day"
  | "multi-week";

export interface GoogleLocalInventoryConfig {
  storeCode: string;
  pickupMethod?: GoogleLocalPickupMethod;
  pickupSla?: GoogleLocalPickupSla;
}

export interface GoogleLocalInventoryItem {
  storeCode: string;
  id: string;
  availability: "in_stock" | "out_of_stock";
  price: string;
  quantity: number;
  pickupMethod?: GoogleLocalPickupMethod;
  pickupSla?: GoogleLocalPickupSla;
}
