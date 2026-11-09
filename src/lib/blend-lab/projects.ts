import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { getPlanByCode, splitTaxInclusive } from "./plans";
import { checkPincodeCoverage } from "./coverage";
import { intakeDraftSchema, type IntakeDraftInput } from "./validation";

export interface BlendLabProjectRecord {
  id: string;
  publicId: string;
  ownerCustomerId: string;
  planCode: string;
  planVersion: number;
  totalPaise: number;
  basePaise: number;
  gstPaise: number;
  taxRateBps: number;
  paymentState: string;
  workflowState: string;
  businessName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  pickupPincode: string;
  pickupAddress: string;
  pickupServiceable: boolean;
  termsVersion: string;
  createdAt: string;
  sampleInfo?: {
    category: string;
    leafGrade?: string;
    currentPricePerKg?: number;
    sampleWeightGrams: number;
    primaryUseCase: string;
  };
  commercialGoals?: {
    goalType: string;
    targetPricePerKg?: number;
    notes?: string;
    sensoryTargets?: Record<string, number>;
  };
}

interface DbProjectRow {
  id: string;
  public_id: string;
  owner_customer_id: string;
  plan_code: string;
  plan_version: number;
  total_paise: number;
  tax_snapshot: string;
  payment_state: string;
  workflow_state: string;
  business_name: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pickup_pincode: string;
  pickup_address: string;
  pickup_serviceable: number;
  terms_version: string;
  created_at: string;
}

interface DbBriefRow {
  tea_category: string;
  leaf_grade: string | null;
  current_price_per_kg: number | null;
  sample_weight_grams: number;
  primary_use_case: string;
  goal_type: string;
  target_price_per_kg: number | null;
  sensory_targets_json: string | null;
  notes: string | null;
}

