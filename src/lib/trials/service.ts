/**
 * TeaFloww Trials v3 — Unified TrialService Singleton
 *
 * Core domain service enforcing:
 * 1. Atomic Compare-and-Swap (CAS) optimistic concurrency control
 * 2. Multi-table synchronous ACID transactions via getDb().transaction()
 * 3. In-transaction atomic audit logging in trial_audit
 * 4. 4x50g kit component weight invariant
 * 5. Publication blocker gate validator
 * 6. Whitelist public projection for storefront security
 */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type {
  Trial,
  TrialWithDetails,
  TrialPublicDto,
  TrialComponent,
  TrialAsset,
  TrialBrewGuide,
  TrialSensoryTest,
  TrialClaim,
  TrialBulkLink,
  TrialPublication,
  TrialAuditEntry,
  AuditActor,
  CreateTrialInput,
  UpdateTrialInput,
  ComponentInput,
  AssetInput,
  TrialQueryOptions,
  TrialPublicQueryOptions,
  PublicationValidationResult,
} from "./types";
import {
  TrialRevisionConflictError,
  TrialNotFoundError,
  TrialPublishGateError,
  TrialWeightInvariantError,
  TrialInvalidStateTransitionError,
} from "./types";
import {
  validateComponentInvariant,
  validatePublication,
  toPublicDto,
  type PublicDtoOptions,
} from "./validation";

