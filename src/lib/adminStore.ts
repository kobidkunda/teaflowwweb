import { getDb } from "@/lib/db";
export type ListOpts = { limit?: number; cursor?: number };
export function pageLimit(raw: unknown): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : 20;
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 20;
}
// UNIQUE-backed idempotency for admin POST replays. Returns prior response when key repeats.
export function idempotent<T>(resource: string, key: string | undefined, produce: () => T): { body: T; deduped: boolean } {
  const db = getDb();
  if (!key) return { body: produce(), deduped: false };
  const prior = db.prepare("SELECT response FROM admin_idempotency WHERE key=?").get(key) as { response: string } | undefined;
  if (prior) return { body: JSON.parse(prior.response) as T, deduped: true };
  const body = produce();
  db.prepare("INSERT OR IGNORE INTO admin_idempotency (key, resource, response) VALUES (?,?,?)").run(key, resource, JSON.stringify(body));
  return { body, deduped: false };
}
