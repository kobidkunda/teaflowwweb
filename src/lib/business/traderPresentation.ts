import { z } from "zod";
import traderCopy from "./traderCopy.json";

export const TRADER_COPY = traderCopy;
export type TraderCopy = { [K in keyof typeof TRADER_COPY]: string };
const text = z.string().trim().min(1).max(800).refine(v => !/[<>]/.test(v), "Use plain text.");
const copySchema = z.object(Object.fromEntries(Object.keys(TRADER_COPY).map(k => [k, text])) as { [K in keyof TraderCopy]: typeof text }).strict();
export const traderPresentationSchema = z.object({
  copy: copySchema,
  // Empty arrays intentionally use the live catalogue automatically.
  slides: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(60), productId: z.number().int().positive(), title: text, body: text }).strict()).max(8),
  productIds: z.array(z.number().int().positive()).max(12),
  journeyProductId: z.number().int().positive().nullable(),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.slides.map(s => s.id)).size !== v.slides.length) ctx.addIssue({code:"custom",path:["slides"],message:"Slide IDs must be unique."});
  if (new Set(v.productIds).size !== v.productIds.length) ctx.addIssue({code:"custom",path:["productIds"],message:"Select each product once."});
});
export type TraderPresentation = z.infer<typeof traderPresentationSchema>;
export const TRADER_DEFAULTS: TraderPresentation = { copy: { ...TRADER_COPY }, slides: [], productIds: [], journeyProductId: null };
