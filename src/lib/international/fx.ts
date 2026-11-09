import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { CommerceError } from "./models";
import { providerFetch } from "./providers";
export type Fx = { id: string; rates: Record<string, string>; updated: number; next: number };
export function latestFx(): Fx | null {
  try {
    const row = getDb().prepare("SELECT document FROM commerce_fx ORDER BY updated_ms DESC LIMIT 1").get() as { document: string } | undefined;
    return row ? JSON.parse(row.document) : null;
  } catch { return null; }
}
export function rateFor(currency: string, payment = false): { rate: string; id: string | null; stale: boolean } {
  if (currency === "INR") return { rate: "1", id: null, stale: false };
  const fx = latestFx();
  if (!fx || !fx.rates[currency] || Date.now() > fx.next + (payment ? 0 : 48 * 3600000)) throw new CommerceError("A current exchange rate is unavailable. Please choose INR or retry shortly.");
  return { rate: fx.rates[currency], id: fx.id, stale: Date.now() > fx.next };
}
export async function refreshFx() {
  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) throw new CommerceError("Exchange rate credentials are missing.");
  const raw = z.object({ result: z.literal("success"), base_code: z.literal("INR"), time_last_update_unix: z.number().positive(), time_next_update_unix: z.number().positive(), conversion_rates: z.record(z.string(), z.number().positive()) }).parse(await providerFetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/INR`));
  if (raw.time_next_update_unix <= raw.time_last_update_unix || raw.time_last_update_unix * 1000 > Date.now() + 60000) throw new CommerceError("Exchange rate timestamps are invalid.");
  const fx: Fx = { id: randomUUID(), rates: Object.fromEntries(Object.entries(raw.conversion_rates).map(([k, v]) => [k, v.toFixed(12).replace(/0+$/, "").replace(/\.$/, "")])), updated: raw.time_last_update_unix * 1000, next: raw.time_next_update_unix * 1000 };
  getDb().prepare("INSERT INTO commerce_fx (id,document,updated_ms,next_ms) VALUES (?,?,?,?)").run(fx.id, JSON.stringify(fx), fx.updated, fx.next);
  return fx;
}
