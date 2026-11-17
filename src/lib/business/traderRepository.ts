import { getDb } from "@/lib/db";
import { listProducts } from "@/lib/products";
import { listProductImages } from "@/lib/productImages";
import { traderPresentationSchema, TRADER_DEFAULTS, type TraderPresentation } from "./traderPresentation";
export const TRADER_PRESENTATION_KEY = "tea_traders_presentation_v1";
export function getTraderPresentation(): TraderPresentation {
  const row = getDb().prepare("SELECT value FROM store_settings WHERE key=?").get(TRADER_PRESENTATION_KEY) as {value:string}|undefined;
  if (!row) return structuredClone(TRADER_DEFAULTS);
  try { return traderPresentationSchema.parse(JSON.parse(row.value)); } catch { return structuredClone(TRADER_DEFAULTS); }
}
export function getTraderCatalogue() {
  return listProducts().map(p => ({ ...p, gallery: listProductImages(p.id) }));
}
export function saveTraderPresentation(raw: unknown): TraderPresentation {
  const content = traderPresentationSchema.parse(raw);
  const allowed = new Set(listProducts().map(p => p.id));
  const ids = [...content.productIds, ...content.slides.map(s => s.productId), ...(content.journeyProductId ? [content.journeyProductId] : [])];
  if (ids.some(id => !allowed.has(id))) throw new Error("Choose published, enabled catalogue products.");
  getDb().prepare(`INSERT INTO store_settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).run(TRADER_PRESENTATION_KEY, JSON.stringify(content));
  return content;
}
export function traderTranslationSource() {
  const content = getTraderPresentation();
  return Object.fromEntries([
    ...Object.entries(content.copy).map(([key, value]) => [`copy.${key}`, value]),
    ...content.slides.flatMap((s, i) => [[`slides.${i}.title`, s.title], [`slides.${i}.body`, s.body]]),
  ]);
}
