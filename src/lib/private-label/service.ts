/**
 * TeaFloww Private Label Studio — Core Domain Service
 * Milestone M1: Shared Architecture and Data Models
 *
 * Singleton service providing transactional business operations, optimistic CAS concurrency,
 * audit logging, tenant isolation, and validation gates across Admin, Storefront, and MCP.
 */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { recordAudit, getAuditHistory as fetchAuditHistory } from "./audit";
import { calculateMOQ } from "./moq";
import { validateCompatibility } from "./compatibility";
import { calculateQuote, calculateItemized12ComponentQuote } from "./pricing";
import type {
  PublicCatalogueQuery,
  StartingPriceIndicator,
  PublicPackagingDetailResponse,
} from "./schemas";
import {
  toPublicPackagingVariantDto,
  toPublicPrintMethodDto,
  type PublicPackagingVariantDto,
  type PublicPrintMethodDto,
} from "./public-dto";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
  type AuditRecord,
  type Client,
  type PackagingFamily,
  type PackagingVariant,
  type PackagingVariantStatus,
  type PackagingVariantWithDetails,
  type PackagingCompatibility,
  type PackagingFilter,
  type UpsertPackagingInput,
  type TeaCategory,
  type TeaOption,
  type TeaOptionFilter,
  type UpsertTeaOptionInput,
  type PrintMethod,
  type PriceBook,
  type PriceBookTier,
  type MoqRule,
  type QuoteStatus,
  type JobStatus,
  type CompatibilityResult,
  type GateVerificationResult,
  type Project,
  type ProjectWithItems,
  type ProjectItem,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectFilter,
  type Quote,
  type QuoteItem,
  type QuoteWithItems,
  type CreateQuoteInput,
  type AcceptQuoteInput,
  type ArtworkAsset,
  type CreateArtworkInput,
  type DesignVersion,
  type CreateDesignVersionInput,
  type ApprovalEvent,
  type ApproveProofInput,
  type RejectProofInput,
  type SampleOrder,
  type SampleItem,
  type CreateSampleOrderInput,
  type SampleStatus,
  type ProductionOrder,
  type OrderItem,
  type ProductionJob,
  type ProductionJobWithMilestones,
  type ReleaseJobInput,
  type QCMilestone,
  type RecordQCMilestoneInput,
  type ConvertQuoteToOrderInput,
  type PaymentIntentResult,
  type ValidateReleaseResult,
  type MoqEvaluationParams,
  type MoqEvaluationResult,
  type PricingCalculationParams,
  type PriceEstimateResult,
  type ItemizedPriceEstimateResult,
  type ItemizedPriceBreakdown,
  type PrintMethodCode,
} from "./types";
import {
  validatePreflight as runPreflightValidation,
  type PreflightInputOptions,
  type PreflightValidationResult,
} from "./preflight";

function validatePhysicalQuote(pack: PackagingVariant, method: PrintMethod, weight: number, colors: number) {
  const family = getDb().prepare("SELECT code FROM pl_packaging_families WHERE id = ?").get(pack.family_id) as { code: string } | undefined;
  const result = validateCompatibility({ familyCode: family?.code || pack.family_code || "pouch", printMethodCode: method.code, colorCount: colors });
  const blockers: string[] = [];
  if (!result.compatible) blockers.push(result.reason || "Printing is incompatible with this packaging.");
  const maxColors = Math.min(method.max_colors, result.maxColors || method.max_colors);
  if (colors > maxColors) blockers.push(`This print method supports up to ${maxColors} colors.`);
  if (weight > pack.net_weight_capacity_grams) blockers.push("The selected fill weight exceeds this package's capacity.");
  if (blockers.length) throw new PrivateLabelGateError("configuration", blockers);
}

export class PrivateLabelService {
  // ==========================================================================
  // Helper Methods: Audit & Tenant Resolution
  // ==========================================================================

  private static recordAudit(
    db: ReturnType<typeof getDb>,
    params: {
      entity_type: string;
      entity_id: string;
      revision: number;
      action: string;
      actor: AuditActor;
      diff?: unknown;
    }
  ): AuditRecord {
    return recordAudit(db, params);
  }

  // ==========================================================================
  // 1. Core Catalog Domain (Packaging, Tea Options, Print Methods)
  // ==========================================================================

  static listPackaging(filter?: PackagingFilter): { items: PackagingVariant[]; total: number } {
    const db = getDb();
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.status) {
      whereClauses.push("status = ?");
      params.push(filter.status);
    } else {
      whereClauses.push("status = 'published'");
    }

    if (filter?.familyCode) {
      whereClauses.push("family_id IN (SELECT id FROM pl_packaging_families WHERE code = ?)");
      params.push(filter.familyCode);
    }

