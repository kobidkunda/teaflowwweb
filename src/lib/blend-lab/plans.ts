/**
 * TeaFloww Blend Lab — Authoritative Service Plans & Entitlements Catalog
 * Prices are strictly stored in integer INR paise.
 * Tax calculations follow B2B professional services (18% GST = 1800 basis points).
 */

import { getDb } from "@/lib/db";
import {
  type PlanCode,
  type PlanEntitlements,
  type ServicePlan,
  type UpsertPlanInput,
  BLEND_LAB_PLANS,
  ORDERED_PLANS,
} from "./plans-catalog";

export * from "./plans-catalog";

interface DbPlanRow {
  code: string;
  public_name: string;
  version: number;
  total_paise: number;
  currency: string;
  entitlements_json: string;
  tax_classification: string;
  tax_rate_bps: number;
  active: number;
  updated_at: string;
}

function mapRowToPlan(row: DbPlanRow): ServicePlan {
  const code = row.code as PlanCode;
  const defaultPlan = BLEND_LAB_PLANS[code] || {
    code,
    title: row.public_name,
    eyebrow: "BLEND LAB SERVICE",
    tagline: "",
    description: "",
    totalPaise: row.total_paise,
    taxRateBps: row.tax_rate_bps,
    features: [],
    exclusions: [],
    buttonLabel: "Select Plan",
    entitlements: {
      inboundShipments: 1,
      outboundShipments: 0,
      detailedPdf: false,
      developmentIncluded: false,
      includedRevisionRounds: 0,
      includedTrialCandidates: 0,
      turnaroundDays: 7,
      sampleWeightGrams: 100,
    },
  };

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(row.entitlements_json || "{}");
  } catch {
    parsed = {};
  }

  const entitlementsData = (parsed.entitlements && typeof parsed.entitlements === "object"
    ? parsed.entitlements
    : parsed) as Partial<PlanEntitlements>;

  return {
    ...defaultPlan,
    code,
    title: row.public_name || defaultPlan.title,
    totalPaise: row.total_paise,
    taxRateBps: row.tax_rate_bps,
    active: Boolean(row.active),
    eyebrow: typeof parsed.eyebrow === "string" ? parsed.eyebrow : defaultPlan.eyebrow,
    tagline: typeof parsed.tagline === "string" ? parsed.tagline : defaultPlan.tagline,
    description: typeof parsed.description === "string" ? parsed.description : defaultPlan.description,
    badge: typeof parsed.badge === "string" ? parsed.badge : (parsed.badge === null ? undefined : defaultPlan.badge),
    highlighted: typeof parsed.highlighted === "boolean" ? parsed.highlighted : defaultPlan.highlighted,
    buttonLabel: typeof parsed.buttonLabel === "string" ? parsed.buttonLabel : defaultPlan.buttonLabel,
    features: Array.isArray(parsed.features) ? (parsed.features as string[]) : defaultPlan.features,
    exclusions: Array.isArray(parsed.exclusions) ? (parsed.exclusions as string[]) : defaultPlan.exclusions,
    entitlements: {
      ...defaultPlan.entitlements,
      ...entitlementsData,
    },
  };
}

export function getPlanByCode(code: string): ServicePlan | null {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM bl_service_plans WHERE code = ?")
      .get(code) as DbPlanRow | undefined;
    if (row) {
      return mapRowToPlan(row);
    }
  } catch {
    // fallback if DB query fails or table not yet migrated
  }

  if (code in BLEND_LAB_PLANS) {
    return BLEND_LAB_PLANS[code as PlanCode];
  }
  return null;
}

export function listPlans(options: { activeOnly?: boolean } = { activeOnly: false }): ServicePlan[] {
  try {
    const db = getDb();
    const rows = (
      options.activeOnly
        ? db.prepare("SELECT * FROM bl_service_plans WHERE active = 1 ORDER BY total_paise ASC").all()
        : db.prepare("SELECT * FROM bl_service_plans ORDER BY total_paise ASC").all()
    ) as DbPlanRow[];

    if (rows && rows.length > 0) {
      return rows.map(mapRowToPlan);
    }
  } catch {
    // fallback if DB query fails
  }

  return ORDERED_PLANS.filter((p) => !options.activeOnly || p.active !== false);
}

export function upsertPlan(data: UpsertPlanInput): ServicePlan {
  if (!data.code || !["MATCH_QUOTE", "QUALITY_AUDIT", "SIGNATURE"].includes(data.code)) {
    throw new Error(`Invalid plan code: ${data.code}`);
  }
  if (!Number.isSafeInteger(data.totalPaise) || data.totalPaise < 0) {
    throw new Error("Invalid plan total paise");
  }
  const taxRateBps = data.taxRateBps ?? 1800;
  if (!Number.isSafeInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000) {
    throw new Error("Invalid tax rate basis points");
  }

  const existing = getPlanByCode(data.code);
  const title = (data.title || existing?.title || data.code).trim();
  const active = data.active !== undefined ? (data.active ? 1 : 0) : (existing?.active ?? true ? 1 : 0);

  const entitlements = {
    ...(existing?.entitlements ?? {}),
    ...(data.entitlements ?? {}),
  };

  const metadataJson = JSON.stringify({
    entitlements,
    eyebrow: data.eyebrow ?? existing?.eyebrow,
    tagline: data.tagline ?? existing?.tagline,
    description: data.description ?? existing?.description,
    badge: data.badge !== undefined ? data.badge : existing?.badge,
    highlighted: data.highlighted !== undefined ? data.highlighted : existing?.highlighted,
    buttonLabel: data.buttonLabel ?? existing?.buttonLabel,
    features: data.features ?? existing?.features ?? [],
    exclusions: data.exclusions ?? existing?.exclusions ?? [],
  });

  const db = getDb();
  db.prepare(`
    INSERT INTO bl_service_plans (code, public_name, version, total_paise, currency, entitlements_json, tax_classification, tax_rate_bps, active, updated_at)
    VALUES (?, ?, 1, ?, 'INR', ?, 'B2B_PROFESSIONAL_SERVICES', ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(code) DO UPDATE SET
      public_name = excluded.public_name,
      total_paise = excluded.total_paise,
      entitlements_json = excluded.entitlements_json,
      tax_rate_bps = excluded.tax_rate_bps,
      active = excluded.active,
      updated_at = CURRENT_TIMESTAMP
  `).run(data.code, title, data.totalPaise, metadataJson, taxRateBps, active);

  return getPlanByCode(data.code)!;
}

/** Entitlement check: Does this plan grant access to the full PDF report? */
export function canDownloadPdfReport(planCode: string): boolean {
  const plan = getPlanByCode(planCode);
  return Boolean(plan?.entitlements.detailedPdf);
}

/** Entitlement check: Does this plan include outbound trial blend dispatches? */
export function canRequestTrialBlend(planCode: string): boolean {
  const plan = getPlanByCode(planCode);
  return Boolean(plan?.entitlements.developmentIncluded && plan.entitlements.outboundShipments > 0);
}
