// Per-entity admin UI config. Mirrors the §3 Zod schemas; no prices/stock defaults trusted.
export type FieldType = "text" | "number" | "checkbox" | "select" | "textarea" | "datetime";
export type Field = { name: string; label: string; type: FieldType; required?: boolean; options?: string[]; hint?: string };
export type EntityConfig = {
  entity: string; title: string; listKey: string; base: string;
  idField: string; columns: { key: string; label: string }[];
  fields: Field[]; readOnly?: boolean; deletable?: boolean;
};
export const ENTITIES: Record<string, EntityConfig> = {
  products: {
    entity: "products", title: "Products", listKey: "products", base: "/api/admin/products",
    idField: "id",
    columns: [{ key: "id", label: "ID" }, { key: "slug", label: "Slug" }, { key: "name", label: "Name" }, { key: "category", label: "Family" }],
    fields: [
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "category", label: "Tea family (legacy label)", type: "text", required: true },
      { name: "category_id", label: "Category ID", type: "number" },
      { name: "origin", label: "Origin", type: "text", required: true },
      { name: "estate", label: "Estate", type: "text", required: true },
      { name: "flush", label: "Flush", type: "text", required: true },
      { name: "harvest_date", label: "Harvest date", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "tasting_notes", label: "Tasting notes", type: "text", required: true },
      { name: "floral", label: "Floral (0–5)", type: "number" },
      { name: "fruity", label: "Fruity (0–5)", type: "number" },
      { name: "malty", label: "Malty (0–5)", type: "number" },
      { name: "body", label: "Body (0–5)", type: "number" },
      { name: "brew_temp", label: "Brew temp °C (50–100)", type: "number", required: true },
      { name: "brew_seconds", label: "Brew seconds (30–600)", type: "number", required: true },
      { name: "featured", label: "Featured", type: "checkbox" },
    ],
  },
  variants: {
    entity: "variants", title: "Variants & Inventory", listKey: "variants", base: "/api/admin/variants",
    idField: "id",
    columns: [{ key: "id", label: "ID" }, { key: "sku", label: "SKU" }, { key: "product_id", label: "Product" }, { key: "packaging_format", label: "Packaging" }, { key: "grams", label: "Grams" }, { key: "price_paise", label: "Price (paise)" }, { key: "stock", label: "Stock" }],
    fields: [
      { name: "product_id", label: "Product ID", type: "number", required: true },
      { name: "sku", label: "SKU (A-Z, 0-9, hyphens)", type: "text", required: true },
      { name: "packaging_format", label: "Packaging format", type: "select", options: ["loose_leaf_pouch", "luxury_tin", "pyramid_bags"], required: true },
      { name: "grams", label: "Grams", type: "number", required: true },
      { name: "servings", label: "Servings (cups)", type: "number", required: true },
      { name: "price_paise", label: "Price (paise)", type: "number", required: true },
      { name: "stock", label: "Stock", type: "number", required: true },
    ],
  },
  categories: {
    entity: "categories", title: "Categories", listKey: "categories", base: "/api/admin/categories",
    idField: "id",
    columns: [{ key: "id", label: "ID" }, { key: "slug", label: "Slug" }, { key: "name", label: "Name" }, { key: "cover_image_url", label: "Cover Image" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "cover_image_url", label: "Cover image URL", type: "text", hint: "Image URL for homepage category circle and cards" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "is_active", label: "Active", type: "checkbox" },
    ],
  },
  "product-images": {
    entity: "product-images", title: "Product images", listKey: "images", base: "/api/admin/product-images",
    idField: "id",
    columns: [{ key: "id", label: "ID" }, { key: "product_id", label: "Product" }, { key: "url", label: "URL" }, { key: "alt_text", label: "Alt text" }, { key: "is_primary", label: "Primary" }],
    fields: [
      { name: "product_id", label: "Product ID", type: "number", required: true },
      { name: "url", label: "Image URL (site-relative or https)", type: "text", required: true },
      { name: "alt_text", label: "Alt text (accessibility)", type: "text", required: true, hint: "Describe the image for screen readers." },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "is_primary", label: "Primary image", type: "checkbox" },
    ],
  },
  sliders: {
    entity: "sliders", title: "Sliders", listKey: "sliders", base: "/api/admin/sliders",
    idField: "id",
    columns: [{ key: "id", label: "ID" }, { key: "title", label: "Title" }, { key: "sort_order", label: "Order" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "subtitle", label: "Subtitle", type: "text" },
      { name: "image_url", label: "Image URL", type: "text", required: true },
      { name: "cta_label", label: "CTA label", type: "text" },
      { name: "cta_href", label: "CTA link", type: "text" },
      { name: "sort_order", label: "Sort order", type: "number" },
      { name: "is_active", label: "Active", type: "checkbox" },
      { name: "starts_at", label: "Starts at", type: "datetime" },
      { name: "ends_at", label: "Ends at", type: "datetime" },
    ],
  },
  coupons: {
    entity: "coupons", title: "Coupons", listKey: "coupons", base: "/api/admin/coupons",
    idField: "code",
    columns: [{ key: "code", label: "Code" }, { key: "kind", label: "Kind" }, { key: "value", label: "Value" }, { key: "is_active", label: "Active" }],
    fields: [
      { name: "code", label: "Code (A-Z, 0-9)", type: "text", required: true },
      { name: "kind", label: "Kind", type: "select", options: ["percent", "flat"], required: true },
      { name: "value", label: "Value (percent 1–50, flat paise)", type: "number", required: true },
      { name: "min_subtotal_paise", label: "Min subtotal (paise)", type: "number" },
      { name: "max_uses", label: "Max uses (blank = unlimited)", type: "number" },
      { name: "starts_at", label: "Starts at", type: "datetime" },
      { name: "ends_at", label: "Ends at", type: "datetime" },
      { name: "is_active", label: "Active", type: "checkbox" },
    ],
  },
  orders: {
    entity: "orders", title: "Orders & dispatch", listKey: "orders", base: "/api/admin/orders",
    idField: "id", readOnly: true, deletable: false,
    columns: [{ key: "id", label: "Order" }, { key: "payment_status", label: "Payment" }, { key: "dispatch_status", label: "Dispatch" }, { key: "total_paise", label: "Total (paise)" }],
    fields: [],
  },
};