export class TrialService {
  /**
   * Helper: Insert atomic audit log row inside the active transaction.
   */
  private static recordAudit(
    db: ReturnType<typeof getDb>,
    trial_id: string,
    revision: number,
    action: string,
    actor: AuditActor,
    diff: unknown
  ): void {
    const auditId = randomUUID();
    const diffJson = diff ? JSON.stringify(diff) : "{}";
    db.prepare(`
      INSERT INTO trial_audit (
        id, trial_id, revision, action, actor_type, actor_id,
        actor_email, diff_json, reason, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      auditId,
      trial_id,
      revision,
      action,
      actor.actor_type,
      actor.actor_id,
      actor.actor_email || null,
      diffJson,
      actor.reason || null,
      actor.ip_address || null
    );
  }

  /**
   * 1. list: Query trials for Admin Studio & MCP with filtering, search, and pagination.
   */
  static list(query: TrialQueryOptions = {}): { trials: Trial[]; total: number } {
    const db = getDb();
    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    if (query.status && query.status !== "all") {
      conditions.push("status = ?");
      params.push(query.status);
    }

    if (query.search?.trim()) {
      conditions.push("(title LIKE ? OR slug LIKE ? OR sku LIKE ?)");
      const term = `%${query.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.join(" AND ");
    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM trials WHERE ${whereClause}`)
      .get(...params) as { count: number } | undefined;
    const total = totalRow?.count || 0;

    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const sortField =
      query.sort_by === "title"
        ? "title"
        : query.sort_by === "price_paise"
        ? "price_paise"
        : query.sort_by === "created_at"
        ? "created_at"
        : "updated_at";
    const sortDir = query.sort_dir === "asc" ? "ASC" : "DESC";

    const rows = db
      .prepare(
        `SELECT * FROM trials
         WHERE ${whereClause}
         ORDER BY ${sortField} ${sortDir}
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Trial[];

    return { trials: rows, total };
  }

  /**
   * 2. listPublic: Query published trials for Storefront catalog with whitelisted projection.
   */
  static listPublic(
    query: TrialPublicQueryOptions = {}
  ): { trials: TrialPublicDto[]; total: number } {
    const db = getDb();
    const conditions: string[] = ["status = 'published'"];
    const params: (string | number)[] = [];

    if (query.search?.trim()) {
      conditions.push("(title LIKE ? OR tagline LIKE ? OR description LIKE ?)");
      const term = `%${query.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.join(" AND ");
    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM trials WHERE ${whereClause}`)
      .get(...params) as { count: number } | undefined;
    const total = totalRow?.count || 0;

    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 50);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const sortField =
      query.sort_by === "title"
        ? "title"
        : query.sort_by === "price_paise"
        ? "price_paise"
        : "published_at";
    const sortDir = query.sort_dir === "asc" ? "ASC" : "DESC";

    const rows = db
      .prepare(
        `SELECT id FROM trials
         WHERE ${whereClause}
         ORDER BY ${sortField} ${sortDir}
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as { id: string }[];

    const dtos: TrialPublicDto[] = [];
    for (const r of rows) {
      const details = TrialService.getById(r.id);
      if (details && details.status === "published") {
        dtos.push(toPublicDto(details));
      }
    }

    return { trials: dtos, total };
  }

  /**
   * 3. getById: Retrieve full aggregate trial dossier by UUID.
   */
  static getById(id: string): TrialWithDetails | null {
    const db = getDb();
    const trial = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
    if (!trial) return null;

    // Components (sorted by slot_index)
    const rawComponents = db
      .prepare(
        `SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC`
      )
      .all(id) as TrialComponent[];

    const components: TrialComponent[] = rawComponents.map((c) => ({
      ...c,
      tasting_notes:
        typeof c.tasting_notes === "string"
          ? c.tasting_notes
          : JSON.stringify(c.tasting_notes || []),
    }));

    // Assets
    const assets = db
      .prepare(
        `SELECT * FROM trial_assets WHERE trial_id = ? ORDER BY sort_order ASC, created_at ASC`
      )
      .all(id) as TrialAsset[];

    // Hero image lookup if hero_image_id is present
    let hero_image: { url: string; alt_text: string } | null = null;
    if (trial.hero_image_id) {
      const media = db
        .prepare("SELECT url, alt_text FROM media_uploads WHERE id = ?")
        .get(trial.hero_image_id) as { url: string; alt_text?: string } | undefined;
      if (media) {
        hero_image = { url: media.url, alt_text: media.alt_text || trial.title };
      }
    }

    // Brew guides
    const rawGuides = db
      .prepare(`SELECT * FROM trial_brew_guides WHERE trial_id = ? ORDER BY sort_order ASC`)
      .all(id) as TrialBrewGuide[];

    const brew_guides: TrialBrewGuide[] = rawGuides.map((g) => ({
      ...g,
      steps_json: typeof g.steps_json === "string" ? g.steps_json : JSON.stringify(g.steps_json || []),
    }));

    // Sensory tests
    const sensory_tests = db
      .prepare(`SELECT * FROM trial_sensory_tests WHERE trial_id = ?`)
      .all(id) as TrialSensoryTest[];

    // Claims
    const claims = db
      .prepare(`SELECT * FROM trial_claims WHERE trial_id = ? ORDER BY sort_order ASC`)
      .all(id) as TrialClaim[];

    // Bulk links with joined catalog information
    const bulk_links = db
      .prepare(
        `SELECT b.*, p.slug as product_slug, v.sku as variant_title
         FROM trial_bulk_links b
         LEFT JOIN products p ON b.product_id = p.id
         LEFT JOIN variants v ON b.variant_id = v.id
         WHERE b.trial_id = ?
         ORDER BY b.sort_order ASC`
      )
      .all(id) as TrialBulkLink[];

    // Latest publication snapshot
    const latest_publication = (db
      .prepare(
        `SELECT * FROM trial_publications WHERE trial_id = ? ORDER BY revision DESC LIMIT 1`
      )
      .get(id) as TrialPublication | undefined) || null;

    return {
      ...trial,
      hero_image,
      components,
      assets,
      brew_guides,
      sensory_tests,
      claims,
      bulk_links,
      latest_publication,
    };
  }

  /**
   * 4. getBySlug: Retrieve full aggregate trial dossier by slug or UUID.
   */
  static getBySlug(slug: string): TrialWithDetails | null {
    const db = getDb();
    const row = db.prepare("SELECT id FROM trials WHERE slug = ? OR id = ?").get(slug, slug) as
      | { id: string }
      | undefined;
    if (!row) return null;
    return TrialService.getById(row.id);
  }

  /**
   * 5. getPublicBySlug: Retrieve published trial by slug or UUID projected for storefront.
   */
  static getPublicBySlug(slug: string): TrialPublicDto | null {
    const db = getDb();
    const row = db
      .prepare("SELECT id FROM trials WHERE (slug = ? OR id = ?) AND status = 'published'")
      .get(slug, slug) as { id: string } | undefined;
    if (!row) return null;
    const details = TrialService.getById(row.id);
    if (!details || details.status !== "published") return null;
    return toPublicDto(details);
  }

  /**
   * 6. createDraft: Create a new draft kit with initial 4x50g slots and revision=1.
   */
  static createDraft(input: CreateTrialInput, actor: AuditActor): Trial {
    const db = getDb();
    const id = randomUUID();
    const baseSlug = (
      input.slug ||
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    ).trim();
    const slug = baseSlug || `trial-${id.slice(0, 8)}`;
    const sku = (input.sku || `TRIAL-${slug.toUpperCase().slice(0, 20)}`).trim();
    const price_paise = input.price_paise !== undefined ? Number(input.price_paise) : 20000;

    // Check slug collision
    const existing = db.prepare("SELECT id FROM trials WHERE slug = ?").get(slug);
    if (existing) {
      throw new Error(`A trial with slug '${slug}' already exists.`);
    }

    return db.transaction(() => {
      db.prepare(`
        INSERT INTO trials (
          id, slug, title, tagline, description, status, pack_format, net_weight_g,
          price_paise, compare_at_price_paise, cost_paise, sku, inventory_quantity,
          inventory_policy, hero_image_id, meta_title, meta_description, revision,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'draft', '4x50g_sachets', 200,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(
        id,
        slug,
        input.title.trim(),
        input.tagline?.trim() || null,
        input.description?.trim() || null,
        price_paise,
        input.compare_at_price_paise ?? null,
        input.cost_paise ?? null,
        sku,
        input.inventory_quantity ?? 0,
        input.inventory_policy ?? "track",
        input.hero_image_id ?? null,
        input.meta_title?.trim() || null,
        input.meta_description?.trim() || null
      );

      // Components: use supplied 4 sachets or default placeholders
      const componentsToInsert =
        input.components && input.components.length === 4
          ? input.components
          : [
              { slot_index: 0, name: "Sample Pouch 1", estate: "Estate A", grade: "CTC BP", flush: "First Flush", weight_g: 50 },
              { slot_index: 1, name: "Sample Pouch 2", estate: "Estate B", grade: "CTC OF", flush: "Second Flush", weight_g: 50 },
              { slot_index: 2, name: "Sample Pouch 3", estate: "Estate C", grade: "CTC PD", flush: "Rain Flush", weight_g: 50 },
              { slot_index: 3, name: "Sample Pouch 4", estate: "Estate D", grade: "CTC BOP", flush: "Autumn Flush", weight_g: 50 },
            ];

      for (const comp of componentsToInsert) {
        db.prepare(`
          INSERT INTO trial_components (
            id, trial_id, slot_index, name, estate, grade, flush, elevation,
            weight_g, quantity, tasting_notes, brew_temp_c, brew_time_sec,
            leaf_dose_g, regular_product_id, regular_variant_id, sort_order,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 50, 1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          comp.id || randomUUID(),
          id,
          comp.slot_index,
          comp.name.trim(),
          (comp.estate || "").trim(),
          (comp.grade || "").trim(),
          (comp.flush || "").trim(),
          comp.elevation?.trim() || null,
          JSON.stringify(comp.tasting_notes || []),
          comp.brew_temp_c || 95,
          comp.brew_time_sec || 240,
          comp.leaf_dose_g || 2.5,
          comp.regular_product_id || null,
          comp.regular_variant_id || null,
          comp.sort_order || comp.slot_index
        );
      }

      TrialService.recordAudit(db, id, 1, "create_draft", actor, { input });

      return db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial;
    })();
  }

  /**
   * 7. update: Atomically update metadata using CAS optimistic revision control.
   */
  static update(
    id: string,
    expected_revision: number,
    input: UpdateTrialInput,
    actor: AuditActor
  ): Trial {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) {
        throw new TrialNotFoundError(id);
      }
      if (existing.status === "archived") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          existing.status,
          "Cannot update an archived trial."
        );
      }
      if (existing.revision !== expected_revision) {
        throw new TrialRevisionConflictError(existing.revision, expected_revision);
      }

      // Check slug collision if changing slug
      if (input.slug && input.slug !== existing.slug) {
        const slugExists = db
          .prepare("SELECT id FROM trials WHERE slug = ? AND id != ?")
          .get(input.slug, id);
        if (slugExists) {
          throw new Error(`Slug '${input.slug}' is already taken.`);
        }
      }

      const title = input.title !== undefined ? input.title.trim() : existing.title;
      const slug = input.slug !== undefined ? input.slug.trim() : existing.slug;
      const tagline = input.tagline !== undefined ? input.tagline?.trim() || null : existing.tagline;
      const description =
        input.description !== undefined ? input.description?.trim() || null : existing.description;
      const price_paise =
        input.price_paise !== undefined ? Number(input.price_paise) : existing.price_paise;
      const compare_at_price_paise =
        input.compare_at_price_paise !== undefined
          ? input.compare_at_price_paise
          : existing.compare_at_price_paise;
      const cost_paise =
        input.cost_paise !== undefined ? input.cost_paise : existing.cost_paise;
      const sku = input.sku !== undefined ? input.sku.trim() : existing.sku;
      const inventory_quantity =
        input.inventory_quantity !== undefined
          ? Number(input.inventory_quantity)
          : existing.inventory_quantity;
      const inventory_policy =
        input.inventory_policy !== undefined ? input.inventory_policy : existing.inventory_policy;
      const hero_image_id =
        input.hero_image_id !== undefined ? input.hero_image_id : existing.hero_image_id;
      const meta_title =
        input.meta_title !== undefined ? input.meta_title?.trim() || null : existing.meta_title;
      const meta_description =
        input.meta_description !== undefined
          ? input.meta_description?.trim() || null
          : existing.meta_description;

      // Atomic CAS update
      const result = db
        .prepare(
          `UPDATE trials
           SET title = ?, slug = ?, tagline = ?, description = ?,
               price_paise = ?, compare_at_price_paise = ?, cost_paise = ?,
               sku = ?, inventory_quantity = ?, inventory_policy = ?,
               hero_image_id = ?, meta_title = ?, meta_description = ?,
               revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(
          title,
          slug,
          tagline,
          description,
          price_paise,
          compare_at_price_paise,
          cost_paise,
          sku,
          inventory_quantity,
          inventory_policy,
          hero_image_id,
          meta_title,
          meta_description,
          id,
          expected_revision
        );

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, expected_revision);
      }

      const nextRev = expected_revision + 1;
      TrialService.recordAudit(db, id, nextRev, "update", actor, {
        patch: input,
      });

      return db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial;
    })();
  }

  /**
   * 8. replaceComponents: Enforce 4x50g=200g invariant, CAS revision increment, and atomic replace.
   */
  static replaceComponents(
    id: string,
    expected_revision: number,
    components: ComponentInput[],
    actor: AuditActor
  ): Trial {
    // Invariant check
    const invariant = validateComponentInvariant(components);
    if (!invariant.valid) {
      throw new TrialWeightInvariantError(
        invariant.totalWeight,
        invariant.count,
        invariant.errors.join("; ")
      );
    }

    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.status === "archived") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          existing.status,
          "Cannot replace components on an archived trial."
        );
      }
      if (existing.revision !== expected_revision) {
        throw new TrialRevisionConflictError(existing.revision, expected_revision);
      }

      // CAS increment on parent trial
      const casResult = db
        .prepare(
          `UPDATE trials SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, expected_revision);

      if (casResult.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, expected_revision);
      }

      // Delete existing components
      db.prepare("DELETE FROM trial_components WHERE trial_id = ?").run(id);

      // Insert 4 new components
      const insertStmt = db.prepare(`
        INSERT INTO trial_components (
          id, trial_id, slot_index, name, estate, grade, flush, elevation,
          weight_g, quantity, tasting_notes, brew_temp_c, brew_time_sec,
          leaf_dose_g, regular_product_id, regular_variant_id, sort_order,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 50, 1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      for (const comp of components) {
        insertStmt.run(
          comp.id || randomUUID(),
          id,
          comp.slot_index,
          comp.name.trim(),
          (comp.estate || "").trim(),
          (comp.grade || "").trim(),
          (comp.flush || "").trim(),
          comp.elevation?.trim() || null,
          JSON.stringify(comp.tasting_notes || []),
          Number(comp.brew_temp_c) || 95,
          Number(comp.brew_time_sec) || 240,
          Number(comp.leaf_dose_g) || 2.5,
          comp.regular_product_id || null,
          comp.regular_variant_id || null,
          comp.sort_order ?? comp.slot_index
        );
      }

      const nextRev = expected_revision + 1;
      TrialService.recordAudit(db, id, nextRev, "replace_components", actor, {
        components_count: components.length,
        components,
      });

      return db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial;
    })();
  }

  /**
   * 9. attachAsset: Attach stage photography with mandatory alt text and CAS revision increment.
   */
  static attachAsset(
    id: string,
    expected_revision: number,
    asset: AssetInput,
    actor: AuditActor
  ): Trial {
    if (!asset.asset_url || !asset.stage || !asset.alt_text?.trim()) {
      throw new Error("Asset requires asset_url, stage, and non-empty alt_text.");
    }

    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.status === "archived") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          existing.status,
          "Cannot attach assets to an archived trial."
        );
      }
      if (existing.revision !== expected_revision) {
        throw new TrialRevisionConflictError(existing.revision, expected_revision);
      }

      // CAS revision increment on parent trial
      const casResult = db
        .prepare(
          `UPDATE trials SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, expected_revision);

      if (casResult.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, expected_revision);
      }

      // Replace any existing asset for the same trial, slot, and stage to avoid duplicates
      if (asset.slot_index !== null && asset.slot_index !== undefined) {
        db.prepare(`
          DELETE FROM trial_assets
          WHERE trial_id = ? AND slot_index = ? AND stage = ?
        `).run(id, asset.slot_index, asset.stage);
      }

      const assetId = asset.id || randomUUID();
      db.prepare(`
        INSERT INTO trial_assets (
          id, trial_id, component_id, slot_index, media_id, asset_url,
          stage, alt_text, caption, rights_status, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        assetId,
        id,
        asset.component_id || null,
        asset.slot_index ?? null,
        asset.media_id || null,
        asset.asset_url.trim(),
        asset.stage,
        asset.alt_text.trim(),
        asset.caption?.trim() || null,
        asset.rights_status || "approved",
        asset.sort_order || 0
      );

      const nextRev = expected_revision + 1;
      TrialService.recordAudit(db, id, nextRev, "attach_asset", actor, {
        asset_id: assetId,
        stage: asset.stage,
        asset_url: asset.asset_url,
      });

      return (TrialService.getById(id) || db.prepare("SELECT * FROM trials WHERE id = ?").get(id)) as Trial;
    })();
  }

  /**
   * 10. validate: Evaluate launch blockers against publication gates.
   */
  static validate(id: string): PublicationValidationResult {
    const trial = TrialService.getById(id);
    if (!trial) throw new TrialNotFoundError(id);
    return validatePublication(trial);
  }

  /**
   * 11. submitReview: Guarded state transition draft -> in_review with CAS.
   */
  static submitReview(id: string, expected_revision: number, actor: AuditActor): Trial {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.revision !== expected_revision) {
        throw new TrialRevisionConflictError(existing.revision, expected_revision);
      }
      if (existing.status !== "draft") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          "in_review",
          `Cannot submit review from '${existing.status}'. Must be in 'draft'.`
        );
      }

      const result = db
        .prepare(
          `UPDATE trials
           SET status = 'in_review', revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, expected_revision);

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, expected_revision);
      }

      const nextRev = expected_revision + 1;
      TrialService.recordAudit(db, id, nextRev, "submit_review", actor, {
        from_status: "draft",
        to_status: "in_review",
      });

      return db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial;
    })();
  }

  /**
   * 12. publish: Gate validation, guarded state transition in_review -> published with snapshot.
   */
  static publish(id: string, expected_revision: number, actor: AuditActor): Trial {
    const db = getDb();

    // Verify publication gates
    const validation = TrialService.validate(id);
    if (!validation.can_publish) {
      throw new TrialPublishGateError(validation.blockers);
    }

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.revision !== expected_revision) {
        throw new TrialRevisionConflictError(existing.revision, expected_revision);
      }
      if (existing.status !== "in_review" && existing.status !== "draft") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          "published",
          `Cannot publish trial from '${existing.status}'. Must be in 'in_review' or 'draft'.`
        );
      }

      const result = db
        .prepare(
          `UPDATE trials
           SET status = 'published', published_at = CURRENT_TIMESTAMP,
               revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, expected_revision);

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, expected_revision);
      }

      const nextRev = expected_revision + 1;
      const fullSnapshot = TrialService.getById(id);
      const pubId = randomUUID();

      db.prepare(`
        INSERT INTO trial_publications (
          id, trial_id, revision, snapshot_json, published_by, published_at, is_active
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
      `).run(pubId, id, nextRev, JSON.stringify(fullSnapshot), actor.actor_id);

      TrialService.recordAudit(db, id, nextRev, "publish", actor, {
        publication_id: pubId,
        published_revision: nextRev,
      });

      return db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial;
    })();
  }

  /**
   * 13. unpublish: Guarded state transition published -> draft with CAS.
   */
  static unpublish(id: string, expected_revision: number, actor: AuditActor): Trial {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.revision !== expected_revision) {
        throw new TrialRevisionConflictError(existing.revision, expected_revision);
      }
      if (existing.status !== "published") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          "draft",
          `Cannot unpublish trial from status '${existing.status}'. Must be 'published'.`
        );
      }

      const result = db
        .prepare(
          `UPDATE trials
           SET status = 'draft', revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, expected_revision);

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, expected_revision);
      }

      // Mark publication snapshots inactive
      db.prepare("UPDATE trial_publications SET is_active = 0 WHERE trial_id = ?").run(id);

      const nextRev = expected_revision + 1;
      TrialService.recordAudit(db, id, nextRev, "unpublish", actor, {
        from_status: "published",
        to_status: "draft",
      });

      return db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial;
    })();
  }

  /**
   * 14. archive: Guarded state transition -> archived with CAS.
   */
  static archive(id: string, expected_revision: number, actor: AuditActor): Trial {
    const db = getDb();

    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.revision !== expected_revision) {
        throw new TrialRevisionConflictError(existing.revision, expected_revision);
      }
      if (existing.status === "archived") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          "archived",
          "Trial is already archived."
        );
      }

      const result = db
        .prepare(
          `UPDATE trials
           SET status = 'archived', archived_at = CURRENT_TIMESTAMP,
               revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, expected_revision);

      if (result.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, expected_revision);
      }

      const nextRev = expected_revision + 1;
      TrialService.recordAudit(db, id, nextRev, "archive", actor, {
        from_status: existing.status,
        to_status: "archived",
      });

      return db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial;
    })();
  }

  /**
   * 15. getHistory: Retrieve chronological audit entries and parsed diffs.
   */
  static getHistory(
    id: string
  ): (TrialAuditEntry & { actor?: { type: string; id: string; email: string | null } })[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, trial_id, revision, action, actor_type, actor_id, actor_email,
                diff_json, reason, ip_address, created_at
         FROM trial_audit
         WHERE trial_id = ?
         ORDER BY revision DESC, created_at DESC`
      )
      .all(id) as TrialAuditEntry[];

    return rows.map((r) => {
      const rawDate = r.created_at;
      const isoDate = rawDate
        ? (rawDate.includes("T") ? rawDate : new Date(rawDate.replace(" ", "T") + "Z").toISOString())
        : new Date().toISOString();
      return {
        ...r,
        created_at: isoDate,
        diff: r.diff_json ? JSON.parse(r.diff_json) : null,
        actor: {
          type: r.actor_type,
          id: r.actor_id,
          email: r.actor_email || null,
        },
      };
    });
  }

  /**
   * 16. delete: Delete a trial draft/in_review/archived kit. Rejects deletion if published.
   */
  static delete(id: string, actor?: AuditActor): boolean {
    const db = getDb();
    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.status === "published") {
        throw new Error("Cannot delete a published trial. Must unpublish or archive first.");
      }

      db.prepare("DELETE FROM trials WHERE id = ?").run(id);
      return true;
    })();
  }

  /**
   * 17. detachAsset: Detach a media asset from a trial with CAS revision control.
   */
  static detachAsset(
    id: string,
    expected_revision: number | undefined,
    asset_id: string,
    actor: AuditActor
  ): Trial {
    const db = getDb();
    return db.transaction(() => {
      const existing = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Trial | undefined;
      if (!existing) throw new TrialNotFoundError(id);
      if (existing.status === "archived") {
        throw new TrialInvalidStateTransitionError(
          existing.status,
          existing.status,
          "Cannot detach assets from an archived trial."
        );
      }

      const rev = expected_revision !== undefined ? expected_revision : existing.revision;
      if (existing.revision !== rev) {
        throw new TrialRevisionConflictError(existing.revision, rev);
      }

      const casResult = db
        .prepare(
          `UPDATE trials SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND revision = ?`
        )
        .run(id, rev);

      if (casResult.changes === 0) {
        const recheck = db.prepare("SELECT revision FROM trials WHERE id = ?").get(id) as
          | { revision: number }
          | undefined;
        if (!recheck) throw new TrialNotFoundError(id);
        throw new TrialRevisionConflictError(recheck.revision, rev);
      }

      db.prepare("DELETE FROM trial_assets WHERE id = ? AND trial_id = ?").run(asset_id, id);

      const nextRev = rev + 1;
      TrialService.recordAudit(db, id, nextRev, "detach_asset", actor, {
        asset_id,
      });

      return (TrialService.getById(id) || db.prepare("SELECT * FROM trials WHERE id = ?").get(id)) as Trial;
    })();
  }

  /**
   * Public DTO Projection Converter
   */
  static toPublicDto(details: TrialWithDetails, options?: PublicDtoOptions): TrialPublicDto {
    return toPublicDto(details, options);
  }
}
