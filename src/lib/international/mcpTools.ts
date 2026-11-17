import { getDb } from "@/lib/db";
import { randomUUID } from "node:crypto";
import {
  studio,
  sourceFor,
  translation,
  queueTranslation,
  editTranslation,
  validateTexts,
  resourceList,
  UI_SOURCE,
  type Texts,
} from "./translations";
import { LANGUAGES, localeSchema, CommerceError } from "./models";
import { hash } from "./quotes";
import { PAN_INDIA_ITEMS, getLocaleDictionary } from "./panIndiaDictionary";

export class TranslationMcpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function parseLocale(value: unknown, { allowEnglish = true } = {}) {
  const parsed = localeSchema.safeParse(value);
  if (!parsed.success) {
    throw new TranslationMcpError(-32602, `Invalid locale: ${String(value)}`);
  }
  if (!allowEnglish && parsed.data === "en") {
    throw new TranslationMcpError(-32602, "Choose a non-English language.");
  }
  return parsed.data;
}

function getContentType(resource: string): string {
  if (resource === "interface" || resource === "homepage" || resource === "shell" || resource === "trade") return resource;
  return resource.split(":")[0] || "other";
}

export const TRANSLATION_TOOL_ALIASES: Record<string, string> = {
  translations_list: "translations.list",
  list_translations: "translations.list",
  "admin.listTranslations": "translations.list",
  "admin.translations.list": "translations.list",
  translations_studio_list: "translations.list",

  translations_get: "translations.get",
  get_translation: "translations.get",
  "admin.getTranslation": "translations.get",
  "admin.translations.get": "translations.get",

  translations_update: "translations.update",
  translations_update_draft: "translations.update",
  update_translation: "translations.update",
  "admin.updateTranslation": "translations.update",
  "admin.translations.update": "translations.update",

  translations_publish: "translations.publish",
  "translations.publishReviewed": "translations.publish",
  translations_publish_reviewed: "translations.publish",
  publish_translation: "translations.publish",
  "admin.publishTranslation": "translations.publish",
  "admin.translations.publish": "translations.publish",

  translations_unpublish: "translations.unpublish",
  unpublish_translation: "translations.unpublish",
  "admin.unpublishTranslation": "translations.unpublish",
  "admin.translations.unpublish": "translations.unpublish",

  translations_queue: "translations.queue",
  queue_translation: "translations.queue",
  translations_generate: "translations.queue",
  generate_translation: "translations.queue",
  "admin.queueTranslation": "translations.queue",
  "admin.translations.queue": "translations.queue",

  translations_seed_pan_india: "translations.seedPanIndia",
  seed_pan_india_translations: "translations.seedPanIndia",
  "admin.seedPanIndiaTranslations": "translations.seedPanIndia",
  "admin.translations.seedPanIndia": "translations.seedPanIndia",

  translations_bulk_publish: "translations.bulkPublish",
  bulk_publish_translations: "translations.bulkPublish",
  "admin.bulkPublishTranslations": "translations.bulkPublish",
  "admin.translations.bulkPublish": "translations.bulkPublish",

  translations_get_locales: "translations.getLocales",
  list_translation_locales: "translations.getLocales",
  "admin.getTranslationLocales": "translations.getLocales",
};

