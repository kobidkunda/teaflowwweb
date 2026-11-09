import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import {
  dispatchToolCall,
  listToolDefinitions,
  listTools,
  McpError,
} from "../../src/lib/mcp";
import { TrialService } from "../../src/lib/trials/service";
import {
  TrialRevisionConflictError,
  type AuditActor,
  type Trial,
  type TrialWithDetails,
} from "../../src/lib/trials/types";
import { getDb } from "../../src/lib/db";

const TEST_DB = path.join(tmpdir(), `trials-mcp-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

function call<T = any>(name: string, args: unknown): T {
  return dispatchToolCall(name, args) as T;
}

function failsWith(name: string, args: unknown): McpError {
  try {
    dispatchToolCall(name, args);
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return error as McpError;
  }
  throw new Error(`expected tool "${name}" to fail with McpError`);
}

const CANONICAL_TRIAL_TOOLS = [
  "trial_list",
  "trial_get",
  "trial_create",
  "trial_update",
  "trial_components_replace",
  "trial_media_attach",
  "trial_validate",
  "trial_submit_review",
  "trial_publish",
  "trial_unpublish",
  "trial_archive",
  "trial_history",
] as const;

const DOT_TRIAL_TOOLS = [
  "trial.list",
  "trial.get",
  "trial.create",
  "trial.update",
  "trial.components_replace",
  "trial.media_attach",
  "trial.validate",
  "trial.submit_review",
  "trial.publish",
  "trial.unpublish",
  "trial.archive",
  "trial.history",
] as const;

const SAMPLE_COMPONENTS = [
  {
    slot_index: 0,
    name: "Makaibari FTGFOP1 Organic",
    estate: "Makaibari Estate",
    grade: "FTGFOP1",
    flush: "First Flush 2026",
    elevation: "1500m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Wild Orchid", "Muscatel", "Dew Grass"],
    brew_temp_c: 85,
    brew_time_sec: 180,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 1,
    name: "Gopaldhara Wonder Muscatel",
    estate: "Gopaldhara Estate",
    grade: "FTGFOP1 Special",
    flush: "Second Flush 2026",
    elevation: "1800m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Ripe Peach", "Honey", "Muscat Grape"],
    brew_temp_c: 90,
    brew_time_sec: 210,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 2,
    name: "Castleton Moonlight White",
    estate: "Castleton Estate",
    grade: "Silver Needles",
    flush: "Spring Clonal",
    elevation: "1600m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Silver Hay", "White Lily", "Apricot"],
    brew_temp_c: 80,
    brew_time_sec: 240,
    leaf_dose_g: 3.0,
  },
  {
    slot_index: 3,
    name: "Rohini Clonal Autumn Reserve",
    estate: "Rohini Estate",
    grade: "TGFOP",
    flush: "Autumn Flush",
    elevation: "1400m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Amber Woods", "Caramel", "Roasted Cocoa"],
    brew_temp_c: 95,
    brew_time_sec: 240,
    leaf_dose_g: 2.5,
  },
];

describe("TeaFloww Trials v3 — MCP Tool Parity & Concurrency Specification", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
  });

  afterAll(() => {
    try {
      getDb().close();
    } catch {}
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try {
        rmSync(TEST_DB + suffix, { force: true });
      } catch {}
    }
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM trials WHERE slug LIKE 'test-mcp-%'").run();
  });

  // ---------------------------------------------------------------------------
  // Suite 1: Tool Registration & Schema Compliance
  // ---------------------------------------------------------------------------
  describe("Suite 1: Tool Registration & Schema Compliance", () => {
    it("1.1: listTools() and listToolDefinitions() export all 12 canonical tools under snake_case", () => {
      expect(listTools).toBe(listToolDefinitions);
      const tools = listTools();
      const names = tools.map((t) => t.name);

      for (const canonical of CANONICAL_TRIAL_TOOLS) {
        expect(names).toContain(canonical);
      }
    });

    it("1.2: dispatches dot notation and alias variants for all 12 trial tools", () => {
      // trial.list executes with defaults
      const listRes = call<{ trials: Trial[]; total: number }>("trial.list", {});
      expect(listRes.trials).toBeDefined();

      // The remaining 11 tools require arguments and thus fail with parameter errors (-32602 / -32004)
      const requiringArgs = DOT_TRIAL_TOOLS.filter((t) => t !== "trial.list");
      for (const dotTool of requiringArgs) {
        const error = failsWith(dotTool, {});
        expect([-32602, -32004]).toContain(error.code);
      }
    });

    it("1.3: enforces valid JSON schema structure on all 12 tools", () => {
      const tools = listTools();
      const trialDefs = tools.filter((t) =>
        CANONICAL_TRIAL_TOOLS.includes(t.name as (typeof CANONICAL_TRIAL_TOOLS)[number])
      );

      expect(trialDefs).toHaveLength(12);

      for (const def of trialDefs) {
        expect(def.inputSchema).toBeDefined();
        expect(def.inputSchema.type).toBe("object");
        expect(typeof def.description).toBe("string");
        expect(def.description.length).toBeGreaterThan(10);
      }

      // Check specific tool schemas
      const createDef = trialDefs.find((t) => t.name === "trial_create")!;
      expect(createDef.inputSchema.required).toContain("title");

      const updateDef = trialDefs.find((t) => t.name === "trial_update")!;
      expect(updateDef.inputSchema.required).toContain("id");
      expect(updateDef.inputSchema.required).toContain("expected_revision");

      const replaceDef = trialDefs.find((t) => t.name === "trial_components_replace")!;
      expect(replaceDef.inputSchema.required).toContain("components");

      const mediaDef = trialDefs.find((t) => t.name === "trial_media_attach")!;
      expect(mediaDef.inputSchema.required).toContain("stage");
      expect(mediaDef.inputSchema.required).toContain("alt_text");

      const validateDef = trialDefs.find((t) => t.name === "trial_validate")!;
      expect(validateDef.inputSchema.required).toContain("id");

      const historyDef = trialDefs.find((t) => t.name === "trial_history")!;
      expect(historyDef.inputSchema.required).toContain("id");
    });

    it("1.4: defines annotations with read-only vs mutating hints", () => {
      const tools = listTools();
      const trialDefs = tools.filter((t) =>
        CANONICAL_TRIAL_TOOLS.includes(t.name as (typeof CANONICAL_TRIAL_TOOLS)[number])
      );

      for (const def of trialDefs) {
        expect(def.annotations).toBeDefined();
        expect(typeof def.annotations?.title).toBe("string");
        expect(def.annotations?.destructiveHint).toBe(false);

        const isQuery = ["trial_list", "trial_get", "trial_validate", "trial_history"].includes(def.name);
        expect(def.annotations?.readOnlyHint).toBe(isQuery);
        if (isQuery) {
          expect(def.annotations?.idempotentHint).toBe(true);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 2: Tool Naming Equivalence (snake_case vs dot notation)
  // ---------------------------------------------------------------------------
  describe("Suite 2: Tool Naming Equivalence", () => {
    it("2.1: trial_list and trial.list execute identically", () => {
      const resSnake = call<{ trials: Trial[]; total: number }>("trial_list", { status: "all" });
      const resDot = call<{ trials: Trial[]; total: number }>("trial.list", { status: "all" });
      const resPlural = call<{ trials: Trial[]; total: number }>("trials.list", { status: "all" });

      expect(resSnake.total).toBe(resDot.total);
      expect(resSnake.total).toBe(resPlural.total);
      expect(resSnake.trials.length).toBe(resDot.trials.length);
    });

    it("2.2: trial_create and trial.create both create draft trials", () => {
      const draft1 = call<Trial>("trial_create", {
        title: "Kit via Snake Case",
        slug: "test-mcp-equiv-snake",
        price_paise: 24900,
      });
      const draft2 = call<Trial>("trial.create", {
        title: "Kit via Dot Notation",
        slug: "test-mcp-equiv-dot",
        price_paise: 24900,
      });

      expect(draft1.id).toBeDefined();
      expect(draft2.id).toBeDefined();
      expect(draft1.status).toBe("draft");
      expect(draft2.status).toBe("draft");
      expect(draft1.revision).toBe(1);
      expect(draft2.revision).toBe(1);
    });

    it("2.3: trial_get and trial.get retrieve identical dossiers", () => {
      const created = call<Trial>("trial_create", {
        title: "Get Equivalence Test Kit",
        slug: "test-mcp-equiv-get",
        price_paise: 29900,
      });

      const getSnake = call<TrialWithDetails>("trial_get", { id: created.id });
      const getDot = call<TrialWithDetails>("trial.get", { id: created.id });

      expect(getSnake.id).toBe(created.id);
      expect(getDot.id).toBe(created.id);
      expect(getSnake.slug).toBe(getDot.slug);
      expect(getSnake.components.length).toBe(getDot.components.length);
    });

    it("2.4: trial_update and trial.update both mutate metadata with CAS", () => {
      const created = call<Trial>("trial_create", {
        title: "Update Equivalence Test Kit",
        slug: "test-mcp-equiv-update",
        price_paise: 20000,
      });

      const updated1 = call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Updated by Snake Case",
      });
      expect(updated1.revision).toBe(2);
      expect(updated1.title).toBe("Updated by Snake Case");

      const updated2 = call<Trial>("trial.update", {
        id: created.id,
        expected_revision: 2,
        title: "Updated by Dot Notation",
      });
      expect(updated2.revision).toBe(3);
      expect(updated2.title).toBe("Updated by Dot Notation");
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 3: Core Tool Operations & Audit Attribution
  // ---------------------------------------------------------------------------
  describe("Suite 3: Core Tool Operations & Audit Attribution", () => {
    it("3.1: trial_create initializes draft, seeds 4x50g sachets, and records actor_type: 'mcp'", () => {
      const created = call<Trial>("trial_create", {
        title: "Spring First Flush Discovery Box",
        slug: "test-mcp-sff-01",
        price_paise: 29900,
        sku: "TF-TRIAL-SFF01",
      });

      expect(created.id).toBeDefined();
      expect(created.slug).toBe("test-mcp-sff-01");
      expect(created.status).toBe("draft");
      expect(created.revision).toBe(1);
      expect(created.pack_format).toBe("4x50g_sachets");
      expect(created.net_weight_g).toBe(200);

      // Verify DB direct inspection: components auto-seeded
      const db = getDb();
      const components = db
        .prepare("SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC")
        .all(created.id) as any[];

      expect(components).toHaveLength(4);
      expect(components.reduce((sum, c) => sum + c.weight_g * c.quantity, 0)).toBe(200);

      // Verify audit log has actor_type: "mcp"
      const audit = db
        .prepare("SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 1")
        .get(created.id) as any;

      expect(audit).toBeDefined();
      expect(audit.action).toBe("create_draft");
      expect(audit.actor_type).toBe("mcp");
      expect(audit.actor_id).toBe("mcp-agent");
    });

    it("3.2: trial_list filters by status, search, and supports pagination", () => {
      call<Trial>("trial_create", {
        title: "Darjeeling Mountain Kit",
        slug: "test-mcp-list-dj",
        price_paise: 22000,
      });
      call<Trial>("trial_create", {
        title: "Assam Valley Malt Kit",
        slug: "test-mcp-list-assam",
        price_paise: 18000,
      });

      const all = call<{ trials: Trial[]; total: number }>("trial_list", { status: "all" });
      expect(all.total).toBeGreaterThanOrEqual(2);

      const drafts = call<{ trials: Trial[]; total: number }>("trial_list", { status: "draft" });
      expect(drafts.trials.every((t) => t.status === "draft")).toBe(true);

      const search = call<{ trials: Trial[]; total: number }>("trial_list", { search: "Darjeeling Mountain" });
      expect(search.trials.some((t) => t.slug === "test-mcp-list-dj")).toBe(true);
      expect(search.trials.every((t) => !t.title.includes("Assam"))).toBe(true);

      const paged = call<{ trials: Trial[]; total: number }>("trial_list", { limit: 1, offset: 0 });
      expect(paged.trials).toHaveLength(1);
    });

    it("3.3: trial_get retrieves full dossier and throws -32004 on missing record", () => {
      const created = call<Trial>("trial_create", {
        title: "Get Dossier Test Kit",
        slug: "test-mcp-get-dossier",
        price_paise: 25000,
      });

      const byId = call<TrialWithDetails>("trial_get", { id: created.id });
      expect(byId.id).toBe(created.id);
      expect(byId.components).toHaveLength(4);

      const bySlug = call<TrialWithDetails>("trial_get", { slug: created.slug });
      expect(bySlug.id).toBe(created.id);

      const err = failsWith("trial_get", { id: "00000000-0000-0000-0000-000000000000" });
      expect(err.code).toBe(-32004);
      expect(err.message).toMatch(/not found/i);
    });

    it("3.4: trial_update increments revision and records audit attribution", () => {
      const created = call<Trial>("trial_create", {
        title: "Pre-Update Title",
        slug: "test-mcp-update-audit",
        price_paise: 19900,
      });

      const updated = call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Post-Update Title via MCP",
        price_paise: 24900,
        reason: "Spring seasonal repricing",
      });

      expect(updated.revision).toBe(2);
      expect(updated.title).toBe("Post-Update Title via MCP");
      expect(updated.price_paise).toBe(24900);

      const db = getDb();
      const audit = db
        .prepare("SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 2")
        .get(created.id) as any;

      expect(audit).toBeDefined();
      expect(audit.action).toBe("update");
      expect(audit.actor_type).toBe("mcp");
      expect(audit.actor_id).toBe("mcp-agent");
    });

    it("3.5: trial_components_replace updates 4 sachets, validates invariant, increments revision", () => {
      const created = call<Trial>("trial_create", {
        title: "Component Replace Test Kit",
        slug: "test-mcp-comp-replace",
        price_paise: 35000,
      });

      const replaced = call<Trial>("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: SAMPLE_COMPONENTS,
      });

      expect(replaced.revision).toBe(2);

      const dossier = call<TrialWithDetails>("trial_get", { id: created.id });
      expect(dossier.components).toHaveLength(4);
      expect(dossier.components[0].name).toBe("Makaibari FTGFOP1 Organic");
      expect(dossier.components[0].estate).toBe("Makaibari Estate");

      const db = getDb();
      const audit = db
        .prepare("SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 2")
        .get(created.id) as any;
      expect(audit.action).toBe("replace_components");
      expect(audit.actor_type).toBe("mcp");
    });

    it("3.6: trial_media_attach attaches stage photography with alt text and increments revision", () => {
      const created = call<Trial>("trial_create", {
        title: "Media Attach Test Kit",
        slug: "test-mcp-media-attach",
        price_paise: 30000,
      });

      const attached = call<Trial>("trial_media_attach", {
        id: created.id,
        expected_revision: 1,
        stage: "packaging",
        asset_url: "/images/trials/mcp-packaging.webp",
        alt_text: "Exterior presentation packaging for Four-Tea Discovery Kit",
      });

      expect(attached.revision).toBe(2);

      const dossier = call<TrialWithDetails>("trial_get", { id: created.id });
      expect(dossier.assets).toHaveLength(1);
      expect(dossier.assets[0].stage).toBe("packaging");
      expect(dossier.assets[0].alt_text).toBe("Exterior presentation packaging for Four-Tea Discovery Kit");

      const db = getDb();
      const audit = db
        .prepare("SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 2")
        .get(created.id) as any;
      expect(audit.action).toBe("attach_asset");
      expect(audit.actor_type).toBe("mcp");
    });

    it("3.7: trial_validate returns blockers for incomplete draft and clears on completion", () => {
      const created = call<Trial>("trial_create", {
        title: "Validation Test Kit",
        slug: "test-mcp-validate",
        price_paise: 0, // Invalid: price must be > 0
      });

      const validationIncomplete = call<{ can_publish: boolean; blockers: string[] }>("trial_validate", {
        id: created.id,
      });
      expect(validationIncomplete.can_publish).toBe(false);
      expect(validationIncomplete.blockers.length).toBeGreaterThan(0);
    });

    it("3.8: trial_history retrieves chronological immutable audit trail", () => {
      const created = call<Trial>("trial_create", {
        title: "History Test Kit",
        slug: "test-mcp-history",
        price_paise: 20000,
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "History Test Kit Rev 2",
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 2,
        title: "History Test Kit Rev 3",
      });

      const history = call<{ history: any[]; total: number }>("trial_history", { id: created.id });
      expect(history.total).toBe(3);
      expect(history.history[0].revision).toBe(3);
      expect(history.history[1].revision).toBe(2);
      expect(history.history[2].revision).toBe(1);
      expect(history.history.every((h) => h.actor_type === "mcp")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 4: Lifecycle State Machine via MCP
  // ---------------------------------------------------------------------------
  describe("Suite 4: Lifecycle State Machine via MCP", () => {
    function setupPublishableTrial(slug: string) {
      const created = call<Trial>("trial_create", {
        title: "Full Lifecycle Discovery Kit",
        slug,
        price_paise: 24900,
        tagline: "Finest organic flushes",
        description: "A rich authentic tasting flight of four Himalayan tea estates.",
        meta_title: "Full Lifecycle Discovery Kit",
        meta_description: "A rich authentic tasting flight of four Himalayan tea estates.",
      });
      // Replace components with provenance
      call<Trial>("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: SAMPLE_COMPONENTS,
      });
      // Attach packaging photograph
      call<Trial>("trial_media_attach", {
        id: created.id,
        expected_revision: 2,
        stage: "packaging",
        asset_url: "/images/trials/packaging-dossier.webp",
        alt_text: "Front view of TeaFloww recyclable discovery box",
      });
      return call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 3,
        inventory_quantity: 50,
      });
    }

    it("4.1: trial_submit_review transitions draft -> in_review under CAS", () => {
      const trial = setupPublishableTrial("test-mcp-lifecycle-review");
      expect(trial.status).toBe("draft");
      expect(trial.revision).toBe(4);

      const reviewed = call<Trial>("trial_submit_review", {
        id: trial.id,
        expected_revision: 4,
      });

      expect(reviewed.status).toBe("in_review");
      expect(reviewed.revision).toBe(5);

      const db = getDb();
      const audit = db
        .prepare("SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 5")
        .get(trial.id) as any;
      expect(audit.action).toBe("submit_review");
      expect(audit.actor_type).toBe("mcp");
    });

    it("4.2: trial_publish passes publication blockers, publishes trial, and creates snapshot", () => {
      const trial = setupPublishableTrial("test-mcp-lifecycle-publish");
      const reviewed = call<Trial>("trial_submit_review", {
        id: trial.id,
        expected_revision: 4,
      });

      const published = call<Trial>("trial_publish", {
        id: reviewed.id,
        expected_revision: 5,
      });

      expect(published.status).toBe("published");
      expect(published.published_at).toBeDefined();
      expect(published.revision).toBe(6);

      const db = getDb();
      const pubSnapshot = db
        .prepare("SELECT * FROM trial_publications WHERE trial_id = ? AND is_active = 1")
        .get(trial.id) as any;
      expect(pubSnapshot).toBeDefined();
      expect(pubSnapshot.revision).toBe(6);
    });

    it("4.3: trial_unpublish reverts published trial back to draft", () => {
      const trial = setupPublishableTrial("test-mcp-lifecycle-unpub");
      call<Trial>("trial_submit_review", { id: trial.id, expected_revision: 4 });
      const published = call<Trial>("trial_publish", { id: trial.id, expected_revision: 5 });

      const unpublished = call<Trial>("trial_unpublish", {
        id: published.id,
        expected_revision: 6,
      });

      expect(unpublished.status).toBe("draft");
      expect(unpublished.revision).toBe(7);

      const db = getDb();
      const pubSnapshots = db
        .prepare("SELECT * FROM trial_publications WHERE trial_id = ? AND is_active = 1")
        .all(trial.id);
      expect(pubSnapshots).toHaveLength(0);
    });

    it("4.4: trial_archive marks trial as archived with archived_at timestamp", () => {
      const trial = setupPublishableTrial("test-mcp-lifecycle-archive");

      const archived = call<Trial>("trial_archive", {
        id: trial.id,
        expected_revision: 4,
      });

      expect(archived.status).toBe("archived");
      expect(archived.archived_at).toBeDefined();
      expect(archived.revision).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 5: CAS Optimistic Concurrency & Error Code -32009
  // ---------------------------------------------------------------------------
  describe("Suite 5: CAS Optimistic Concurrency & Error Code -32009", () => {
    it("5.1: trial_update with stale revision throws -32009 without modifying state", () => {
      const created = call<Trial>("trial_create", {
        title: "CAS Update Concurrency",
        slug: "test-mcp-cas-update",
        price_paise: 20000,
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Revision 2 Update",
      });

      // Attempt update with stale revision 1 (now at 2)
      const err = failsWith("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Illegal Stale Overwrite",
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/conflict|revision mismatch/i);

      // Verify state was not modified
      const current = call<TrialWithDetails>("trial_get", { id: created.id });
      expect(current.revision).toBe(2);
      expect(current.title).toBe("Revision 2 Update");
    });

    it("5.2: trial_components_replace with stale revision throws -32009", () => {
      const created = call<Trial>("trial_create", {
        title: "CAS Components Concurrency",
        slug: "test-mcp-cas-comp",
        price_paise: 20000,
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Revision 2 Update",
      });

      const err = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1, // Stale!
        components: SAMPLE_COMPONENTS,
      });

      expect(err.code).toBe(-32009);
    });

    it("5.3: trial_media_attach with stale revision throws -32009", () => {
      const created = call<Trial>("trial_create", {
        title: "CAS Media Concurrency",
        slug: "test-mcp-cas-media",
        price_paise: 20000,
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Advance to rev 2",
      });

      const err = failsWith("trial_media_attach", {
        id: created.id,
        expected_revision: 1, // Stale!
        stage: "packaging",
        asset_url: "/test.jpg",
        alt_text: "Packaging photo",
      });

      expect(err.code).toBe(-32009);
    });

    it("5.4: trial_submit_review with stale revision throws -32009", () => {
      const created = call<Trial>("trial_create", {
        title: "CAS Submit Review Concurrency",
        slug: "test-mcp-cas-submit",
        price_paise: 20000,
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Advance to rev 2",
      });

      const err = failsWith("trial_submit_review", {
        id: created.id,
        expected_revision: 1, // Stale!
      });

      expect(err.code).toBe(-32009);
    });

    it("5.5: trial_publish with stale revision throws -32009", () => {
      const created = call<Trial>("trial_create", {
        title: "CAS Publish Concurrency",
        slug: "test-mcp-cas-publish",
        price_paise: 20000,
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Advance to rev 2",
      });

      const err = failsWith("trial_publish", {
        id: created.id,
        expected_revision: 1, // Stale!
      });

      expect(err.code).toBe(-32009);
    });

    it("5.6: trial_unpublish with stale revision throws -32009", () => {
      const err = failsWith("trial_unpublish", {
        id: "no-matter",
        expected_revision: 0,
      });
      expect([-32009, -32004]).toContain(err.code);
    });

    it("5.7: trial_archive with stale revision throws -32009", () => {
      const created = call<Trial>("trial_create", {
        title: "CAS Archive Concurrency",
        slug: "test-mcp-cas-archive",
        price_paise: 20000,
      });

      call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Advance to rev 2",
      });

      const err = failsWith("trial_archive", {
        id: created.id,
        expected_revision: 1, // Stale!
      });

      expect(err.code).toBe(-32009);
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 6: Cross-Channel Concurrency Parity (MCP ↔ Admin Service)
  // ---------------------------------------------------------------------------
  describe("Suite 6: Cross-Channel Concurrency Parity", () => {
    const adminActor: AuditActor = {
      actor_type: "admin",
      actor_id: "admin-session-123",
      actor_email: "admin@teafloww.com",
    };

    it("6.1: MCP create -> Admin service update -> stale MCP update trapped with -32009", () => {
      // 1. Create trial via MCP (Revision 1, actor_type: mcp)
      const mcpTrial = call<Trial>("trial_create", {
        title: "Cross Channel Parity Kit",
        slug: "test-mcp-cross-ch-1",
        price_paise: 22000,
      });
      expect(mcpTrial.revision).toBe(1);

      // 2. Admin service updates trial directly (Revision 2, actor_type: admin)
      const adminUpdated = TrialService.update(
        mcpTrial.id,
        1,
        { title: "Updated by Admin Studio" },
        adminActor
      );
      expect(adminUpdated.revision).toBe(2);

      // 3. Stale MCP update using expected_revision: 1 is TRAPPED with -32009
      const staleMcpErr = failsWith("trial_update", {
        id: mcpTrial.id,
        expected_revision: 1,
        title: "Stale MCP Overwrite Attempt",
      });
      expect(staleMcpErr.code).toBe(-32009);

      // 4. MCP inspects current dossier, observes revision 2
      const freshMcp = call<TrialWithDetails>("trial_get", { id: mcpTrial.id });
      expect(freshMcp.revision).toBe(2);
      expect(freshMcp.title).toBe("Updated by Admin Studio");

      // 5. MCP updates with matching expected_revision: 2 -> succeeds, increments to 3
      const mcpFixed = call<Trial>("trial_update", {
        id: mcpTrial.id,
        expected_revision: 2,
        title: "Resolved MCP Update",
      });
      expect(mcpFixed.revision).toBe(3);

      // 6. Audit history verifies interleaved actor types
      const history = call<{ history: any[] }>("trial_history", { id: mcpTrial.id }).history;
      expect(history[0].actor_type).toBe("mcp"); // rev 3
      expect(history[1].actor_type).toBe("admin"); // rev 2
      expect(history[2].actor_type).toBe("mcp"); // rev 1
    });

    it("6.2: Admin create -> MCP update -> stale Admin update trapped with 409", () => {
      // 1. Admin creates draft trial (Revision 1, actor_type: admin)
      const adminCreated = TrialService.createDraft(
        {
          title: "Admin Origin Discovery Kit",
          slug: "test-mcp-cross-ch-2",
          price_paise: 28000,
        },
        adminActor
      );
      expect(adminCreated.revision).toBe(1);

      // 2. MCP updates trial (Revision 2, actor_type: mcp)
      const mcpUpdated = call<Trial>("trial_update", {
        id: adminCreated.id,
        expected_revision: 1,
        title: "Mutated via MCP Programmatic Agent",
      });
      expect(mcpUpdated.revision).toBe(2);

      // 3. Stale Admin update using expected_revision: 1 throws TrialRevisionConflictError (HTTP 409)
      expect(() =>
        TrialService.update(
          adminCreated.id,
          1, // Stale!
          { title: "Admin Stale Overwrite" },
          adminActor
        )
      ).toThrow(TrialRevisionConflictError);

      // 4. Audit trail shows interleaved actors
      const history = call<{ history: any[] }>("trial_history", { id: adminCreated.id }).history;
      expect(history[0].actor_type).toBe("mcp");
      expect(history[1].actor_type).toBe("admin");
    });

    it("6.3: Cross-channel component replacement collision is trapped with -32009", () => {
      const trial = call<Trial>("trial_create", {
        title: "Component Collision Kit",
        slug: "test-mcp-cross-comp",
        price_paise: 24000,
      });

      // Admin updates components directly -> rev 2
      TrialService.replaceComponents(trial.id, 1, SAMPLE_COMPONENTS, adminActor);

      // MCP client with stale revision 1 is rejected
      const staleCompErr = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 1,
        components: SAMPLE_COMPONENTS,
      });
      expect(staleCompErr.code).toBe(-32009);
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 7: Invariant Violations & Blocker Gates
  // ---------------------------------------------------------------------------
  describe("Suite 7: Invariant Violations & Blocker Gates", () => {
    it("7.1: sachet count != 4 is rejected with -32602", () => {
      const trial = call<Trial>("trial_create", {
        title: "Invalid Sachet Count Kit",
        slug: "test-mcp-inv-count",
        price_paise: 20000,
      });

      // 3 sachets
      const err3 = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 1,
        components: SAMPLE_COMPONENTS.slice(0, 3),
      });
      expect(err3.code).toBe(-32602);

      // 5 sachets
      const err5 = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 1,
        components: [...SAMPLE_COMPONENTS, { ...SAMPLE_COMPONENTS[0], slot_index: 4 }],
      });
      expect(err5.code).toBe(-32602);
    });

    it("7.2: sachet weight != 50g / kit net weight != 200g is rejected with -32602", () => {
      const trial = call<Trial>("trial_create", {
        title: "Invalid Weight Kit",
        slug: "test-mcp-inv-weight",
        price_paise: 20000,
      });

      // Total 160g (4x40g)
      const err160 = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 1,
        components: SAMPLE_COMPONENTS.map((c) => ({ ...c, weight_g: 40 })),
      });
      expect(err160.code).toBe(-32602);

      // Total 200g but non-standard distribution [60g, 40g, 50g, 50g]
      const invalidDist = [
        { ...SAMPLE_COMPONENTS[0], weight_g: 60 },
        { ...SAMPLE_COMPONENTS[1], weight_g: 40 },
        SAMPLE_COMPONENTS[2],
        SAMPLE_COMPONENTS[3],
      ];
      const errDist = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 1,
        components: invalidDist,
      });
      expect(errDist.code).toBe(-32602);
    });

    it("7.3: duplicate slot_index is rejected with -32602", () => {
      const trial = call<Trial>("trial_create", {
        title: "Duplicate Slot Kit",
        slug: "test-mcp-inv-slot",
        price_paise: 20000,
      });

      const dupSlots = [
        { ...SAMPLE_COMPONENTS[0], slot_index: 0 },
        { ...SAMPLE_COMPONENTS[1], slot_index: 0 }, // Duplicate slot 0!
        { ...SAMPLE_COMPONENTS[2], slot_index: 2 },
        { ...SAMPLE_COMPONENTS[3], slot_index: 3 },
      ];
      const err = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 1,
        components: dupSlots,
      });
      expect(err.code).toBe(-32602);
    });

    it("7.4: missing alt text on media attach is rejected with -32602", () => {
      const trial = call<Trial>("trial_create", {
        title: "Missing Alt Text Kit",
        slug: "test-mcp-inv-alt",
        price_paise: 20000,
      });

      const errEmpty = failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 1,
        stage: "packaging",
        asset_url: "/test.jpg",
        alt_text: "  ", // Empty string!
      });
      expect(errEmpty.code).toBe(-32602);

      const errMissing = failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 1,
        stage: "packaging",
        asset_url: "/test.jpg",
        // alt_text omitted entirely
      });
      expect(errMissing.code).toBe(-32602);
    });

    it("7.5: publish gate blockers block trial_publish with error -32009", () => {
      // Incomplete trial: price is 0, no media
      const trial = call<Trial>("trial_create", {
        title: "Incomplete Blocked Kit",
        slug: "test-mcp-inv-blocker",
        price_paise: 0,
      });

      const err = failsWith("trial_publish", {
        id: trial.id,
        expected_revision: 1,
      });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/cannot publish trial|blocker/i);
    });

    it("7.6: invalid state transitions are rejected with -32009 or -32602", () => {
      const trial = call<Trial>("trial_create", {
        title: "Invalid Transition Kit",
        slug: "test-mcp-inv-transition",
        price_paise: 25000,
      });

      // Cannot unpublish a draft trial
      const errUnpub = failsWith("trial_unpublish", {
        id: trial.id,
        expected_revision: 1,
      });
      expect([-32009, -32602]).toContain(errUnpub.code);

      // Archive trial
      call<Trial>("trial_archive", { id: trial.id, expected_revision: 1 });

      // Cannot update an archived trial
      const errUpdate = failsWith("trial_update", {
        id: trial.id,
        expected_revision: 2,
        title: "Attempt Edit After Archive",
      });
      expect([-32009, -32602]).toContain(errUpdate.code);
    });
  });

  // ---------------------------------------------------------------------------
  // Suite 8: Database Setup & Teardown Architecture
  // ---------------------------------------------------------------------------
  describe("Suite 8: Database Setup & Teardown Architecture", () => {
    it("8.1: runs in isolated SQLite database and confirms schema tables exist", () => {
      const db = getDb();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'trial%'")
        .all() as { name: string }[];
      const names = tables.map((t) => t.name);

      expect(names).toContain("trials");
      expect(names).toContain("trial_components");
      expect(names).toContain("trial_assets");
      expect(names).toContain("trial_brew_guides");
      expect(names).toContain("trial_sensory_tests");
      expect(names).toContain("trial_claims");
      expect(names).toContain("trial_bulk_links");
      expect(names).toContain("trial_publications");
      expect(names).toContain("trial_audit");
    });
  });
});
