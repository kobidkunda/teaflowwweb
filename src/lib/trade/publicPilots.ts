import type { TradeSharedPilotRecord } from "./catalogue";

/** Public discovery must not turn E2E fixtures into apparent real supply hubs. */
export function publicTradePilots(records: TradeSharedPilotRecord[]) {
  const seen = new Set<string>();
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return records.filter((record) => {
    if (record.status !== "active" || /\be2e\b/i.test(`${record.town_name} ${record.collection_point}`)) return false;
    if (!record.town_name.trim() || !record.collection_point.trim() || !record.collection_address.trim()) return false;
    const key = JSON.stringify([record.town_name, record.collection_point, record.collection_address].map(normalize));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