export function createProjectDraft(
  rawInput: IntakeDraftInput,
  ownerCustomerId: string = "guest"
): { project: BlendLabProjectRecord; reused: boolean } {
  const input = intakeDraftSchema.parse(rawInput);
  const db = getDb();

  // 1. Check idempotency key first
  const existingByStrictKey = db
    .prepare("SELECT * FROM bl_projects WHERE idempotency_key = ?")
    .get(input.idempotencyKey) as DbProjectRow | undefined;

  if (existingByStrictKey) {
    const brief = db
      .prepare("SELECT * FROM bl_project_briefs WHERE project_id = ?")
      .get(existingByStrictKey.id) as DbBriefRow | undefined;

    const taxSnap = JSON.parse(existingByStrictKey.tax_snapshot || "{}");

    return {
      reused: true,
      project: {
        id: existingByStrictKey.id,
        publicId: existingByStrictKey.public_id,
        ownerCustomerId: existingByStrictKey.owner_customer_id,
        planCode: existingByStrictKey.plan_code,
        planVersion: existingByStrictKey.plan_version,
        totalPaise: existingByStrictKey.total_paise,
        basePaise: taxSnap.basePaise ?? existingByStrictKey.total_paise,
        gstPaise: taxSnap.taxPaise ?? 0,
        taxRateBps: taxSnap.taxRateBps ?? 1800,
        paymentState: existingByStrictKey.payment_state,
        workflowState: existingByStrictKey.workflow_state,
        businessName: existingByStrictKey.business_name || undefined,
        contactName: existingByStrictKey.contact_name,
        contactEmail: existingByStrictKey.contact_email,
        contactPhone: existingByStrictKey.contact_phone,
        pickupPincode: existingByStrictKey.pickup_pincode,
        pickupAddress: existingByStrictKey.pickup_address,
        pickupServiceable: Boolean(existingByStrictKey.pickup_serviceable),
        termsVersion: existingByStrictKey.terms_version,
        createdAt: existingByStrictKey.created_at,
        sampleInfo: brief
          ? {
              category: brief.tea_category,
              leafGrade: brief.leaf_grade || undefined,
              currentPricePerKg: brief.current_price_per_kg || undefined,
              sampleWeightGrams: brief.sample_weight_grams,
              primaryUseCase: brief.primary_use_case,
            }
          : undefined,
        commercialGoals: brief
          ? {
              goalType: brief.goal_type,
              targetPricePerKg: brief.target_price_per_kg || undefined,
              notes: brief.notes || undefined,
              sensoryTargets: brief.sensory_targets_json
                ? JSON.parse(brief.sensory_targets_json)
                : undefined,
            }
          : undefined,
      },
    };
  }

  // 2. Fetch authoritative plan and price in paise
  const plan = getPlanByCode(input.planCode);
  if (!plan) {
    throw new Error(`Invalid plan code: ${input.planCode}`);
  }

  const tax = splitTaxInclusive(plan.totalPaise, plan.taxRateBps);
  const coverage = checkPincodeCoverage(input.pickupDetails.pincode);

  const projectId = crypto.randomUUID();
  const publicId = `bl_proj_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  const formattedAddress = [
    input.pickupDetails.addressLine1,
    input.pickupDetails.addressLine2,
    input.pickupDetails.city,
    input.pickupDetails.state,
    input.pickupDetails.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  const insertProject = db.prepare(`
    INSERT INTO bl_projects (
      id, public_id, owner_customer_id, plan_code, plan_version,
      plan_entitlements_snapshot, total_paise, tax_snapshot,
      payment_state, workflow_state, business_name, contact_name,
      contact_email, contact_phone, pickup_pincode, pickup_address,
      pickup_serviceable, terms_version, idempotency_key, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, 1,
      ?, ?, ?,
      'draft', 'draft_submitted', ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const insertBrief = db.prepare(`
    INSERT INTO bl_project_briefs (
      project_id, tea_category, leaf_grade, current_price_per_kg,
      sample_weight_grams, primary_use_case, goal_type, target_price_per_kg,
      sensory_targets_json, notes, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const tx = db.transaction(() => {
    insertProject.run(
      projectId,
      publicId,
      ownerCustomerId,
      plan.code,
      JSON.stringify(plan.entitlements),
      plan.totalPaise,
      JSON.stringify(tax),
      input.pickupDetails.businessName || null,
      input.pickupDetails.contactName,
      input.pickupDetails.email,
      input.pickupDetails.phone,
      input.pickupDetails.pincode,
      formattedAddress,
      coverage.serviceable ? 1 : 0,
      input.acceptedTermsVersion,
      input.idempotencyKey,
      now,
      now
    );

    insertBrief.run(
      projectId,
      input.sampleInfo.category,
      input.sampleInfo.leafGrade || null,
      input.sampleInfo.currentPurchasePricePerKg || null,
      input.sampleInfo.sampleWeightGrams,
      input.sampleInfo.primaryUseCase,
      input.commercialGoals.goalType,
      input.commercialGoals.targetPricePerKg || null,
      input.commercialGoals.sensorySliders
        ? JSON.stringify(input.commercialGoals.sensorySliders)
        : null,
      input.commercialGoals.notes || null,
      now
    );
  });

  tx();

  return {
    reused: false,
    project: {
      id: projectId,
      publicId,
      ownerCustomerId,
      planCode: plan.code,
      planVersion: 1,
      totalPaise: plan.totalPaise,
      basePaise: tax.basePaise,
      gstPaise: tax.taxPaise,
      taxRateBps: tax.taxRateBps,
      paymentState: "draft",
      workflowState: "draft_submitted",
      businessName: input.pickupDetails.businessName || undefined,
      contactName: input.pickupDetails.contactName,
      contactEmail: input.pickupDetails.email,
      contactPhone: input.pickupDetails.phone,
      pickupPincode: input.pickupDetails.pincode,
      pickupAddress: formattedAddress,
      pickupServiceable: coverage.serviceable,
      termsVersion: input.acceptedTermsVersion,
      createdAt: now,
      sampleInfo: {
        category: input.sampleInfo.category,
        leafGrade: input.sampleInfo.leafGrade,
        currentPricePerKg: input.sampleInfo.currentPurchasePricePerKg,
        sampleWeightGrams: input.sampleInfo.sampleWeightGrams,
        primaryUseCase: input.sampleInfo.primaryUseCase,
      },
      commercialGoals: {
        goalType: input.commercialGoals.goalType,
        targetPricePerKg: input.commercialGoals.targetPricePerKg,
        notes: input.commercialGoals.notes,
        sensoryTargets: input.commercialGoals.sensorySliders,
      },
    },
  };
}

function mapProjectRecord(row: DbProjectRow, brief?: DbBriefRow): BlendLabProjectRecord {
  let taxSnap: { basePaise?: number; taxPaise?: number; taxRateBps?: number } = {};
  try {
    taxSnap = JSON.parse(row.tax_snapshot || "{}");
  } catch {
    taxSnap = {};
  }

  return {
    id: row.id,
    publicId: row.public_id,
    ownerCustomerId: row.owner_customer_id,
    planCode: row.plan_code,
    planVersion: row.plan_version,
    totalPaise: row.total_paise,
    basePaise: taxSnap.basePaise ?? row.total_paise,
    gstPaise: taxSnap.taxPaise ?? 0,
    taxRateBps: taxSnap.taxRateBps ?? 1800,
    paymentState: row.payment_state,
    workflowState: row.workflow_state,
    businessName: row.business_name || undefined,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    pickupPincode: row.pickup_pincode,
    pickupAddress: row.pickup_address,
    pickupServiceable: Boolean(row.pickup_serviceable),
    termsVersion: row.terms_version,
    createdAt: row.created_at,
    sampleInfo: brief
      ? {
          category: brief.tea_category,
          leafGrade: brief.leaf_grade || undefined,
          currentPricePerKg: brief.current_price_per_kg || undefined,
          sampleWeightGrams: brief.sample_weight_grams,
          primaryUseCase: brief.primary_use_case,
        }
      : undefined,
    commercialGoals: brief
      ? {
          goalType: brief.goal_type,
          targetPricePerKg: brief.target_price_per_kg || undefined,
          notes: brief.notes || undefined,
          sensoryTargets: brief.sensory_targets_json
            ? JSON.parse(brief.sensory_targets_json)
            : undefined,
        }
      : undefined,
  };
}

export function getProjectByPublicId(publicId: string): BlendLabProjectRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM bl_projects WHERE public_id = ?")
    .get(publicId) as DbProjectRow | undefined;

  if (!row) return null;

  const brief = db
    .prepare("SELECT * FROM bl_project_briefs WHERE project_id = ?")
    .get(row.id) as DbBriefRow | undefined;

  return mapProjectRecord(row, brief);
}

export function getProjectByIdOrPublicId(idOrPublicId: string): BlendLabProjectRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM bl_projects WHERE id = ? OR public_id = ?")
    .get(idOrPublicId, idOrPublicId) as DbProjectRow | undefined;

  if (!row) return null;

  const brief = db
    .prepare("SELECT * FROM bl_project_briefs WHERE project_id = ?")
    .get(row.id) as DbBriefRow | undefined;

  return mapProjectRecord(row, brief);
}

export function listProjects(params: {
  status?: string;
  paymentState?: string;
  planCode?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): { projects: BlendLabProjectRecord[]; total: number } {
  const db = getDb();
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  if (params.status && params.status !== "all") {
    whereClauses.push("workflow_state = ?");
    queryParams.push(params.status.trim());
  }

  if (params.paymentState && params.paymentState !== "all") {
    whereClauses.push("payment_state = ?");
    queryParams.push(params.paymentState.trim());
  }

  if (params.planCode && params.planCode !== "all") {
    whereClauses.push("plan_code = ?");
    queryParams.push(params.planCode.trim());
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    whereClauses.push(
      "(public_id LIKE ? OR contact_name LIKE ? OR contact_email LIKE ? OR contact_phone LIKE ? OR business_name LIKE ?)"
    );
    queryParams.push(term, term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM bl_projects ${whereSql}`).get(...queryParams) as { count: number };
  const total = countRow?.count ?? 0;

  const limit = Math.max(1, Math.min(100, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);

  const rows = db.prepare(
    `SELECT * FROM bl_projects ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...queryParams, limit, offset) as DbProjectRow[];

  const projects = rows.map((row) => {
    const brief = db
      .prepare("SELECT * FROM bl_project_briefs WHERE project_id = ?")
      .get(row.id) as DbBriefRow | undefined;
    return mapProjectRecord(row, brief);
  });

  return { projects, total };
}

export function updateProjectWorkflow(
  idOrPublicId: string,
  updates: {
    workflowState?: string;
    paymentState?: string;
    notes?: string;
  }
): BlendLabProjectRecord {
  const db = getDb();
  const existing = getProjectByIdOrPublicId(idOrPublicId);
  if (!existing) {
    throw new Error(`Blend Lab project not found: ${idOrPublicId}`);
  }

  const projectSets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const projectParams: (string | number)[] = [];

  if (updates.workflowState !== undefined) {
    projectSets.push("workflow_state = ?");
    projectParams.push(updates.workflowState.trim());
  }

  if (updates.paymentState !== undefined) {
    projectSets.push("payment_state = ?");
    projectParams.push(updates.paymentState.trim());
  }

  projectParams.push(existing.id);

  const tx = db.transaction(() => {
    if (projectSets.length > 1) {
      db.prepare(`UPDATE bl_projects SET ${projectSets.join(", ")} WHERE id = ?`).run(...projectParams);
    }

    if (updates.notes !== undefined) {
      const combinedNotes = updates.notes.trim();
      db.prepare(`
        UPDATE bl_project_briefs
        SET notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ?
      `).run(combinedNotes, existing.id);
    }
  });

  tx();

  return getProjectByIdOrPublicId(existing.id)!;
}
