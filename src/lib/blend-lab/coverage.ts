import { getDb } from "@/lib/db";

export interface PincodeCoverageResult {
  pincode: string;
  serviceable: boolean;
  city?: string;
  state?: string;
  carrier?: string;
  estimatedPickupDays?: number;
  fallbackInstructions?: string;
}

export function checkPincodeCoverage(pincode: string): PincodeCoverageResult {
  const cleanPin = pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return {
      pincode: cleanPin,
      serviceable: false,
      fallbackInstructions: "Please provide a valid 6-digit Indian PIN code.",
    };
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM bl_pincode_coverage WHERE pincode = ?")
    .get(cleanPin) as
    | {
        pincode: string;
        city: string;
        state: string;
        serviceable: number;
        carrier: string;
        estimated_days: number;
      }
    | undefined;

  if (existing) {
    const isServiceable = Boolean(existing.serviceable);
    return {
      pincode: cleanPin,
      serviceable: isServiceable,
      city: existing.city,
      state: existing.state,
      carrier: existing.carrier,
      estimatedPickupDays: existing.estimated_days,
      fallbackInstructions: isServiceable
        ? undefined
        : "Standard courier pickup is currently limited for this area. Please contact lab support at info@teafloww.com for custom self-dispatch instructions.",
    };
  }

  // General heuristic for standard PINs across India (major courier network)
  // Pin starting with 0 is invalid (already filtered by regex).
  // Standard serviceable pan-India tier-1 and tier-2 zones
  return {
    pincode: cleanPin,
    serviceable: true,
    city: "Partner Coverage Hub",
    state: "India",
    carrier: "Express Courier Network",
    estimatedPickupDays: 3,
  };
}

export function listCoverage(options: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): { coverage: PincodeCoverageResult[]; total: number } {
  const db = getDb();
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim()}%`;
    whereClauses.push("(pincode LIKE ? OR city LIKE ? OR state LIKE ? OR carrier LIKE ?)");
    queryParams.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM bl_pincode_coverage ${whereSql}`).get(...queryParams) as { count: number } | undefined;
  const total = countRow?.count ?? 0;

  const limit = Math.max(1, Math.min(200, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);

  const rows = db.prepare(
    `SELECT * FROM bl_pincode_coverage ${whereSql} ORDER BY pincode ASC LIMIT ? OFFSET ?`
  ).all(...queryParams, limit, offset) as Array<{
    pincode: string;
    city: string;
    state: string;
    serviceable: number;
    carrier: string;
    estimated_days: number;
  }>;

  const coverage = rows.map((r) => ({
    pincode: r.pincode,
    city: r.city,
    state: r.state,
    serviceable: Boolean(r.serviceable),
    carrier: r.carrier,
    estimatedPickupDays: r.estimated_days,
  }));

  return { coverage, total };
}

export function upsertCoverage(entry: {
  pincode: string;
  city: string;
  state: string;
  carrier?: string;
  estimatedDays?: number;
  serviceable?: boolean;
}): PincodeCoverageResult {
  const cleanPin = entry.pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    throw new Error("PIN code must be a valid 6-digit Indian postal code.");
  }
  const city = entry.city.trim();
  if (!city) throw new Error("City is required.");
  const state = entry.state.trim();
  if (!state) throw new Error("State is required.");
  const carrier = entry.carrier?.trim() || "Express Cargo";
  const estimatedDays = Math.max(1, Math.min(30, entry.estimatedDays ?? 3));
  const serviceable = entry.serviceable !== false ? 1 : 0;

  const db = getDb();
  db.prepare(`
    INSERT INTO bl_pincode_coverage (pincode, city, state, serviceable, carrier, estimated_days)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(pincode) DO UPDATE SET
      city = excluded.city,
      state = excluded.state,
      serviceable = excluded.serviceable,
      carrier = excluded.carrier,
      estimated_days = excluded.estimated_days
  `).run(cleanPin, city, state, serviceable, carrier, estimatedDays);

  return checkPincodeCoverage(cleanPin);
}

export function deleteCoverage(pincode: string): boolean {
  const cleanPin = pincode.trim();
  const db = getDb();
  const result = db.prepare("DELETE FROM bl_pincode_coverage WHERE pincode = ?").run(cleanPin);
  return result.changes > 0;
}
