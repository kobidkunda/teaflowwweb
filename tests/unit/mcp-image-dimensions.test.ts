import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { detectImageDimensions } from "../../src/lib/uploads";
import {
  getImageRequirements,
  getCompatibleSlots,
} from "../../src/lib/imageRequirements";
import {
  dispatchToolCall,
  dispatchResourceRead,
  listToolDefinitions,
  dispatchCompletion,
} from "../../src/lib/mcp";

// Isolated DB for image tests
const TEST_DB = path.join(tmpdir(), `mcp-img-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

/** Helper to generate a minimal valid PNG buffer with given width and height */
function createMockPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  // PNG signature
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR length = 13
  buf.writeUInt32BE(13, 8);
  // Chunk type 'IHDR'
  buf.write("IHDR", 12, "ascii");
  // Width & height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // Bit depth 8, color type 2 (RGB), compression 0, filter 0, interlace 0
  buf.set([8, 2, 0, 0, 0], 24);
  // CRC dummy
  buf.writeUInt32BE(0x12345678, 29);
  return buf;
}

/** Helper to generate a minimal valid JPEG buffer with given width and height */
function createMockJpeg(width: number, height: number): Buffer {
  // SOI (2) + APP0 (18) + DQT (69) + SOF0 (19) + EOI (2) = ~110 bytes
  const buf = Buffer.alloc(80);
  buf[0] = 0xff;
  buf[1] = 0xd8; // SOI
  buf[2] = 0xff;
  buf[3] = 0xe0; // APP0
  buf.writeUInt16BE(16, 4); // len
  buf.write("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", 6, "binary");
  // SOF0 at offset 22
  buf[22] = 0xff;
  buf[23] = 0xc0; // SOF0
  buf.writeUInt16BE(17, 24); // len
  buf[26] = 8; // precision
  buf.writeUInt16BE(height, 27); // height
  buf.writeUInt16BE(width, 29); // width
  buf[31] = 3; // 3 components
  // EOI
  buf[40] = 0xff;
  buf[41] = 0xd9;
  return buf;
}

describe("MCP Image Dimension Detection & Requirements Protocol", () => {
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

  // -------------------------------------------------------------------------
  // 1. Binary Image Dimension Detector
  // -------------------------------------------------------------------------
  describe("1. Binary Image Dimension Detection", () => {
    it("detects dimensions accurately from PNG buffers", () => {
      const png = createMockPng(1200, 1200);
      const dims = detectImageDimensions(png);
      expect(dims).toEqual({ width: 1200, height: 1200, format: "png" });

      const panoramicPng = createMockPng(1920, 800);
      expect(detectImageDimensions(panoramicPng)).toEqual({
        width: 1920,
        height: 800,
        format: "png",
      });
    });

    it("detects dimensions accurately from JPEG buffers", () => {
      const jpg = createMockJpeg(1200, 800);
      const dims = detectImageDimensions(jpg);
      expect(dims).toEqual({ width: 1200, height: 800, format: "jpeg" });
    });

    it("returns null for non-image or truncated buffers without crashing", () => {
      expect(detectImageDimensions(Buffer.from("not an image"))).toBeNull();
      expect(detectImageDimensions(Buffer.alloc(0))).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Image Requirements Engine
  // -------------------------------------------------------------------------
  describe("2. Image Requirements Specifications", () => {
    it("provides complete specification for all storefront targets", () => {
      const reqs = getImageRequirements();
      expect(reqs.slots.length).toBeGreaterThanOrEqual(5);

      const prod = reqs.slots.find((s) => s.entity_type === "product");
      expect(prod).toBeDefined();
      expect(prod?.recommended_width).toBe(1200);
      expect(prod?.recommended_height).toBe(1200);
      expect(prod?.aspect_ratio).toBe("1:1");
      expect(prod?.min_width).toBe(800);

      const slider = reqs.slots.find((s) => s.entity_type === "slider");
      expect(slider?.recommended_width).toBe(1920);
      expect(slider?.recommended_height).toBe(800);
      expect(slider?.aspect_ratio).toBe("2.4:1 / 16:9");

      const blog = reqs.slots.find((s) => s.entity_type === "blog");
      expect(blog?.recommended_width).toBe(1200);
      expect(blog?.recommended_height).toBe(675);
    });

    it("filters image requirements by entity_type and section_key", () => {
      const prodReq = getImageRequirements({ entity_type: "product" });
      expect(prodReq.selected?.entity_type).toBe("product");
      expect(prodReq.selected?.recommended_width).toBe(1200);

      const heroReq = getImageRequirements({ section_key: "home_hero" });
      expect(heroReq.selected?.section_key).toBe("home_hero");
      expect(heroReq.selected?.recommended_width).toBe(1920);
      expect(heroReq.selected?.recommended_height).toBe(800);

      const storyReq = getImageRequirements({ section_key: "home_story" });
      expect(storyReq.selected?.section_key).toBe("home_story");
      expect(storyReq.selected?.recommended_width).toBe(1200);
      expect(storyReq.selected?.recommended_height).toBe(800);
    });

    it("evaluates slot compatibility based on aspect ratio and resolution", () => {
      // 1200x1200 square -> optimal for product
      const squareSlots = getCompatibleSlots(1200, 1200);
      expect(squareSlots.some((s) => s.slot === "product" && s.suitability === "optimal")).toBe(true);

      // 1920x800 banner -> optimal for slider & home_hero
      const bannerSlots = getCompatibleSlots(1920, 800);
      expect(bannerSlots.some((s) => s.slot === "slider" && s.suitability === "optimal")).toBe(true);
      expect(bannerSlots.some((s) => s.slot === "site_placement:home_hero" && s.suitability === "optimal")).toBe(true);

      // 1200x800 (3:2) -> optimal for home_story & category
      const scenicSlots = getCompatibleSlots(1200, 800);
      expect(scenicSlots.some((s) => s.slot === "site_placement:home_story" && s.suitability === "optimal")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. MCP Tool: media.getImageRequirements
  // -------------------------------------------------------------------------
  describe("3. MCP Tool media.getImageRequirements", () => {
    it("is exposed in MCP tool definitions", () => {
      const tools = listToolDefinitions();
      const tool = tools.find((t) => t.name === "media.getImageRequirements");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("dimensions");
    });

    it("returns image requirements via dispatchToolCall", () => {
      const result = dispatchToolCall("media.getImageRequirements", {}) as ReturnType<typeof getImageRequirements>;
      expect(result.slots.length).toBeGreaterThanOrEqual(5);
      expect(result.general_rules.max_file_size_mb).toBe(5);

      const filtered = dispatchToolCall("media.getImageRequirements", { entity_type: "product" }) as ReturnType<typeof getImageRequirements>;
      expect(filtered.selected?.recommended_width).toBe(1200);
      expect(filtered.selected?.aspect_ratio).toBe("1:1");
    });
  });

  // -------------------------------------------------------------------------
  // 4. MCP Tool: media.uploadMedia returns dimensions & requirements
  // -------------------------------------------------------------------------
  describe("4. MCP Tool media.uploadMedia dimension reporting", () => {
    it("automatically extracts width and height and returns target requirements", () => {
      const pngBuffer = createMockPng(1200, 1200);
      const base64Data = pngBuffer.toString("base64");

      const res = dispatchToolCall("media.uploadMedia", {
        filename: "test-tea-tin.png",
        base64_data: base64Data,
        alt_text: "Silver Tips Tea Tin 100g",
      }) as any;

      expect(res.success).toBe(true);
      expect(res.asset.width).toBe(1200);
      expect(res.asset.height).toBe(1200);
      expect(res.dimensions).toEqual({
        width: 1200,
        height: 1200,
        aspect_ratio: "1.00:1",
      });
      expect(res.required_dimensions.product).toBeDefined();
      expect(res.required_dimensions.slider).toBeDefined();
      expect(res.compatible_targets.some((c: any) => c.slot === "product")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. MCP Tool: media.associateMedia returns required dimensions
  // -------------------------------------------------------------------------
  describe("5. MCP Tool media.associateMedia dimension validation", () => {
    it("returns required dimensions and dimension match when associating media", () => {
      // 1. Create a product first
      const prod = dispatchToolCall("admin.upsertProduct", {
        slug: "dim-test-tea",
        name: "Dimension Test Tea",
        category: "Darjeeling",
        origin: "Darjeeling",
        estate: "Margaret's Hope",
        flush: "First Flush",
        harvest_date: "2026 Spring",
        description: "Fresh high mountain flush.",
        tasting_notes: "Muscatel, citrus",
        brew_temp: 95,
        brew_seconds: 180,
      }) as any;

      // 2. Upload a 1200x1200 square image
      const png = createMockPng(1200, 1200);
      const uploaded = dispatchToolCall("media.uploadMedia", {
        filename: "square-tin.png",
        base64_data: png.toString("base64"),
        alt_text: "Square tea caddy",
      }) as any;

      // 3. Associate with product
      const assoc = dispatchToolCall("media.associateMedia", {
        media_id: uploaded.asset.id,
        entity_type: "product",
        entity_id: prod.id,
      }) as any;

      expect(assoc.success).toBe(true);
      expect(assoc.associated).toBe(true);
      expect(assoc.required_dimensions).toEqual(
        expect.objectContaining({
          recommended_width: 1200,
          recommended_height: 1200,
          aspect_ratio: "1:1",
          min_width: 800,
        })
      );
      expect(assoc.asset_dimensions).toEqual({ width: 1200, height: 1200 });
      expect(assoc.dimension_match.status).toBe("optimal");
    });
  });

  // -------------------------------------------------------------------------
  // 6. Entity Upsert Tools Return Required Dimensions
  // -------------------------------------------------------------------------
  describe("6. Entity Upsert Tools Return Required Dimensions", () => {
    it("admin.upsertSitePlacement returns required dimensions for section key", () => {
      const hero = dispatchToolCall("admin.upsertSitePlacement", {
        section_key: "home_hero",
        title: "Spring Harvest",
        image_url: "/uploads/hero.jpg",
      }) as any;
      expect(hero.placement.section_key).toBe("home_hero");
      expect(hero.required_dimensions.recommended_width).toBe(1920);
      expect(hero.required_dimensions.recommended_height).toBe(800);
      expect(hero.required_dimensions.aspect_ratio).toContain("2.4:1");

      const story = dispatchToolCall("admin.upsertSitePlacement", {
        section_key: "home_story",
        title: "Bento Plantation Story",
        image_url: "/uploads/story.jpg",
      }) as any;
      expect(story.required_dimensions.recommended_width).toBe(1200);
      expect(story.required_dimensions.recommended_height).toBe(800);
      expect(story.required_dimensions.aspect_ratio).toBe("3:2");
    });

    it("admin.upsertProductImage returns required 1:1 dimensions", () => {
      const prodImg = dispatchToolCall("admin.upsertProductImage", {
        product_id: 1,
        url: "/uploads/sample-tea.jpg",
        alt_text: "Sample tea cup",
      }) as any;
      expect(prodImg.required_dimensions.recommended_width).toBe(1200);
      expect(prodImg.required_dimensions.aspect_ratio).toBe("1:1");
    });

    it("admin.upsertSlider returns required 2.4:1 / 16:9 banner dimensions", () => {
      const slider = dispatchToolCall("admin.upsertSlider", {
        title: "Autumn Moonlight Flush",
        image_url: "/uploads/autumn.jpg",
      }) as any;
      expect(slider.required_dimensions.recommended_width).toBe(1920);
      expect(slider.required_dimensions.recommended_height).toBe(800);
    });

    it("admin.upsertCategory returns required cover dimensions", () => {
      const cat = dispatchToolCall("admin.upsertCategory", {
        slug: "dim-cat-white",
        name: "White Teas",
        cover_image_url: "/uploads/white-cover.jpg",
      }) as any;
      expect(cat.required_dimensions.recommended_width).toBe(1200);
      expect(cat.required_dimensions.recommended_height).toBe(800);
    });

    it("blog.upsertBlogPost returns required 16:9 article dimensions", () => {
      const blog = dispatchToolCall("blog.upsertBlogPost", {
        slug: "dim-blog-first-flush",
        title: "The Wonder of First Flush",
        content: "Every spring in Darjeeling...",
        cover_image_url: "/uploads/first-flush.jpg",
      }) as any;
      expect(blog.required_dimensions.recommended_width).toBe(1200);
      expect(blog.required_dimensions.recommended_height).toBe(675);
    });
  });

  // -------------------------------------------------------------------------
  // 7. MCP Resources Return Dimensions and Specifications
  // -------------------------------------------------------------------------
  describe("7. MCP Resources Dimension Reporting", () => {
    it("tea://media/requirements static resource returns complete specs", () => {
      const res = dispatchResourceRead("tea://media/requirements");
      expect(res.contents).toHaveLength(1);
      const data = JSON.parse(res.contents[0].text);
      expect(data.slots.length).toBeGreaterThanOrEqual(5);
      expect(data.general_rules.max_file_size_mb).toBe(5);
    });

    it("tea://site-placements/{section} returns placement with required dimensions", () => {
      const res = dispatchResourceRead("tea://site-placements/home_hero");
      const data = JSON.parse(res.contents[0].text);
      expect(data.section_key).toBe("home_hero");
      expect(data.required_dimensions.recommended_width).toBe(1920);
      expect(data.required_dimensions.recommended_height).toBe(800);
    });

    it("tea://media/{id} returns asset with dimensions and compatible targets", () => {
      // Create asset
      const png = createMockPng(1920, 800);
      const uploaded = dispatchToolCall("media.uploadMedia", {
        filename: "hero-landscape.png",
        base64_data: png.toString("base64"),
        alt_text: "High mountain sunrise",
      }) as any;

      const res = dispatchResourceRead(`tea://media/${uploaded.asset.id}`);
      const data = JSON.parse(res.contents[0].text);
      expect(data.dimensions.width).toBe(1920);
      expect(data.dimensions.height).toBe(800);
      expect(data.compatible_targets.some((c: any) => c.slot === "slider")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Autocomplete Completion
  // -------------------------------------------------------------------------
  describe("8. Contextual Autocomplete", () => {
    it("completes entity_type and section_key targets", () => {
      const entityComp = dispatchCompletion(null, { name: "entity_type", value: "pro" });
      expect(entityComp.completion.values).toContain("product");

      const sectionComp = dispatchCompletion(null, { name: "section_key", value: "home" });
      expect(sectionComp.completion.values).toContain("home_hero");
    });
  });
});