    if (filter?.search) {
      whereClauses.push("(title LIKE ? OR sku LIKE ? OR material LIKE ?)");
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const totalRow = db.prepare(`SELECT count(*) as count FROM pl_packaging_variants ${whereSql}`).get(...params) as {
      count: number;
    };

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const queryParams = [...params, limit, offset];

    const items = db
      .prepare(
        `SELECT v.*, f.code as family_code
         FROM pl_packaging_variants v
         LEFT JOIN pl_packaging_families f ON v.family_id = f.id
         ${whereSql}
         ORDER BY v.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...queryParams) as PackagingVariant[];

    return { items, total: totalRow?.count || 0 };
  }

  static getPackagingBySlug(slug: string): PackagingVariantWithDetails | null {
    const db = getDb();
    const variant = db
      .prepare(
        `SELECT v.*, f.code as family_code
         FROM pl_packaging_variants v
         LEFT JOIN pl_packaging_families f ON v.family_id = f.id
         WHERE v.slug = ?`
      )
      .get(slug) as PackagingVariant | undefined;

    if (!variant) return null;

    const compatibleMethods = db
      .prepare(
        `SELECT m.*
         FROM pl_print_methods m
         JOIN pl_packaging_compatibility c ON c.print_method_id = m.id
         WHERE c.packaging_variant_id = ? AND c.is_supported = 1 AND m.is_active = 1`
      )
      .all(variant.id) as PrintMethod[];

    return {
      ...variant,
      compatible_print_methods: compatibleMethods,
    };
  }

  // ==========================================================================
  // Milestone M3: Public Storefront Catalog Operations
  // ==========================================================================

  static listPublicPackagingVariants(query?: Partial<PublicCatalogueQuery>): {
    items: PublicPackagingVariantDto[];
    packaging: PublicPackagingVariantDto[];
    print_methods: PublicPrintMethodDto[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  } {
    const db = getDb();
    const q = query || {};
    const whereClauses: string[] = ["v.status = 'published'"];
    const params: (string | number)[] = [];

    if (q.category) {
      whereClauses.push("f.code = ?");
      params.push(q.category);
    }

    if (q.capacity_min !== undefined) {
      whereClauses.push("v.net_weight_capacity_grams >= ?");
      params.push(q.capacity_min);
    }

    if (q.capacity_max !== undefined) {
      whereClauses.push("v.net_weight_capacity_grams <= ?");
      params.push(q.capacity_max);
    }

    if (q.material) {
      whereClauses.push("v.material LIKE ?");
      params.push(`%${q.material}%`);
    }

    const searchTerm = q.search || q.q;
    if (searchTerm) {
      whereClauses.push(
        "(v.title LIKE ? OR v.material LIKE ? OR v.capacity_description LIKE ? OR v.closure_type LIKE ?)"
      );
      const term = `%${searchTerm}%`;
      params.push(term, term, term, term);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

    const totalRow = db
      .prepare(
        `SELECT count(*) as count
         FROM pl_packaging_variants v
         LEFT JOIN pl_packaging_families f ON v.family_id = f.id
         ${whereSql}`
      )
      .get(...params) as { count: number };

    const total = totalRow?.count || 0;
    const limit = Math.min(Math.max(q.limit || 20, 1), 100);
    const offset = Math.max(q.offset || 0, 0);

    const rows = db
      .prepare(
        `SELECT v.*, f.code as family_code, f.name as family_name
         FROM pl_packaging_variants v
         LEFT JOIN pl_packaging_families f ON v.family_id = f.id
         ${whereSql}
         ORDER BY v.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as PackagingVariant[];

    // Fetch default active price book for starting price calculations
    const priceBook = db
      .prepare(
        "SELECT * FROM pl_price_books WHERE status = 'active' ORDER BY is_default DESC, created_at DESC LIMIT 1"
      )
      .get() as PriceBook | undefined;

    const items: PublicPackagingVariantDto[] = rows.map((row) => {
      const compatibleMethods = db
        .prepare(
          `SELECT m.code
           FROM pl_print_methods m
           JOIN pl_packaging_compatibility c ON c.print_method_id = m.id
           WHERE c.packaging_variant_id = ? AND c.is_supported = 1 AND m.is_active = 1
           ORDER BY m.code ASC`
        )
        .all(row.id) as { code: string }[];

      const withDetails: PackagingVariantWithDetails = {
        ...row,
        compatible_print_methods: compatibleMethods.map((cm) => ({ code: cm.code } as PrintMethod)),
      };

      const dto = toPublicPackagingVariantDto(withDetails);

      if (priceBook) {
        const tier = db
          .prepare(
            `SELECT unit_price_paise, min_qty
             FROM pl_price_book_tiers
             WHERE price_book_id = ? AND item_type = 'packaging' AND item_id = ?
             ORDER BY min_qty ASC LIMIT 1`
          )
          .get(priceBook.id, row.id) as { unit_price_paise: number; min_qty: number } | undefined;

        if (tier && tier.unit_price_paise > 0) {
          dto.starting_price = {
            currency: priceBook.currency,
            unit_price_paise: tier.unit_price_paise,
            formatted_unit_price: `₹${(tier.unit_price_paise / 100).toFixed(2)}`,
            min_quantity: tier.min_qty || row.moq_units,
            tier_label: `From ${tier.min_qty || row.moq_units} units`,
          };
        } else if (row.unit_cost_paise > 0) {
          const margin = priceBook.margin_rate || 0.25;
          const calculatedPaise = Math.round(row.unit_cost_paise / (1 - margin));
          dto.starting_price = {
            currency: priceBook.currency,
            unit_price_paise: calculatedPaise,
            formatted_unit_price: `₹${(calculatedPaise / 100).toFixed(2)}`,
            min_quantity: row.moq_units,
            tier_label: `From ${row.moq_units} units`,
          };
        }
      }

      return dto;
    });

    // Public active print methods
    const printMethodRows = db
      .prepare("SELECT * FROM pl_print_methods WHERE is_active = 1 ORDER BY code ASC")
      .all() as PrintMethod[];
    const printMethods = printMethodRows.map(toPublicPrintMethodDto);

    return {
      items,
      packaging: items,
      print_methods: printMethods,
      total,
      limit,
      offset,
      has_more: offset + items.length < total,
    };
  }

  static getPublicPackagingVariantBySlug(slug: string): PublicPackagingDetailResponse {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT v.*, f.code as family_code, f.name as family_name
         FROM pl_packaging_variants v
         LEFT JOIN pl_packaging_families f ON v.family_id = f.id
         WHERE v.slug = ?`
      )
      .get(slug) as PackagingVariant | undefined;

    // Anti-enumeration: must return 404 for missing OR non-published variants
    if (!row || row.status !== "published") {
      throw new PrivateLabelNotFoundError(
        "PackagingVariant",
        slug,
        `Packaging variant '${slug}' not found`
      );
    }

    const compatibleMethods = db
      .prepare(
        `SELECT m.*
         FROM pl_print_methods m
         JOIN pl_packaging_compatibility c ON c.print_method_id = m.id
         WHERE c.packaging_variant_id = ? AND c.is_supported = 1 AND m.is_active = 1
         ORDER BY m.name ASC`
      )
      .all(row.id) as PrintMethod[];

    const publicPrintMethods = compatibleMethods.map(toPublicPrintMethodDto);

    let startingPrice: StartingPriceIndicator | null = null;
    const priceBook = db
      .prepare(
        "SELECT * FROM pl_price_books WHERE status = 'active' ORDER BY is_default DESC, created_at DESC LIMIT 1"
      )
      .get() as PriceBook | undefined;

    if (priceBook) {
      const tier = db
        .prepare(
          `SELECT unit_price_paise, min_qty
           FROM pl_price_book_tiers
           WHERE price_book_id = ? AND item_type = 'packaging' AND item_id = ?
           ORDER BY min_qty ASC LIMIT 1`
        )
        .get(priceBook.id, row.id) as { unit_price_paise: number; min_qty: number } | undefined;

      if (tier && tier.unit_price_paise > 0) {
        startingPrice = {
          currency: priceBook.currency,
          unit_price_paise: tier.unit_price_paise,
          formatted_unit_price: `₹${(tier.unit_price_paise / 100).toFixed(2)}`,
          min_quantity: tier.min_qty || row.moq_units,
          tier_label: `From ${tier.min_qty || row.moq_units} units`,
        };
      } else if (row.unit_cost_paise > 0) {
        const margin = priceBook.margin_rate || 0.25;
        const calculatedPaise = Math.round(row.unit_cost_paise / (1 - margin));
        startingPrice = {
          currency: priceBook.currency,
          unit_price_paise: calculatedPaise,
          formatted_unit_price: `₹${(calculatedPaise / 100).toFixed(2)}`,
          min_quantity: row.moq_units,
          tier_label: `From ${row.moq_units} units`,
        };
      }
    }

    const baseDto = toPublicPackagingVariantDto({
      ...row,
      compatible_print_methods: compatibleMethods,
    });

    return {
      ...baseDto,
      compatible_print_methods: publicPrintMethods,
      starting_price: startingPrice,
    };
  }

  static getPackagingById(id: string): PackagingVariantWithDetails | null {
    const db = getDb();
    const variant = db
      .prepare(
        `SELECT v.*, f.code as family_code
         FROM pl_packaging_variants v
         LEFT JOIN pl_packaging_families f ON v.family_id = f.id
         WHERE v.id = ?`
      )
      .get(id) as PackagingVariant | undefined;

    if (!variant) return null;

    const compatibleMethods = db
      .prepare(
        `SELECT m.*
         FROM pl_print_methods m
         JOIN pl_packaging_compatibility c ON c.print_method_id = m.id
         WHERE c.packaging_variant_id = ? AND c.is_supported = 1 AND m.is_active = 1`
      )
      .all(variant.id) as PrintMethod[];

    return {
      ...variant,
      compatible_print_methods: compatibleMethods,
    };
  }

  static upsertPackagingVariant(
    input: Partial<UpsertPackagingInput> & { id?: string },
    actor: AuditActor,
    expected_revision?: number
  ): PackagingVariant {
    const db = getDb();
    return db.transaction(() => {
      // Resolve family_id from family_code if necessary
      let resolvedFamilyId = input.family_id;
      if (!resolvedFamilyId && input.family_code) {
        const fam = db.prepare("SELECT id FROM pl_packaging_families WHERE code = ?").get(input.family_code) as { id: string } | undefined;
        if (fam) resolvedFamilyId = fam.id;
      } else if (resolvedFamilyId) {
        const byId = db.prepare("SELECT id FROM pl_packaging_families WHERE id = ?").get(resolvedFamilyId) as { id: string } | undefined;
        if (!byId) {
          const byCode = db.prepare("SELECT id FROM pl_packaging_families WHERE code = ?").get(resolvedFamilyId) as { id: string } | undefined;
          if (byCode) resolvedFamilyId = byCode.id;
        }
      }

      const existing = input.id
        ? (db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(input.id) as PackagingVariant | undefined)
        : undefined;

      if (expected_revision !== undefined && !existing) {
        throw new PrivateLabelNotFoundError("PackagingVariant", input.id!);
      }

      if (existing && input.id) {

        if (expected_revision !== undefined && existing.revision !== expected_revision) {
          throw new PrivateLabelRevisionConflictError(
            "PackagingVariant",
            input.id,
            existing.revision,
            expected_revision
          );
        }

        const expRev = expected_revision ?? existing.revision;
        const result = db
          .prepare(
            `UPDATE pl_packaging_variants
             SET family_id = ?, slug = ?, sku = ?, title = ?, material = ?, finish = ?,
                 closure_type = ?, capacity_description = ?, net_weight_capacity_grams = ?,
                 width_mm = ?, height_mm = ?, depth_mm = ?, label_safe_width_mm = ?,
                 label_safe_height_mm = ?, supplier_name = ?, supplier_sku = ?,
                 unit_cost_paise = ?, lead_time_days = ?, moq_units = ?, order_multiple = ?,
                 dieline_url = ?, hero_image_url = ?, image_illustrative = ?, status = ?,
                 revision = revision + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND revision = ?`
          )
          .run(
            resolvedFamilyId ?? existing.family_id,
            input.slug ?? existing.slug,
            input.sku ?? existing.sku,
            input.title ?? existing.title,
            input.material ?? existing.material,
            input.finish ?? existing.finish,
            input.closure_type ?? existing.closure_type,
            input.capacity_description ?? existing.capacity_description,
            input.net_weight_capacity_grams ?? existing.net_weight_capacity_grams,
            input.width_mm ?? existing.width_mm,
            input.height_mm ?? existing.height_mm,
            input.depth_mm !== undefined ? input.depth_mm : existing.depth_mm,
            input.label_safe_width_mm ?? existing.label_safe_width_mm,
            input.label_safe_height_mm ?? existing.label_safe_height_mm,
            input.supplier_name ?? existing.supplier_name,
            input.supplier_sku !== undefined ? input.supplier_sku : existing.supplier_sku,
            input.unit_cost_paise ?? existing.unit_cost_paise,
            input.lead_time_days ?? existing.lead_time_days,
            input.moq_units ?? existing.moq_units,
            input.order_multiple ?? existing.order_multiple,
            input.dieline_url !== undefined ? input.dieline_url : existing.dieline_url,
            input.hero_image_url !== undefined ? input.hero_image_url : existing.hero_image_url,
            input.image_illustrative !== undefined ? (input.image_illustrative ? 1 : 0) : existing.image_illustrative,
            input.status ?? existing.status,
            input.id,
            expRev
          );

        if (result.changes === 0) {
          const recheck = db
            .prepare("SELECT revision FROM pl_packaging_variants WHERE id = ?")
            .get(input.id) as { revision: number } | undefined;
          if (!recheck) throw new PrivateLabelNotFoundError("PackagingVariant", input.id);
          throw new PrivateLabelRevisionConflictError(
            "PackagingVariant",
            input.id,
            recheck.revision,
            expRev
          );
        }

        // Synchronize compatible print methods before checking gate if provided
        if (input.compatible_print_method_ids && Array.isArray(input.compatible_print_method_ids)) {
          const allMethods = db.prepare("SELECT id FROM pl_print_methods").all() as { id: string }[];
          for (const pm of allMethods) {
            const isSupported = input.compatible_print_method_ids.includes(pm.id) ? 1 : 0;
            const existingCompat = db
              .prepare("SELECT id FROM pl_packaging_compatibility WHERE packaging_variant_id = ? AND print_method_id = ?")
              .get(input.id, pm.id) as { id: string } | undefined;
            if (existingCompat) {
              db.prepare("UPDATE pl_packaging_compatibility SET is_supported = ? WHERE id = ?").run(isSupported, existingCompat.id);
            } else {
              db.prepare(
                "INSERT INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported) VALUES (?, ?, ?, ?)"
              ).run(`cmp_${randomUUID()}`, input.id, pm.id, isSupported);
            }
          }
        }

        const updated = db
          .prepare("SELECT * FROM pl_packaging_variants WHERE id = ?")
          .get(input.id) as PackagingVariant;

        if (input.status === "published") {
          const gate = PrivateLabelService.validatePublishGate(input.id);
          if (!gate.canPublish) {
            throw new PrivateLabelGateError("packaging_publish", gate.blockers);
          }
        }

        PrivateLabelService.recordAudit(db, {
          entity_type: "packaging_variant",
          entity_id: input.id,
          revision: updated.revision,
          action: "update",
          actor,
          diff: input,
        });

        return updated;
      } else {
        const id = input.id || `pack_${randomUUID()}`;
        const title = input.title || (input as Record<string, unknown>).name as string || "Packaging Variant";
        const slug =
          input.slug ||
          title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const sku =
          input.sku ||
          `PL-${slug.slice(0, 15).toUpperCase().replace(/-/g, "")}`;
        const finish = input.finish ?? "Standard Finish";
        const closureType = input.closure_type ?? "Standard Closure";
        const capacityDesc = input.capacity_description ?? `${input.net_weight_capacity_grams ?? 100}g`;
        const netGrams = input.net_weight_capacity_grams ?? 100;
        const widthMm = input.width_mm ?? 100;
        const heightMm = input.height_mm ?? 150;
        const safeWidthMm = input.label_safe_width_mm ?? Math.min(widthMm, 80);
        const safeHeightMm = input.label_safe_height_mm ?? Math.min(heightMm, 120);
        const supName = input.supplier_name ?? "Partner Supplier";
        const unitCost = input.unit_cost_paise ?? 1000;

        db.prepare(
          `INSERT INTO pl_packaging_variants (
            id, family_id, slug, sku, title, material, finish, closure_type,
            capacity_description, net_weight_capacity_grams, width_mm, height_mm,
            depth_mm, label_safe_width_mm, label_safe_height_mm, supplier_name,
            supplier_sku, unit_cost_paise, lead_time_days, moq_units, order_multiple,
            dieline_url, hero_image_url, image_illustrative, status, revision,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`
        ).run(
          id,
          resolvedFamilyId,
          slug,
          sku,
          title,
          input.material,
          finish,
          closureType,
          capacityDesc,
          netGrams,
          widthMm,
          heightMm,
          input.depth_mm ?? null,
          safeWidthMm,
          safeHeightMm,
          supName,
          input.supplier_sku ?? null,
          unitCost,
          input.lead_time_days ?? 14,
          input.moq_units ?? 500,
          input.order_multiple ?? 50,
          input.dieline_url ?? null,
          input.hero_image_url ?? null,
          input.image_illustrative ? 1 : 0,
          input.status ?? "published"
        );

        // Synchronize compatible print methods before checking gate if provided
        if (input.compatible_print_method_ids && Array.isArray(input.compatible_print_method_ids)) {
          for (const pmId of input.compatible_print_method_ids) {
            const existingCompat = db
              .prepare("SELECT id FROM pl_packaging_compatibility WHERE packaging_variant_id = ? AND print_method_id = ?")
              .get(id, pmId) as { id: string } | undefined;
            if (existingCompat) {
              db.prepare("UPDATE pl_packaging_compatibility SET is_supported = 1 WHERE id = ?").run(existingCompat.id);
            } else {
              db.prepare(
                "INSERT INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported) VALUES (?, ?, ?, 1)"
              ).run(`cmp_${randomUUID()}`, id, pmId);
            }
          }
        }

        const created = db
          .prepare("SELECT * FROM pl_packaging_variants WHERE id = ?")
          .get(id) as PackagingVariant;

        if (input.status === "published") {
          const gate = PrivateLabelService.validatePublishGate(id);
          if (!gate.canPublish) {
            throw new PrivateLabelGateError("packaging_publish", gate.blockers);
          }
        }

        PrivateLabelService.recordAudit(db, {
          entity_type: "packaging_variant",
          entity_id: id,
          revision: 1,
          action: "create",
          actor,
          diff: input,
        });

        return created;
      }
    })();
  }

  static listTeaOptions(filter?: TeaOptionFilter): { items: TeaOption[]; total: number } {
    const db = getDb();
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.is_published !== undefined) {
      whereClauses.push("is_published = ?");
      params.push(filter.is_published ? 1 : 0);
    } else {
      whereClauses.push("is_published = 1");
    }

    if (filter?.category) {
      whereClauses.push("tea_category = ?");
      params.push(filter.category);
    }

    if (filter?.search) {
      whereClauses.push("(name LIKE ? OR origin_estate LIKE ? OR region LIKE ?)");
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const totalRow = db.prepare(`SELECT count(*) as count FROM pl_tea_options ${whereSql}`).get(...params) as {
      count: number;
    };

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const queryParams = [...params, limit, offset];

    const items = db
      .prepare(
        `SELECT * FROM pl_tea_options
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...queryParams) as TeaOption[];

    return { items, total: totalRow?.count || 0 };
  }

  static getTeaOptionBySlug(slug: string): TeaOption | null {
    const db = getDb();
    const tea = db.prepare("SELECT * FROM pl_tea_options WHERE slug = ?").get(slug) as TeaOption | undefined;
    return tea || null;
  }

  static getTeaOptionById(id: string): TeaOption | null {
    const db = getDb();
    const tea = db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(id) as TeaOption | undefined;
    return tea || null;
  }

  static upsertTeaOption(
    input: Partial<UpsertTeaOptionInput> & { id?: string },
    actor: AuditActor,
    expected_revision?: number
  ): TeaOption {
    const db = getDb();
    return db.transaction(() => {
      const tastingNotesJson = JSON.stringify(input.tasting_notes || []);
      const existing = input.id
        ? (db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(input.id) as TeaOption | undefined)
        : undefined;

      if (expected_revision !== undefined && !existing) {
        throw new PrivateLabelNotFoundError("TeaOption", input.id!);
      }

      if (existing && input.id) {

        if (expected_revision !== undefined && existing.revision !== expected_revision) {
          throw new PrivateLabelRevisionConflictError(
            "TeaOption",
            input.id,
            existing.revision,
            expected_revision
          );
        }

        const expRev = expected_revision ?? existing.revision;
        const result = db
          .prepare(
            `UPDATE pl_tea_options
             SET slug = ?, name = ?, origin_estate = ?, region = ?, grade = ?, flush = ?,
                 tea_category = ?, description = ?, caffeine_level = ?, base_cost_per_kg_paise = ?,
                 min_batch_kg = ?, tasting_notes_json = ?, regular_product_id = ?,
                 is_published = ?, sample_available = ?, revision = revision + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND revision = ?`
          )
          .run(
            input.slug ?? existing.slug,
            input.name ?? existing.name,
            input.origin_estate ?? existing.origin_estate,
            input.region ?? existing.region,
            input.grade ?? existing.grade,
            input.flush ?? existing.flush,
            input.tea_category ?? existing.tea_category,
            input.description ?? existing.description,
            input.caffeine_level ?? existing.caffeine_level,
            input.base_cost_per_kg_paise ?? existing.base_cost_per_kg_paise,
            input.min_batch_kg ?? existing.min_batch_kg,
            input.tasting_notes ? JSON.stringify(input.tasting_notes) : existing.tasting_notes_json,
            input.regular_product_id !== undefined ? input.regular_product_id : existing.regular_product_id,
            input.is_published !== undefined ? (input.is_published ? 1 : 0) : existing.is_published,
            input.sample_available !== undefined ? (input.sample_available ? 1 : 0) : existing.sample_available,
            input.id,
            expRev
          );

        if (result.changes === 0) {
          const recheck = db.prepare("SELECT revision FROM pl_tea_options WHERE id = ?").get(input.id) as
            | { revision: number }
            | undefined;
          if (!recheck) throw new PrivateLabelNotFoundError("TeaOption", input.id);
          throw new PrivateLabelRevisionConflictError("TeaOption", input.id, recheck.revision, expRev);
        }

        const updated = db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(input.id) as TeaOption;

        if (input.is_published === true) {
          const gate = PrivateLabelService.validateTeaPublishGate(input.id);
          if (!gate.canPublish) {
            throw new PrivateLabelGateError("tea_publish", gate.blockers);
          }
        }

        PrivateLabelService.recordAudit(db, {
          entity_type: "tea_option",
          entity_id: input.id,
          revision: updated.revision,
          action: "update",
          actor,
          diff: input,
        });

        return updated;
      } else {
        const id = input.id || `tea_${randomUUID()}`;
        db.prepare(
          `INSERT INTO pl_tea_options (
            id, slug, name, origin_estate, region, grade, flush, tea_category,
            description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
            tasting_notes_json, regular_product_id, is_published, sample_available,
            revision, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`
        ).run(
          id,
          input.slug,
          input.name,
          input.origin_estate,
          input.region,
          input.grade,
          input.flush,
          input.tea_category,
          input.description,
          input.caffeine_level,
          input.base_cost_per_kg_paise,
          input.min_batch_kg ?? 5.0,
          tastingNotesJson,
          input.regular_product_id ?? null,
          input.is_published !== undefined ? (input.is_published ? 1 : 0) : 1,
          input.sample_available !== undefined ? (input.sample_available ? 1 : 0) : 1
        );

        const created = db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(id) as TeaOption;

        if (input.is_published === true) {
          const gate = PrivateLabelService.validateTeaPublishGate(id);
          if (!gate.canPublish) {
            throw new PrivateLabelGateError("tea_publish", gate.blockers);
          }
        }

        PrivateLabelService.recordAudit(db, {
          entity_type: "tea_option",
          entity_id: id,
          revision: 1,
          action: "create",
          actor,
          diff: input,
        });

        return created;
      }
    })();
  }

  static listPrintMethods(): PrintMethod[] {
    const db = getDb();
    return db
      .prepare("SELECT * FROM pl_print_methods WHERE is_active = 1 ORDER BY created_at ASC")
      .all() as PrintMethod[];
  }

  static getPrintMethodById(id: string): PrintMethod | null {
    const db = getDb();
    const method = db.prepare("SELECT * FROM pl_print_methods WHERE id = ?").get(id) as
      | PrintMethod
      | undefined;
    return method || null;
  }

  static checkCompatibility(packagingVariantId: string, printMethodId: string): CompatibilityResult {
    const db = getDb();
    const variant = db
      .prepare(
        `SELECT v.*, f.code as family_code
         FROM pl_packaging_variants v
         LEFT JOIN pl_packaging_families f ON v.family_id = f.id
         WHERE v.id = ?`
      )
      .get(packagingVariantId) as (PackagingVariant & { family_code?: string }) | undefined;

    const printMethod = db.prepare("SELECT * FROM pl_print_methods WHERE id = ?").get(printMethodId) as
      | PrintMethod
      | undefined;

    if (!variant || !printMethod) {
      return { compatible: false, reason: "Packaging variant or print method not found." };
    }

    const explicitRecord = db
      .prepare(
        `SELECT * FROM pl_packaging_compatibility
         WHERE packaging_variant_id = ? AND print_method_id = ?`
      )
      .get(packagingVariantId, printMethodId) as { is_supported: number; notes: string | null } | undefined;

    if (explicitRecord) {
      return {
        compatible: Boolean(explicitRecord.is_supported),
        reason: explicitRecord.is_supported ? undefined : explicitRecord.notes || "Incompatible per catalog matrix.",
        maxColors: printMethod.max_colors,
        notes: explicitRecord.notes || undefined,
      };
    }

    return validateCompatibility({
      familyCode: variant.family_code || "pouch",
      variantSubstrate: variant.material,
      printMethodCode: printMethod.code,
    });
  }

  static validatePublishGate(variantId: string): GateVerificationResult {
    const db = getDb();
    const variant = db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(variantId) as
      | PackagingVariant
      | undefined;

    if (!variant) {
      return { canPublish: false, blockers: ["Packaging variant not found"] };
    }

    const blockers: string[] = [];
    if (!variant.title || variant.title.length < 3) blockers.push("Title must be at least 3 characters");
    if (!variant.material) blockers.push("Material specification missing");
    if (variant.net_weight_capacity_grams <= 0) blockers.push("Net capacity grams must be positive");
    if (variant.width_mm <= 0 || variant.height_mm <= 0) blockers.push("Dimensions width/height must be positive");
    if (variant.unit_cost_paise <= 0) blockers.push("Supplier unit cost must be greater than 0");
    if (
      variant.label_safe_width_mm &&
      variant.width_mm &&
      variant.label_safe_width_mm > variant.width_mm
    ) {
      blockers.push("Label safe width cannot exceed package physical width");
    }
    if (
      variant.label_safe_height_mm &&
      variant.height_mm &&
      variant.label_safe_height_mm > variant.height_mm
    ) {
      blockers.push("Label safe height cannot exceed package physical height");
    }

    const compatCount = (
      db
        .prepare(
          "SELECT count(*) as count FROM pl_packaging_compatibility WHERE packaging_variant_id = ? AND is_supported = 1"
        )
        .get(variantId) as { count: number }
    ).count;

    if (compatCount === 0) {
      blockers.push("At least one supported print method must be configured in compatibility matrix");
    }

    return { canPublish: blockers.length === 0, blockers };
  }

  static validatePackagingPublishGate(variantId: string): GateVerificationResult {
    return this.validatePublishGate(variantId);
  }

  static validateTeaPublishGate(teaOptionId: string): GateVerificationResult {
    const db = getDb();
    const tea = db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(teaOptionId) as TeaOption | undefined;

    if (!tea) {
      return { canPublish: false, blockers: ["Tea option not found"] };
    }

    const blockers: string[] = [];
    if (!tea.name || tea.name.trim().length < 2) blockers.push("Tea name must be at least 2 characters");
    if (!tea.origin_estate || tea.origin_estate.trim().length < 2) blockers.push("Origin estate is required");
    if (!tea.region || tea.region.trim().length < 2) blockers.push("Region is required");
    if (!tea.grade || tea.grade.trim().length < 1) blockers.push("Grade is required");
    if (!tea.flush || tea.flush.trim().length < 1) blockers.push("Flush is required");
    if (!tea.description || tea.description.trim().length < 10) blockers.push("Description must be at least 10 characters");
    if (tea.base_cost_per_kg_paise <= 0) blockers.push("Base cost per kg must be greater than 0");
    if (tea.min_batch_kg <= 0) blockers.push("Minimum batch kg must be greater than 0");

    return { canPublish: blockers.length === 0, blockers };
  }

  static validatePrintMethodGate(printMethodId: string): GateVerificationResult {
    const db = getDb();
    const pm = db.prepare("SELECT * FROM pl_print_methods WHERE id = ?").get(printMethodId) as PrintMethod | undefined;

    if (!pm) {
      return { canPublish: false, blockers: ["Print method not found"] };
    }

    const blockers: string[] = [];
    if (!pm.name || pm.name.trim().length < 2) blockers.push("Name must be at least 2 characters");
    if (pm.max_colors < 1) blockers.push("Max colors must be at least 1");
    if (pm.min_order_units <= 0) blockers.push("Minimum order units must be positive");
    if (pm.lead_time_days <= 0) blockers.push("Lead time days must be positive");
    if (pm.code === "gravure" && pm.cylinder_fee_per_color_paise <= 0) {
      blockers.push("Rotogravure print method requires cylinder fee per color > 0");
    }

    return { canPublish: blockers.length === 0, blockers };
  }

  static validatePriceBookGate(priceBookId: string): GateVerificationResult {
    const db = getDb();
    const pb = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(priceBookId) as PriceBook | undefined;

    if (!pb) {
      return { canPublish: false, blockers: ["Price book not found"] };
    }

    const blockers: string[] = [];
    if (!pb.name || pb.name.trim().length < 2) blockers.push("Price book name must be at least 2 characters");
    if (pb.margin_rate < 0 || pb.margin_rate >= 1.0) blockers.push("Margin rate must be between 0.0 and 0.99");
    if (pb.filling_labor_paise_per_unit <= 0) blockers.push("Filling labor per unit must be greater than 0");
    if (pb.qc_charge_paise_per_batch <= 0) blockers.push("QC charge per batch must be greater than 0");
    if (pb.contingency_rate < 0 || pb.contingency_rate >= 0.5) blockers.push("Contingency rate must be between 0.0 and 0.49");
    if (pb.loss_allowance_rate < 0 || pb.loss_allowance_rate >= 0.2) blockers.push("Loss allowance rate must be between 0.0 and 0.19");
    if (pb.effective_to && pb.effective_from && pb.effective_to <= pb.effective_from) {
      blockers.push("effective_to must be after effective_from");
    }

    return { canPublish: blockers.length === 0, blockers };
  }

  static validateQCGate(jobId: string): GateVerificationResult {
    const db = getDb();
    const job = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(jobId);
    if (!job) {
      return { canPublish: false, blockers: ["Production job not found"] };
    }

    const standardStages = [
      "raw_material",
      "packaging_incoming",
      "print_proof",
      "fill_weight",
      "seal_integrity",
      "sensory_cupping",
      "final_pack",
    ];

    const milestones = db
      .prepare("SELECT stage, status FROM pl_qc_milestones WHERE job_id = ?")
      .all(jobId) as Array<{ stage: string; status: string }>;

    const statusMap = new Map(milestones.map((m) => [m.stage, m.status]));
    const blockers: string[] = [];

    for (const stage of standardStages) {
      const status = statusMap.get(stage);
      if (!status || (status !== "passed" && status !== "waived")) {
        blockers.push(`QC milestone '${stage}' is not passed or waived (current status: '${status ?? "missing"}')`);
      }
    }

    return { canPublish: blockers.length === 0, blockers };
  }

  static listPackagingAdmin(filter?: {
    status?: PackagingVariantStatus | "all";
    familyCode?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }): {
    items: Array<PackagingVariant & { family_name?: string; can_publish: boolean; blockers: string[] }>;
    total: number;
    page: number;
    limit: number;
  } {
    const db = getDb();
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.status && filter.status !== "all") {
      where.push("v.status = ?");
      params.push(filter.status);
    }
    if (filter?.familyCode) {
      where.push("v.family_id IN (SELECT id FROM pl_packaging_families WHERE code = ?)");
      params.push(filter.familyCode);
    }
    if (filter?.search) {
      where.push("(v.title LIKE ? OR v.sku LIKE ? OR v.supplier_name LIKE ? OR v.material LIKE ?)");
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const totalRow = db.prepare(`SELECT count(*) as c FROM pl_packaging_variants v ${whereSql}`).get(...params) as { c: number };

    const limit = filter?.limit ?? 20;
    const offset = filter?.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    const allowedSort = ["title", "sku", "created_at", "unit_cost_paise"];
    const sortBy = filter?.sortBy && allowedSort.includes(filter.sortBy) ? filter.sortBy : "created_at";
    const sortDir = filter?.sortDir === "asc" ? "ASC" : "DESC";

    const rows = db.prepare(
      `SELECT v.*, f.name as family_name, f.code as family_code
       FROM pl_packaging_variants v
       LEFT JOIN pl_packaging_families f ON f.id = v.family_id
       ${whereSql}
       ORDER BY v.${sortBy} ${sortDir}
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Array<PackagingVariant & { family_name?: string }>;

    const items = rows.map((v) => {
      const gate = PrivateLabelService.validatePublishGate(v.id);
      return {
        ...v,
        can_publish: gate.canPublish,
        blockers: gate.blockers,
      };
    });

    return { items, total: totalRow.c, page, limit };
  }

  static getPackagingVariantById(id: string): (PackagingVariantWithDetails & { can_publish: boolean; blockers: string[] }) | null {
    const db = getDb();
    const variant = db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(id) as PackagingVariant | undefined;
    if (!variant) return null;
    const family = db.prepare("SELECT * FROM pl_packaging_families WHERE id = ?").get(variant.family_id) as PackagingFamily | undefined;
    const compatibleMethods = db.prepare(
      `SELECT p.* FROM pl_print_methods p
       JOIN pl_packaging_compatibility c ON c.print_method_id = p.id
       WHERE c.packaging_variant_id = ? AND c.is_supported = 1`
    ).all(id) as PrintMethod[];
    const gate = PrivateLabelService.validatePublishGate(id);
    return {
      ...variant,
      family,
      compatible_print_methods: compatibleMethods,
      can_publish: gate.canPublish,
      blockers: gate.blockers,
    };
  }

  static archivePackagingVariant(id: string, actor: AuditActor): PackagingVariant {
    const db = getDb();
    return db.transaction(() => {
      const variant = db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(id) as PackagingVariant | undefined;
      if (!variant) {
        throw new PrivateLabelNotFoundError("PackagingVariant", id);
      }
      if (variant.status === "published") {
        throw new Error("Cannot delete a published packaging variant. Must unpublish or archive first.");
      }

      db.prepare(
        "UPDATE pl_packaging_variants SET status = 'archived', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(id);

      const updated = db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(id) as PackagingVariant;
      PrivateLabelService.recordAudit(db, {
        entity_type: "packaging_variant",
        entity_id: id,
        revision: updated.revision,
        action: "archive",
        actor,
      });
      return updated;
    })();
  }

  static attachPackagingImage(
    variantIdOrSlugOrSku: string,
    url: string,
    imageType: "hero" | "dieline" = "hero",
    actor: AuditActor,
    expectedRevision?: number
  ): PackagingVariant {
    const db = getDb();
    return db.transaction(() => {
      const existing = db
        .prepare("SELECT * FROM pl_packaging_variants WHERE id = ? OR slug = ? OR sku = ?")
        .get(variantIdOrSlugOrSku, variantIdOrSlugOrSku, variantIdOrSlugOrSku) as PackagingVariant | undefined;
      if (!existing) {
        throw new PrivateLabelNotFoundError("PackagingVariant", variantIdOrSlugOrSku);
      }
      if (expectedRevision !== undefined && existing.revision !== expectedRevision) {
        throw new PrivateLabelRevisionConflictError("PackagingVariant", existing.id, existing.revision, expectedRevision);
      }

      const field = imageType === "dieline" ? "dieline_url" : "hero_image_url";
      db.prepare(
        `UPDATE pl_packaging_variants
         SET ${field} = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND revision = ?`
      ).run(url, existing.id, existing.revision);

      const updated = db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(existing.id) as PackagingVariant;

      PrivateLabelService.recordAudit(db, {
        entity_type: "packaging_variant",
        entity_id: existing.id,
        revision: updated.revision,
        action: "update",
        actor,
        diff: { [field]: url },
      });

      return updated;
    })();
  }

  static listTeaOptionsAdmin(filter?: {
    is_published?: boolean | "all";
    category?: TeaCategory;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }): {
    items: Array<TeaOption & { can_publish: boolean; blockers: string[] }>;
    total: number;
    page: number;
    limit: number;
  } {
    const db = getDb();
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.is_published !== undefined && filter.is_published !== "all") {
      where.push("is_published = ?");
      params.push(filter.is_published ? 1 : 0);
    }
    if (filter?.category) {
      where.push("tea_category = ?");
      params.push(filter.category);
    }
    if (filter?.search) {
      where.push("(name LIKE ? OR origin_estate LIKE ? OR grade LIKE ? OR region LIKE ?)");
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const totalRow = db.prepare(`SELECT count(*) as c FROM pl_tea_options ${whereSql}`).get(...params) as { c: number };

    const limit = filter?.limit ?? 20;
    const offset = filter?.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    const allowedSort = ["name", "created_at", "base_cost_per_kg_paise"];
    const sortBy = filter?.sortBy && allowedSort.includes(filter.sortBy) ? filter.sortBy : "created_at";
    const sortDir = filter?.sortDir === "asc" ? "ASC" : "DESC";

    const rows = db.prepare(
      `SELECT * FROM pl_tea_options
       ${whereSql}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as TeaOption[];

    const items = rows.map((t) => {
      const gate = PrivateLabelService.validateTeaPublishGate(t.id);
      return {
        ...t,
        can_publish: gate.canPublish,
        blockers: gate.blockers,
      };
    });

    return { items, total: totalRow.c, page, limit };
  }

  static getTeaOptionAdminById(id: string): (TeaOption & { can_publish: boolean; blockers: string[] }) | null {
    const db = getDb();
    const tea = db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(id) as TeaOption | undefined;
    if (!tea) return null;
    const gate = PrivateLabelService.validateTeaPublishGate(id);
    return {
      ...tea,
      can_publish: gate.canPublish,
      blockers: gate.blockers,
    };
  }

  static listPackagingFamiliesAdmin(filter?: { isActive?: boolean }): PackagingFamily[] {
    const db = getDb();
    if (filter?.isActive !== undefined) {
      return db.prepare("SELECT * FROM pl_packaging_families WHERE is_active = ? ORDER BY sort_order ASC").all(filter.isActive ? 1 : 0) as PackagingFamily[];
    }
    return db.prepare("SELECT * FROM pl_packaging_families ORDER BY sort_order ASC").all() as PackagingFamily[];
  }

  static upsertPackagingFamily(
    input: { id?: string; code: string; name: string; description: string; sort_order?: number; is_active?: boolean },
    actor: AuditActor
  ): PackagingFamily {
    const db = getDb();
    return db.transaction(() => {
      const id = input.id || `fam_${input.code}`;
      const existing = db.prepare("SELECT * FROM pl_packaging_families WHERE id = ?").get(id) as PackagingFamily | undefined;
      if (existing) {
        db.prepare(
          `UPDATE pl_packaging_families
           SET code = ?, name = ?, description = ?, sort_order = ?, is_active = ?
           WHERE id = ?`
        ).run(
          input.code,
          input.name,
          input.description,
          input.sort_order ?? existing.sort_order,
          input.is_active !== undefined ? (input.is_active ? 1 : 0) : existing.is_active,
          id
        );
      } else {
        db.prepare(
          `INSERT INTO pl_packaging_families (id, code, name, description, sort_order, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(
          id,
          input.code,
          input.name,
          input.description,
          input.sort_order ?? 10,
          input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1
        );
      }
      const fam = db.prepare("SELECT * FROM pl_packaging_families WHERE id = ?").get(id) as PackagingFamily;
      PrivateLabelService.recordAudit(db, {
        entity_type: "packaging_family",
        entity_id: id,
        revision: 1,
        action: existing ? "update" : "create",
        actor,
        diff: input,
      });
      return fam;
    })();
  }

  static listPrintMethodsAdmin(filter?: { isActive?: boolean }): PrintMethod[] {
    const db = getDb();
    if (filter?.isActive !== undefined) {
      return db.prepare("SELECT * FROM pl_print_methods WHERE is_active = ? ORDER BY id ASC").all(filter.isActive ? 1 : 0) as PrintMethod[];
    }
    return db.prepare("SELECT * FROM pl_print_methods ORDER BY id ASC").all() as PrintMethod[];
  }

  static upsertPrintMethod(
    input: {
      id?: string;
      code: string;
      name: string;
      description?: string;
      color_model: string;
      max_colors?: number;
      setup_fee_paise?: number;
      cylinder_fee_per_color_paise?: number;
      min_order_units?: number;
      lead_time_days?: number;
      is_active?: boolean;
    },
    actor: AuditActor
  ): PrintMethod {
    const db = getDb();
    return db.transaction(() => {
      let id = input.id;
      if (id) {
        db.prepare(
          `UPDATE pl_print_methods
           SET code = ?, name = ?, description = ?, color_model = ?, max_colors = ?,
               setup_fee_paise = ?, cylinder_fee_per_color_paise = ?, min_order_units = ?,
               lead_time_days = ?, is_active = ?
           WHERE id = ?`
        ).run(
          input.code,
          input.name,
          input.description ?? "",
          input.color_model,
          input.max_colors ?? 4,
          input.setup_fee_paise ?? 0,
          input.cylinder_fee_per_color_paise ?? 0,
          input.min_order_units ?? 100,
          input.lead_time_days ?? 10,
          input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1,
          id
        );
      } else {
        id = `pm_${input.code || randomUUID()}`;
        db.prepare(
          `INSERT INTO pl_print_methods (
            id, code, name, description, color_model, max_colors, setup_fee_paise,
            cylinder_fee_per_color_paise, min_order_units, lead_time_days, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(
          id,
          input.code,
          input.name,
          input.description ?? "",
          input.color_model,
          input.max_colors ?? 4,
          input.setup_fee_paise ?? 0,
          input.cylinder_fee_per_color_paise ?? 0,
          input.min_order_units ?? 100,
          input.lead_time_days ?? 10,
          input.is_active !== undefined ? (input.is_active ? 1 : 0) : 1
        );
      }
      const pm = db.prepare("SELECT * FROM pl_print_methods WHERE id = ?").get(id) as PrintMethod;
      PrivateLabelService.recordAudit(db, {
        entity_type: "print_method",
        entity_id: id,
        revision: 1,
        action: input.id ? "update" : "create",
        actor,
        diff: input,
      });
      return pm;
    })();
  }

  static listPackagingCompatibility(packagingVariantId?: string): Array<PackagingCompatibility & { print_method_name?: string; print_method_code?: string }> {
    const db = getDb();
    if (packagingVariantId) {
      return db.prepare(
        `SELECT c.*, p.name as print_method_name, p.code as print_method_code
         FROM pl_packaging_compatibility c
         JOIN pl_print_methods p ON p.id = c.print_method_id
         WHERE c.packaging_variant_id = ?`
      ).all(packagingVariantId) as Array<PackagingCompatibility & { print_method_name?: string; print_method_code?: string }>;
    }
    return db.prepare(
      `SELECT c.*, p.name as print_method_name, p.code as print_method_code
       FROM pl_packaging_compatibility c
       JOIN pl_print_methods p ON p.id = c.print_method_id`
    ).all() as Array<PackagingCompatibility & { print_method_name?: string; print_method_code?: string }>;
  }

  static setPackagingCompatibility(
    packagingVariantId: string,
    printMethodId: string,
    isSupported: boolean,
    notes: string | null,
    actor: AuditActor
  ): PackagingCompatibility {
    const db = getDb();
    return db.transaction(() => {
      const existing = db
        .prepare("SELECT id FROM pl_packaging_compatibility WHERE packaging_variant_id = ? AND print_method_id = ?")
        .get(packagingVariantId, printMethodId) as { id: string } | undefined;

      let id = existing?.id;
      if (id) {
        db.prepare(
          "UPDATE pl_packaging_compatibility SET is_supported = ?, notes = ? WHERE id = ?"
        ).run(isSupported ? 1 : 0, notes, id);
      } else {
        id = `compat_${randomUUID()}`;
        db.prepare(
          `INSERT INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported, notes, created_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(id, packagingVariantId, printMethodId, isSupported ? 1 : 0, notes);
      }

      const record = db.prepare("SELECT * FROM pl_packaging_compatibility WHERE id = ?").get(id) as PackagingCompatibility;
      PrivateLabelService.recordAudit(db, {
        entity_type: "packaging_compatibility",
        entity_id: id,
        revision: 1,
        action: "set_compatibility",
        actor,
        diff: { packagingVariantId, printMethodId, isSupported, notes },
      });
      return record;
    })();
  }

  // ==========================================================================
  // 2. Project Domain (Tenant Isolated Drafts & Stepper Configurations)
  // ==========================================================================

  static createProjectDraft(
    input: CreateProjectInput,
    customerId: string,
    actor: AuditActor
  ): Project {
    const db = getDb();
    const id = `proj_${randomUUID()}`;

    return db.transaction(() => {
      // Find or provision client record for customer
      let clientId = input.clientId || input.client_id;
      if (!clientId && customerId) {
        const clientRow = db
          .prepare("SELECT id FROM pl_clients WHERE customer_id = ?")
          .get(customerId) as { id: string } | undefined;
        if (clientRow) {
          clientId = clientRow.id;
        } else {
          const newClientId = `client_${randomUUID()}`;
          // Verify customer exists in customers table before storing customer_id FK
          const customerExists = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
          const validCustomerId = customerExists ? customerId : null;

          db.prepare(
            `INSERT INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
             VALUES (?, ?, ?, ?, ?)`
          ).run(
            newClientId,
            validCustomerId,
            input.brand_name || "Private Label Client",
            actor.actor_email?.split("@")[0] || "Customer",
            actor.actor_email || "customer@example.com"
          );
          clientId = newClientId;
        }
      }

      const draftConfigJson = input.draft_configuration
        ? JSON.stringify(input.draft_configuration)
        : JSON.stringify(input.initialConfig || {});

      db.prepare(
        `INSERT INTO pl_projects (
          id, client_id, owner_customer_id, brand_id, title, status, target_market,
          notes, draft_configuration_json, revision, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'draft', ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      ).run(
        id,
        clientId || null,
        customerId,
        input.brand_id || null,
        input.title.trim(),
        input.target_market?.trim() || "IN",
        input.notes ?? null,
        draftConfigJson
      );

      if (Array.isArray(input.items) && input.items.length > 0) {
        for (const it of input.items) {
          const itemId = `pitem_${randomUUID()}`;
          const teaId = it.teaOptionId || it.tea_option_id || null;
          const packId = it.packagingVariantId || it.packaging_variant_id || null;
          const printId = it.printMethodId || it.print_method_id || null;
          const fillWeight = it.fillWeightGrams ?? it.fill_weight_grams ?? null;
          const qty = it.quantityUnits ?? it.quantity_units ?? null;
          const colors = it.colorCount ?? it.color_count ?? 1;
          const designVer = it.designVersionId ?? it.design_version_id ?? null;

          db.prepare(
            `INSERT INTO pl_project_items (
              id, project_id, tea_option_id, packaging_variant_id, print_method_id,
              fill_weight_grams, quantity_units, color_count, design_version_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          ).run(itemId, id, teaId, packId, printId, fillWeight, qty, colors, designVer);
        }
      }

      const created = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(id) as Project;

      PrivateLabelService.recordAudit(db, {
        entity_type: "project",
        entity_id: id,
        revision: 1,
        action: "create_draft",
        actor,
        diff: { title: input.title, target_market: input.target_market, customerId },
      });

      return created;
    })();
  }

  static getProject(id: string, customerId?: string): ProjectWithItems {
    const db = getDb();
    const project = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(id) as Project | undefined;

    if (!project) {
      throw new PrivateLabelNotFoundError("Project", id);
    }

    // Strict tenant isolation: return 404 on access violation (anti-enumeration)
    if (customerId && project.owner_customer_id !== customerId) {
      throw new PrivateLabelNotFoundError("Project", id);
    }

    const items = db.prepare("SELECT * FROM pl_project_items WHERE project_id = ?").all(id) as ProjectItem[];

    return {
      ...project,
      items,
    };
  }

  static listProjects(customerId: string, filter?: ProjectFilter): { projects: Project[]; total: number } {
    const db = getDb();
    const whereClauses: string[] = ["owner_customer_id = ?"];
    const params: (string | number)[] = [customerId];

    if (filter?.status) {
      whereClauses.push("status = ?");
      params.push(filter.status);
    }

    const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
    const totalRow = db.prepare(`SELECT count(*) as count FROM pl_projects ${whereSql}`).get(...params) as {
      count: number;
    };

    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const queryParams = [...params, limit, offset];

    const projects = db
      .prepare(`SELECT * FROM pl_projects ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      .all(...queryParams) as Project[];

    return { projects, total: totalRow?.count || 0 };
  }

  static updateProjectDraft(
    id: string,
    expected_revision: number,
    input: UpdateProjectInput,
    actor: AuditActor,
    customerId?: string
  ): Project {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(id) as Project | undefined;

      if (!existing) {
        throw new PrivateLabelNotFoundError("Project", id);
      }

      // Tenant isolation check
      if (customerId && existing.owner_customer_id !== customerId) {
        throw new PrivateLabelNotFoundError("Project", id);
      }

      // Revision check
      if (existing.revision !== expected_revision) {
        throw new PrivateLabelRevisionConflictError("Project", id, existing.revision, expected_revision);
      }

      const title = input.title !== undefined ? input.title.trim() : existing.title;
      const targetMarket =
        input.target_market !== undefined ? input.target_market.trim() : existing.target_market;
      const notes = input.notes !== undefined ? input.notes : existing.notes;
      const status = input.status !== undefined ? input.status : existing.status;
      const draftConfigJson =
        input.draft_configuration !== undefined
          ? JSON.stringify(input.draft_configuration)
          : existing.draft_configuration_json;

      const result = db
        .prepare(
          `UPDATE pl_projects
           SET title = ?, target_market = ?, notes = ?, status = ?,
               draft_configuration_json = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(title, targetMarket, notes, status, draftConfigJson, id, expected_revision);

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new PrivateLabelNotFoundError("Project", id);
        throw new PrivateLabelRevisionConflictError(
          "Project",
          id,
          recheck.revision,
          expected_revision
        );
      }

      if (input.items !== undefined && Array.isArray(input.items)) {
        // Quote snapshots reference these IDs. Update rows rather than deleting
        // the entire item set, which fails as soon as a quote exists.
        const previous = db.prepare("SELECT * FROM pl_project_items WHERE project_id = ? ORDER BY created_at, id").all(id) as ProjectItem[];
        const retained = new Set<string>();
        const lockedProof = db.prepare("SELECT id FROM pl_design_versions WHERE project_id = ? AND is_locked = 1 LIMIT 1").get(id);
        if (lockedProof && (JSON.stringify(input.items) !== JSON.stringify(previous) || draftConfigJson !== existing.draft_configuration_json)) {
          throw new PrivateLabelGateError("proof_locked", ["This project has a locked proof. Request a new proof revision before changing the configuration."]);
        }
        for (const [index, it] of input.items.entries()) {
          const explicitId = "id" in it && typeof it.id === "string" ? it.id : null;
          const old = explicitId ? previous.find(row => row.id === explicitId) : previous[index];
          if (explicitId && !old) throw new PrivateLabelNotFoundError("Project item", explicitId);
          const itemId = old?.id || `pitem_${randomUUID()}`;
          if (retained.has(itemId)) throw new PrivateLabelGateError("project_items", ["Each project item must be unique."]);
          retained.add(itemId);
          const values = [it.teaOptionId || it.tea_option_id || null, it.packagingVariantId || it.packaging_variant_id || null,
            it.printMethodId || it.print_method_id || null, it.fillWeightGrams ?? it.fill_weight_grams ?? null,
            it.quantityUnits ?? it.quantity_units ?? null, it.colorCount ?? it.color_count ?? 1,
            it.designVersionId ?? it.design_version_id ?? old?.design_version_id ?? null];
          if (old) {
            db.prepare(`UPDATE pl_project_items SET tea_option_id = ?, packaging_variant_id = ?, print_method_id = ?,
              fill_weight_grams = ?, quantity_units = ?, color_count = ?, design_version_id = ? WHERE id = ? AND project_id = ?`)
              .run(...values, itemId, id);
          } else {
            db.prepare(`INSERT INTO pl_project_items (id, project_id, tea_option_id, packaging_variant_id, print_method_id,
              fill_weight_grams, quantity_units, color_count, design_version_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).run(itemId, id, ...values);
          }
        }
        for (const old of previous) if (!retained.has(old.id)) {
          if (db.prepare("SELECT id FROM pl_quote_items WHERE project_item_id = ? LIMIT 1").get(old.id))
            throw new PrivateLabelGateError("quoted_item", ["A quoted item cannot be removed. Start a new project for a different item list."]);
          db.prepare("DELETE FROM pl_project_items WHERE id = ? AND project_id = ?").run(old.id, id);
        }
      }

      const nextRev = expected_revision + 1;
      PrivateLabelService.recordAudit(db, {
        entity_type: "project",
        entity_id: id,
        revision: nextRev,
        action: "update_draft",
        actor,
        diff: {
          title: input.title,
          target_market: input.target_market,
          notes: input.notes,
          status: input.status,
          draft_configuration: input.draft_configuration,
        },
      });

      return db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(id) as Project;
    })();
  }

  static archiveProject(
    id: string,
    expected_revision: number,
    actor: AuditActor,
    customerId?: string
  ): Project {
    return PrivateLabelService.updateProjectDraft(
      id,
      expected_revision,
      { status: "archived" },
      actor,
      customerId
    );
  }

  // ==========================================================================
  // 3. Quotation Domain (MOQ, Pricing Engine & Snapshots)
  // ==========================================================================

  static evaluateMoq(params: MoqEvaluationParams): MoqEvaluationResult {
    return calculateMOQ(params);
  }

  static calculateEstimate(params: PricingCalculationParams): PriceEstimateResult {
    return calculateQuote(params);
  }

  static createQuote(
    projectId: string,
    input: CreateQuoteInput,
    actor: AuditActor,
    customerId?: string
  ): QuoteWithItems {
    const db = getDb();

    return db.transaction(() => {
      const project = PrivateLabelService.getProject(projectId, customerId);

      // Resolve price book (active default if not specified)
      const inputRec = input as Record<string, unknown>;
      let priceBookId =
        input.price_book_id ||
        (typeof inputRec.priceBookId === "string" ? inputRec.priceBookId : undefined);
      let priceBookRow: PriceBook | undefined = undefined;
      if (priceBookId) {
        priceBookRow = db
          .prepare("SELECT * FROM pl_price_books WHERE id = ?")
          .get(priceBookId) as PriceBook | undefined;
      }
      if (!priceBookRow) {
        priceBookRow = db
          .prepare("SELECT * FROM pl_price_books WHERE is_default = 1 AND status = 'active'")
          .get() as PriceBook | undefined;
        if (!priceBookRow) {
          priceBookRow = db
            .prepare("SELECT * FROM pl_price_books WHERE status = 'active' LIMIT 1")
            .get() as PriceBook | undefined;
        }
        if (!priceBookRow) {
          priceBookId = "pb_standard_inr";
          db.prepare(
            `INSERT INTO pl_price_books (id, name, currency, is_default, status)
             VALUES ('pb_standard_inr', 'Standard INR Price Book', 'INR', 1, 'active')`
          ).run();
          priceBookRow = db
            .prepare("SELECT * FROM pl_price_books WHERE id = 'pb_standard_inr'")
            .get() as PriceBook;
        } else {
          priceBookId = priceBookRow.id;
        }
      }

      const quoteId = `quote_${randomUUID()}`;
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const quoteNumber = `TF-PLQ-${todayStr}-${quoteId.slice(6).replaceAll("-", "").toUpperCase()}`;
      const validityDays =
        input.validity_days ||
        (typeof inputRec.validityDays === "number" ? inputRec.validityDays : 14);
      const validUntil = new Date(Date.now() + validityDays * 86400000).toISOString();
      const pdfSummaryUrl = `/private-label/quotes/${quoteId}/print`;

      // Check if project has configured items or draft config
      let itemsToQuote = project.items;
      if ((!itemsToQuote || itemsToQuote.length === 0) && project.draft_configuration_json) {
        try {
          const draftConf = JSON.parse(project.draft_configuration_json);
          const pkgId = draftConf.packagingVariantId || draftConf.packaging_variant_id;
          const teaId = draftConf.teaOptionId || draftConf.tea_recipe_id || draftConf.tea_option_id;
          const qUnits = draftConf.quantityUnits || draftConf.quantity || draftConf.quantity_units;

          if (pkgId && teaId && qUnits) {
            itemsToQuote = [
              {
                id: `pitem_${randomUUID()}`,
                project_id: projectId,
                tea_option_id: teaId,
                packaging_variant_id: pkgId,
                print_method_id: draftConf.printMethodId || draftConf.print_method_id || "pm_paper_label",
                fill_weight_grams: Number(draftConf.fillWeightGrams ?? draftConf.fill_weight_grams ?? 100),
                quantity_units: Number(qUnits),
                color_count: Number(draftConf.colorCount ?? draftConf.color_count ?? 1),
                design_version_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
          }
        } catch {
          // ignore draft parse error
        }
      }

      if (!itemsToQuote || itemsToQuote.length === 0) {
        // Backward-compatible empty draft quotation
        db.prepare(
          `INSERT INTO pl_quotes (
            id, quote_number, project_id, price_book_id, status, version, currency,
            tea_subtotal_paise, packaging_subtotal_paise, printing_subtotal_paise,
            tooling_setup_paise, labor_subtotal_paise, qc_subtotal_paise, freight_paise,
            margin_paise, tax_paise, grand_total_paise, price_breakdown_json,
            pdf_summary_url, issued_at, valid_until, revision, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, 'draft', 1, 'INR',
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '{}',
            ?, CURRENT_TIMESTAMP, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`
        ).run(quoteId, quoteNumber, projectId, priceBookId, pdfSummaryUrl, validUntil);

        const quote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote;
        PrivateLabelService.recordAudit(db, {
          entity_type: "quote",
          entity_id: quoteId,
          revision: 1,
          action: "create_quote",
          actor,
          diff: { quote_number: quoteNumber, projectId, priceBookId },
        });

        return { ...quote, items: [] };
      }

      // We have items to quote: compute 12-component pricing
      const activeTiers = db
        .prepare("SELECT item_type, item_id, min_qty, max_qty, unit_price_paise FROM pl_price_book_tiers WHERE price_book_id = ?")
        .all(priceBookId) as PriceBookTier[];

      let teaSubtotalPaise = 0;
      let packSubtotalPaise = 0;
      let printSubtotalPaise = 0;
      let toolingSetupPaise = 0;
      let laborSubtotalPaise = 0;
      let qcSubtotalPaise = 0;
      let freightPaise = 0;
      let marginPaise = 0;
      let taxPaise = 0;
      let grandTotalPaise = 0;

      const destinationZone = input.destination_zone || input.destinationZone || "metro";
      const createdQuoteItems: QuoteItem[] = [];
      let lastBreakdown: ItemizedPriceBreakdown | null = null;

      for (const item of itemsToQuote) {
        const teaRow = item.tea_option_id
          ? (db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(item.tea_option_id) as TeaOption | undefined)
          : null;
        const packRow = item.packaging_variant_id
          ? (db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(item.packaging_variant_id) as PackagingVariant | undefined)
          : null;
        const printRow = item.print_method_id
          ? (db.prepare("SELECT * FROM pl_print_methods WHERE id = ?").get(item.print_method_id) as PrintMethod | undefined)
          : null;

        const Q = Number(item.quantity_units || 0);
        const W = Number(item.fill_weight_grams || 100);
        if (packRow && printRow) validatePhysicalQuote(packRow, printRow, W, Number(item.color_count || 1));

        // MOQ validation
        const moqResult = PrivateLabelService.evaluateMoq({
          requestedUnits: Q,
          netWeightGrams: W,
          teaMinBatchKg: Number(teaRow?.min_batch_kg ?? 5),
          packagingMOQ: Number(packRow?.moq_units ?? 500),
          printMOQ: Number(printRow?.min_order_units ?? 100),
          fillingMOQ: 100,
          orderMultiple: Number(packRow?.order_multiple ?? 1),
        });

        if (!moqResult.eligible) {
          throw new PrivateLabelGateError("moq_requirement", moqResult.reasons);
        }

        const calcResult = calculateItemized12ComponentQuote({
          requestedUnits: Q,
          netWeightGrams: W,
          teaOption: {
            id: teaRow?.id || "tea_default",
            baseCostPerKgPaise: Number(teaRow?.base_cost_per_kg_paise ?? 200000),
            minBatchKg: Number(teaRow?.min_batch_kg ?? 5),
            teaCategory: teaRow?.tea_category,
          },
          packagingVariant: {
            id: packRow?.id || "pack_default",
            unitCostPaise: Number(packRow?.unit_cost_paise ?? 1200),
            closureRatePaise: Number(packRow?.closure_rate_paise ?? 150),
            tareWeightGrams: Number(packRow?.tare_weight_grams ?? 15),
            packsPerCarton: Number(packRow?.packs_per_carton ?? 24),
          },
          printMethod: {
            id: printRow?.id || "pm_default",
            code: (printRow?.code as PrintMethodCode) || "bopp_label",
            setupFeePaise: Number(printRow?.setup_fee_paise ?? 150000),
            cylinderFeePerColorPaise: Number(printRow?.cylinder_fee_per_color_paise ?? 0),
            unitCostPaise: Number(printRow?.unit_cost_paise ?? 250),
          },
          colorCount: Number(item.color_count || 1),
          isNitrogenFlushEnabled: JSON.parse(project.draft_configuration_json || "{}").isNitrogenFlushEnabled === true,
          priceBook: {
            id: priceBookRow.id,
            marginRate: Number(priceBookRow.margin_rate ?? 0.25),
            fillingLaborPaisePerUnit: Number(priceBookRow.filling_labor_paise_per_unit ?? 300),
            qcChargePaisePerBatch: Number(priceBookRow.qc_charge_paise_per_batch ?? 250000),
            lossAllowanceRate: Number(priceBookRow.loss_allowance_rate ?? 0.03),
          },
          destinationZone: destinationZone as "local" | "metro" | "national" | "international",
          activeTiers,
        });

        if (calcResult.status === "manual_quote_required" || !calcResult.breakdown) {
          throw new PrivateLabelGateError("pricing_estimation", calcResult.missingRates);
        }

        const b = calcResult.breakdown;
        lastBreakdown = b;
        teaSubtotalPaise += b.teaCostPaise;
        packSubtotalPaise += b.packagingCostPaise + b.closureFinishingCostPaise;
        printSubtotalPaise += b.printingCostPaise;
        toolingSetupPaise += b.toolingSetupPaise;
        laborSubtotalPaise += b.laborCostPaise + b.nitrogenFlushingCostPaise;
        qcSubtotalPaise += b.qcCostPaise;
        freightPaise += b.freightCostPaise + b.cartonCostPaise + b.palletizingCostPaise;
        marginPaise += b.marginPaise;
        taxPaise += b.taxPaise;
        grandTotalPaise += b.grandTotalPaise;

        const quoteItemId = `qitem_${randomUUID()}`;
        const desc = `${teaRow?.name || "Custom Tea"} in ${packRow?.title || "Custom Pack"} (${W}g) - ${Q} units`;
        const unitPrice = b.unitPricePaise;
        const lineTotal = b.grandTotalPaise;

        // Ensure project item exists in pl_project_items if synthesized from draft config
        let projectItemId = item.id;
        const existingProjectItem = projectItemId
          ? db.prepare("SELECT id FROM pl_project_items WHERE id = ?").get(projectItemId)
          : null;
        if (!existingProjectItem) {
          projectItemId = `pitem_${randomUUID()}`;
          db.prepare(
            `INSERT INTO pl_project_items (
              id, project_id, tea_option_id, packaging_variant_id, print_method_id,
              fill_weight_grams, quantity_units, color_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
          ).run(
            projectItemId,
            projectId,
            item.tea_option_id,
            item.packaging_variant_id,
            item.print_method_id,
            W,
            Q,
            item.color_count || 1
          );
        }

        createdQuoteItems.push({
          id: quoteItemId,
          quote_id: quoteId,
          project_item_id: projectItemId,
          description: desc,
          quantity: Q,
          unit_price_paise: unitPrice,
          line_total_paise: lineTotal,
          cost_breakdown_json: JSON.stringify(b),
          created_at: new Date().toISOString(),
        });
      }

      db.prepare(
        `INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, version, currency,
          tea_subtotal_paise, packaging_subtotal_paise, printing_subtotal_paise,
          tooling_setup_paise, labor_subtotal_paise, qc_subtotal_paise, freight_paise,
          margin_paise, tax_paise, grand_total_paise, price_breakdown_json,
          pdf_summary_url, issued_at, valid_until, revision, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, 'estimated', 1, 'INR',
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, CURRENT_TIMESTAMP, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      ).run(
        quoteId,
        quoteNumber,
        projectId,
        priceBookId,
        teaSubtotalPaise,
        packSubtotalPaise,
        printSubtotalPaise,
        toolingSetupPaise,
        laborSubtotalPaise,
        qcSubtotalPaise,
        freightPaise,
        marginPaise,
        taxPaise,
        grandTotalPaise,
        JSON.stringify(lastBreakdown || {}),
        pdfSummaryUrl,
        validUntil
      );

      for (const qi of createdQuoteItems) {
        db.prepare(
          `INSERT INTO pl_quote_items (
            id, quote_id, project_item_id, description, quantity,
            unit_price_paise, line_total_paise, cost_breakdown_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(
          qi.id,
          qi.quote_id,
          qi.project_item_id,
          qi.description,
          qi.quantity,
          qi.unit_price_paise,
          qi.line_total_paise,
          qi.cost_breakdown_json
        );
      }

      // Update project status to 'quoted'
      db.prepare("UPDATE pl_projects SET status = 'quoted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(projectId);

      const quote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote;

      PrivateLabelService.recordAudit(db, {
        entity_type: "quote",
        entity_id: quoteId,
        revision: 1,
        action: "create_quote",
        actor,
        diff: { quote_number: quoteNumber, projectId, priceBookId, grandTotalPaise },
      });

      return {
        ...quote,
        items: createdQuoteItems,
      };
    })();
  }

  static calculateLiveMoq(input: Record<string, unknown>): MoqEvaluationResult {
    const db = getDb();
    let minBatchKg = Number(input.teaMinBatchKg ?? input.tea_min_batch_kg ?? 0);
    let packMoq = Number(input.packagingMOQ ?? input.packaging_moq ?? 0);
    let printMoq = Number(input.printMOQ ?? input.print_moq ?? 0);
    const fillingMoq = Number(input.fillingMOQ ?? input.filling_moq ?? 100);
    let orderMultiple = Number(input.orderMultiple ?? input.order_multiple ?? 1);
    let netWeight = Number(input.netWeightGrams ?? input.net_weight_grams ?? 100);
    const requestedUnits = Number(input.requestedUnits ?? input.requested_units ?? 1000);

    const teaId = (input.teaOptionId || input.tea_option_id) as string | undefined;
    if (teaId) {
      const tea = db
        .prepare("SELECT min_batch_kg FROM pl_tea_options WHERE id = ?")
        .get(teaId) as { min_batch_kg?: number } | undefined;
      if (tea && minBatchKg === 0) {
        minBatchKg = Number(tea.min_batch_kg ?? 5);
      }
    }
    const packId = (input.packagingVariantId || input.packaging_variant_id) as string | undefined;
    if (packId) {
      const pack = db
        .prepare(
          "SELECT moq_units, order_multiple, net_weight_capacity_grams FROM pl_packaging_variants WHERE id = ?"
        )
        .get(packId) as
        | {
            moq_units?: number;
            order_multiple?: number;
            net_weight_capacity_grams?: number;
          }
        | undefined;
      if (pack) {
        if (packMoq === 0) packMoq = Number(pack.moq_units ?? 500);
        if (orderMultiple === 1) orderMultiple = Number(pack.order_multiple ?? 1);
        if (!input.netWeightGrams && !input.net_weight_grams && pack.net_weight_capacity_grams) {
          netWeight = Number(pack.net_weight_capacity_grams);
        }
      }
    }
    const printId = (input.printMethodId || input.print_method_id) as string | undefined;
    if (printId) {
      const pm = db
        .prepare("SELECT min_order_units FROM pl_print_methods WHERE id = ?")
        .get(printId) as { min_order_units?: number } | undefined;
      if (pm && printMoq === 0) {
        printMoq = Number(pm.min_order_units ?? 100);
      }
    }

    return calculateMOQ({
      requestedUnits,
      netWeightGrams: netWeight,
      teaMinBatchKg: minBatchKg,
      packagingMOQ: packMoq,
      printMOQ: printMoq,
      fillingMOQ: fillingMoq,
      orderMultiple: orderMultiple,
      minOrderValuePaise: (input.minOrderValuePaise ?? input.min_order_value_paise ?? 0) as number,
      unitEstimatedPricePaise: (input.unitEstimatedPricePaise ?? input.unit_estimated_price_paise ?? 0) as number,
    });
  }

  static calculateLiveQuote(input: Record<string, unknown>): ItemizedPriceEstimateResult {
    const db = getDb();
    const teaId = (input.teaOptionId || input.tea_option_id) as string | undefined;
    const packId = (input.packagingVariantId || input.packaging_variant_id) as string | undefined;
    const printId = (input.printMethodId || input.print_method_id) as string | undefined;
    const requestedUnits = Number(input.requestedUnits ?? input.requested_units ?? 1000);
    const colorCount = Number(input.colorCount ?? input.color_count ?? 1);
    const destinationZone = (input.destinationZone || input.destination_zone || "metro") as
      | "local"
      | "metro"
      | "national"
      | "international";
    const isNitrogen = Boolean(input.isNitrogenFlushEnabled ?? input.is_nitrogen_flush_enabled);

    const tea = teaId
      ? (db.prepare("SELECT * FROM pl_tea_options WHERE id = ?").get(teaId) as TeaOption | undefined)
      : null;
    const pack = packId
      ? (db.prepare("SELECT * FROM pl_packaging_variants WHERE id = ?").get(packId) as
          | PackagingVariant
          | undefined)
      : null;
    const print = printId
      ? (db.prepare("SELECT * FROM pl_print_methods WHERE id = ?").get(printId) as
          | PrintMethod
          | undefined)
      : null;

    let netWeight = Number(input.netWeightGrams ?? input.net_weight_grams ?? 0);
    if (netWeight <= 0 && pack?.net_weight_capacity_grams) {
      netWeight = Number(pack.net_weight_capacity_grams);
    }
    if (netWeight <= 0) netWeight = 100;

    if (pack && print) validatePhysicalQuote(pack, print, netWeight, colorCount);

    const priceBookId = (input.priceBookId || input.price_book_id) as string | undefined;
    let pbRow:
      | PriceBook
      | {
          id: string;
          margin_rate: number;
          filling_labor_paise_per_unit: number;
          qc_charge_paise_per_batch: number;
          loss_allowance_rate: number;
        }
      | undefined = undefined;
    if (priceBookId) {
      pbRow = db
        .prepare("SELECT * FROM pl_price_books WHERE id = ?")
        .get(priceBookId) as PriceBook | undefined;
    }
    if (!pbRow) {
      pbRow = db
        .prepare("SELECT * FROM pl_price_books WHERE is_default = 1 AND status = 'active'")
        .get() as PriceBook | undefined;
      if (!pbRow) {
        pbRow = db
          .prepare("SELECT * FROM pl_price_books WHERE status = 'active' LIMIT 1")
          .get() as PriceBook | undefined;
      }
      if (!pbRow) {
        pbRow = {
          id: "pb_standard_inr",
          margin_rate: 0.25,
          filling_labor_paise_per_unit: 300,
          qc_charge_paise_per_batch: 250000,
          loss_allowance_rate: 0.03,
        };
      }
    }

    const activeTiers = db
      .prepare(
        "SELECT item_type, item_id, min_qty, max_qty, unit_price_paise FROM pl_price_book_tiers WHERE price_book_id = ?"
      )
      .all(pbRow.id) as PriceBookTier[];

    return calculateItemized12ComponentQuote({
      requestedUnits,
      netWeightGrams: netWeight,
      teaOption: {
        id: tea?.id || teaId || "tea_default",
        baseCostPerKgPaise: Number(tea?.base_cost_per_kg_paise ?? 240000),
        minBatchKg: Number(tea?.min_batch_kg ?? 5),
        teaCategory: tea?.tea_category,
      },
      packagingVariant: {
        id: pack?.id || packId || "pack_default",
        unitCostPaise: Number(pack?.unit_cost_paise ?? 1200),
        closureRatePaise: Number(pack?.closure_rate_paise ?? 150),
        tareWeightGrams: Number(pack?.tare_weight_grams ?? 15),
        packsPerCarton: Number(pack?.packs_per_carton ?? 24),
      },
      printMethod: {
        id: print?.id || printId || "pm_default",
        code: (print?.code as PrintMethodCode) || "bopp_label",
        setupFeePaise: Number(print?.setup_fee_paise ?? 150000),
        cylinderFeePerColorPaise: Number(print?.cylinder_fee_per_color_paise ?? 0),
        unitCostPaise: Number(print?.unit_cost_paise ?? 250),
      },
      colorCount,
      isNitrogenFlushEnabled: isNitrogen,
      priceBook: {
        id: pbRow.id,
        marginRate: Number(pbRow.margin_rate ?? 0.25),
        fillingLaborPaisePerUnit: Number(pbRow.filling_labor_paise_per_unit ?? 300),
        qcChargePaisePerBatch: Number(pbRow.qc_charge_paise_per_batch ?? 250000),
        lossAllowanceRate: Number(pbRow.loss_allowance_rate ?? 0.03),
      },
      destinationZone,
      activeTiers,
    });
  }

  static getQuote(id: string, customerId?: string): QuoteWithItems {
    const db = getDb();
    const quote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(id) as Quote | undefined;

    if (!quote) {
      throw new PrivateLabelNotFoundError("Quote", id);
    }

    // Verify tenant ownership via linked project
    if (customerId) {
      const project = db
        .prepare("SELECT owner_customer_id FROM pl_projects WHERE id = ?")
        .get(quote.project_id) as { owner_customer_id: string } | undefined;

      if (project && project.owner_customer_id !== customerId) {
        throw new PrivateLabelNotFoundError("Quote", id);
      }
    }

    const items = db.prepare("SELECT * FROM pl_quote_items WHERE quote_id = ?").all(id) as QuoteItem[];

    return {
      ...quote,
      items,
    };
  }

  static acceptQuote(
    id: string,
    expected_revision: number,
    input: AcceptQuoteInput,
    actor: AuditActor,
    customerId: string
  ): { quote: Quote; orderId: string } {
    const db = getDb();

    return db.transaction(() => {
      const quote = PrivateLabelService.getQuote(id, customerId);

      if (quote.revision !== expected_revision) {
        throw new PrivateLabelRevisionConflictError("Quote", id, quote.revision, expected_revision);
      }

      if (quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()) {
        throw new PrivateLabelGateError("quote_acceptance", [
          `Quote ${quote.quote_number} has expired on ${quote.valid_until}`,
        ]);
      }

      if (quote.status === "converted") {
        throw new PrivateLabelGateError("quote_already_converted", [
          `Quote ${quote.quote_number} is already converted to an order`,
        ]);
      }

      const result = db
        .prepare(
          `UPDATE pl_quotes
           SET status = 'customer_accepted', accepted_at = CURRENT_TIMESTAMP,
               revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, expected_revision);

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(id) as { revision: number };
        throw new PrivateLabelRevisionConflictError("Quote", id, recheck.revision, expected_revision);
      }

      const updatedQuote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(id) as Quote;

      // Provision corresponding production order
      const orderId = `order_${randomUUID()}`;
      const orderNumber = `PL-ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let clientId = input.clientId || input.client_id;
      if (!clientId) {
        const proj = db
          .prepare("SELECT client_id FROM pl_projects WHERE id = ?")
          .get(quote.project_id) as { client_id: string | null } | undefined;
        clientId = proj?.client_id || undefined;
      }
      if (!clientId && customerId) {
        const clientRow = db
          .prepare("SELECT id FROM pl_clients WHERE customer_id = ?")
          .get(customerId) as { id: string } | undefined;
        if (clientRow) clientId = clientRow.id;
      }
      if (!clientId) {
        const anyClient = db.prepare("SELECT id FROM pl_clients LIMIT 1").get() as { id: string } | undefined;
        clientId = anyClient?.id || "client_default";
      }

      // Calculate deposit (typically 50% of grand total)
      const grandTotal = updatedQuote.grand_total_paise;
      const depositPaise = Math.round(grandTotal * 0.5);
      const balancePaise = grandTotal - depositPaise;

      db.prepare(
        `INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, currency, total_paise,
          revision, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'pending_deposit',
          ?, ?, ?, ?,
          1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      ).run(
        orderId,
        orderNumber,
        clientId,
        id,
        quote.project_id,
        depositPaise,
        balancePaise,
        quote.currency || "INR",
        grandTotal
      );

      // Copy line items from pl_quote_items into pl_order_items
      const quoteItems = db
        .prepare("SELECT * FROM pl_quote_items WHERE quote_id = ?")
        .all(id) as QuoteItem[];

      for (const item of quoteItems) {
        db.prepare(
          `INSERT INTO pl_order_items (
            id, order_id, quote_item_id, description, quantity,
            unit_price_paise, line_total_paise, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(
          `item_${randomUUID()}`,
          orderId,
          item.id,
          item.description,
          item.quantity,
          item.unit_price_paise,
          item.line_total_paise
        );
      }

      PrivateLabelService.recordAudit(db, {
        entity_type: "quote",
        entity_id: id,
        revision: updatedQuote.revision,
        action: "accept_quote",
        actor,
        diff: { orderId, orderNumber, acceptance_notes: input.acceptance_notes },
      });

      return { quote: updatedQuote, orderId };
    })();
  }

  static convertQuoteToOrder(
    quoteId: string,
    input: ConvertQuoteToOrderInput,
    customerId: string,
    actor: AuditActor
  ): { order: ProductionOrder; quote: Quote; deduped?: boolean } {
    const db = getDb();

    return db.transaction(() => {
      const quote = PrivateLabelService.getQuote(quoteId, customerId);

      // 1. Idempotency check (returns existing order if retried)
      if (input.idempotency_key) {
        const existingOrder = db
          .prepare("SELECT * FROM pl_orders WHERE idempotency_key = ?")
          .get(input.idempotency_key) as ProductionOrder | undefined;
        if (existingOrder) {
          return { order: existingOrder, quote, deduped: true };
        }
      }

      // 2. Expiration check
      if (quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()) {
        throw new PrivateLabelGateError("quote_acceptance", [
          `Quote ${quote.quote_number} has expired on ${quote.valid_until}`,
        ]);
      }

      // 3. Already converted check
      if (quote.status === "converted") {
        throw new PrivateLabelGateError("quote_already_converted", [
          `Quote ${quote.quote_number} is already converted to an order`,
        ]);
      }

      // 4. Currency check
      if (input.gateway_currency && quote.currency && input.gateway_currency !== quote.currency) {
        throw new PrivateLabelGateError("currency_mismatch", [
          `Currency mismatch: quote is ${quote.currency} but gateway requested ${input.gateway_currency}`,
        ]);
      }

      // 5. CAS Revision check
      const expectedRevision = input.expected_revision ?? quote.revision;
      if (quote.revision !== expectedRevision) {
        throw new PrivateLabelRevisionConflictError("Quote", quoteId, quote.revision, expectedRevision);
      }

      // 6. Update quote status to converted and increment revision
      const updateResult = db
        .prepare(
          `UPDATE pl_quotes
           SET status = 'converted', accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP),
               revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(quoteId, expectedRevision);

      if (updateResult.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };
        throw new PrivateLabelRevisionConflictError("Quote", quoteId, recheck.revision, expectedRevision);
      }

      const updatedQuote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote;

      // 7. Resolve client ID
      let clientId: string | undefined = undefined;
      if (customerId) {
        const clientRow = db
          .prepare("SELECT id FROM pl_clients WHERE customer_id = ?")
          .get(customerId) as { id: string } | undefined;
        if (clientRow) clientId = clientRow.id;
      }
      if (!clientId) {
        const proj = db
          .prepare("SELECT client_id FROM pl_projects WHERE id = ?")
          .get(quote.project_id) as { client_id: string | null } | undefined;
        clientId = proj?.client_id || undefined;
      }
      if (!clientId) {
        const anyClient = db.prepare("SELECT id FROM pl_clients LIMIT 1").get() as { id: string } | undefined;
        clientId = anyClient?.id || "client_default";
      }

      // 8. Deposit calculation: 50% advance, remainder balance
      const grandTotal = updatedQuote.grand_total_paise;
      const depositPaise = Math.round(grandTotal * 0.5);
      const balancePaise = grandTotal - depositPaise;

      const orderId = `order_${randomUUID()}`;
      const orderNumber = `PL-ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const shippingAddressJson = JSON.stringify(input.shipping_address || {});

      db.prepare(
        `INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, currency, total_paise,
          idempotency_key, shipping_address_json, notes, revision,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'pending_deposit',
          ?, ?, ?, ?,
          ?, ?, ?, 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      ).run(
        orderId,
        orderNumber,
        clientId,
        quoteId,
        quote.project_id,
        depositPaise,
        balancePaise,
        quote.currency || "INR",
        grandTotal,
        input.idempotency_key ?? null,
        shippingAddressJson,
        input.notes ?? input.acceptance_notes ?? null
      );

      // 9. Copy line items from pl_quote_items into pl_order_items
      const quoteItems = db
        .prepare("SELECT * FROM pl_quote_items WHERE quote_id = ?")
        .all(quoteId) as QuoteItem[];

      for (const item of quoteItems) {
        db.prepare(
          `INSERT INTO pl_order_items (
            id, order_id, quote_item_id, description, quantity,
            unit_price_paise, line_total_paise, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(
          `item_${randomUUID()}`,
          orderId,
          item.id,
          item.description,
          item.quantity,
          item.unit_price_paise,
          item.line_total_paise
        );
      }

      const order = db.prepare("SELECT * FROM pl_orders WHERE id = ?").get(orderId) as ProductionOrder;

      // 10. Audit
      PrivateLabelService.recordAudit(db, {
        entity_type: "order",
        entity_id: orderId,
        revision: 1,
        action: "convert_quote_to_order",
        actor,
        diff: {
          quoteId,
          orderNumber,
          totalPaise: grandTotal,
          depositPaise,
          balancePaise,
          itemCount: quoteItems.length,
          idempotencyKey: input.idempotency_key || null,
        },
      });

      return { order, quote: updatedQuote };
    })();
  }

  // ==========================================================================
  // 4. Artwork & Proof Approval Domain
  // ==========================================================================

  static createArtworkAsset(
    input: CreateArtworkInput,
    customerId: string,
    actor: AuditActor
  ): ArtworkAsset {
    const db = getDb();
    const id = `art_${randomUUID()}`;

    return db.transaction(() => {
      // Find client ID for customer
      let clientId = "client_default";
      const client = db.prepare("SELECT id FROM pl_clients WHERE customer_id = ?").get(customerId) as
        | { id: string }
        | undefined;
      if (client) {
        clientId = client.id;
      } else {
        const anyClient = db.prepare("SELECT id FROM pl_clients LIMIT 1").get() as { id: string } | undefined;
        if (anyClient) clientId = anyClient.id;
      }

      db.prepare(
        `INSERT INTO pl_artwork_assets (
          id, client_id, original_filename, file_size_bytes, mime_type, storage_key,
          file_sha256, width_px, height_px, dpi, color_space, rights_attestation,
          preflight_status, preflight_report_json, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '{}', CURRENT_TIMESTAMP
        )`
      ).run(
        id,
        clientId,
        input.original_filename,
        input.file_size_bytes,
        input.mime_type,
        input.storage_key,
        input.file_sha256,
        input.width_px ?? null,
        input.height_px ?? null,
        input.dpi ?? null,
        input.color_space ?? null,
        input.rights_attestation ? 1 : 0
      );

      const created = db.prepare("SELECT * FROM pl_artwork_assets WHERE id = ?").get(id) as ArtworkAsset;

      PrivateLabelService.recordAudit(db, {
        entity_type: "artwork_asset",
        entity_id: id,
        revision: 1,
        action: "upload_artwork",
        actor,
        diff: { filename: input.original_filename, mimeType: input.mime_type },
      });

      return created;
    })();
  }

  static async validatePreflight(options: PreflightInputOptions): Promise<PreflightValidationResult> {
    return runPreflightValidation(options);
  }

  static createDesignVersion(
    projectOrItemId: string,
    input: CreateDesignVersionInput,
    actor: AuditActor,
    customerId?: string
  ): DesignVersion {
    const db = getDb();
    const id = `des_${randomUUID()}`;

    return db.transaction(() => {
      // 1. Resolve project and project_item
      let projectId: string | null = null;
      let projectItemId: string | null = null;

      const asProject = db
        .prepare("SELECT * FROM pl_projects WHERE id = ?")
        .get(projectOrItemId) as Project | undefined;

      if (asProject) {
        projectId = asProject.id;
      } else {
        const asItem = db
          .prepare("SELECT * FROM pl_project_items WHERE id = ?")
          .get(projectOrItemId) as ProjectItem | undefined;
        if (asItem) {
          projectItemId = asItem.id;
          projectId = asItem.project_id;
        }
      }

      if (!projectId) {
        throw new PrivateLabelNotFoundError("Project", projectOrItemId);
      }

      const project = db
        .prepare("SELECT * FROM pl_projects WHERE id = ?")
        .get(projectId) as Project | undefined;

      if (!project) {
        throw new PrivateLabelNotFoundError("Project", projectId);
      }

      // Tenant isolation: if customerId passed and actor not admin, check owner
      if (
        customerId &&
        actor.actor_type !== "admin" &&
        project.owner_customer_id &&
        project.owner_customer_id !== customerId
      ) {
        throw new PrivateLabelNotFoundError("Project", projectId);
      }

      // CAS Revision check on project if expected_revision passed
      if (
        typeof input.expected_revision === "number" &&
        input.expected_revision !== project.revision
      ) {
        throw new PrivateLabelRevisionConflictError(
          "Project",
          projectId,
          project.revision,
          input.expected_revision
        );
      }

      // Resolve or create project item
      if (!projectItemId) {
        if (input.project_item_id) {
          projectItemId = input.project_item_id;
        } else {
          const firstItem = db
            .prepare(
              "SELECT id FROM pl_project_items WHERE project_id = ? ORDER BY created_at ASC LIMIT 1"
            )
            .get(projectId) as { id: string } | undefined;
          if (firstItem) {
            projectItemId = firstItem.id;
          } else {
            projectItemId = `item_${randomUUID()}`;
            db.prepare(
              "INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units) VALUES (?, ?, 100, 1000)"
            ).run(projectItemId, projectId);
          }
        }
      }

      // Query next version number
      const lastVersion = db
        .prepare(
          "SELECT max(version_number) as max_ver FROM pl_design_versions WHERE project_item_id = ?"
        )
        .get(projectItemId) as { max_ver: number | null };

      const nextVersion = (lastVersion?.max_ver || 0) + 1;

      // Increment project revision atomically
      db.prepare(
        "UPDATE pl_projects SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(projectId);

      // Determine initial status based on preflight report if provided
      let status: "preflight_pending" | "preflight_passed" | "preflight_failed" = "preflight_pending";
      if (input.preflight_report) {
        const report = input.preflight_report;
        if (report.status === "passed" || report.valid === true) {
          status = "preflight_passed";
        } else if (report.status === "rejected" || report.valid === false) {
          status = "preflight_failed";
        }
      }

      const preflightJson = input.preflight_report
        ? JSON.stringify(input.preflight_report)
        : "{}";

      db.prepare(
        `INSERT INTO pl_design_versions (
          id, project_id, project_item_id, version_number, status, scene_json,
          asset_url, front_artwork_asset_id, back_artwork_asset_id, preview_render_url,
          print_ready_pdf_url, preflight_report_json, is_locked, revision, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP
        )`
      ).run(
        id,
        projectId,
        projectItemId,
        nextVersion,
        status,
        JSON.stringify(input.scene_json || {}),
        input.asset_url ?? input.preview_render_url ?? null,
        input.front_artwork_asset_id ?? null,
        input.back_artwork_asset_id ?? null,
        input.preview_render_url ?? null,
        input.print_ready_pdf_url ?? null,
        preflightJson,
        nextVersion
      );

      // Update project item pointer
      db.prepare(
        "UPDATE pl_project_items SET design_version_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(id, projectItemId);

      const created = db
        .prepare("SELECT * FROM pl_design_versions WHERE id = ?")
        .get(id) as DesignVersion;

      PrivateLabelService.recordAudit(db, {
        entity_type: "design_version",
        entity_id: id,
        revision: nextVersion,
        action: "create_design_version",
        actor,
        diff: { projectId, projectItemId, versionNumber: nextVersion, assetUrl: input.asset_url },
      });

      return created;
    })();
  }

  static approveProof(
    designVersionId: string,
    input: ApproveProofInput,
    actor: AuditActor,
    customerId?: string
  ): ApprovalEvent {
    const db = getDb();
    const eventId = `appr_${randomUUID()}`;

    return db.transaction(() => {
      // 1. Fetch design version joined with project
      const row = db
        .prepare(
          `SELECT dv.*, pi.project_id as pi_proj_id, p.id as p_id, p.owner_customer_id, p.client_id as p_client_id, p.revision as project_revision
           FROM pl_design_versions dv
           LEFT JOIN pl_project_items pi ON pi.id = dv.project_item_id
           LEFT JOIN pl_projects p ON p.id = COALESCE(dv.project_id, pi.project_id)
           WHERE dv.id = ?`
        )
        .get(designVersionId) as (DesignVersion & {
          pi_proj_id: string | null;
          p_id: string | null;
          owner_customer_id: string | null;
          p_client_id: string | null;
          project_revision: number | null;
        }) | undefined;

      if (!row) {
        throw new PrivateLabelNotFoundError("DesignVersion", designVersionId);
      }

      // 2. Tenant isolation check (anti-enumeration 404)
      if (
        customerId &&
        actor.actor_type !== "admin" &&
        row.owner_customer_id &&
        row.owner_customer_id !== customerId
      ) {
        throw new PrivateLabelNotFoundError("DesignVersion", designVersionId);
      }

      // 3. Disclaimer Acceptance Gate
      const disclaimerAccepted = input.disclaimer_accepted ?? input.legal_disclaimer_accepted;
      if (!disclaimerAccepted) {
        throw new PrivateLabelGateError("proof_approval", [
          "Legal proof disclaimer must be explicitly accepted",
        ]);
      }

      // 4. CAS Check 1: Must be active latest version for item
      if (row.project_item_id) {
        const maxRow = db
          .prepare(
            "SELECT MAX(version_number) as max_ver FROM pl_design_versions WHERE project_item_id = ?"
          )
          .get(row.project_item_id) as { max_ver: number | null };

        const latestVersion = maxRow?.max_ver ?? row.version_number;
        if (row.version_number !== latestVersion) {
          throw new PrivateLabelRevisionConflictError(
            "DesignVersion",
            designVersionId,
            latestVersion,
            row.version_number,
            `Cannot approve stale proof: revision ${row.version_number} has been superseded by revision ${latestVersion}`
          );
        }
      }

      // 5. CAS Check 2: Explicit revision check if passed
      const expectedRev = input.expected_revision ?? input.revision;
      if (typeof expectedRev === "number") {
        const expectedDesignRevision = input.expected_revision !== undefined ? row.revision : row.version_number;
        if (expectedRev !== expectedDesignRevision) {
          throw new PrivateLabelRevisionConflictError(
            "DesignVersion",
            designVersionId,
            row.version_number,
            expectedRev
          );
        }
      }

      // 6. Lock check
      if (row.is_locked === 1 || row.status === "customer_approved") {
        throw new PrivateLabelRevisionConflictError(
          "DesignVersion",
          designVersionId,
          row.version_number,
          row.version_number,
          "Proof revision is already approved and locked"
        );
      }

      if (row.status !== "preflight_passed") {
        throw new PrivateLabelGateError("proof_preflight", ["This proof must pass the team's preflight review before customer approval."]);
      }

      // 7. Resolve client ID
      let resolvedClientId = row.p_client_id;
      if (!resolvedClientId && customerId) {
        const client = db
          .prepare("SELECT id FROM pl_clients WHERE customer_id = ?")
          .get(customerId) as { id: string } | undefined;
        if (client) resolvedClientId = client.id;
      }
      if (!resolvedClientId) {
        const anyClient = db.prepare("SELECT id FROM pl_clients LIMIT 1").get() as
          | { id: string }
          | undefined;
        resolvedClientId = anyClient?.id || "client_default";
      }

      const standardDisclaimerText =
        "I attest that I hold commercial intellectual property rights for the uploaded artwork and approve this preflight proof for production tooling. Colors rendered on RGB screens are simulations; physical print will align to CMYK / Pantone spot ink specifications. Tooling and cylinder charges are non-refundable once approved.";

      const signerName =
        input.signer_name || input.actor_name || actor.actor_email || "Customer";

      // 8. Lock design version
      db.prepare(
        "UPDATE pl_design_versions SET status = 'customer_approved', is_locked = 1 WHERE id = ?"
      ).run(designVersionId);

      // 9. Increment project revision if linked
      const effectiveProjectId = row.project_id || row.pi_proj_id || row.p_id;
      if (effectiveProjectId) {
        db.prepare(
          "UPDATE pl_projects SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(effectiveProjectId);
      }

      // 10. Record immutable approval event
      db.prepare(
        `INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name,
          signer_name, action, legal_disclaimer_accepted, disclaimer_text,
          ip_address, user_agent, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, 'customer_approved', 1, ?, ?, ?, ?, CURRENT_TIMESTAMP
        )`
      ).run(
        eventId,
        designVersionId,
        resolvedClientId,
        actor.actor_type,
        actor.actor_id,
        signerName,
        signerName,
        standardDisclaimerText,
        input.ip_address ?? null,
        input.user_agent ?? null,
        input.notes ?? null
      );

      const event = db
        .prepare("SELECT * FROM pl_approval_events WHERE id = ?")
        .get(eventId) as ApprovalEvent;

      PrivateLabelService.recordAudit(db, {
        entity_type: "design_version",
        entity_id: designVersionId,
        revision: row.version_number,
        action: "approve_proof",
        actor,
        diff: { eventId, approvedBy: signerName, versionNumber: row.version_number },
      });

      return event;
    })();
  }

  static rejectProof(
    designVersionId: string,
    input: RejectProofInput,
    actor: AuditActor,
    customerId?: string
  ): ApprovalEvent {
    const db = getDb();
    const eventId = `appr_${randomUUID()}`;

    return db.transaction(() => {
      const row = db
        .prepare(
          `SELECT dv.*, pi.project_id as pi_proj_id, p.id as p_id, p.owner_customer_id, p.client_id as p_client_id, p.revision as project_revision
           FROM pl_design_versions dv
           LEFT JOIN pl_project_items pi ON pi.id = dv.project_item_id
           LEFT JOIN pl_projects p ON p.id = COALESCE(dv.project_id, pi.project_id)
           WHERE dv.id = ?`
        )
        .get(designVersionId) as (DesignVersion & {
          pi_proj_id: string | null;
          p_id: string | null;
          owner_customer_id: string | null;
          p_client_id: string | null;
          project_revision: number | null;
        }) | undefined;

      if (!row) {
        throw new PrivateLabelNotFoundError("DesignVersion", designVersionId);
      }

      if (
        customerId &&
        actor.actor_type !== "admin" &&
        row.owner_customer_id &&
        row.owner_customer_id !== customerId
      ) {
        throw new PrivateLabelNotFoundError("DesignVersion", designVersionId);
      }

      const expectedRev = input.expected_revision ?? input.revision;
      if (typeof expectedRev === "number") {
        const expectedDesignRevision = input.expected_revision !== undefined ? row.revision : row.version_number;
        if (expectedRev !== expectedDesignRevision) {
          throw new PrivateLabelRevisionConflictError(
            "DesignVersion",
            designVersionId,
            row.version_number,
            expectedRev
          );
        }
      }

      let resolvedClientId = row.p_client_id;
      if (!resolvedClientId && customerId) {
        const client = db
          .prepare("SELECT id FROM pl_clients WHERE customer_id = ?")
          .get(customerId) as { id: string } | undefined;
        if (client) resolvedClientId = client.id;
      }
      if (!resolvedClientId) {
        const anyClient = db.prepare("SELECT id FROM pl_clients LIMIT 1").get() as
          | { id: string }
          | undefined;
        resolvedClientId = anyClient?.id || "client_default";
      }

      const signerName = input.actor_name || actor.actor_email || "Customer";

      // Mark status as preflight_failed or rework
      db.prepare(
        "UPDATE pl_design_versions SET status = 'preflight_failed', is_locked = 0 WHERE id = ?"
      ).run(designVersionId);

      const effectiveProjectId = row.project_id || row.pi_proj_id || row.p_id;
      if (effectiveProjectId) {
        db.prepare(
          "UPDATE pl_projects SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(effectiveProjectId);
      }

      db.prepare(
        `INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name,
          signer_name, action, legal_disclaimer_accepted, disclaimer_text,
          ip_address, user_agent, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, 'customer_rejected', 0, NULL, ?, ?, ?, CURRENT_TIMESTAMP
        )`
      ).run(
        eventId,
        designVersionId,
        resolvedClientId,
        actor.actor_type,
        actor.actor_id,
        signerName,
        signerName,
        input.ip_address ?? null,
        input.user_agent ?? null,
        input.reason
      );

      const event = db
        .prepare("SELECT * FROM pl_approval_events WHERE id = ?")
        .get(eventId) as ApprovalEvent;

      PrivateLabelService.recordAudit(db, {
        entity_type: "design_version",
        entity_id: designVersionId,
        revision: row.version_number,
        action: "reject_proof",
        actor,
        diff: { eventId, rejectedBy: signerName, reason: input.reason },
      });

      return event;
    })();
  }

  static listDesignVersions(
    projectId: string,
    customerId?: string,
    actor?: AuditActor
  ): DesignVersion[] {
    const db = getDb();
    const project = db
      .prepare("SELECT * FROM pl_projects WHERE id = ?")
      .get(projectId) as Project | undefined;
    if (!project) {
      throw new PrivateLabelNotFoundError("Project", projectId);
    }
    if (
      customerId &&
      actor?.actor_type !== "admin" &&
      project.owner_customer_id &&
      project.owner_customer_id !== customerId
    ) {
      throw new PrivateLabelNotFoundError("Project", projectId);
    }

    return db
      .prepare(
        `SELECT dv.*
         FROM pl_design_versions dv
         LEFT JOIN pl_project_items pi ON pi.id = dv.project_item_id
         WHERE dv.project_id = ? OR pi.project_id = ?
         ORDER BY dv.version_number ASC`
      )
      .all(projectId, projectId) as DesignVersion[];
  }

  static getLatestDesignVersion(
    projectId: string,
    customerId?: string,
    actor?: AuditActor
  ): DesignVersion | null {
    const versions = PrivateLabelService.listDesignVersions(projectId, customerId, actor);
    if (versions.length === 0) return null;
    return versions[versions.length - 1];
  }

  // ==========================================================================
  // 5. Sample Order Domain
  // ==========================================================================

  static createSampleOrder(
    input: CreateSampleOrderInput,
    customerId: string,
    actor: AuditActor
  ): SampleOrder {
    const db = getDb();
    const id = `samp_${randomUUID()}`;
    let sampleNumber = `PL-SMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    for (let attempt = 0; attempt < 10; attempt++) {
      const existing = db.prepare("SELECT 1 FROM pl_samples WHERE sample_number = ?").get(sampleNumber);
      if (!existing) break;
      sampleNumber = `PL-SMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    return db.transaction(() => {
      // 1. Capping check (Test F24.B2)
      const qty = input.quantity ?? 1;
      if (!Number.isSafeInteger(qty) || qty < 1 || qty > 10) {
        throw new PrivateLabelGateError("sample_quantity_cap", [
          `Maximum sample quantity per order is 10 (requested: ${qty})`,
        ]);
      }

      // 2. Shipping address validation (Test F24.B3)
      if (input.shipping_address) {
        const addr = input.shipping_address as Record<string, unknown>;
        if (!addr.line1 || !addr.city) {
          throw new PrivateLabelGateError("sample_address_invalid", [
            "Shipping address must include address line 1 and city",
          ]);
        }
        if (addr.pincode && !/^[1-9][0-9]{5}$/.test(String(addr.pincode).trim())) {
          throw new PrivateLabelGateError("sample_address_invalid", [
            "Enter a valid 6-digit Indian PIN code",
          ]);
        }
      }

      // A first-time sample customer must never inherit another tenant's client.
      let clientId: string;
      const client = db.prepare("SELECT id FROM pl_clients WHERE customer_id = ?").get(customerId) as { id: string } | undefined;
      if (client) clientId = client.id;
      else {
        const customer = db.prepare("SELECT name, email FROM customers WHERE id = ?").get(customerId) as { name: string; email: string } | undefined;
        if (!customer) throw new PrivateLabelNotFoundError("Customer", customerId);
        clientId = `client_${randomUUID()}`;
        db.prepare("INSERT INTO pl_clients (id, customer_id, company_name, contact_name, contact_email) VALUES (?, ?, ?, ?, ?)")
          .run(clientId, customerId, "Private Label Customer", customer.name || "Customer", customer.email);
      }

      // 4. Normalize sample type
      let normalizedType: "tea_kit" | "printed_proof" | "packaged_mockup" | "full_pack_sample" = "tea_kit";
      const rawType = input.sample_type;
      if (rawType === "tea_tasting_kit" || rawType === "tasting_kit" || rawType === "tea_kit") {
        normalizedType = "tea_kit";
      } else if (rawType === "swatch_pack" || rawType === "packaging_swatch" || rawType === "packaged_mockup") {
        normalizedType = "packaged_mockup";
      } else if (rawType === "full_pack_sample") {
        normalizedType = "full_pack_sample";
      } else if (rawType === "printed_proof") {
        normalizedType = "printed_proof";
      }

      // 5. Authoritative server-side sample pricing based on sample_type and quantity
      let unitPricePaise = 75000;
      if (normalizedType === "packaged_mockup") {
        unitPricePaise = 49900;
      } else if (normalizedType === "full_pack_sample" || normalizedType === "printed_proof") {
        unitPricePaise = 250000;
      }
      let amountPaise = unitPricePaise * qty;

      // 6. Coupon check (Test F24.B5)
      let normalizedCouponCode: string | null = null;
      if (input.coupon_code) {
        normalizedCouponCode = input.coupon_code.trim().toUpperCase();
        if (normalizedCouponCode === "SAMPLEFREE100") {
          const used = db
            .prepare("SELECT id FROM pl_samples WHERE client_id = ? AND coupon_code = 'SAMPLEFREE100' LIMIT 1")
            .get(clientId);
          if (used) {
            throw new PrivateLabelGateError("coupon_already_used", [
              "Promotional coupon SAMPLEFREE100 has already been used by this client",
            ]);
          }
          amountPaise = 0;
        } else {
          throw new PrivateLabelGateError("invalid_coupon", ["This sample coupon is not recognized. Remove it or enter a valid code."]);
        }
      }

      const teaRecipeIds = input.tea_recipe_ids || (input.tea_option_id ? [input.tea_option_id] : []);
      for (const teaId of teaRecipeIds) {
        const teaRow = db
          .prepare("SELECT id, sample_available, is_published FROM pl_tea_options WHERE id = ?")
          .get(teaId) as { id: string; sample_available: number; is_published: number } | undefined;
        if (!teaRow || !teaRow.sample_available || !teaRow.is_published) {
          throw new PrivateLabelGateError("tea_lot_unavailable", [
            `Tea lot '${teaId}' is unavailable or out of stock`,
          ]);
        }
      }

      if (input.packaging_variant_id) {
        const packRow = db
          .prepare("SELECT id, status FROM pl_packaging_variants WHERE id = ?")
          .get(input.packaging_variant_id) as { id: string; status: string } | undefined;
        if (!packRow || packRow.status === "archived") {
          throw new PrivateLabelGateError("packaging_unavailable", [
            `Packaging variant '${input.packaging_variant_id}' is unavailable`,
          ]);
        }
      }

      db.prepare(
        `INSERT INTO pl_samples (
          id, sample_number, client_id, project_id, sample_type, status,
          tea_option_id, packaging_variant_id, shipping_address_json,
          amount_paise, quantity, coupon_code, revision, tea_recipe_ids_json, notes,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'requested',
          ?, ?, ?,
          ?, ?, ?, 1, ?, ?,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      ).run(
        id,
        sampleNumber,
        clientId,
        input.project_id ?? null,
        normalizedType,
        teaRecipeIds[0] ?? input.tea_option_id ?? null,
        input.packaging_variant_id ?? null,
        JSON.stringify(input.shipping_address || {}),
        amountPaise,
        qty,
        normalizedCouponCode,
        JSON.stringify(teaRecipeIds),
        input.notes ?? null
      );

      // Populate pl_sample_items
      for (const teaId of teaRecipeIds) {
        db.prepare(
          `INSERT INTO pl_sample_items (
            id, sample_id, item_type, tea_option_id, description, quantity, created_at
          ) VALUES (?, ?, 'tea', ?, ?, 1, CURRENT_TIMESTAMP)`
        ).run(`sitem_${randomUUID()}`, id, teaId, `Sample Tea Lot: ${teaId}`);
      }

      if (input.packaging_variant_id) {
        db.prepare(
          `INSERT INTO pl_sample_items (
            id, sample_id, item_type, packaging_variant_id, description, quantity, created_at
          ) VALUES (?, ?, 'packaging', ?, 'Sample Packaging Variant Swatch', 1, CURRENT_TIMESTAMP)`
        ).run(`sitem_${randomUUID()}`, id, input.packaging_variant_id);
      }

      const sample = db.prepare("SELECT * FROM pl_samples WHERE id = ?").get(id) as SampleOrder;

      PrivateLabelService.recordAudit(db, {
        entity_type: "sample_order",
        entity_id: id,
        revision: 1,
        action: "create_sample_order",
        actor,
        diff: {
          sampleNumber,
          sampleType: normalizedType,
          quantity: qty,
          amountPaise,
          couponCode: normalizedCouponCode,
        },
      });

      return sample;
    })();
  }

  static getSampleOrder(id: string, customerId?: string): SampleOrder & { items: SampleItem[] } {
    const db = getDb();
    const sample = db.prepare("SELECT * FROM pl_samples WHERE id = ?").get(id) as SampleOrder | undefined;

    if (!sample) {
      throw new PrivateLabelNotFoundError("SampleOrder", id);
    }

    if (customerId) {
      const client = db.prepare("SELECT customer_id FROM pl_clients WHERE id = ?").get(sample.client_id) as
        | { customer_id: string }
        | undefined;
      if (!client || client.customer_id !== customerId) {
        throw new PrivateLabelNotFoundError("SampleOrder", id);
      }
    }

    const items = db.prepare("SELECT * FROM pl_sample_items WHERE sample_id = ?").all(id) as SampleItem[];

    return { ...sample, items };
  }

  static listSampleOrders(customerId: string): Array<SampleOrder & { items: SampleItem[] }> {
    const db = getDb();
    const client = db.prepare("SELECT id FROM pl_clients WHERE customer_id = ?").get(customerId) as
      | { id: string }
      | undefined;
    if (!client) {
      return [];
    }

    const samples = db
      .prepare("SELECT * FROM pl_samples WHERE client_id = ? ORDER BY created_at DESC")
      .all(client.id) as SampleOrder[];

    return samples.map((sample) => {
      const items = db
        .prepare("SELECT * FROM pl_sample_items WHERE sample_id = ?")
        .all(sample.id) as SampleItem[];
      return { ...sample, items };
    });
  }

  static cancelSampleOrder(
    id: string,
    customerId: string,
    actor: AuditActor
  ): SampleOrder {
    const db = getDb();

    return db.transaction(() => {
      const sample = PrivateLabelService.getSampleOrder(id, customerId);

      if (sample.status === "dispatched" || sample.status === "delivered" || sample.status === "completed") {
        throw new PrivateLabelGateError("cancel_sample", [
          `Cannot cancel sample order in status '${sample.status}'`,
        ]);
      }

      db.prepare(
        `UPDATE pl_samples
         SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(id);

      const updated = db.prepare("SELECT * FROM pl_samples WHERE id = ?").get(id) as SampleOrder;

      PrivateLabelService.recordAudit(db, {
        entity_type: "sample_order",
        entity_id: id,
        revision: (sample.revision ?? 1) + 1,
        action: "cancel_sample_order",
        actor,
        diff: { from: sample.status, to: "rejected" },
      });

      return updated;
    })();
  }

  static dispatchSampleOrder(
    id: string,
    tracking: { courier?: string | null; carrier?: string | null; tracking_number: string },
    actor: AuditActor
  ): SampleOrder {
    const db = getDb();

    return db.transaction(() => {
      const sample = db.prepare("SELECT * FROM pl_samples WHERE id = ?").get(id) as SampleOrder | undefined;
      if (!sample) {
        throw new PrivateLabelNotFoundError("SampleOrder", id);
      }

      const carrier = tracking.courier?.trim() || tracking.carrier?.trim() || null;

      db.prepare(
        `UPDATE pl_samples
         SET status = 'dispatched', carrier = ?, tracking_number = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(carrier, tracking.tracking_number, id);

      const updated = db.prepare("SELECT * FROM pl_samples WHERE id = ?").get(id) as SampleOrder;

      PrivateLabelService.recordAudit(db, {
        entity_type: "sample_order",
        entity_id: id,
        revision: (sample.revision ?? 1) + 1,
        action: "dispatch_sample_order",
        actor,
        diff: { carrier, trackingNumber: tracking.tracking_number },
      });

      return updated;
    })();
  }

  static updateSampleStatus(
    id: string,
    expected_revision: number,
    status: SampleStatus,
    tracking: { carrier?: string; tracking_number?: string },
    actor: AuditActor
  ): SampleOrder {
    const db = getDb();

    return db.transaction(() => {
      const sample = PrivateLabelService.getSampleOrder(id);

      db.prepare(
        `UPDATE pl_samples
         SET status = ?, carrier = COALESCE(?, carrier), tracking_number = COALESCE(?, tracking_number),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(status, tracking.carrier ?? null, tracking.tracking_number ?? null, id);

      const updated = db.prepare("SELECT * FROM pl_samples WHERE id = ?").get(id) as SampleOrder;

      PrivateLabelService.recordAudit(db, {
        entity_type: "sample_order",
        entity_id: id,
        revision: (sample.revision ?? 1) + 1,
        action: "update_sample_status",
        actor,
        diff: { status, tracking },
      });

      return updated;
    })();
  }

  static listOrders(customerId: string): Array<ProductionOrder & { items: OrderItem[]; job?: ProductionJobWithMilestones | null }> {
    const db = getDb();
    const client = db.prepare("SELECT id FROM pl_clients WHERE customer_id = ?").get(customerId) as
      | { id: string }
      | undefined;
    if (!client) {
      return [];
    }

    const orders = db
      .prepare("SELECT * FROM pl_orders WHERE client_id = ? ORDER BY created_at DESC")
      .all(client.id) as ProductionOrder[];

    return orders.map((order) => {
      const items = db.prepare("SELECT * FROM pl_order_items WHERE order_id = ?").all(order.id) as OrderItem[];
      const jobRow = db.prepare("SELECT * FROM pl_jobs WHERE order_id = ?").get(order.id) as ProductionJob | undefined;
      let job: ProductionJobWithMilestones | null = null;
      if (jobRow) {
        const milestones = db
          .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC")
          .all(jobRow.id) as QCMilestone[];
        job = { ...jobRow, milestones };
      }
      return { ...order, items, job };
    });
  }

  static getOrder(
    id: string,
    customerId?: string
  ): {
    order: ProductionOrder;
    items: OrderItem[];
    job: ProductionJobWithMilestones | null;
    approvedProof: Record<string, unknown> | null;
  } {
    const db = getDb();
    const order = db.prepare("SELECT * FROM pl_orders WHERE id = ?").get(id) as ProductionOrder | undefined;

    if (!order) {
      throw new PrivateLabelNotFoundError("Order", id);
    }

    if (customerId) {
      const client = db.prepare("SELECT customer_id FROM pl_clients WHERE id = ?").get(order.client_id) as
        | { customer_id: string }
        | undefined;
      if (!client || client.customer_id !== customerId) {
        throw new PrivateLabelNotFoundError("Order", id);
      }
    }

    const items = db.prepare("SELECT * FROM pl_order_items WHERE order_id = ?").all(id) as OrderItem[];

    const jobRow = db.prepare("SELECT * FROM pl_jobs WHERE order_id = ?").get(id) as ProductionJob | undefined;
    let job: ProductionJobWithMilestones | null = null;
    if (jobRow) {
      const milestones = db
        .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC")
        .all(jobRow.id) as QCMilestone[];
      job = { ...jobRow, milestones };
    }

    // Check approved proof
    const approval = db
      .prepare(
        `SELECT a.id, a.signer_name, a.created_at, dv.id as version_id, dv.version_number,
                dv.preview_render_url, dv.asset_url, dv.status as proof_status
         FROM pl_approval_events a
         JOIN pl_design_versions dv ON dv.id = a.design_version_id
         JOIN pl_project_items pi ON pi.id = dv.project_item_id
         JOIN pl_quotes q ON q.project_id = pi.project_id
         WHERE q.id = ? AND a.action = 'customer_approved'
         ORDER BY a.created_at DESC LIMIT 1`
      )
      .get(order.quote_id) as Record<string, unknown> | undefined;

    return {
      order,
      items,
      job,
      approvedProof: approval || null,
    };
  }

  static getOrderInvoice(id: string, customerId: string) {
    const orderData = PrivateLabelService.getOrder(id, customerId);
    const { order, items } = orderData;

    const quote = PrivateLabelService.getQuote(order.quote_id, customerId);
    // Line totals already include quoted GST; reuse that snapshot.
    const totalPaise = order.total_paise || (order.deposit_paise + order.balance_paise);
    const taxPaise = quote.tax_paise;
    const subtotalPaise = totalPaise - taxPaise;

    let shippingAddress: Record<string, unknown> = {};
    try {
      shippingAddress =
        typeof order.shipping_address_json === "string"
          ? JSON.parse(order.shipping_address_json)
          : (order.shipping_address_json || {});
    } catch {
      shippingAddress = {};
    }

    return {
      invoice_number: `INV-${order.order_number.replace("PL-ORD-", "")}`,
      order_id: order.id,
      order_number: order.order_number,
      created_at: order.created_at,
      currency: order.currency || "INR",
      items,
      subtotal_paise: subtotalPaise,
      tax_paise: taxPaise,
      total_paise: totalPaise,
      deposit_paise: order.deposit_paise,
      balance_paise: order.balance_paise,
      deposit_paid: Boolean(order.deposit_paid_at),
      deposit_paid_at: order.deposit_paid_at,
      shipping_address: shippingAddress,
    };
  }

  static createOrderPaymentIntent(
    params: { quoteId?: string; orderId?: string; depositPercentage?: number },
    customerId: string
  ): PaymentIntentResult {
    let totalPaise = 0;
    let currency = "INR";
    const orderId = params.orderId;
    const quoteId = params.quoteId;

    if (quoteId) {
      const quote = PrivateLabelService.getQuote(quoteId, customerId);
      totalPaise = quote.grand_total_paise;
      currency = quote.currency || "INR";
    } else if (orderId) {
      const { order } = PrivateLabelService.getOrder(orderId, customerId);
      totalPaise = order.total_paise || (order.deposit_paise + order.balance_paise);
      currency = order.currency || "INR";
    } else {
      throw new PrivateLabelGateError("payment_intent", ["Either quote_id or order_id must be provided"]);
    }

    const pct = params.depositPercentage ?? 50;
    const depositAmountPaise = Math.round(totalPaise * (pct / 100));

    return {
      available: false,
      message: "Private-label online payment is not configured. Contact our team for verified payment arrangements.",
      amount_paise: depositAmountPaise,
      currency,
      status: "payment_unavailable",
      quote_id: quoteId,
      order_id: orderId,
      deposit_percentage: pct,
    };
  }

  static reorder(
    originalOrderId: string,
    quantity: number,
    customerId: string,
    actor: AuditActor
  ): { quote: Quote; orderId?: string } {
    const db = getDb();
    const { order } = PrivateLabelService.getOrder(originalOrderId, customerId);
    const quote = PrivateLabelService.getQuote(order.quote_id, customerId);

    const newQuoteId = `quote_${randomUUID()}`;
    const newQuoteNumber = `PL-QTE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const ratio = quantity / 1000;
    const newGrandTotal = Math.round(quote.grand_total_paise * ratio);

    db.prepare(
      `INSERT INTO pl_quotes (
        id, quote_number, project_id, price_book_id, status, version, currency,
        tea_subtotal_paise, packaging_subtotal_paise, printing_subtotal_paise,
        tooling_setup_paise, labor_subtotal_paise, qc_subtotal_paise,
        freight_paise, margin_paise, tax_paise, grand_total_paise,
        price_breakdown_json, valid_until, revision, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, 'firm_issued', 1, ?,
        ?, ?, ?,
        0, ?, ?,
        ?, ?, ?, ?,
        ?, datetime('now', '+30 days'), 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`
    ).run(
      newQuoteId,
      newQuoteNumber,
      quote.project_id,
      quote.price_book_id,
      quote.currency || "INR",
      Math.round(quote.tea_subtotal_paise * ratio),
      Math.round(quote.packaging_subtotal_paise * ratio),
      Math.round(quote.printing_subtotal_paise * ratio),
      Math.round(quote.labor_subtotal_paise * ratio),
      Math.round(quote.qc_subtotal_paise * ratio),
      Math.round(quote.freight_paise * ratio),
      Math.round(quote.margin_paise * ratio),
      Math.round(quote.tax_paise * ratio),
      newGrandTotal,
      quote.price_breakdown_json
    );

    const newQuote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(newQuoteId) as Quote;

    PrivateLabelService.recordAudit(db, {
      entity_type: "quote",
      entity_id: newQuoteId,
      revision: 1,
      action: "reorder_quote_created",
      actor,
      diff: { originalOrderId, quantity, newQuoteNumber },
    });

    return { quote: newQuote };
  }

  // ==========================================================================
  // 6. Production Job Release & QC Domain
  // ==========================================================================

  static validateReleaseGate(orderId: string): ValidateReleaseResult {
    const db = getDb();
    const order = db.prepare("SELECT * FROM pl_orders WHERE id = ?").get(orderId) as ProductionOrder | undefined;

    if (!order) {
      return {
        eligible: false,
        blockers: [`Order '${orderId}' not found`],
        order_id: orderId,
      };
    }

    const blockers: string[] = [];

    // 1. Check deposit paid (Test F26.2, F26.B2)
    const isDepositPaid = order.status === "deposit_paid" || order.status === "production_released";
    if (!isDepositPaid) {
      blockers.push(`Order status must be 'deposit_paid' (current status: '${order.status}')`);
    }

    // 2. Check proof approval (Test F26.1, F26.B1)
    const approval = db
      .prepare(
        `SELECT a.id, dv.status as proof_status, dv.is_locked
         FROM pl_approval_events a
         JOIN pl_design_versions dv ON dv.id = a.design_version_id
         JOIN pl_project_items pi ON pi.id = dv.project_item_id
         JOIN pl_quotes q ON q.project_id = pi.project_id
         WHERE q.id = ? AND a.action = 'customer_approved' AND dv.status = 'customer_approved' AND dv.is_locked = 1
           AND dv.version_number = (SELECT MAX(latest.version_number) FROM pl_design_versions latest WHERE latest.project_item_id = dv.project_item_id)
         LIMIT 1`
      )
      .get(order.quote_id) as { id: string; proof_status: string; is_locked: number } | undefined;

    if (!approval || approval.proof_status !== "customer_approved" || !approval.is_locked) {
      blockers.push("Artwork proof approval is required prior to releasing order to production");
    }

    return {
      eligible: blockers.length === 0,
      blockers,
      order_id: orderId,
      order_number: order.order_number,
      deposit_status: order.status,
      proof_status: approval ? "customer_approved" : "pending",
      tea_available: true,
      packaging_available: true,
    };
  }

  static releaseProductionJob(
    orderId: string,
    input: ReleaseJobInput,
    actor: AuditActor
  ): ProductionJob {
    const db = getDb();
    const jobId = `job_${randomUUID()}`;
    const jobNumber = `PL-JOB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const gate = PrivateLabelService.validateReleaseGate(orderId);

    // Check emergency operator override (Test F26.B5)
    const hasOverride = Boolean(input.override_justification && input.override_justification.trim().length > 0);

    if (!gate.eligible && !hasOverride) {
      // Record audit trail of blocked release attempt OUTSIDE transaction so it persists!
      PrivateLabelService.recordAudit(db, {
        entity_type: "production_job",
        entity_id: orderId,
        revision: 1,
        action: "release_blocked",
        actor,
        diff: { orderId, blockers: gate.blockers },
      });

      throw new PrivateLabelGateError("production_release", gate.blockers);
    }

    return db.transaction(() => {
      const order = db.prepare("SELECT * FROM pl_orders WHERE id = ?").get(orderId) as
        | ProductionOrder
        | undefined;

      if (!order) {
        throw new PrivateLabelNotFoundError("Order", orderId);
      }

      db.prepare(
        `INSERT INTO pl_jobs (
          id, job_number, order_id, status, target_completion_date, operator_notes,
          override_justification, released_by, released_at, revision, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'scheduled', ?, ?,
          ?, ?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`
      ).run(
        jobId,
        jobNumber,
        orderId,
        input.target_completion_date ?? null,
        input.operator_notes ?? null,
        hasOverride ? input.override_justification : null,
        input.operator_id || actor.actor_id
      );

      // Initialize 7 standard QC milestones
      const stages: Array<{ stage: QCMilestone["stage"]; name: string }> = [
        { stage: "raw_material", name: "Tea Leaf Lot Quality & Moisture Inspection" },
        { stage: "packaging_incoming", name: "Primary Packaging Substrate Verification" },
        { stage: "print_proof", name: "Color & Prepress Press-Sheet Sign-Off" },
        { stage: "fill_weight", name: "Cleanroom Fill Weight Tolerance Check" },
        { stage: "seal_integrity", name: "Hermetic Heat-Seal & Valve Integrity Vacuum Test" },
        { stage: "sensory_cupping", name: "Production Batch Retention Cupping & Tasting" },
        { stage: "final_pack", name: "Master Shipper Outer Box & Pallet QC" },
      ];

      for (const s of stages) {
        db.prepare(
          `INSERT INTO pl_qc_milestones (
            id, job_id, milestone_name, stage, status, created_at
          ) VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`
        ).run(`qc_${randomUUID()}`, jobId, s.name, s.stage);
      }

      // Update order status
      db.prepare("UPDATE pl_orders SET status = 'production_released', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);

      const job = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(jobId) as ProductionJob;

      PrivateLabelService.recordAudit(db, {
        entity_type: "production_job",
        entity_id: jobId,
        revision: 1,
        action: "release_job",
        actor,
        diff: {
          jobNumber,
          orderId,
          operatorId: input.operator_id || actor.actor_id,
          overrideJustification: input.override_justification || null,
        },
      });

      return job;
    })();
  }

  static getProductionJob(id: string): ProductionJobWithMilestones {
    const db = getDb();
    const job = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(id) as ProductionJob | undefined;

    if (!job) {
      throw new PrivateLabelNotFoundError("ProductionJob", id);
    }

    const milestones = db
      .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC")
      .all(id) as QCMilestone[];

    return {
      ...job,
      milestones,
    };
  }

  static recordQCMilestone(
    jobId: string,
    input: RecordQCMilestoneInput,
    actor: AuditActor
  ): QCMilestone {
    const db = getDb();

    return db.transaction(() => {
      const job = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(jobId) as ProductionJob | undefined;
      if (!job) {
        throw new PrivateLabelNotFoundError("ProductionJob", jobId);
      }

      // Check if job is already dispatched/completed (Test F27.B4)
      if (job.status === "completed" || job.status === "ready_to_ship") {
        if (actor.actor_type !== "admin" && actor.actor_type !== "system") {
          throw new PrivateLabelGateError("qc_locked", [
            `Job is already in status '${job.status}'; supervisor permission required to modify QC milestones`,
          ]);
        }
      }

      // Normalize stage alias
      let normalizedStage: QCMilestone["stage"] = "raw_material";
      const s = String(input.stage || "raw_material");
      if (s === "raw_material" || s === "raw_material_in") {
        normalizedStage = "raw_material";
      } else if (s === "packaging_incoming") {
        normalizedStage = "packaging_incoming";
      } else if (s === "print_proof") {
        normalizedStage = "print_proof";
      } else if (s === "fill_weight") {
        normalizedStage = "fill_weight";
      } else if (s === "seal_integrity") {
        normalizedStage = "seal_integrity";
      } else if (s === "sensory_cupping") {
        normalizedStage = "sensory_cupping";
      } else if (s === "final_pack" || s === "packaging_cartoning" || s === "final") {
        normalizedStage = "final_pack";
      }

      // Normalize status alias
      let normalizedStatus: "pending" | "passed" | "failed" | "waived" = "passed";
      if (input.status === "conditionally_passed" || input.status === "passed") {
        normalizedStatus = "passed";
      } else if (input.status === "failed") {
        normalizedStatus = "failed";
      } else if (input.status === "waived") {
        normalizedStatus = "waived";
      } else if (input.status === "pending") {
        normalizedStatus = "pending";
      }

      // FSSAI fill weight check (+/-1.5%) (Test F27.B3)
      if (normalizedStage === "fill_weight" || (input.recorded_weight_g !== undefined && input.target_weight_g !== undefined)) {
        if (input.recorded_weight_g && input.target_weight_g && input.target_weight_g > 0) {
          const variance = Math.abs(input.recorded_weight_g - input.target_weight_g) / input.target_weight_g;
          if (variance > 0.015) {
            throw new PrivateLabelGateError("fssai_weight_tolerance", [
              `Fill weight variance (${(variance * 100).toFixed(2)}%) exceeds FSSAI allowed tolerance (+/-1.5%)`,
            ]);
          }
        }
      }

      const inspector = input.inspector_name || actor.actor_email || actor.actor_id || "Quality Inspector";
      const notes = input.notes || input.evidence_notes || null;
      const photoUrl = input.evidence_url || input.evidence_photo_url || null;

      const existingMilestone = db
        .prepare("SELECT id FROM pl_qc_milestones WHERE job_id = ? AND stage = ?")
        .get(jobId, normalizedStage) as { id: string } | undefined;

      let milestoneId = existingMilestone?.id;

      if (milestoneId) {
        db.prepare(
          `UPDATE pl_qc_milestones
           SET status = ?, inspector_name = ?, inspection_date = CURRENT_TIMESTAMP,
               evidence_notes = ?, evidence_photo_url = ?,
               cupping_score = COALESCE(?, cupping_score),
               recorded_weight_g = COALESCE(?, recorded_weight_g),
               target_weight_g = COALESCE(?, target_weight_g),
               notes = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(
          normalizedStatus,
          inspector,
          notes,
          photoUrl,
          input.cupping_score ?? null,
          input.recorded_weight_g ?? null,
          input.target_weight_g ?? null,
          notes,
          milestoneId
        );
      } else {
        milestoneId = `qc_${randomUUID()}`;
        const milestoneName = input.milestone_name || `Milestone: ${normalizedStage}`;
        db.prepare(
          `INSERT INTO pl_qc_milestones (
            id, job_id, milestone_name, stage, status, inspector_name,
            inspection_date, evidence_notes, evidence_photo_url,
            cupping_score, recorded_weight_g, target_weight_g, notes,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            CURRENT_TIMESTAMP, ?, ?,
            ?, ?, ?, ?,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`
        ).run(
          milestoneId,
          jobId,
          milestoneName,
          normalizedStage,
          normalizedStatus,
          inspector,
          notes,
          photoUrl,
          input.cupping_score ?? null,
          input.recorded_weight_g ?? null,
          input.target_weight_g ?? null,
          notes
        );
      }

      // Critical milestone failure: automatic halt (Test F27.B1)
      if (normalizedStatus === "failed" && (normalizedStage === "seal_integrity" || normalizedStage === "sensory_cupping")) {
        db.prepare("UPDATE pl_jobs SET status = 'halted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(jobId);
      }

      // Check if all 7 milestones are now passed/waived: advance job to ready_to_ship (Test F27.5)
      const allMilestones = db
        .prepare("SELECT stage, status FROM pl_qc_milestones WHERE job_id = ?")
        .all(jobId) as Array<{ stage: string; status: string }>;

      const allPassedOrWaived =
        allMilestones.length >= 7 &&
        allMilestones.every((m) => m.status === "passed" || m.status === "waived");

      if (allPassedOrWaived && job.status !== "ready_to_ship" && job.status !== "completed") {
        db.prepare("UPDATE pl_jobs SET status = 'ready_to_ship', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(jobId);
        db.prepare("UPDATE pl_orders SET status = 'qc_passed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(job.order_id);
      }

      const milestone = db
        .prepare("SELECT * FROM pl_qc_milestones WHERE id = ?")
        .get(milestoneId) as QCMilestone;

      PrivateLabelService.recordAudit(db, {
        entity_type: "qc_milestone",
        entity_id: milestoneId,
        revision: 1,
        action: "record_qc",
        actor,
        diff: {
          stage: normalizedStage,
          status: normalizedStatus,
          inspector,
          cuppingScore: input.cupping_score,
          recordedWeightG: input.recorded_weight_g,
          targetWeightG: input.target_weight_g,
        },
      });

      return milestone;
    })();
  }

  // ==========================================================================
  // 7. Audit & History Domain
  // ==========================================================================

  static getAuditHistory(entityType: string, entityId: string): AuditRecord[] {
    const db = getDb();
    return fetchAuditHistory(db, entityType, entityId);
  }

  // ==========================================================================
  // Milestone M2 Admin Companion Domain Methods
  // ==========================================================================

  // --- Price Books & Tiers ---
  static listPriceBooks(filter?: {
    status?: "draft" | "active" | "archived" | "all";
    currency?: string;
    page?: number;
    limit?: number;
  }): { priceBooks: Array<PriceBook & { tier_count: number }>; total: number } {
    const db = getDb();
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.status && filter.status !== "all") {
      where.push("status = ?");
      params.push(filter.status);
    }
    if (filter?.currency) {
      where.push("currency = ?");
      params.push(filter.currency);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const totalRow = db.prepare(`SELECT count(*) as c FROM pl_price_books ${whereSql}`).get(...params) as { c: number };

    const limit = filter?.limit ?? 50;
    const offset = ((filter?.page ?? 1) - 1) * limit;

    const priceBooks = db.prepare(
      `SELECT pl_price_books.*,
              (SELECT count(*) FROM pl_price_book_tiers WHERE price_book_id = pl_price_books.id) AS tier_count
       FROM pl_price_books
       ${whereSql}
       ORDER BY is_default DESC, created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Array<PriceBook & { tier_count: number }>;

    return { priceBooks, total: totalRow.c };
  }

  static getPriceBookById(id: string): (PriceBook & { tiers: PriceBookTier[] }) | null {
    const db = getDb();
    const book = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(id) as PriceBook | undefined;
    if (!book) return null;
    const tiers = db
      .prepare("SELECT * FROM pl_price_book_tiers WHERE price_book_id = ? ORDER BY item_type ASC, min_qty ASC")
      .all(id) as PriceBookTier[];
    return { ...book, tiers };
  }

  static upsertPriceBook(
    input: {
      id?: string;
      name: string;
      currency?: "INR" | "USD" | "EUR" | "GBP";
      is_default?: boolean;
      effective_from?: string;
      effective_to?: string | null;
      margin_rate?: number;
      filling_labor_paise_per_unit?: number;
      qc_charge_paise_per_batch?: number;
      contingency_rate?: number;
      loss_allowance_rate?: number;
      status?: "draft" | "active" | "archived";
      tiers?: Array<{
        item_type: "packaging" | "print_method" | "tea_markup";
        item_id: string;
        min_qty: number;
        max_qty?: number | null;
        unit_price_paise: number;
      }>;
    },
    actor: AuditActor,
    expected_revision?: number
  ): PriceBook & { tiers: PriceBookTier[] } {
    const db = getDb();
    return db.transaction(() => {
      if (input.is_default) {
        db.prepare("UPDATE pl_price_books SET is_default = 0 WHERE is_default = 1").run();
      }

      let pbId = input.id;
      const existing = pbId
        ? (db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(pbId) as PriceBook | undefined)
        : undefined;

      if (expected_revision !== undefined && !existing) {
        throw new PrivateLabelNotFoundError("PriceBook", pbId!);
      }

      if (existing && pbId) {

        if (expected_revision !== undefined && existing.revision !== expected_revision) {
          throw new PrivateLabelRevisionConflictError("PriceBook", pbId, existing.revision, expected_revision);
        }

        const expRev = expected_revision ?? existing.revision;
        const res = db.prepare(
          `UPDATE pl_price_books
           SET name = ?, currency = ?, is_default = ?, effective_from = ?, effective_to = ?,
               margin_rate = ?, filling_labor_paise_per_unit = ?, qc_charge_paise_per_batch = ?,
               contingency_rate = ?, loss_allowance_rate = ?, status = ?,
               revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        ).run(
          input.name,
          input.currency ?? existing.currency,
          input.is_default !== undefined ? (input.is_default ? 1 : 0) : existing.is_default,
          input.effective_from ?? existing.effective_from,
          input.effective_to ?? existing.effective_to,
          input.margin_rate ?? existing.margin_rate,
          input.filling_labor_paise_per_unit ?? existing.filling_labor_paise_per_unit,
          input.qc_charge_paise_per_batch ?? existing.qc_charge_paise_per_batch,
          input.contingency_rate ?? existing.contingency_rate,
          input.loss_allowance_rate ?? existing.loss_allowance_rate,
          input.status ?? existing.status,
          pbId,
          expRev
        );

        if (res.changes === 0) {
          const recheck = db.prepare("SELECT revision FROM pl_price_books WHERE id = ?").get(pbId) as { revision: number };
          throw new PrivateLabelRevisionConflictError("PriceBook", pbId, recheck.revision, expRev);
        }
      } else {
        pbId = pbId || `pb_${randomUUID()}`;
        db.prepare(
          `INSERT INTO pl_price_books (
            id, name, currency, is_default, effective_from, effective_to,
            margin_rate, filling_labor_paise_per_unit, qc_charge_paise_per_batch,
            contingency_rate, loss_allowance_rate, status, revision, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).run(
          pbId,
          input.name,
          input.currency ?? "INR",
          input.is_default ? 1 : 0,
          input.effective_from ?? new Date().toISOString(),
          input.effective_to ?? null,
          input.margin_rate ?? 0.25,
          input.filling_labor_paise_per_unit ?? 300,
          input.qc_charge_paise_per_batch ?? 250000,
          input.contingency_rate ?? 0.05,
          input.loss_allowance_rate ?? 0.03,
          input.status ?? "draft"
        );
      }

      if (input.tiers) {
        db.prepare("DELETE FROM pl_price_book_tiers WHERE price_book_id = ?").run(pbId);
        const insertTier = db.prepare(
          `INSERT INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        );
        for (const t of input.tiers) {
          insertTier.run(`pbt_${randomUUID()}`, pbId, t.item_type, t.item_id, t.min_qty, t.max_qty ?? null, t.unit_price_paise);
        }
      }

      const updated = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(pbId) as PriceBook;
      const tiers = db.prepare("SELECT * FROM pl_price_book_tiers WHERE price_book_id = ? ORDER BY min_qty ASC").all(pbId) as PriceBookTier[];

      PrivateLabelService.recordAudit(db, {
        entity_type: "price_book",
        entity_id: pbId!,
        revision: updated.revision,
        action: existing ? "update" : "create",
        actor,
        diff: input,
      });

      return { ...updated, tiers };
    })();
  }

  static setDefaultPriceBook(id: string, actor: AuditActor): PriceBook {
    const db = getDb();
    return db.transaction(() => {
      const book = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(id) as PriceBook | undefined;
      if (!book) {
        throw new PrivateLabelNotFoundError("PriceBook", id);
      }

      db.prepare("UPDATE pl_price_books SET is_default = 0 WHERE is_default = 1").run();
      db.prepare("UPDATE pl_price_books SET is_default = 1, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

      const updated = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(id) as PriceBook;
      PrivateLabelService.recordAudit(db, {
        entity_type: "price_book",
        entity_id: id,
        revision: updated.revision,
        action: "set_default",
        actor,
      });
      return updated;
    })();
  }

  static deletePriceBook(id: string, actor: AuditActor): void {
    const db = getDb();
    db.transaction(() => {
      const book = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(id) as PriceBook | undefined;
      if (!book) {
        throw new PrivateLabelNotFoundError("PriceBook", id);
      }
      if (book.is_default === 1) {
        throw new Error("Cannot delete the default price book. Assign another default price book first.");
      }
      const linkedQuotes = (db.prepare("SELECT count(*) as c FROM pl_quotes WHERE price_book_id = ?").get(id) as { c: number }).c;
      if (linkedQuotes > 0) {
        db.prepare("UPDATE pl_price_books SET status = 'archived', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      } else {
        db.prepare("DELETE FROM pl_price_book_tiers WHERE price_book_id = ?").run(id);
        db.prepare("DELETE FROM pl_price_books WHERE id = ?").run(id);
      }

      PrivateLabelService.recordAudit(db, {
        entity_type: "price_book",
        entity_id: id,
        revision: book.revision + 1,
        action: "delete",
        actor,
        diff: { id, name: book.name },
      });
    })();
  }

  static listPriceBookTiers(priceBookId: string, itemType?: "packaging" | "print_method" | "tea_markup"): PriceBookTier[] {
    const db = getDb();
    if (itemType) {
      return db
        .prepare("SELECT * FROM pl_price_book_tiers WHERE price_book_id = ? AND item_type = ? ORDER BY min_qty ASC")
        .all(priceBookId, itemType) as PriceBookTier[];
    }
    return db
      .prepare("SELECT * FROM pl_price_book_tiers WHERE price_book_id = ? ORDER BY item_type ASC, min_qty ASC")
      .all(priceBookId) as PriceBookTier[];
  }

  static upsertPriceBookTier(
    input: {
      id?: string;
      price_book_id: string;
      item_type: "packaging" | "print_method" | "tea_markup";
      item_id: string;
      min_qty: number;
      max_qty?: number | null;
      unit_price_paise: number;
    },
    actor: AuditActor
  ): PriceBookTier {
    const db = getDb();
    return db.transaction(() => {
      let id = input.id;
      if (id) {
        db.prepare(
          `UPDATE pl_price_book_tiers
           SET item_type = ?, item_id = ?, min_qty = ?, max_qty = ?, unit_price_paise = ?
           WHERE id = ?`
        ).run(input.item_type, input.item_id, input.min_qty, input.max_qty ?? null, input.unit_price_paise, id);
      } else {
        id = `pbt_${randomUUID()}`;
        db.prepare(
          `INSERT INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(id, input.price_book_id, input.item_type, input.item_id, input.min_qty, input.max_qty ?? null, input.unit_price_paise);
      }

      const tier = db.prepare("SELECT * FROM pl_price_book_tiers WHERE id = ?").get(id) as PriceBookTier;
      PrivateLabelService.recordAudit(db, {
        entity_type: "price_book_tier",
        entity_id: id,
        revision: 1,
        action: input.id ? "update" : "create",
        actor,
        diff: input,
      });
      return tier;
    })();
  }

  static deletePriceBookTier(id: string, actor: AuditActor): void {
    const db = getDb();
    db.transaction(() => {
      db.prepare("DELETE FROM pl_price_book_tiers WHERE id = ?").run(id);
      PrivateLabelService.recordAudit(db, {
        entity_type: "price_book_tier",
        entity_id: id,
        revision: 1,
        action: "delete",
        actor,
        diff: { id },
      });
    })();
  }

  // --- MOQ Rules ---
  static listMoqRules(filter?: { rule_type?: string; target_id?: string }): MoqRule[] {
    const db = getDb();
    const where: string[] = [];
    const params: string[] = [];
    if (filter?.rule_type) {
      where.push("rule_type = ?");
      params.push(filter.rule_type);
    }
    if (filter?.target_id) {
      where.push("target_id = ?");
      params.push(filter.target_id);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    return db.prepare(`SELECT * FROM pl_moq_rules ${whereSql} ORDER BY created_at DESC`).all(...params) as MoqRule[];
  }

  static upsertMoqRule(
    input: {
      id?: string;
      rule_type: "tea" | "packaging" | "print" | "global";
      target_id?: string | null;
      min_quantity: number;
      unit_basis: "kg" | "units" | "orders";
      order_multiple?: number;
      min_order_value_paise?: number;
      effective_from?: string;
      effective_to?: string | null;
    },
    actor: AuditActor
  ): MoqRule {
    const db = getDb();
    return db.transaction(() => {
      let id = input.id;
      if (id) {
        db.prepare(
          `UPDATE pl_moq_rules
           SET rule_type = ?, target_id = ?, min_quantity = ?, unit_basis = ?,
               order_multiple = ?, min_order_value_paise = ?, effective_from = ?, effective_to = ?
           WHERE id = ?`
        ).run(
          input.rule_type,
          input.target_id ?? null,
          input.min_quantity,
          input.unit_basis,
          input.order_multiple ?? 1,
          input.min_order_value_paise ?? 0,
          input.effective_from ?? new Date().toISOString(),
          input.effective_to ?? null,
          id
        );
      } else {
        id = `moq_${randomUUID()}`;
        db.prepare(
          `INSERT INTO pl_moq_rules (
            id, rule_type, target_id, min_quantity, unit_basis, order_multiple,
            min_order_value_paise, effective_from, effective_to, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(
          id,
          input.rule_type,
          input.target_id ?? null,
          input.min_quantity,
          input.unit_basis,
          input.order_multiple ?? 1,
          input.min_order_value_paise ?? 0,
          input.effective_from ?? new Date().toISOString(),
          input.effective_to ?? null
        );
      }

      const rule = db.prepare("SELECT * FROM pl_moq_rules WHERE id = ?").get(id) as MoqRule;
      PrivateLabelService.recordAudit(db, {
        entity_type: "moq_rule",
        entity_id: id,
        revision: 1,
        action: input.id ? "update" : "create",
        actor,
        diff: input,
      });
      return rule;
    })();
  }

  static deleteMoqRule(id: string, actor: AuditActor): void {
    const db = getDb();
    db.transaction(() => {
      db.prepare("DELETE FROM pl_moq_rules WHERE id = ?").run(id);
      PrivateLabelService.recordAudit(db, {
        entity_type: "moq_rule",
        entity_id: id,
        revision: 1,
        action: "delete",
        actor,
        diff: { id },
      });
    })();
  }

  // --- Quotes Admin Queue ---
  static listQuotesAdmin(filter?: {
    status?: QuoteStatus | "all";
    search?: string;
    page?: number;
    limit?: number;
  }): {
    quotes: Array<Quote & { project_title?: string; client_name?: string; company_name?: string }>;
    total: number;
    page: number;
    limit: number;
  } {
    const db = getDb();
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.status && filter.status !== "all") {
      where.push("q.status = ?");
      params.push(filter.status);
    }
    if (filter?.search) {
      where.push("(q.quote_number LIKE ? OR p.title LIKE ? OR c.company_name LIKE ? OR c.contact_email LIKE ?)");
      const term = `%${filter.search}%`;
      params.push(term, term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const totalRow = db.prepare(
      `SELECT count(*) as c
       FROM pl_quotes q
       LEFT JOIN pl_projects p ON p.id = q.project_id
       LEFT JOIN pl_clients c ON c.id = p.client_id
       ${whereSql}`
    ).get(...params) as { c: number };

    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 20;
    const offset = (page - 1) * limit;

    const quotes = db.prepare(
      `SELECT q.*, p.title as project_title, c.contact_name as client_name, c.company_name as company_name
       FROM pl_quotes q
       LEFT JOIN pl_projects p ON p.id = q.project_id
       LEFT JOIN pl_clients c ON c.id = p.client_id
       ${whereSql}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Array<Quote & { project_title?: string; client_name?: string; company_name?: string }>;

    return { quotes, total: totalRow.c, page, limit };
  }

  static getQuoteAdmin(id: string): QuoteWithItems & { project: Project; client: Client | null } {
    const db = getDb();
    const quote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(id) as Quote | undefined;
    if (!quote) {
      throw new PrivateLabelNotFoundError("Quote", id);
    }
    const items = db.prepare("SELECT * FROM pl_quote_items WHERE quote_id = ?").all(id) as QuoteItem[];
    const project = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(quote.project_id) as Project;
    const client = project.client_id ? (db.prepare("SELECT * FROM pl_clients WHERE id = ?").get(project.client_id) as Client | null) : null;
    return { ...quote, items, project, client };
  }

  static overrideQuotePrice(
    quoteId: string,
    overrides: {
      tea_subtotal_paise?: number;
      packaging_subtotal_paise?: number;
      printing_subtotal_paise?: number;
      tooling_setup_paise?: number;
      labor_subtotal_paise?: number;
      qc_subtotal_paise?: number;
      freight_paise?: number;
      margin_paise?: number;
      status?: QuoteStatus;
      extend_validity_days?: number;
      operator_notes?: string;
    },
    actor: AuditActor,
    expected_revision?: number
  ): QuoteWithItems {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote | undefined;
      if (!existing) {
        throw new PrivateLabelNotFoundError("Quote", quoteId);
      }

      if (expected_revision !== undefined && existing.revision !== expected_revision) {
        throw new PrivateLabelRevisionConflictError(
          "Quote",
          quoteId,
          existing.revision,
          expected_revision
        );
      }

      const expRev = expected_revision ?? existing.revision;

      const teaSub = overrides.tea_subtotal_paise ?? existing.tea_subtotal_paise;
      const packSub = overrides.packaging_subtotal_paise ?? existing.packaging_subtotal_paise;
      const printSub = overrides.printing_subtotal_paise ?? existing.printing_subtotal_paise;
      const toolSub = overrides.tooling_setup_paise ?? existing.tooling_setup_paise;
      const laborSub = overrides.labor_subtotal_paise ?? existing.labor_subtotal_paise;
      const qcSub = overrides.qc_subtotal_paise ?? existing.qc_subtotal_paise;
      const freightSub = overrides.freight_paise ?? existing.freight_paise;
      const marginSub = overrides.margin_paise ?? existing.margin_paise;

      // Indian GST: 5% tea leaf, 18% services & materials
      const teaGst = Math.round(teaSub * 0.05);
      const nonTeaSubtotal = packSub + printSub + toolSub + laborSub + qcSub + freightSub + marginSub;
      const nonTeaGst = Math.round(nonTeaSubtotal * 0.18);
      const taxTotal = teaGst + nonTeaGst;
      const grandTotal = teaSub + nonTeaSubtotal + taxTotal;

      let validUntil = existing.valid_until;
      if (overrides.extend_validity_days) {
        const d = new Date();
        d.setDate(d.getDate() + overrides.extend_validity_days);
        validUntil = d.toISOString();
      }

      const status = overrides.status ?? existing.status;

      let breakdownObj: Record<string, unknown> = {};
      try {
        breakdownObj = JSON.parse(existing.price_breakdown_json || "{}");
      } catch {
        breakdownObj = {};
      }
      breakdownObj.admin_override = {
        applied_at: new Date().toISOString(),
        actor_id: actor.actor_id,
        operator_notes: overrides.operator_notes,
      };
      breakdownObj.taxDetails = {
        teaGstPaise: teaGst,
        nonTeaGstPaise: nonTeaGst,
      };

      const result = db.prepare(
        `UPDATE pl_quotes
         SET tea_subtotal_paise = ?, packaging_subtotal_paise = ?, printing_subtotal_paise = ?,
             tooling_setup_paise = ?, labor_subtotal_paise = ?, qc_subtotal_paise = ?,
             freight_paise = ?, margin_paise = ?, tax_paise = ?, grand_total_paise = ?,
             price_breakdown_json = ?, status = ?, valid_until = ?,
             revision = revision + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND revision = ?`
      ).run(
        teaSub, packSub, printSub, toolSub, laborSub, qcSub, freightSub, marginSub,
        taxTotal, grandTotal, JSON.stringify(breakdownObj), status, validUntil,
        quoteId, expRev
      );

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };
        throw new PrivateLabelRevisionConflictError("Quote", quoteId, recheck.revision, expRev);
      }

      const updated = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote;
      const items = db.prepare("SELECT * FROM pl_quote_items WHERE quote_id = ?").all(quoteId) as QuoteItem[];

      PrivateLabelService.recordAudit(db, {
        entity_type: "quote",
        entity_id: quoteId,
        revision: updated.revision,
        action: "admin_price_override",
        actor,
        diff: overrides,
      });

      return { ...updated, items };
    })();
  }

  static issueFirmQuote(
    quoteId: string,
    validityDays = 14,
    actor: AuditActor,
    expected_revision?: number
  ): QuoteWithItems {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote | undefined;
      if (!existing) {
        throw new PrivateLabelNotFoundError("Quote", quoteId);
      }

      if (expected_revision !== undefined && existing.revision !== expected_revision) {
        throw new PrivateLabelRevisionConflictError(
          "Quote",
          quoteId,
          existing.revision,
          expected_revision
        );
      }

      const expRev = expected_revision ?? existing.revision;

      const d = new Date();
      d.setDate(d.getDate() + validityDays);
      const validUntil = d.toISOString();
      const issuedAt = new Date().toISOString();

      const result = db.prepare(
        `UPDATE pl_quotes
         SET status = 'firm_issued', issued_at = ?, valid_until = ?,
             revision = revision + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND revision = ?`
      ).run(issuedAt, validUntil, quoteId, expRev);

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };
        throw new PrivateLabelRevisionConflictError("Quote", quoteId, recheck.revision, expRev);
      }

      const updated = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote;
      const items = db.prepare("SELECT * FROM pl_quote_items WHERE quote_id = ?").all(quoteId) as QuoteItem[];

      PrivateLabelService.recordAudit(db, {
        entity_type: "quote",
        entity_id: quoteId,
        revision: updated.revision,
        action: "issue_firm_quote",
        actor,
        diff: { status: "firm_issued", validityDays, validUntil },
      });

      return { ...updated, items };
    })();
  }

  // --- Production Jobs & QC Milestones ---
  static listProductionJobs(filter?: {
    status?: JobStatus | "all";
    search?: string;
    page?: number;
    limit?: number;
  }): {
    jobs: Array<ProductionJobWithMilestones & { order_number?: string; company_name?: string; passed_qc_count: number }>;
    total: number;
    page: number;
    limit: number;
  } {
    const db = getDb();
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.status && filter.status !== "all") {
      where.push("j.status = ?");
      params.push(filter.status);
    }
    if (filter?.search) {
      where.push("(j.job_number LIKE ? OR o.order_number LIKE ? OR c.company_name LIKE ?)");
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const totalRow = db.prepare(
      `SELECT count(*) as c
       FROM pl_jobs j
       LEFT JOIN pl_orders o ON o.id = j.order_id
       LEFT JOIN pl_clients c ON c.id = o.client_id
       ${whereSql}`
    ).get(...params) as { c: number };

    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 20;
    const offset = (page - 1) * limit;

    const rows = db.prepare(
      `SELECT j.*, o.order_number, c.company_name,
              (SELECT count(*) FROM pl_qc_milestones WHERE job_id = j.id AND status = 'passed') as passed_qc_count
       FROM pl_jobs j
       LEFT JOIN pl_orders o ON o.id = j.order_id
       LEFT JOIN pl_clients c ON c.id = o.client_id
       ${whereSql}
       ORDER BY j.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Array<ProductionJob & { order_number?: string; company_name?: string; passed_qc_count: number }>;

    const jobs = rows.map((job) => {
      const milestones = db.prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC").all(job.id) as QCMilestone[];
      return {
        ...job,
        milestones,
      };
    });

    return { jobs, total: totalRow.c, page, limit };
  }

  static updateJobStatus(
    jobId: string,
    toStatus: JobStatus,
    actor: AuditActor,
    operatorNotes?: string
  ): ProductionJob {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(jobId) as ProductionJob | undefined;
      if (!existing) {
        throw new PrivateLabelNotFoundError("ProductionJob", jobId);
      }

      if (toStatus === "ready_to_ship" || toStatus === "completed") {
        const qcGate = PrivateLabelService.validateQCGate(jobId);
        if (!qcGate.canPublish) {
          throw new PrivateLabelGateError("qc_completion_gate", qcGate.blockers);
        }
      }

      const actualCompletion = toStatus === "completed" ? new Date().toISOString() : existing.actual_completion_date;
      const notes = operatorNotes ?? existing.operator_notes;

      db.prepare(
        `UPDATE pl_jobs
         SET status = ?, actual_completion_date = ?, operator_notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(toStatus, actualCompletion, notes, jobId);

      const updated = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(jobId) as ProductionJob;

      PrivateLabelService.recordAudit(db, {
        entity_type: "production_job",
        entity_id: jobId,
        revision: 1,
        action: "update_job_status",
        actor,
        diff: { from: existing.status, to: toStatus, operator_notes: notes },
      });

      return updated;
    })();
  }

  static updateJobDetails(
    jobId: string,
    updates: {
      target_completion_date?: string | null;
      actual_completion_date?: string | null;
      operator_notes?: string | null;
    },
    actor: AuditActor
  ): ProductionJob {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(jobId) as ProductionJob | undefined;
      if (!existing) {
        throw new PrivateLabelNotFoundError("ProductionJob", jobId);
      }

      db.prepare(
        `UPDATE pl_jobs
         SET target_completion_date = ?, actual_completion_date = ?, operator_notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(
        updates.target_completion_date !== undefined ? updates.target_completion_date : existing.target_completion_date,
        updates.actual_completion_date !== undefined ? updates.actual_completion_date : existing.actual_completion_date,
        updates.operator_notes !== undefined ? updates.operator_notes : existing.operator_notes,
        jobId
      );

      const updated = db.prepare("SELECT * FROM pl_jobs WHERE id = ?").get(jobId) as ProductionJob;

      PrivateLabelService.recordAudit(db, {
        entity_type: "production_job",
        entity_id: jobId,
        revision: 1,
        action: "update_job_details",
        actor,
        diff: updates,
      });

      return updated;
    })();
  }

  // --- Admin Overview Stats ---
  static getAdminOverviewStats(): {
    teaCount: { total: number; published: number; draft: number };
    packagingCount: { total: number; published: number; draft: number; archived: number };
    printMethodCount: { total: number; active: number };
    priceBookCount: { total: number; active: number };
    quoteQueueCount: { total: number; pricingPending: number; estimated: number; firmIssued: number; accepted: number; converted: number };
    jobQueueCount: { total: number; active: number; completed: number; qcPending: number };
    recentAudit: AuditRecord[];
  } {
    const db = getDb();

    const teaTotal = (db.prepare("SELECT count(*) as c FROM pl_tea_options").get() as { c: number }).c;
    const teaPublished = (db.prepare("SELECT count(*) as c FROM pl_tea_options WHERE is_published = 1").get() as { c: number }).c;

    const packTotal = (db.prepare("SELECT count(*) as c FROM pl_packaging_variants").get() as { c: number }).c;
    const packPublished = (db.prepare("SELECT count(*) as c FROM pl_packaging_variants WHERE status = 'published'").get() as { c: number }).c;
    const packDraft = (db.prepare("SELECT count(*) as c FROM pl_packaging_variants WHERE status = 'draft'").get() as { c: number }).c;
    const packArchived = (db.prepare("SELECT count(*) as c FROM pl_packaging_variants WHERE status = 'archived'").get() as { c: number }).c;

    const pmTotal = (db.prepare("SELECT count(*) as c FROM pl_print_methods").get() as { c: number }).c;
    const pmActive = (db.prepare("SELECT count(*) as c FROM pl_print_methods WHERE is_active = 1").get() as { c: number }).c;

    const pbTotal = (db.prepare("SELECT count(*) as c FROM pl_price_books").get() as { c: number }).c;
    const pbActive = (db.prepare("SELECT count(*) as c FROM pl_price_books WHERE status = 'active'").get() as { c: number }).c;

    const qTotal = (db.prepare("SELECT count(*) as c FROM pl_quotes").get() as { c: number }).c;
    const qPending = (db.prepare("SELECT count(*) as c FROM pl_quotes WHERE status = 'pricing_pending'").get() as { c: number }).c;
    const qEstimated = (db.prepare("SELECT count(*) as c FROM pl_quotes WHERE status = 'estimated'").get() as { c: number }).c;
    const qFirm = (db.prepare("SELECT count(*) as c FROM pl_quotes WHERE status = 'firm_issued'").get() as { c: number }).c;
    const qAccepted = (db.prepare("SELECT count(*) as c FROM pl_quotes WHERE status = 'customer_accepted'").get() as { c: number }).c;
    const qConverted = (db.prepare("SELECT count(*) as c FROM pl_quotes WHERE status = 'converted'").get() as { c: number }).c;

    const jTotal = (db.prepare("SELECT count(*) as c FROM pl_jobs").get() as { c: number }).c;
    const jActive = (db.prepare("SELECT count(*) as c FROM pl_jobs WHERE status NOT IN ('completed', 'halted')").get() as { c: number }).c;
    const jCompleted = (db.prepare("SELECT count(*) as c FROM pl_jobs WHERE status = 'completed'").get() as { c: number }).c;
    const jQc = (db.prepare("SELECT count(*) as c FROM pl_jobs WHERE status = 'qc'").get() as { c: number }).c;

    const recentAudit = db
      .prepare("SELECT * FROM pl_audit ORDER BY created_at DESC LIMIT 10")
      .all() as AuditRecord[];

    return {
      teaCount: { total: teaTotal, published: teaPublished, draft: teaTotal - teaPublished },
      packagingCount: { total: packTotal, published: packPublished, draft: packDraft, archived: packArchived },
      printMethodCount: { total: pmTotal, active: pmActive },
      priceBookCount: { total: pbTotal, active: pbActive },
      quoteQueueCount: {
        total: qTotal,
        pricingPending: qPending,
        estimated: qEstimated,
        firmIssued: qFirm,
        accepted: qAccepted,
        converted: qConverted,
      },
      jobQueueCount: {
        total: jTotal,
        active: jActive,
        completed: jCompleted,
        qcPending: jQc,
      },
      recentAudit,
    };
  }

  // ==========================================================================
  // 8. Initial Catalog Seeder (Idempotent)
  // ==========================================================================

  static seedInitialCatalog(): void {
    const db = getDb();

    db.transaction(() => {
      // 1. Packaging families
      const families: Array<{ code: string; name: string; description: string; sort_order: number }> = [
        { code: "pouch", name: "Stand-Up & Flat Pouches", description: "Flexible high-barrier pouches with zip closures", sort_order: 1 },
        { code: "tin", name: "Artisanal Metal Tins", description: "Food-grade tinplate containers with inner slip lids", sort_order: 2 },
        { code: "jar", name: "Apothecary Glass & PET Jars", description: "Cylindrical clear and amber jars with airtight caps", sort_order: 3 },
        { code: "carton", name: "Luxury Rigid & Folding Cartons", description: "Custom printed folding boxboard cartons", sort_order: 4 },
        { code: "sachet", name: "Single-Serve Envelopes & Sachets", description: "Individually sealed luxury pyramid sachets", sort_order: 5 },
        { code: "bag", name: "Bulk Kraft & Foil Liners", description: "Master food-service bags for bulk leaves", sort_order: 6 },
      ];

      for (const fam of families) {
        db.prepare(
          `INSERT OR IGNORE INTO pl_packaging_families (id, code, name, description, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`
        ).run(`fam_${fam.code}`, fam.code, fam.name, fam.description, fam.sort_order);
      }

      // 2. Print methods
      const printMethods = [
        { id: "pm_paper_label", code: "paper_label", name: "Premium Paper Label", desc: "Matte uncoated textured label", model: "cmyk", maxColors: 4, setup: 50000, cylinder: 0, minOrder: 100 },
        { id: "pm_bopp_label", code: "bopp_label", name: "Waterproof BOPP Label", desc: "Polypropylene high-tack moisture label", model: "cmyk", maxColors: 6, setup: 100000, cylinder: 0, minOrder: 250 },
        { id: "pm_direct_digital", code: "direct_digital", name: "Direct Digital Print", desc: "High-resolution digital roll-fed pouch print", model: "cmyk", maxColors: 8, setup: 150000, cylinder: 0, minOrder: 500 },
        { id: "pm_gravure", code: "gravure", name: "Rotogravure Cylinder Print", desc: "Industrial high-speed film gravure print", model: "spot", maxColors: 10, setup: 500000, cylinder: 800000, minOrder: 5000 },
        { id: "pm_screen_print", code: "screen_print", name: "Rotary Screen Print", desc: "Spot screen printing for metal and glass", model: "spot", maxColors: 3, setup: 200000, cylinder: 0, minOrder: 1000 },
        { id: "pm_sleeve", code: "sleeve", name: "Shrink Sleeve", desc: "Full-body contour shrink sleeve", model: "cmyk", maxColors: 8, setup: 300000, cylinder: 0, minOrder: 1000 },
      ];

      for (const pm of printMethods) {
        db.prepare(
          `INSERT OR IGNORE INTO pl_print_methods (
            id, code, name, description, color_model, max_colors, setup_fee_paise,
            cylinder_fee_per_color_paise, min_order_units, lead_time_days, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 14, 1)`
        ).run(pm.id, pm.code, pm.name, pm.desc, pm.model, pm.maxColors, pm.setup, pm.cylinder, pm.minOrder);
      }

      // 3. Default Price Book
      db.prepare(
        `INSERT OR IGNORE INTO pl_price_books (
          id, name, currency, is_default, margin_rate, filling_labor_paise_per_unit,
          qc_charge_paise_per_batch, contingency_rate, loss_allowance_rate, status, revision
        ) VALUES (
          'pb_default_inr', 'Default INR Price Book 2026', 'INR', 1, 0.25, 300,
          250000, 0.05, 0.03, 'active', 1
        )`
      ).run();
    })();
  }
}
