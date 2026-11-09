// Rerunnable script to associate product images with their respective variants/bases.
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

const configs = [
  {
    slug: "darjeeling-spring",
    images: [
      {
        url: "/images/mockup/card1_darjeeling.jpg",
        alt_text: "Darjeeling Spring Clonal First Flush - Resealable Loose Leaf Pouch",
        format: "loose_leaf_pouch",
        sort_order: 0,
        is_primary: 1,
      },
      {
        url: "/uploads/product-darjeeling-tin.jpg",
        alt_text: "Darjeeling Spring Clonal First Flush - Airtight Luxury Caddy Tin",
        format: "luxury_tin",
        sort_order: 1,
        is_primary: 0,
      },
      {
        url: "/images/cat-tea-bags.jpg",
        alt_text: "Darjeeling Spring Clonal First Flush - Biodegradable Pyramid Bags",
        format: "pyramid_bags",
        sort_order: 2,
        is_primary: 0,
      },
      {
        url: "/uploads/bento-pluck.jpg",
        alt_text: "Fresh spring two leaves and a bud plucking in Darjeeling",
        format: null, // shared
        sort_order: 3,
        is_primary: 0,
      },
    ],
  },
  {
    slug: "assam-golden-breakfast",
    images: [
      {
        url: "/images/mockup/card2_assam_breakfast.jpg",
        alt_text: "Assam Golden Breakfast - Resealable Loose Leaf Pouch",
        format: "loose_leaf_pouch",
        sort_order: 0,
        is_primary: 1,
      },
      {
        url: "/uploads/product-assam-tin.jpg",
        alt_text: "Assam Golden Breakfast - Airtight Luxury Caddy Tin",
        format: "luxury_tin",
        sort_order: 1,
        is_primary: 0,
      },
      {
        url: "/images/cat-tea-bags.jpg",
        alt_text: "Assam Golden Breakfast - Biodegradable Pyramid Bags",
        format: "pyramid_bags",
        sort_order: 2,
        is_primary: 0,
      },
      {
        url: "/uploads/bento-plantation.jpg",
        alt_text: "Assam tea garden morning mist",
        format: null, // shared
        sort_order: 3,
        is_primary: 0,
      },
    ],
  },
  {
    slug: "nilgiri-mist-green",
    images: [
      {
        url: "/images/mockup/card6_nilgiri_frost.jpg",
        alt_text: "Nilgiri Mist Green - Resealable Loose Leaf Pouch",
        format: "loose_leaf_pouch",
        sort_order: 0,
        is_primary: 1,
      },
      {
        url: "/uploads/product-nilgiri-tin.jpg",
        alt_text: "Nilgiri Mist Green - Airtight Luxury Caddy Tin",
        format: "luxury_tin",
        sort_order: 1,
        is_primary: 0,
      },
      {
        url: "/images/cat-tea-bags.jpg",
        alt_text: "Nilgiri Mist Green - Biodegradable Pyramid Bags",
        format: "pyramid_bags",
        sort_order: 2,
        is_primary: 0,
      },
    ],
  },
  {
    slug: "summer-chinary-black",
    images: [
      {
        url: "/images/mockup/card3_summer_chinquy.jpg",
        alt_text: "Darjeeling Summer Chinary Black - Resealable Loose Leaf Pouch",
        format: "loose_leaf_pouch",
        sort_order: 0,
        is_primary: 1,
      },
      {
        url: "/images/mockup/card3_summer_chinquy_tin.jpg",
        alt_text: "Darjeeling Summer Chinary Black - Airtight Luxury Caddy Tin",
        format: "luxury_tin",
        sort_order: 1,
        is_primary: 0,
      },
      {
        url: "/images/cat-tea-bags.jpg",
        alt_text: "Darjeeling Summer Chinary Black - Biodegradable Pyramid Bags",
        format: "pyramid_bags",
        sort_order: 2,
        is_primary: 0,
      },
    ],
  },
  {
    slug: "assam-golden-tips",
    images: [
      {
        url: "/images/mockup/card4_heritage_golden.jpg",
        alt_text: "Assam Heritage Golden Tips - Resealable Loose Leaf Pouch",
        format: "loose_leaf_pouch",
        sort_order: 0,
        is_primary: 1,
      },
      {
        url: "/images/mockup/card4_heritage_golden_tin.jpg",
        alt_text: "Assam Heritage Golden Tips - Airtight Luxury Caddy Tin",
        format: "luxury_tin",
        sort_order: 1,
        is_primary: 0,
      },
      {
        url: "/images/cat-tea-bags.jpg",
        alt_text: "Assam Heritage Golden Tips - Biodegradable Pyramid Bags",
        format: "pyramid_bags",
        sort_order: 2,
        is_primary: 0,
      },
    ],
  },
  {
    slug: "kangra-green",
    images: [
      {
        url: "/images/mockup/card5_kangra_green.jpg",
        alt_text: "Kangra Valley Spring Green - Resealable Loose Leaf Pouch",
        format: "loose_leaf_pouch",
        sort_order: 0,
        is_primary: 1,
      },
      {
        url: "/images/mockup/card5_kangra_green_tin.jpg",
        alt_text: "Kangra Valley Spring Green - Airtight Luxury Caddy Tin",
        format: "luxury_tin",
        sort_order: 1,
        is_primary: 0,
      },
    ],
  },
];

try {
  db.transaction(() => {
    for (const cfg of configs) {
      const product = db.prepare("SELECT id FROM products WHERE slug=?").get(cfg.slug);
      if (!product) continue;

      const variants = db.prepare("SELECT sku, packaging_format FROM variants WHERE product_id=?").all(product.id);

      // Clean existing images for this product and re-seed cleanly
      db.prepare("DELETE FROM product_images WHERE product_id=?").run(product.id);

      for (const img of cfg.images) {
        let assignedSkus = [];
        if (img.format) {
          assignedSkus = variants
            .filter((v) => v.packaging_format === img.format && v.sku)
            .map((v) => v.sku);
        }

        db.prepare(
          "INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary, variant_skus) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(
          product.id,
          img.url,
          img.alt_text,
          img.sort_order,
          img.is_primary,
          JSON.stringify(assignedSkus)
        );
      }
    }
  })();
  console.log("Successfully seeded variant-specific imagery for products.");
} catch (error) {
  console.error("Failed to seed variant imagery:", error);
  process.exit(1);
} finally {
  db.close();
}
