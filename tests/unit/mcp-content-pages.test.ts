import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import {
  dispatchToolCall,
  listToolDefinitions,
  listResourceDefinitions,
  listResourceTemplateDefinitions,
  dispatchResourceRead,
  listPromptDefinitions,
  dispatchPromptGet,
  dispatchCompletion,
  McpError,
} from "../../src/lib/mcp";

const TEST_DB = path.join(tmpdir(), `mcp-content-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

function call<T>(name: string, args: unknown): T {
  return dispatchToolCall(name, args) as T;
}

function failsWith(name: string, args: unknown): number {
  try {
    dispatchToolCall(name, args);
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return (error as McpError).code;
  }
  throw new Error(`expected ${name} to fail`);
}

describe("MCP 100% Content, Text, Image & Storefront Management", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
  });

  afterAll(() => {
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try {
        rmSync(TEST_DB + suffix, { force: true });
      } catch {
        /* ignore */
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Tool Catalog Coverage
  // ---------------------------------------------------------------------------
  it("registers all content, pages, text blocks, announcement, and navigation tools", () => {
    const tools = listToolDefinitions();
    const names = new Set(tools.map((t) => t.name));

    expect(names.has("content.listPages")).toBe(true);
    expect(names.has("content.getPage")).toBe(true);
    expect(names.has("admin.upsertPage")).toBe(true);
    expect(names.has("admin.deletePage")).toBe(true);

    expect(names.has("content.getTextBlock")).toBe(true);
    expect(names.has("admin.updateTextBlock")).toBe(true);
    expect(names.has("content.listTextBlocks")).toBe(true);
    expect(names.has("admin.deleteTextBlock")).toBe(true);

    expect(names.has("store.getAnnouncement")).toBe(true);
    expect(names.has("admin.updateAnnouncement")).toBe(true);

    expect(names.has("store.getNavigation")).toBe(true);
    expect(names.has("admin.updateNavigation")).toBe(true);
    expect(names.has("admin.updateFooter")).toBe(true);

    expect(names.has("store.getStoreInfo")).toBe(true);
    expect(names.has("media.replaceImage")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 2. Content Pages Tools & Aliases
  // ---------------------------------------------------------------------------
  describe("pages management", () => {
    it("lists default seeded pages via content.listPages and alias listPages", () => {
      const res = call<{ pages: Array<{ slug: string; title: string }> }>("content.listPages", {});
      expect(Array.isArray(res.pages)).toBe(true);
      expect(res.pages.length).toBeGreaterThanOrEqual(10);

      const slugs = res.pages.map((p) => p.slug);
      expect(slugs).toContain("about");
      expect(slugs).toContain("shipping");
      expect(slugs).toContain("returns");
      expect(slugs).toContain("contact");

      const aliasRes = call<{ pages: Array<{ slug: string }> }>("listPages", {});
      expect(aliasRes.pages.length).toBe(res.pages.length);
    });

    it("gets an existing page by slug via content.getPage and alias getPage", () => {
      const res = call<{ page: { slug: string; title: string; headline: string } }>("content.getPage", {
        slug: "about",
      });
      expect(res.page).toBeDefined();
      expect(res.page.slug).toBe("about");
      expect(res.page.title).toContain("About");

      const aliasRes = call<{ page: { slug: string } }>("getPage", { slug: "about" });
      expect(aliasRes.page.slug).toBe("about");
    });

    it("fails with -32004 when getting a nonexistent page", () => {
      expect(failsWith("content.getPage", { slug: "nonexistent-page-slug-xyz" })).toBe(-32004);
    });

    it("creates, updates, and idempotently upserts a custom content page", () => {
      const key = "550e8400-e29b-41d4-a716-446655440001";
      const created = call<{
        success: boolean;
        page: { slug: string; title: string; headline: string; is_published: number };
        deduped: boolean;
      }>("admin.upsertPage", {
        slug: "tea-rituals",
        title: "Himalayan Tea Rituals",
        eyebrow: "SACRED BREWING",
        headline: "From Morning Mist to Evening Reflection",
        subtitle: "How Himalayan orthodox teas awaken mindful presence.",
        body_markdown: "# Tea Rituals\n\nExperience serenity with single-estate flushes.",
        meta_title: "Tea Rituals | Himalayan Tea House",
        meta_description: "Mindful brewing guides and high-mountain rituals.",
        is_published: true,
        idempotencyKey: key,
      });

      expect(created.success).toBe(true);
      expect(created.page.slug).toBe("tea-rituals");
      expect(created.page.title).toBe("Himalayan Tea Rituals");
      expect(created.page.headline).toBe("From Morning Mist to Evening Reflection");
      expect(created.deduped).toBe(false);

      // Verify idempotency
      const secondCall = call<{ deduped: boolean }>("admin.upsertPage", {
        slug: "tea-rituals",
        title: "Himalayan Tea Rituals",
        idempotencyKey: key,
      });
      expect(secondCall.deduped).toBe(true);

      // Update via alias updatePage
      const updated = call<{ success: boolean; page: { headline: string } }>("updatePage", {
        slug: "tea-rituals",
        title: "Himalayan Tea Rituals Updated",
        headline: "Awakened Senses",
      });
      expect(updated.success).toBe(true);
      expect(updated.page.headline).toBe("Awakened Senses");
    });

    it("deletes a page by slug with confirmation via admin.deletePage and alias deletePage", () => {
      // Create a temporary page to delete
      call("admin.upsertPage", {
        slug: "temp-delete-page",
        title: "Temporary Page",
      });

      // Without confirmation, must fail with -32009
      expect(failsWith("admin.deletePage", { slug: "temp-delete-page", confirmed: false })).toBe(-32009);

      // With confirmation
      const res = call<{ deleted: boolean }>("deletePage", {
        slug: "temp-delete-page",
        confirmed: true,
      });
      expect(res.deleted).toBe(true);

      // Verify it's gone
      expect(failsWith("content.getPage", { slug: "temp-delete-page" })).toBe(-32004);
    });

    it("supports deleting page via admin.deleteEntity with entity: 'page'", () => {
      call("admin.upsertPage", {
        slug: "entity-delete-page",
        title: "Entity Delete Page",
      });

      const res = call<{ deleted: boolean }>("admin.deleteEntity", {
        entity: "page",
        id: "entity-delete-page",
        confirmed: true,
      });
      expect(res.deleted).toBe(true);
      expect(failsWith("content.getPage", { slug: "entity-delete-page" })).toBe(-32004);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Text Blocks Tools & Aliases
  // ---------------------------------------------------------------------------
  describe("text content blocks management", () => {
    it("lists seeded text blocks with optional prefix filtering", () => {
      const all = call<{ blocks: Array<{ key: string; content: string }> }>("content.listTextBlocks", {});
      expect(all.blocks.length).toBeGreaterThan(0);

      const footerBlocks = call<{ blocks: Array<{ key: string }> }>("listTextBlocks", {
        prefix: "footer.",
      });
      expect(footerBlocks.blocks.length).toBeGreaterThan(0);
      expect(footerBlocks.blocks.every((b) => b.key.startsWith("footer."))).toBe(true);
    });

    it("reads a specific text block with getTextBlock", () => {
      const res = call<{ key: string; content: string; exists: boolean }>("content.getTextBlock", {
        key: "announcement.text",
      });
      expect(res.key).toBe("announcement.text");
      expect(typeof res.content).toBe("string");
      expect(res.exists).toBe(true);
    });

    it("updates and creates text blocks via admin.updateTextBlock and alias updateTextBlock", () => {
      const updated = call<{
        success: boolean;
        block: { key: string; content: string; content_type: string; description: string };
      }>("admin.updateTextBlock", {
        key: "shipping.express_commitment",
        content: "Same-day courier dispatch from Siliguri tea hub before 2 PM IST.",
        content_type: "text",
        description: "Express shipping cutoff banner",
      });

      expect(updated.success).toBe(true);
      expect(updated.block.key).toBe("shipping.express_commitment");
      expect(updated.block.content).toContain("Same-day courier dispatch");

      // Verify reading back
      const read = call<{ content: string }>("getTextBlock", { key: "shipping.express_commitment" });
      expect(read.content).toContain("Same-day courier dispatch");
    });

    it("deletes a text block via admin.deleteTextBlock and admin.deleteEntity", () => {
      call("updateTextBlock", { key: "test.deletable.key", content: "temp value" });

      const del = call<{ deleted: boolean }>("deleteTextBlock", {
        key: "test.deletable.key",
        confirmed: true,
      });
      expect(del.deleted).toBe(true);

      call("updateTextBlock", { key: "test.deletable.key2", content: "temp value 2" });
      const entityDel = call<{ deleted: boolean }>("admin.deleteEntity", {
        entity: "content_block",
        id: "test.deletable.key2",
        confirmed: true,
      });
      expect(entityDel.deleted).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Announcement & Navigation & Footer Management
  // ---------------------------------------------------------------------------
  describe("announcement, navigation & footer management", () => {
    it("reads and updates top announcement banner", () => {
      const initial = call<{ announcement: { text: string; enabled: boolean } }>("store.getAnnouncement", {});
      expect(initial.announcement).toBeDefined();

      const updated = call<{
        success: boolean;
        announcement: { text: string; highlight: string; link_url: string; enabled: boolean };
      }>("admin.updateAnnouncement", {
        text: "Special Spring First Flush lots now arriving directly from Darjeeling estates.",
        highlight: "FIRST FLUSH 2026",
        link_url: "/shop",
        link_label: "Discover Lots",
        enabled: true,
      });

      expect(updated.success).toBe(true);
      expect(updated.announcement.text).toContain("Special Spring First Flush");
      expect(updated.announcement.highlight).toBe("FIRST FLUSH 2026");
      expect(updated.announcement.enabled).toBe(true);

      // Verify via alias getAnnouncement
      const readBack = call<{ announcement: { highlight: string } }>("getAnnouncement", {});
      expect(readBack.announcement.highlight).toBe("FIRST FLUSH 2026");
    });

    it("reads and updates navigation links", () => {
      const nav = call<{ navigation: { header_links: Array<{ label: string; href: string }> } }>(
        "store.getNavigation",
        {}
      );
      expect(nav.navigation).toBeDefined();
      expect(Array.isArray(nav.navigation.header_links)).toBe(true);

      const updated = call<{
        success: boolean;
        navigation: { header_links: Array<{ label: string; href: string }> };
      }>("admin.updateNavigation", {
        header_links: [
          { label: "Shop", href: "/shop" },
          { label: "Estates", href: "/leaf-to-cup" },
          { label: "Rituals", href: "/pages/tea-rituals" },
          { label: "Contact", href: "/contact" },
        ],
      });

      expect(updated.success).toBe(true);
      expect(updated.navigation.header_links.length).toBe(4);
      expect(updated.navigation.header_links[2].label).toBe("Rituals");
    });

    it("updates footer copy via admin.updateFooter", () => {
      const updated = call<{
        success: boolean;
        updated: { tagline?: string; copyright?: string; badge?: string };
      }>("admin.updateFooter", {
        tagline: "Orthodox Tea Direct from Eastern Himalayan Estates.",
        copyright: "© 2026 Himalayan Tea House. All rights reserved.",
        badge: "Siliguri Packaging Hub • Origin Direct",
      });

      expect(updated.success).toBe(true);
      expect(updated.updated.tagline).toBe("Orthodox Tea Direct from Eastern Himalayan Estates.");

      // Check text block was updated
      const read = call<{ content: string }>("getTextBlock", { key: "footer.tagline" });
      expect(read.content).toBe("Orthodox Tea Direct from Eastern Himalayan Estates.");
    });

    it("reads unified store info via store.getStoreInfo and alias getStoreInfo", () => {
      const info = call<{
        brand: { name: string; tagline: string };
        contact: { email: string; telephone: string };
        address: { addressLocality: string };
        shipping: { dispatchCommitment: string };
      }>("store.getStoreInfo", {});

      expect(info.brand.name).toBe("Himalayan Tea House");
      expect(info.contact.email).toBeDefined();
      expect(info.address.addressLocality).toBe("Siliguri");
      expect(info.shipping.dispatchCommitment).toBeDefined();

      const aliasInfo = call<typeof info>("getStoreInfo", {});
      expect(aliasInfo.brand.name).toBe("Himalayan Tea House");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Media Upload via URL/Data URI & Page Association
  // ---------------------------------------------------------------------------
  describe("media uploads, replacement and page association", () => {
    // 1x1 transparent PNG data URI
    const transparentPngDataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    it("uploads media using data URI and associates with a page", () => {
      const upload = call<{
        success: boolean;
        asset: { id: number; url: string };
      }>("media.uploadMedia", {
        filename: "hero-tea-rituals.png",
        image_url: transparentPngDataUri,
        alt_text: "High mountain tea garden in mist",
      });

      expect(upload.success).toBe(true);
      expect(upload.asset.id).toBeGreaterThan(0);
      expect(upload.asset.url).toContain("/uploads/");

      // Associate media with a content page
      const assoc = call<{
        success: boolean;
        entity_type: string;
        entity_id: string;
        page_slug?: string;
      }>("media.associateMedia", {
        media_id: upload.asset.id,
        entity_type: "page",
        entity_id: "about",
      });

      expect(assoc.success).toBe(true);
      expect(assoc.entity_type).toBe("page");
      expect(assoc.page_slug).toBe("about");

      // Verify the page hero image URL was updated
      const page = call<{ page: { hero_image_url: string; hero_media_id: number } }>("content.getPage", {
        slug: "about",
      });
      expect(page.page.hero_media_id).toBe(upload.asset.id);
      expect(page.page.hero_image_url).toBe(upload.asset.url);
    });

    it("replaces existing image file using media.replaceImage", () => {
      const upload = call<{ asset: { id: number } }>("media.uploadMedia", {
        filename: "replaceable-image.png",
        image_url: transparentPngDataUri,
      });

      const replaced = call<{
        success: boolean;
        asset: { id: number; alt_text: string };
      }>("media.replaceImage", {
        media_id: upload.asset.id,
        image_url: transparentPngDataUri,
        alt_text: "Replaced high altitude leaves",
      });

      expect(replaced.success).toBe(true);
      expect(replaced.asset.id).toBe(upload.asset.id);
      expect(replaced.asset.alt_text).toBe("Replaced high altitude leaves");
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Resources & Resource Templates
  // ---------------------------------------------------------------------------
  describe("resources and resource templates", () => {
    it("declares new content and page resources in listResourceDefinitions", () => {
      const res = listResourceDefinitions();
      const uris = new Set(res.map((r) => r.uri));

      expect(uris.has("tea://pages")).toBe(true);
      expect(uris.has("tea://announcement")).toBe(true);
      expect(uris.has("tea://navigation")).toBe(true);
      expect(uris.has("tea://content/blocks")).toBe(true);
    });

    it("declares page and content templates in listResourceTemplateDefinitions", () => {
      const templates = listResourceTemplateDefinitions();
      const uris = new Set(templates.map((t) => t.uriTemplate));

      expect(uris.has("tea://pages/{slug}")).toBe(true);
      expect(uris.has("tea://content/{key}")).toBe(true);
    });

    it("reads tea://pages resource correctly", () => {
      const res = dispatchResourceRead("tea://pages");
      expect(res.contents).toHaveLength(1);
      expect(res.contents[0].uri).toBe("tea://pages");
      const parsed = JSON.parse(res.contents[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it("reads tea://announcement resource correctly", () => {
      const res = dispatchResourceRead("tea://announcement");
      expect(res.contents).toHaveLength(1);
      const parsed = JSON.parse(res.contents[0].text);
      expect(parsed.text).toBeDefined();
    });

    it("reads tea://navigation resource correctly", () => {
      const res = dispatchResourceRead("tea://navigation");
      expect(res.contents).toHaveLength(1);
      const parsed = JSON.parse(res.contents[0].text);
      expect(parsed.header_links).toBeDefined();
    });

    it("reads tea://content/blocks resource correctly", () => {
      const res = dispatchResourceRead("tea://content/blocks");
      expect(res.contents).toHaveLength(1);
      const parsed = JSON.parse(res.contents[0].text);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("reads dynamic tea://pages/{slug} template correctly", () => {
      const res = dispatchResourceRead("tea://pages/about");
      expect(res.contents).toHaveLength(1);
      const parsed = JSON.parse(res.contents[0].text);
      expect(parsed.slug).toBe("about");
    });

    it("reads dynamic tea://content/{key} template correctly", () => {
      const res = dispatchResourceRead("tea://content/footer.tagline");
      expect(res.contents).toHaveLength(1);
      const parsed = JSON.parse(res.contents[0].text);
      expect(parsed.key).toBe("footer.tagline");
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Prompts & Completions
  // ---------------------------------------------------------------------------
  describe("prompts and autocompletion", () => {
    it("declares new content prompts in listPromptDefinitions", () => {
      const prompts = listPromptDefinitions();
      const names = new Set(prompts.map((p) => p.name));

      expect(names.has("page-content-editor")).toBe(true);
      expect(names.has("announcement-banner-copywriter")).toBe(true);
      expect(names.has("site-rebranding-planner")).toBe(true);
    });

    it("generates page-content-editor prompt", () => {
      const p = dispatchPromptGet("page-content-editor", { slug: "brand", theme: "artisan orthodox heritage" }) as {
        messages: Array<{ role: string; content: { text: string } }>;
      };
      expect(p.messages).toHaveLength(1);
      expect(p.messages[0].content.text).toContain("brand");
      expect(p.messages[0].content.text).toContain("artisan orthodox heritage");
    });

    it("generates announcement-banner-copywriter prompt", () => {
      const p = dispatchPromptGet("announcement-banner-copywriter", { campaignTheme: "Summer Second Flush" }) as {
        messages: Array<{ role: string; content: { text: string } }>;
      };
      expect(p.messages).toHaveLength(1);
      expect(p.messages[0].content.text).toContain("Summer Second Flush");
    });

    it("generates site-rebranding-planner prompt", () => {
      const p = dispatchPromptGet("site-rebranding-planner", { brandTagline: "High Mountain Orthodox Purity" }) as {
        messages: Array<{ role: string; content: { text: string } }>;
      };
      expect(p.messages).toHaveLength(1);
      expect(p.messages[0].content.text).toContain("High Mountain Orthodox Purity");
    });

    it("provides autocompletion for page slugs, content block keys, and entity types", () => {
      // Slug completion includes pages
      const slugComp = dispatchCompletion(null, { name: "slug", value: "abo" });
      expect(slugComp.completion.values).toContain("about");

      // Key completion includes content blocks
      const keyComp = dispatchCompletion(null, { name: "key", value: "footer" });
      expect(keyComp.completion.values.some((v) => v.startsWith("footer."))).toBe(true);

      // Entity type completion includes page and content_block
      const entityComp = dispatchCompletion(null, { name: "entity_type", value: "p" });
      expect(entityComp.completion.values).toContain("page");
      expect(entityComp.completion.values).toContain("product");
    });
  });
});
