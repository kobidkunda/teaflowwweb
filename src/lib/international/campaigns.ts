import { z } from "zod";
import { getDb } from "@/lib/db";
import { countrySchema } from "./models";
import { homepagePath } from "@/lib/homepageSchema";
export const campaignSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(100), countries: z.array(countrySchema).min(1).max(300), enabled: z.boolean(),
  starts: z.number().int().nonnegative(), ends: z.number().int().positive(), priority: z.number().int().min(0).max(100),
  heroTitle: z.string().max(500).default(""), heroDescription: z.string().max(500).default(""), heroImage: homepagePath.default(""),
  announcement: z.string().max(500).default(""), sliderIds: z.array(z.number().int().positive()).max(30).default([]), featuredIds: z.array(z.number().int().positive()).max(30).default([]),
}).strict().refine(c => c.ends > c.starts, "Campaign end must follow start.");
export type Campaign = z.infer<typeof campaignSchema>;
export function campaigns(): Campaign[] {
  try { return (getDb().prepare("SELECT document FROM commerce_campaigns").all() as { document: string }[]).map(r => campaignSchema.parse(JSON.parse(r.document))); } catch { return []; }
}
export function activeCampaign(country: string, now = Date.now()) {
  return campaigns().filter(c => c.enabled && c.countries.includes(country) && c.starts <= now && c.ends > now).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] || null;
}