export const TRANSLATION_TOOL_DEFINITIONS = [
  {
    name: "translations.getLocales",
    description: "Get all supported storefront languages and locales in TeaFloww (codes, native names, direction, Pan-India status).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      title: "Get Supported Translation Locales",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: () => {
      const panIndiaCodes = new Set(["hi", "bn", "pa", "mr", "gu", "ta", "te"]);
      return {
        locales: LANGUAGES.map((l) => ({
          code: l.code,
          name: l.name,
          dir: l.dir,
          isPanIndia: panIndiaCodes.has(l.code),
        })),
        defaultLocale: "en",
        supportedCount: LANGUAGES.length,
      };
    },
  },
  {
    name: "translations.list",
    description:
      "List all translatable resources, their current status (published, draft, stale, missing, queued, failed), revisions, and counts for TeaFloww Translation Studio.",
    inputSchema: {
      type: "object",
      properties: {
        locale: {
          type: "string",
          description: "Target language code (e.g. 'hi', 'bn', 'pa', 'mr', 'gu', 'ta', 'te', 'ar', 'fr', 'de', 'es', 'pt', 'ja', 'zh-CN'). Defaults to 'hi'.",
        },
        type: {
          type: "string",
          description: "Filter by content type ('all', 'interface', 'homepage', 'shell', 'trade', 'product', 'category', 'page', 'blog', 'email', 'slider', 'block', 'placement', 'campaign'). Defaults to 'all'.",
        },
        status: {
          type: "string",
          description: "Filter by status ('all', 'published', 'draft', 'stale', 'missing', 'queued', 'failed'). Defaults to 'all'.",
        },
        search: {
          type: "string",
          description: "Search filter matching resource identifier, title, or type.",
        },
        limit: {
          type: "number",
          description: "Maximum number of resources to return (default: 100, max: 500).",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0).",
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "List Translation Resources & Statuses",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as {
        locale?: string;
        type?: string;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
      };
      const loc = raw.locale !== undefined ? parseLocale(raw.locale) : "hi";
      const studioList = studio(loc);

      const typeFilter = raw.type && raw.type !== "all" ? raw.type.toLowerCase() : null;
      const statusFilter = raw.status && raw.status !== "all" ? raw.status.toLowerCase() : null;
      const searchQuery = raw.search ? raw.search.toLowerCase().trim() : null;

      let filtered = studioList.map((item) => {
        const itemType = getContentType(item.resource);
        return {
          resource: item.resource,
          title: item.title,
          type: itemType,
          status: item.status,
          error: item.error,
          jobId: item.jobId,
          revision: item.translation?.revision ?? null,
          hasDraft: Boolean(item.translation?.draft),
          hasPublished: Boolean(item.translation?.published),
          updatedMs: item.translation?.updated_ms ?? null,
        };
      });

      if (typeFilter) {
        filtered = filtered.filter((r) => r.type === typeFilter);
      }
      if (statusFilter) {
        filtered = filtered.filter((r) => r.status === statusFilter);
      }
      if (searchQuery) {
        filtered = filtered.filter(
          (r) =>
            r.title.toLowerCase().includes(searchQuery) ||
            r.resource.toLowerCase().includes(searchQuery) ||
            r.type.toLowerCase().includes(searchQuery)
        );
      }

      const counts = studioList.reduce<Record<string, number>>((acc, cur) => {
        acc[cur.status] = (acc[cur.status] || 0) + 1;
        acc.total = (acc.total || 0) + 1;
        return acc;
      }, { published: 0, draft: 0, stale: 0, missing: 0, queued: 0, failed: 0, total: 0 });

      const limit = Math.max(1, Math.min(500, Number(raw.limit) || 100));
      const offset = Math.max(0, Number(raw.offset) || 0);
      const paginated = filtered.slice(offset, offset + limit);

      return {
        locale: loc,
        total: filtered.length,
        limit,
        offset,
        counts,
        resources: paginated,
      };
    },
  },
  {
    name: "translations.get",
    description:
      "Get detailed translation information for a specific resource and locale, including original English source texts, draft texts, published texts, revisions, and history.",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          description: "Resource identifier (e.g. 'interface', 'shell', 'homepage', 'trade', 'product:1', 'category:1', 'page:1').",
        },
        locale: {
          type: "string",
          description: "Target language code (e.g. 'hi', 'bn'). Defaults to 'hi'.",
        },
      },
      required: ["resource"],
      additionalProperties: false,
    },
    annotations: {
      title: "Get Translation Record Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as { resource: string; locale?: string };
      if (!raw.resource || typeof raw.resource !== "string") {
        throw new TranslationMcpError(-32602, "Resource identifier is required.");
      }
      const loc = raw.locale !== undefined ? parseLocale(raw.locale) : "hi";
      let source: Texts;
      try {
        source = sourceFor(raw.resource);
      } catch (err) {
        throw new TranslationMcpError(-32602, `Unknown or not found translation resource: ${(err as Error).message}`);
      }

      const sourceHash = hash(source);
      const row = translation(raw.resource, loc);

      let draftTexts: Texts | null = null;
      let publishedTextsData: Texts | null = null;
      if (row?.draft) {
        try { draftTexts = JSON.parse(row.draft); } catch {}
      }
      if (row?.published) {
        try { publishedTextsData = JSON.parse(row.published); } catch {}
      }

      const isStale = Boolean(row && row.source_hash !== sourceHash);
      const status = isStale
        ? "stale"
        : row?.published && row.published_hash === sourceHash
        ? "published"
        : row?.draft
        ? "draft"
        : "missing";

      const db = getDb();
      let history: unknown[] = [];
      if (row?.id) {
        try {
          history = db
            .prepare("SELECT id, document, created_ms FROM commerce_translation_history WHERE translation_id=? ORDER BY created_ms DESC LIMIT 10")
            .all(row.id);
        } catch {}
      }

      const list = resourceList();
      const meta = list.find((r) => r.resource === raw.resource);

      return {
        resource: raw.resource,
        title: meta?.title || raw.resource,
        locale: loc,
        status,
        isStale,
        revision: row?.revision ?? 0,
        sourceHash,
        publishedHash: row?.published_hash ?? null,
        source,
        draft: draftTexts,
        published: publishedTextsData,
        updatedMs: row?.updated_ms ?? null,
        history,
      };
    },
  },
  {
    name: "translations.update",
    description:
      "Save or update a translation draft for a resource and locale in TeaFloww Translation Studio. Validates protected brand terms (TeaFloww, Nirva), SKU codes, URLs, template placeholders, and blocks unsupported HTML/scripts.",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          description: "Resource identifier (e.g. 'interface', 'shell', 'homepage', 'trade', 'product:1').",
        },
        locale: {
          type: "string",
          description: "Target language code (e.g. 'hi', 'bn', 'fr', etc.).",
        },
        texts: {
          type: "object",
          description: "Key-value dictionary mapping source text keys to translated strings.",
        },
      },
      required: ["resource", "locale", "texts"],
      additionalProperties: false,
    },
    annotations: {
      title: "Update Translation Draft",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as {
        resource: string;
        locale: string;
        texts: Record<string, string>;
      };
      if (!raw.resource || typeof raw.resource !== "string") {
        throw new TranslationMcpError(-32602, "Resource is required.");
      }
      const loc = parseLocale(raw.locale, { allowEnglish: raw.resource === "trade" });
      if (!raw.texts || typeof raw.texts !== "object") {
        throw new TranslationMcpError(-32602, "Texts dictionary is required.");
      }

      try {
        editTranslation(raw.resource, raw.texts, "draft", loc);
      } catch (err) {
        if (err instanceof CommerceError) {
          throw new TranslationMcpError(-32602, err.message);
        }
        throw err;
      }

      const updated = translation(raw.resource, loc);
      return {
        ok: true,
        resource: raw.resource,
        locale: loc,
        status: "draft",
        revision: updated?.revision ?? 1,
        updatedMs: updated?.updated_ms ?? Date.now(),
      };
    },
  },
  {
    name: "translations.publish",
    description:
      "Review and publish a translation to live status on TeaFloww storefront. If texts is provided, it validates, updates, and publishes them. If texts is omitted, it reviews and promotes the existing draft to published status.",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          description: "Resource identifier (e.g. 'interface', 'shell', 'homepage', 'trade', 'product:1').",
        },
        locale: {
          type: "string",
          description: "Target language code (e.g. 'hi', 'bn', 'fr', etc.).",
        },
        texts: {
          type: "object",
          description: "Optional key-value dictionary to publish. If omitted, publishes the existing draft.",
        },
        expected_revision: {
          type: "integer",
          minimum: 0,
          description: "Optional optimistic-concurrency revision guard.",
        },
        reviewed: {
          type: "boolean",
          description: "Optional explicit review confirmation; passing false blocks publication.",
        },
      },
      required: ["resource", "locale"],
      additionalProperties: false,
    },
    annotations: {
      title: "Publish Translation Live",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as {
        resource: string;
        locale: string;
        texts?: Record<string, string>;
        expected_revision?: number;
        reviewed?: boolean;
      };
      if (!raw.resource || typeof raw.resource !== "string") {
        throw new TranslationMcpError(-32602, "Resource is required.");
      }
      if (raw.reviewed === false) {
        throw new TranslationMcpError(-32602, "Translation must be reviewed before publication.");
      }
      const loc = parseLocale(raw.locale, { allowEnglish: raw.resource === "trade" });
      const existing = translation(raw.resource, loc);

      if (raw.expected_revision !== undefined) {
        if (!Number.isInteger(raw.expected_revision) || raw.expected_revision < 0) {
          throw new TranslationMcpError(-32602, "expected_revision must be a non-negative integer.");
        }
        if ((existing?.revision ?? 0) !== raw.expected_revision) {
          throw new TranslationMcpError(-32009, "Translation revision changed; reload before publishing.");
        }
      }

      if (!raw.texts) {
        if (!existing || !existing.draft) {
          throw new TranslationMcpError(
            -32602,
            `No draft found to publish for [${raw.resource}] in locale [${loc}]. Provide texts to publish directly or update draft first.`
          );
        }
      }

      try {
        editTranslation(raw.resource, raw.texts || null, "publish", loc);
      } catch (err) {
        if (err instanceof CommerceError) {
          throw new TranslationMcpError(-32602, err.message);
        }
        throw err;
      }

      const published = translation(raw.resource, loc);
      return {
        ok: true,
        resource: raw.resource,
        locale: loc,
        status: "published",
        revision: published?.revision ?? 1,
        updatedMs: published?.updated_ms ?? Date.now(),
      };
    },
  },
  {
    name: "translations.unpublish",
    description:
      "Unpublish an active translation, clearing live published status and reverting that resource in that locale to English fallback.",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          description: "Resource identifier to unpublish.",
        },
        locale: {
          type: "string",
          description: "Target language code.",
        },
      },
      required: ["resource", "locale"],
      additionalProperties: false,
    },
    annotations: {
      title: "Unpublish Translation",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as { resource: string; locale: string };
      if (!raw.resource || typeof raw.resource !== "string") {
        throw new TranslationMcpError(-32602, "Resource is required.");
      }
      const loc = parseLocale(raw.locale, { allowEnglish: raw.resource === "trade" });
      editTranslation(raw.resource, {}, "unpublish", loc);

      return {
        ok: true,
        resource: raw.resource,
        locale: loc,
        status: "unpublished",
      };
    },
  },
  {
    name: "translations.queue",
    description:
      "Queue draft translations for at most 25 specified resources in one non-English language. Never publishes automatically. Already published or draft records are skipped unless force=true.",
    inputSchema: {
      type: "object",
      properties: {
        resources: {
          type: "array",
          minItems: 1,
          maxItems: 25,
          items: { type: "string", maxLength: 100 },
          description: "List of unique resource identifiers to queue (e.g. ['product:1', 'category:2']). Max 25 per call.",
        },
        locale: {
          type: "string",
          description: "Target non-English language code.",
        },
        force: {
          type: "boolean",
          description: "Allow regenerating an existing draft or published resource (draft only; does not unpublish).",
        },
      },
      required: ["resources", "locale"],
      additionalProperties: false,
    },
    annotations: {
      title: "Queue Resources for Translation",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as { resources: string[]; locale: string; force?: boolean };
      if (!Array.isArray(raw.resources) || raw.resources.length === 0) {
        throw new TranslationMcpError(-32602, "At least one resource is required.");
      }
      if (raw.resources.length > 25) {
        throw new TranslationMcpError(-32602, "Queue at most 25 resources per call.");
      }
      if (raw.resources.some((r) => typeof r !== "string" || r.trim().length === 0 || r.length > 100)) {
        throw new TranslationMcpError(-32602, "Each resource identifier must be a non-empty string up to 100 characters.");
      }
      if (new Set(raw.resources).size !== raw.resources.length) {
        throw new TranslationMcpError(-32602, "Duplicate resource identifiers are not allowed.");
      }
      const loc = parseLocale(raw.locale, { allowEnglish: false });
      const force = Boolean(raw.force);
      const current = new Map(studio(loc).map((item) => [item.resource, item]));
      const queued: string[] = [];
      const skipped: Array<{ resource: string; reason: string }> = [];

      for (const res of raw.resources) {
        const row = current.get(res);
        if (!row) {
          skipped.push({ resource: res, reason: "Unknown resource" });
          continue;
        }
        if (row.status === "queued" || row.status === "processing") {
          skipped.push({ resource: res, reason: row.status });
          continue;
        }
        if (!force && (row.status === "published" || row.status === "draft")) {
          skipped.push({ resource: res, reason: "Existing published or draft translation" });
          continue;
        }
        if (Object.keys(sourceFor(res)).length === 0) {
          skipped.push({ resource: res, reason: "No translatable source fields" });
          continue;
        }
        try {
          queueTranslation(res, loc);
          queued.push(res);
        } catch (err) {
          throw new TranslationMcpError(-32602, `Failed queueing resource [${res}]: ${(err as Error).message}`);
        }
      }

      return {
        ok: true,
        queued: queued.length,
        queuedResources: queued,
        skipped,
        locale: loc,
        publication: "None; drafts require review.",
      };
    },
  },
  {
    name: "translations.seedPanIndia",
    description:
      "Seed verified Pan-India translation dictionaries (Hindi, Bengali, Punjabi, Marathi, Gujarati, Tamil, Telugu) for the storefront interface, and immediately review and publish them.",
    inputSchema: {
      type: "object",
      properties: {
        locales: {
          type: "array",
          items: { type: "string" },
          description: "Locales to seed (defaults to all 7: hi, bn, pa, mr, gu, ta, te).",
        },
        publish: {
          type: "boolean",
          description: "Whether to publish immediately to live storefront (default: true).",
        },
        resource: {
          type: "string",
          description: "Resource to seed (default: 'interface').",
        },
      },
      additionalProperties: false,
    },
    annotations: {
      title: "Seed Pan-India Translations",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as {
        locales?: string[];
        publish?: boolean;
        resource?: string;
      };
      const defaultLocales = ["hi", "bn", "pa", "mr", "gu", "ta", "te"];
      const locales = (raw.locales && raw.locales.length > 0 ? raw.locales : defaultLocales).map((l) =>
        parseLocale(l, { allowEnglish: false })
      );
      const shouldPublish = raw.publish !== false;
      const resource = raw.resource || "interface";

      const db = getDb();
      const source = sourceFor(resource);
      const sourceHash = hash(source);

      let seededCount = 0;
      db.transaction(() => {
        for (const loc of locales) {
          const dict = getLocaleDictionary(loc);
          const validDict = validateTexts(source, dict, true);
          const dictJson = JSON.stringify(validDict);
          const existing = translation(resource, loc);
          const now = Date.now();

          if (existing) {
            const pub = shouldPublish ? dictJson : existing.published;
            const pubHash = shouldPublish ? sourceHash : existing.published_hash;
            db.prepare(
              "UPDATE commerce_translations SET draft=?, published=?, published_hash=?, source_hash=?, source=?, revision=revision+1, updated_ms=? WHERE id=?"
            ).run(dictJson, pub, pubHash, sourceHash, JSON.stringify(source), now, existing.id);
            seededCount++;
          } else {
            const newId = randomUUID();
            const pub = shouldPublish ? dictJson : null;
            const pubHash = shouldPublish ? sourceHash : null;
            db.prepare(
              `INSERT INTO commerce_translations (id, resource, locale, source_hash, source, draft, published, published_hash, revision, updated_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
            ).run(newId, resource, loc, sourceHash, JSON.stringify(source), dictJson, pub, pubHash, now);
            seededCount++;
          }
        }
      })();

      return {
        ok: true,
        resource,
        locales,
        seededCount,
        published: shouldPublish,
      };
    },
  },
  {
    name: "translations.bulkPublish",
    description:
      "Review and publish multiple translation records across resources and locales in a single atomic transaction.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              resource: { type: "string" },
              locale: { type: "string" },
              texts: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
            required: ["resource", "locale"],
          },
          description: "List of items to publish.",
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    annotations: {
      title: "Bulk Publish Translations",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    run: (args: unknown) => {
      const raw = (args ?? {}) as {
        items: Array<{ resource: string; locale: string; texts?: Record<string, string> }>;
      };
      if (!Array.isArray(raw.items) || raw.items.length === 0) {
        throw new TranslationMcpError(-32602, "At least one item is required.");
      }

      const db = getDb();
      let publishedCount = 0;

      db.transaction(() => {
        for (const item of raw.items) {
          const loc = parseLocale(item.locale, { allowEnglish: false });
          editTranslation(item.resource, item.texts || null, "publish", loc);
          publishedCount++;
        }
      })();

      return {
        ok: true,
        publishedCount,
      };
    },
  },
];
