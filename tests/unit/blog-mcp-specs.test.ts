import { describe, it, expect } from "vitest";
import { analyzeBlogSpecs } from "@/lib/blogs";
import { dispatchToolCall, listToolDefinitions } from "@/lib/mcp";

describe("Blog Redesign & MCP Specs Verification", () => {
  it("registers all blog tools and media.uploadMedia in MCP", () => {
    const tools = listToolDefinitions();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("blog.listBlogPosts");
    expect(toolNames).toContain("blog.getBlogPost");
    expect(toolNames).toContain("blog.upsertBlogPost");
    expect(toolNames).toContain("blog.createBlogPost");
    expect(toolNames).toContain("blog.updateBlogPost");
    expect(toolNames).toContain("blog.deleteBlogPost");
    expect(toolNames).toContain("media.uploadMedia");
  });

  it("analyzes rich blog content and returns detailed specs, widgets, and SEO metrics", () => {
    const sampleArticle = `
# Understanding High-Elevation Terroir

High-elevation clonal bushes develop intricate aroma volatiles.

## Terroir Comparison

Elevation directly impacts daily temperature differentials.

\`\`\`chart
{
  "type": "bar",
  "title": "Terroir Elevation (ft)",
  "data": [
    {"label": "Assam", "value": 600},
    {"label": "Darjeeling Valley", "value": 3500},
    {"label": "High Terroir", "value": 6800}
  ],
  "unit": "ft"
}
\`\`\`

## Sensory Radar Cupping Profile

\`\`\`tasting-radar
{
  "title": "Sensory Cupping Wheel",
  "scores": {
    "floral": 5,
    "fruity": 4,
    "malty": 2,
    "body": 3,
    "sweetness": 4,
    "earthy": 1
  }
}
\`\`\`

## Featured Garden Tea Pairing

\`\`\`product
{
  "slug": "darjeeling-first-flush",
  "highlight": "Artisanal Spring Lot"
}
\`\`\`

## Steeping Parameters

\`\`\`steep-guide
{
  "title": "Gongfu Ritual",
  "temp_c": 92,
  "time_seconds": 180,
  "dose_g": 2.5,
  "water_ml": 200,
  "steeps": 3,
  "tips": "Preheat vessel with boiling water."
}
\`\`\`

> [!TIP]
> Never brew high-grown orthodox teas with rapid boiling water.
    `.trim();

    const specs = analyzeBlogSpecs(sampleArticle, {
      title: "Understanding High-Elevation Terroir & Spring Volatiles",
      seo_title: "Understanding High-Elevation Terroir & Spring Volatiles",
      seo_description: "Explore how high-altitude Himalayan terroirs shape delicate floral notes in orthodox spring teas.",
      cover_image_url: "/uploads/sample-cover.jpg",
    });

    // Verify reading metrics
    expect(specs.reading_metrics.word_count).toBeGreaterThan(30);
    expect(specs.reading_metrics.reading_time_minutes).toBeGreaterThanOrEqual(1);

    // Verify headings outline
    expect(specs.headings_outline.length).toBeGreaterThanOrEqual(3);
    expect(specs.headings_outline[0].text).toContain("Understanding High-Elevation Terroir");

    // Verify detected widgets
    expect(specs.detected_widgets.charts_count).toBe(1);
    expect(specs.detected_widgets.tasting_radars_count).toBe(1);
    expect(specs.detected_widgets.products_count).toBe(1);
    expect(specs.detected_widgets.steep_guides_count).toBe(1);
    expect(specs.detected_widgets.product_slugs).toContain("darjeeling-first-flush");

    // Verify cover image specs
    expect(specs.cover_image.recommended_dimensions.aspect_ratio).toBe("16:9");
    expect(specs.cover_image.recommended_dimensions.width).toBe(1200);
    expect(specs.cover_image.status).toBe("valid");

    // Verify SEO analysis
    expect(specs.seo_analysis.score_out_of_100).toBeGreaterThanOrEqual(75);
    expect(specs.seo_analysis.title_status).toBe("optimal");
    expect(specs.seo_analysis.description_status).toBe("optimal");

    // Verify syntax guide is populated
    expect(specs.widget_syntax_guide.chart).toContain("```chart");
    expect(specs.widget_syntax_guide.product).toContain("```product");
    expect(specs.widget_syntax_guide.steep_guide).toContain("```steep-guide");
  });

  it("performs 100% MCP read and write cycle for blog posts with detailed specs", async () => {
    // 1. Create a test post via MCP
    const testSlug = `test-mcp-dossier-${Date.now()}`;
    const createRes = dispatchToolCall("blog.createBlogPost", {
      title: "Test MCP Editorial Guide",
      slug: testSlug,
      content: "# Heading 1\n\nProse content.\n\n```chart\n{\"type\": \"bar\", \"title\": \"Altitude\", \"data\": [{\"label\": \"A\", \"value\": 100}]}\n```",
      summary: "Detailed test article summary for verifying MCP write capabilities.",
      status: "draft",
    }) as { post: { id: number; slug: string }; specs: { detected_widgets: { charts_count: number } } };

    const createdPost = createRes.post;
    const createdSpecs = createRes.specs;

    expect(createdPost.slug).toBe(testSlug);
    expect(createdSpecs.detected_widgets.charts_count).toBe(1);

    // 2. Read back via MCP
    const getRes = dispatchToolCall("blog.getBlogPost", { slugOrId: testSlug }) as {
      post: { id: number; title: string };
      specs: { reading_metrics: { word_count: number } };
    };
    expect(getRes.post.id).toBe(createdPost.id);
    expect(getRes.specs.reading_metrics.word_count).toBeGreaterThan(0);

    // 3. Update via MCP
    const updateRes = dispatchToolCall("blog.updateBlogPost", {
      id: createdPost.id,
      title: "Updated Test MCP Editorial Guide",
      content: "# Updated Heading\n\nUpdated text.\n\n```product\n{\"slug\": \"assam-special\"}\n```",
      summary: "Updated test summary for verifying MCP update capabilities.",
      status: "published",
    }) as { post: { title: string }; specs: { detected_widgets: { products_count: number } } };

    expect(updateRes.post.title).toBe("Updated Test MCP Editorial Guide");
    expect(updateRes.specs.detected_widgets.products_count).toBe(1);

    // 4. Delete via MCP
    const deleteRes = dispatchToolCall("blog.deleteBlogPost", {
      idOrSlug: createdPost.id,
      confirmed: true,
    }) as { deleted: boolean };
    expect(deleteRes.deleted).toBe(true);
  });

  it("supports both Base64 and Binary Buffer image uploads via MCP", async () => {
    // 1. Base64 Upload
    const base64Data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const base64Result = dispatchToolCall("media.uploadMedia", {
      filename: "test-base64.png",
      base64_data: base64Data,
      alt_text: "Test Base64 Image",
    }) as { success: boolean; dimensions: { width: number; height: number } };

    expect(base64Result.success).toBe(true);
    expect(base64Result.dimensions.width).toBe(1);
    expect(base64Result.dimensions.height).toBe(1);

    // 2. Raw Binary Buffer / Byte Array Upload
    // PNG 1x1 binary bytes
    const pngBinaryBytes = [
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196,
      137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 252, 207, 192, 15,
      0, 4, 1, 1, 1, 132, 169, 140, 33, 0, 0, 0, 0, 73, 69, 78,
      68, 174, 66, 96, 130
    ];

    const binaryResult = dispatchToolCall("media.uploadMedia", {
      filename: "test-binary.png",
      binary_data: pngBinaryBytes,
      alt_text: "Test Binary Image",
    }) as { success: boolean; dimensions: { width: number; height: number } };

    expect(binaryResult.success).toBe(true);
    expect(binaryResult.dimensions.width).toBe(1);
    expect(binaryResult.dimensions.height).toBe(1);
  });
});
