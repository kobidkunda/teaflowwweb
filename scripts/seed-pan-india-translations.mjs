import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Ensure database path
const dbPath = process.env.DATABASE_PATH || path.join(rootDir, "data", "store.sqlite");
if (!fs.existsSync(dbPath)) {
  console.log(`Database not found at ${dbPath}; skipping SQLite seed.`);
  process.exit(0);
}

// Dynamically import better-sqlite3
const Database = (await import("better-sqlite3")).default;
const db = new Database(dbPath);

// Import dictionary items
const storefrontCopy = JSON.parse(fs.readFileSync(path.join(rootDir, "src/lib/international/storefrontCopy.json"), "utf8"));
const { PAN_INDIA_ITEMS, getLocaleDictionary } = await import("../src/lib/international/panIndiaDictionary.mjs");

const UI_SOURCE = {
  ...storefrontCopy,
  nav_shop: "Shop Tea", nav_leaf: "Leaf to Cup", nav_black: "Black Teas", nav_blend_lab: "Blend Lab", nav_finder: "Tea Finder", nav_trials: "Trials & Samples", nav_wholesale: "Wholesale & Bulk",
  invalid_fields: "Please check the submitted fields.",
  deliver: "Deliver to", currency: "Currency", language: "Language", save: "Save preferences", close: "Close", search: "Search countries",
  unavailable: "Browsing is available. Checkout is not yet available for this destination.", shop: "Shop", bag: "Bag", checkout: "Checkout",
  name: "Full name", email: "Email", phone: "Phone", line1: "Street address", line2: "Apartment or building (optional)", city: "City", state: "State or region", postcode: "Postal code", country: "Country",
  prepaid: "Pay online", cod: "Cash on delivery (India)", quote: "Calculate delivery and total", pay: "Continue to payment", placeCod: "Place cash on delivery order",
  shipping: "Delivery", merchandise: "Teas after discounts", duties: "Import charges", tax: "Additional tax", codFee: "Cash on delivery fee", paymentDiscount: "Prepaid Instant Discount", total: "Total",
  recipient: "Import duties and local taxes may be collected on arrival and are payable by the recipient.", included: "Calculated import duties are included in this total.",
  pending: "Payment verification pending", review: "Review your delivery details and final total before payment.", coupon: "Offer code", loading: "Loading…", expired: "Your quote expired. Calculate a new total.",
  inrAcceptance: "I accept that my payment will be charged in INR (Indian Rupees) and my bank may apply foreign exchange or conversion fees.",
};
for (const item of PAN_INDIA_ITEMS) {
  UI_SOURCE[item.id] = item.en;
  UI_SOURCE[item.en] = item.en;
}
const sourceHash = crypto.createHash("sha256").update(JSON.stringify(UI_SOURCE)).digest("hex");

const LOCALES = ["hi", "bn", "pa", "mr", "gu", "ta", "te"];

console.log(`Seeding Pan-India storefront translations for: ${LOCALES.join(", ")}...`);

db.transaction(() => {
  for (const locale of LOCALES) {
    const dict = getLocaleDictionary(locale);
    const existing = db.prepare("SELECT id FROM commerce_translations WHERE resource='interface' AND locale=?").get(locale);
    const dictJson = JSON.stringify(dict);
    const now = Date.now();

    if (existing) {
      db.prepare(
        "UPDATE commerce_translations SET draft=?, published=?, published_hash=?, source_hash=?, revision=revision+1, updated_ms=? WHERE id=?"
      ).run(dictJson, dictJson, sourceHash, sourceHash, now, existing.id);
      console.log(`  ✓ Updated interface translations for [${locale}]`);
    } else {
      const newId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO commerce_translations (id, resource, locale, source_hash, source, draft, published, published_hash, revision, updated_ms)
         VALUES (?, 'interface', ?, ?, ?, ?, ?, ?, 1, ?)`
      ).run(newId, locale, sourceHash, JSON.stringify(UI_SOURCE), dictJson, dictJson, sourceHash, now);
      console.log(`  ✓ Inserted interface translations for [${locale}]`);
    }
  }
})();

console.log("Pan-India translation seeding complete!");
