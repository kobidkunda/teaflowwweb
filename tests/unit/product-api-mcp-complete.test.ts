import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { POST as publicProductsPOST, GET as publicProductsGET } from "@/app/api/products/route";
import { POST as adminProductsPOST, GET as adminProductsGET } from "@/app/api/admin/products/route";
import { PUT as adminProductPUT, GET as adminProductGET } from "@/app/api/admin/products/[id]/route";
import { dispatchToolCall, listToolDefinitions } from "@/lib/mcp";
import { getDb } from "@/lib/db";
import { getProduct, listAllVariants } from "@/lib/products";
import { GET as openApiGET } from "@/app/api/mcp/openapi/route";
import { POST as toolPOST } from "@/app/api/mcp/tools/[tool]/route";

describe("Product API & MCP 100% Complete Sourcing Parity Suite", () => {
  let env: TestEnv;
  let authCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  // Helper for MCP call
  function mcpCall<T = Record<string, unknown>>(name: string, args: Record<string, unknown>): T {
    return dispatchToolCall(name, args) as T;
  }

  describe("Full product connector contract", () => {
    it("publishes full product fields in OpenAPI without caching the old contract", async () => {
      const res = openApiGET(new Request("http://localhost/api/mcp/openapi"));
      expect(res.headers.get("cache-control")).toBe("no-store");
      const spec = await res.json();
      const operation = spec.paths["/api/mcp/tools/admin.upsertProduct"].post;
      expect(operation.operationId).toBe("admin_upsertProduct");
      expect(operation.requestBody.content["application/json"].schema).toEqual(
        listToolDefinitions().find((tool) => tool.name === "admin.upsertProduct")!.inputSchema,
      );
      expect(operation.requestBody.content["application/json"].schema.properties).toEqual(expect.objectContaining({
        category_id: expect.any(Object), ingredients: expect.any(Object), description: expect.any(Object),
        seo_title: expect.any(Object), seo_description: expect.any(Object), variants: expect.any(Object), images: expect.any(Object),
      }));
    });

    it("saves full details through the authenticated connector and preserves the gallery and packs on category edits", async () => {
      const db = getDb();
      const first = Number(db.prepare("INSERT INTO categories (slug, name) VALUES (?, ?)").run("connector-bengal", "Bengal Signature Blends").lastInsertRowid);
      const second = Number(db.prepare("INSERT INTO categories (slug, name) VALUES (?, ?)").run("connector-milk", "Everyday Milk Chai").lastInsertRowid);
      const payload = {
        slug: "connector-full-tea", name: "Connector Full Tea", category_id: first,
        description: "Operator supplied product description.", ingredients: ["Black tea", "Cardamom"],
        seo_title: "Connector Full Tea | TeaFloww", seo_description: "Operator supplied SEO description.",
        status: "draft", noindex: true,
        variants: [25, 50, 100, 250].map((grams) => ({
          sku: `CONNECTOR-${grams}G`, grams, price_paise: 19900, stock: 0,
          packaging_format: "loose_leaf_pouch", servings: Math.floor(grams / 2),
        })),
        images: [{ url: "/images/connector.jpg", alt_text: "Product pack", is_primary: 1 }],
      };
      const call = (body: unknown, authorized = true) => toolPOST(new Request("http://localhost/api/mcp/tools/admin.upsertProduct", {
        method: "POST", headers: { "Content-Type": "application/json", ...(authorized ? { Authorization: `Bearer ${process.env.MCP_TOKEN}` } : {}) },
        body: JSON.stringify(body),
      }), { params: Promise.resolve({ tool: "admin.upsertProduct" }) });
      expect((await call(payload, false)).status).toBe(401);
      const res = await call(payload);
      expect(res.status).toBe(200);
      const created = await res.json();
      const id = created.id;
      const packs = db.prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY id").all(id);
      const gallery = db.prepare("SELECT * FROM product_images WHERE product_id = ?").all(id);
      expect(packs).toHaveLength(4);
      expect(gallery).toHaveLength(1);
      expect(db.prepare("SELECT ingredients, seo_title, noindex FROM products WHERE id = ?").get(id)).toMatchObject({
        ingredients: "Black tea, Cardamom", seo_title: payload.seo_title, noindex: 1,
      });
      expect((await call({ id, category_id: second })).status).toBe(200);
      expect(db.prepare("SELECT category_id, category FROM products WHERE id = ?").get(id)).toMatchObject({ category_id: second, category: "Everyday Milk Chai" });
      expect((await call({ id, category: "connector-bengal" })).status).toBe(200);
      expect(db.prepare("SELECT category_id, category FROM products WHERE id = ?").get(id)).toMatchObject({ category_id: first, category: "Bengal Signature Blends" });
      expect((await call({ id, category_id: null, seo_title: null, seo_description: null })).status).toBe(200);
      expect(db.prepare("SELECT category_id, category, seo_title, seo_description FROM products WHERE id = ?").get(id)).toMatchObject({ category_id: null, category: "", seo_title: null, seo_description: null });
      expect(db.prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY id").all(id)).toEqual(packs);
      expect(db.prepare("SELECT * FROM product_images WHERE product_id = ?").all(id)).toEqual(gallery);
      expect((await call({ id, category_id: -1 })).status).toBe(400);
      expect((await call({ id, category_id: 999999 })).status).toBe(404);
      expect((await call([])).status).toBe(400);
      expect(db.prepare("SELECT description FROM products WHERE id = ?").get(id)).toMatchObject({ description: payload.description });
    });
  });

  describe("1. Public Product API (/api/products)", () => {
    it("accepts complete product details including category, ingredients, description, verified_origin, status, price, inventory without fictional defaults", async () => {
      const payload = {
        name: "Artisan Ilam Silver Tips",
        slug: "artisan-ilam-silver-tips",
        category: "White Tea",
        ingredients: "100% Hand-harvested Camellia sinensis tips",
        description: "Rare silver needle tips sun-withered in the misty high mountains of eastern Nepal.",
        verified_origin: "Mai Pokhari, Ilam, Eastern Nepal (Elevation: 2,150m)",
        status: "draft",
        price: 450,
        inventory: 35,
      };

      const req = new Request("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await publicProductsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      const p = data.product;

      expect(p.slug).toBe("artisan-ilam-silver-tips");
      expect(p.name).toBe("Artisan Ilam Silver Tips");
      expect(p.category).toBe("White Tea");
      expect(p.ingredients).toBe("100% Hand-harvested Camellia sinensis tips");
      expect(p.description).toBe("Rare silver needle tips sun-withered in the misty high mountains of eastern Nepal.");
      expect(p.verified_origin).toBe("Mai Pokhari, Ilam, Eastern Nepal (Elevation: 2,150m)");
      expect(p.status).toBe("draft");
      expect(p.price).toBe(450);
      expect(p.price_paise).toBe(45000);
      expect(p.inventory).toBe(35);
      // Ensure no fictional estate or flush was injected
      expect(p.estate).not.toContain("Risheehat");
      expect(p.flush).not.toContain("First Flush");
    });

    it("GET /api/products isolates draft products from public view by default and supports ?status=all", async () => {
      // Default GET (published only)
      const reqPub = new Request("http://localhost/api/products", { method: "GET" });
      const resPub = await publicProductsGET(reqPub);
      expect(resPub.status).toBe(200);
      const pubData = await resPub.json();
      const foundInPublic = pubData.products.some((p: { slug: string }) => p.slug === "artisan-ilam-silver-tips");
      expect(foundInPublic).toBe(false);

      // GET with ?status=all (or ?status=draft)
      const reqAll = new Request("http://localhost/api/products?status=all", { method: "GET" });
      const resAll = await publicProductsGET(reqAll);
      expect(resAll.status).toBe(200);
      const allData = await resAll.json();
      const foundInAll = allData.products.some((p: { slug: string }) => p.slug === "artisan-ilam-silver-tips");
      expect(foundInAll).toBe(true);

      const reqDraft = new Request("http://localhost/api/products?status=draft", { method: "GET" });
      const resDraft = await publicProductsGET(reqDraft);
      expect(resDraft.status).toBe(200);
      const draftData = await resDraft.json();
      const foundInDraft = draftData.products.some((p: { slug: string }) => p.slug === "artisan-ilam-silver-tips");
      expect(foundInDraft).toBe(true);
    });
  });

  describe("2. Admin Product API (/api/admin/products & [id])", () => {
    let createdAdminProductId: number;
    const adminSlug = `wild-forest-smoked-${Date.now()}`;

    it("POST /api/admin/products creates product with ingredients, verified_origin, draft status, price, inventory", async () => {
      const payload = {
        name: "Wild Forest Smoked Black",
        slug: adminSlug,
        category: "Black Tea",
        ingredients: "Pine-smoked whole leaf black tea",
        description: "Naturally pine-smoked over local cedarwood in the Himalayan foothills.",
        verified_origin: "Temi, South Sikkim, GI Registered (Elevation: 1,800m)",
        status: "draft",
        price: 320,
        inventory: 60,
      };

      const req = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: {
          Cookie: authCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const res = await adminProductsPOST(req);
      const body = await res.json();
      expect(res.status, JSON.stringify(body)).toBe(201);
      expect(body.slug).toBe(adminSlug);
      expect(body.ingredients).toBe("Pine-smoked whole leaf black tea");
      expect(body.verified_origin).toBe("Temi, South Sikkim, GI Registered (Elevation: 1,800m)");
      expect(body.status).toBe("draft");
      expect(body.price).toBe(320);
      expect(body.price_paise).toBe(32000);
      expect(body.inventory).toBe(60);

      createdAdminProductId = body.id;
      expect(createdAdminProductId).toBeGreaterThan(0);
    });

    it("PUT /api/admin/products/[id] updates ingredients, verified_origin, publishes status, and syncs price/inventory", async () => {
      const updatePayload = {
        name: "Wild Forest Smoked Black Reserve",
        slug: adminSlug,
        ingredients: "Pine-smoked wild Camellia sinensis leaves & juniper berries",
        description: "Updated reserve edition with juniper wood cure.",
        verified_origin: "Temi, South Sikkim, Estate Certified",
        status: "published",
        price: 380,
        inventory: 45,
      };

      const req = new Request(`http://localhost/api/admin/products/${createdAdminProductId}`, {
        method: "PUT",
        headers: {
          Cookie: authCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      const res = await adminProductPUT(req, { params: Promise.resolve({ id: String(createdAdminProductId) }) });
      expect(res.status).toBe(200);

      // Verify via GET
      const getReq = new Request(`http://localhost/api/admin/products/${createdAdminProductId}`, {
        method: "GET",
        headers: { Cookie: authCookie },
      });
      const getRes = await adminProductGET(getReq, { params: Promise.resolve({ id: String(createdAdminProductId) }) });
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      const p = getBody.product;

      expect(p.name).toBe("Wild Forest Smoked Black Reserve");
      expect(p.ingredients).toBe("Pine-smoked wild Camellia sinensis leaves & juniper berries");
      expect(p.verified_origin).toBe("Temi, South Sikkim, Estate Certified");
      expect(p.status).toBe("published");
      expect(p.price).toBe(380);
      expect(p.price_paise).toBe(38000);
      expect(p.inventory).toBe(45);
    });

    it("GET /api/admin/products supports status filter query (?status=draft, ?status=published, ?status=all)", async () => {
      const req = new Request("http://localhost/api/admin/products?status=all", {
        headers: { Cookie: authCookie },
      });
      const res = await adminProductsGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.products.length).toBeGreaterThan(0);
    });
  });

  describe("3. MCP Catalog 100% Parity (admin.upsertProduct & variant/image tools)", () => {
    it("admin.upsertProduct creates a complete product with ingredients, verified_origin, draft status, price, inventory", () => {
      const result = mcpCall<{
        id: number;
        slug: string;
        price: number;
        price_paise: number;
        inventory: number;
      }>("admin.upsertProduct", {
        name: "MCP Organic Lavender Earl Grey",
        slug: "mcp-organic-lavender-earl-grey",
        category: "Flavoured Tea",
        ingredients: "Organic orthodox black tea, French culinary lavender blossoms, natural bergamot oil",
        description: "Soothing fusion of high-grown black tea and fragrant lavender.",
        verified_origin: "Nilgiri Blue Mountains, Tamil Nadu (Elevation: 1,900m)",
        status: "draft",
        price: 299,
        inventory: 80,
      });

      expect(result.id).toBeGreaterThan(0);
      expect(result.slug).toBe("mcp-organic-lavender-earl-grey");
      expect(result.price).toBe(299);
      expect(result.price_paise).toBe(29900);
      expect(result.inventory).toBe(80);

      // Verify via store.getProduct
      const fetched = mcpCall<{
        product: {
          slug: string;
          ingredients?: string;
          verified_origin?: string;
          status: string;
          price: number;
          inventory: number;
          variants: Array<{ sku: string; price_paise: number; stock: number }>;
        };
      }>("store.getProduct", { slug: "mcp-organic-lavender-earl-grey" });

      expect(fetched.product.slug).toBe("mcp-organic-lavender-earl-grey");
      expect(fetched.product.ingredients).toBe("Organic orthodox black tea, French culinary lavender blossoms, natural bergamot oil");
      expect(fetched.product.verified_origin).toBe("Nilgiri Blue Mountains, Tamil Nadu (Elevation: 1,900m)");
      expect(fetched.product.status).toBe("draft");
      expect(fetched.product.price).toBe(299);
      expect(fetched.product.inventory).toBe(80);
      expect(fetched.product.variants.length).toBeGreaterThanOrEqual(1);
    });

    it("admin.upsertProduct updates an existing product by slug, changing ingredients, status, price, and inventory", () => {
      const updated = mcpCall<{
        slug: string;
        price: number;
        price_paise: number;
        inventory: number;
      }>("admin.upsertProduct", {
        slug: "mcp-organic-lavender-earl-grey",
        ingredients: "Organic orthodox black tea, French lavender, Sicilian bergamot oil, cornflower petals",
        status: "published",
        price: 349,
        inventory: 120,
      });

      expect(updated.price).toBe(349);
      expect(updated.price_paise).toBe(34900);
      expect(updated.inventory).toBe(120);

      const fetched = mcpCall<{
        product: {
          ingredients?: string;
          status: string;
          price: number;
          inventory: number;
        };
      }>("store.getProduct", { slug: "mcp-organic-lavender-earl-grey" });

      expect(fetched.product.ingredients).toBe("Organic orthodox black tea, French lavender, Sicilian bergamot oil, cornflower petals");
      expect(fetched.product.status).toBe("published");
      expect(fetched.product.price).toBe(349);
      expect(fetched.product.inventory).toBe(120);
    });

    it("admin.upsertProduct accepts direct variants and images arrays", () => {
      const createdWithArrays = mcpCall<{ id: number; slug: string }>("admin.upsertProduct", {
        name: "MCP Multi-Format Darjeeling",
        slug: "mcp-multi-format-darjeeling",
        category: "Black Tea",
        ingredients: "100% Pure Darjeeling Orthodox Black Tea",
        verified_origin: "Darjeeling, West Bengal, India",
        status: "published",
        variants: [
          { sku: "MCP-MFD-100", grams: 100, price_paise: 39900, stock: 40, packaging_format: "loose_leaf_pouch" },
          { sku: "MCP-MFD-250", grams: 250, price_paise: 89900, stock: 25, packaging_format: "luxury_tin" },
        ],
        images: [
          { url: "/images/mcp-mfd-1.jpg", alt_text: "Front pouch", is_primary: 1 },
          { url: "/images/mcp-mfd-2.jpg", alt_text: "Dry leaf close up", is_primary: 0 },
        ],
      });

      expect(createdWithArrays.id).toBeGreaterThan(0);

      const fetched = mcpCall<{
        product: {
          variants: Array<{ sku: string; price_paise: number; stock: number }>;
          images: Array<{ url: string; alt_text: string }>;
        };
      }>("store.getProduct", { slug: "mcp-multi-format-darjeeling" });

      expect(fetched.product.variants.length).toBe(2);
      expect(fetched.product.variants[0].sku).toBe("MCP-MFD-100");
      expect(fetched.product.variants[1].sku).toBe("MCP-MFD-250");
      expect(fetched.product.images.length).toBe(2);
    });

    it("admin.upsertVariant supports product_slug, price in INR, and inventory alias for stock", () => {
      const newVar = mcpCall<{ id: number; sku: string; price_paise: number; stock: number }>("admin.upsertVariant", {
        product_slug: "mcp-multi-format-darjeeling",
        sku: "MCP-MFD-500",
        grams: 500,
        price: 1599, // INR
        inventory: 15, // alias for stock
      });

      expect(newVar.id).toBeGreaterThan(0);
      expect(newVar.sku).toBe("MCP-MFD-500");
      expect(newVar.price_paise).toBe(159900);
      expect(newVar.stock).toBe(15);

      const fetched = mcpCall<{
        product: {
          variants: Array<{ sku: string }>;
        };
      }>("store.getProduct", { slug: "mcp-multi-format-darjeeling" });

      expect(fetched.product.variants.some((v) => v.sku === "MCP-MFD-500")).toBe(true);
    });

    it("admin.upsertProductImage supports product_slug", () => {
      const imgRes = mcpCall<{ id: number }>("admin.upsertProductImage", {
        product_slug: "mcp-multi-format-darjeeling",
        url: "/images/mcp-mfd-liquor.jpg",
        alt_text: "Golden amber cup infusion",
      });

      expect(imgRes.id).toBeGreaterThan(0);
    });
  });

  describe("4. Variant Original MRP parity + full admin-form field round-trip via MCP", () => {
    const SLUG = "mcp-parity-rose-iced";
    let categoryId = 0;
    let productId = 0;

    it("seeds a category for assignment", () => {
      const info = getDb()
        .prepare("INSERT INTO categories (slug, name) VALUES (?, ?)")
        .run("mcp-parity-iced", "MCP Parity Iced Teas");
      categoryId = Number(info.lastInsertRowid);
      expect(categoryId).toBeGreaterThan(0);
    });

    it("connector schemas expose every admin-form field incl. variant MRP", () => {
      const defs = listToolDefinitions();
      const upsert = defs.find((d) => d.name === "admin.upsertProduct");
      const variant = defs.find((d) => d.name === "admin.upsertVariant");
      expect(upsert).toBeDefined();
      expect(variant).toBeDefined();
      const productProps = (upsert!.inputSchema as { properties: Record<string, unknown> }).properties;
      for (const field of [
        "name", "slug", "category", "category_id", "status", "ingredients", "featured",
        "description", "tasting_notes", "aroma_tags",
        "floral", "fruity", "malty", "body", "sweetness", "earthy",
        "dry_leaf_grade", "dry_leaf_appearance", "dry_leaf_aroma",
        "liquor_hue_hex", "liquor_hue_name", "liquor_clarity", "liquor_body",
        "wet_leaf_aroma", "wet_leaf_oxidation",
        "brew_temp", "brew_seconds", "leaf_dose_grams", "water_ml", "steep_count", "steep_instructions",
        "origin", "verified_origin", "estate", "flush", "harvest_date",
        "elevation_feet", "elevation_display", "lot_number", "cultivar", "estate_story",
        "seo_title", "seo_description", "canonical_override", "noindex",
        "variants", "images",
      ]) {
        expect(productProps[field], `product field ${field}`).toBeDefined();
      }
      const variantProps = (variant!.inputSchema as { properties: Record<string, unknown> }).properties;
      for (const field of ["sku", "grams", "price_paise", "compare_at_price_paise", "mrp_inr", "mrp", "stock", "packaging_format", "servings"]) {
        expect(variantProps[field], `variant field ${field}`).toBeDefined();
      }
      const variantItems = (productProps.variants as { items: { properties: Record<string, unknown> } }).items.properties;
      expect(variantItems.compare_at_price_paise).toBeDefined();
      expect(variantItems.mrp_inr).toBeDefined();
    });

    it("admin.createProduct persists every admin-form field incl. 4 variants with MRP + gallery", () => {
      const created = mcpCall<{ id: number; slug: string }>("admin.createProduct", {
        name: "MCP Parity Rose Iced Black Tea",
        slug: SLUG,
        category_id: categoryId,
        status: "draft",
        ingredients: "Black tea, rose petals, hibiscus",
        featured: true,
        description: "## Iced linen-fresh pour\nSingle-estate summer black tea cold-steeped with rose.",
        tasting_notes: "Rosewater, wild berry, brisk black tea finish",
        aroma_tags: ["rose", "hibiscus", "berry"],
        floral: 4, fruity: 5, malty: 1, body: 3, sweetness: 4, earthy: 0,
        dry_leaf_grade: "FTGFOP",
        dry_leaf_appearance: "Dark twisted leaf with pink petals",
        dry_leaf_aroma: "Rose garden after rain",
        liquor_hue_hex: "#a83a4e",
        liquor_hue_name: "Rosé Ruby",
        liquor_clarity: "Brilliant",
        liquor_body: "Silky light",
        wet_leaf_aroma: "Stewed berries",
        wet_leaf_oxidation: "Full 95%",
        brew_temp: 95, brew_seconds: 300, leaf_dose_grams: 5, water_ml: 1000, steep_count: 1,
        steep_instructions: "Steep hot 5 minutes, pour over ice (or cold-steep overnight).",
        origin: "Dooars, West Bengal, India",
        verified_origin: "Dooars estate lot, verified garden invoice",
        estate: "Parity Estate",
        flush: "Summer Flush",
        harvest_date: "June 2026",
        elevation_feet: 450,
        elevation_display: "300 – 600 ft",
        lot_number: "PAR-DJ-06/26",
        cultivar: "P312",
        estate_story: "A young Dooars garden replanted for iced-tea cultivars.",
        seo_title: "Rose Iced Black Tea | TeaFloww",
        seo_description: "Cold-steeped Dooars black tea with rose and hibiscus. Single-estate summer lot.",
        canonical_override: "",
        noindex: 0,
        variants: [
          { sku: "MCP-ROSE-25G", grams: 25, price_paise: 9900, compare_at_price_paise: 12900, stock: 60, packaging_format: "loose_leaf_pouch", servings: 12 },
          { sku: "MCP-ROSE-50G", grams: 50, price_paise: 18900, mrp_inr: 229, stock: 40, packaging_format: "luxury_tin", servings: 25 },
          { sku: "MCP-ROSE-100G", grams: 100, price_paise: 34900, mrp: 399, stock: 30, packaging_format: "loose_leaf_pouch", servings: 50 },
          { sku: "MCP-ROSE-250G", grams: 250, price_paise: 79900, stock: 10, packaging_format: "loose_leaf_pouch", servings: 125 },
        ],
        images: [
          { url: "/images/mcp-rose-1.jpg", alt_text: "Rose iced tea pouch front", sort_order: 0, is_primary: 1 },
          { url: "/images/mcp-rose-2.jpg", alt_text: "Ruby liquor in tall glass", sort_order: 1, is_primary: 0 },
        ],
      });
      expect(created.id).toBeGreaterThan(0);
      productId = created.id;

      const row = getDb().prepare("SELECT * FROM products WHERE id = ?").get(productId) as Record<string, unknown>;
      expect(row.slug).toBe(SLUG);
      expect(row.category_id).toBe(categoryId);
      expect(row.category).toBe("MCP Parity Iced Teas");
      expect(row.status).toBe("draft");
      expect(row.ingredients).toBe("Black tea, rose petals, hibiscus");
      expect(row.featured).toBe(1);
      expect(String(row.description)).toContain("cold-steeped");
      expect(String(row.tasting_notes)).toContain("Rosewater");
      expect(row.floral).toBe(4);
      expect(row.fruity).toBe(5);
      expect(row.malty).toBe(1);
      expect(row.body).toBe(3);
      expect(row.sweetness).toBe(4);
      expect(row.earthy).toBe(0);
      expect(JSON.parse(String(row.aroma_tags))).toEqual(["rose", "hibiscus", "berry"]);
      expect(row.dry_leaf_grade).toBe("FTGFOP");
      expect(row.liquor_hue_hex).toBe("#a83a4e");
      expect(row.liquor_hue_name).toBe("Rosé Ruby");
      expect(row.wet_leaf_oxidation).toBe("Full 95%");
      expect(row.brew_temp).toBe(95);
      expect(row.brew_seconds).toBe(300);
      expect(row.leaf_dose_grams).toBe(5);
      expect(row.water_ml).toBe(1000);
      expect(row.estate).toBe("Parity Estate");
      expect(row.elevation_feet).toBe(450);
      expect(row.lot_number).toBe("PAR-DJ-06/26");
      expect(row.cultivar).toBe("P312");
      expect(String(row.estate_story)).toContain("iced-tea cultivars");
      expect(row.seo_title).toBe("Rose Iced Black Tea | TeaFloww");
      expect(String(row.seo_description)).toContain("Cold-steeped Dooars");

      const variants = listAllVariants(productId);
      expect(variants).toHaveLength(4);
      const bySku = new Map(variants.map((v) => [v.sku, v]));
      expect(bySku.get("MCP-ROSE-25G")?.compare_at_price_paise).toBe(12900);
      expect(bySku.get("MCP-ROSE-50G")?.compare_at_price_paise).toBe(22900);
      expect(bySku.get("MCP-ROSE-100G")?.compare_at_price_paise).toBe(39900);
      expect(bySku.get("MCP-ROSE-250G")?.compare_at_price_paise).toBeNull();
      expect(bySku.get("MCP-ROSE-50G")?.packaging_format).toBe("luxury_tin");

      const images = getDb().prepare("SELECT url, alt_text, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order").all(productId) as Array<Record<string, unknown>>;
      expect(images).toHaveLength(2);
      expect(images[0].alt_text).toBe("Rose iced tea pouch front");
      expect(images[0].is_primary).toBe(1);

      const mapped = getProduct(productId);
      expect(mapped?.variants).toHaveLength(4);
    });

    it("admin.updateVariant: omitted MRP preserves, null clears, mrp_inr sets, bad values rejected", () => {
      // Price-only touch preserves the stored MRP.
      mcpCall("admin.updateVariant", { sku: "MCP-ROSE-25G", price_paise: 10900 });
      expect(getDb().prepare("SELECT price_paise, compare_at_price_paise FROM variants WHERE sku = ?").get("MCP-ROSE-25G")).toMatchObject({ price_paise: 10900, compare_at_price_paise: 12900 });

      // Stock-only touch preserves price, grams and MRP (no silent resets).
      mcpCall("admin.updateVariant", { sku: "MCP-ROSE-25G", stock: 61 });
      expect(getDb().prepare("SELECT price_paise, grams, stock, compare_at_price_paise FROM variants WHERE sku = ?").get("MCP-ROSE-25G")).toMatchObject({
        price_paise: 10900, grams: 25, stock: 61, compare_at_price_paise: 12900,
      });

      // Explicit null clears the discount badge.
      mcpCall("admin.updateVariant", { sku: "MCP-ROSE-25G", compare_at_price_paise: null });
      expect(getDb().prepare("SELECT compare_at_price_paise FROM variants WHERE sku = ?").get("MCP-ROSE-25G")).toMatchObject({ compare_at_price_paise: null });

      // Rupees alias sets it again.
      mcpCall("admin.updateVariant", { sku: "MCP-ROSE-25G", mrp_inr: 149 });
      expect(getDb().prepare("SELECT compare_at_price_paise FROM variants WHERE sku = ?").get("MCP-ROSE-25G")).toMatchObject({ compare_at_price_paise: 14900 });

      // MRP below price is rejected — nothing changes.
      expect(() => mcpCall("admin.updateVariant", { sku: "MCP-ROSE-25G", compare_at_price_paise: 100 })).toThrow(/Original MRP/);
      expect(getDb().prepare("SELECT compare_at_price_paise FROM variants WHERE sku = ?").get("MCP-ROSE-25G")).toMatchObject({ compare_at_price_paise: 14900 });

      // Garbage MRP is rejected with a precise message.
      expect(() => mcpCall("admin.updateVariant", { sku: "MCP-ROSE-25G", mrp: "a lot" })).toThrow(/Original MRP/);
    });

    it("admin.updateProduct embedded variants preserve omitted MRP and apply new MRP", () => {
      mcpCall("admin.updateProduct", {
        slug: SLUG,
        description: "Updated editorial story, second edition.",
        status: "published",
        variants: [
          { sku: "MCP-ROSE-50G", price_paise: 18900, stock: 41 },
          { sku: "MCP-ROSE-100G", price_paise: 34900, stock: 30, mrp: 379 },
        ],
      });
      const db = getDb();
      expect(db.prepare("SELECT description, status FROM products WHERE id = ?").get(productId)).toMatchObject({
        description: "Updated editorial story, second edition.",
        status: "published",
      });
      // Omitted MRP preserved (was 22900), untouched tasting notes preserved.
      expect(db.prepare("SELECT compare_at_price_paise, stock FROM variants WHERE sku = ?").get("MCP-ROSE-50G")).toMatchObject({ compare_at_price_paise: 22900, stock: 41 });
      expect(db.prepare("SELECT compare_at_price_paise FROM variants WHERE sku = ?").get("MCP-ROSE-100G")).toMatchObject({ compare_at_price_paise: 37900 });
      expect(db.prepare("SELECT tasting_notes FROM products WHERE id = ?").get(productId)).toMatchObject({
        tasting_notes: "Rosewater, wild berry, brisk black tea finish",
      });

      // Embedded MRP below price is rejected for the whole product update.
      expect(() => mcpCall("admin.updateProduct", {
        slug: SLUG,
        variants: [{ sku: "MCP-ROSE-250G", price_paise: 79900, stock: 10, mrp_inr: 10 }],
      })).toThrow(/Original MRP/);
    });

    it("admin.createVariant accepts MRP aliases on new SKUs", () => {
      const v = mcpCall<{ sku: string }>("admin.createVariant", {
        product_slug: SLUG,
        sku: "MCP-ROSE-500G",
        grams: 500,
        price_inr: 1499,
        mrp: 1799,
        stock: 8,
        packaging_format: "loose_leaf_pouch",
      });
      expect(v.sku).toBe("MCP-ROSE-500G");
      expect(getDb().prepare("SELECT price_paise, compare_at_price_paise, stock FROM variants WHERE sku = ?").get("MCP-ROSE-500G")).toMatchObject({
        price_paise: 149900,
        compare_at_price_paise: 179900,
        stock: 8,
      });
    });
  });

  describe("5. Dedicated granular MCP tools for complete sourcing, brewing, leaf profiles, inventory, and publication status", () => {
    const SLUG = "mcp-granular-tool-test";
    let productId = 0;

    beforeAll(() => {
      // Create a test product
      const res = mcpCall<{ id: number }>("admin.createProduct", {
        name: "Granular Tool Parity Tea",
        slug: SLUG,
        category: "Regional Tea Origins",
        price: 199,
        status: "draft",
        variants: [
          { sku: "GTT-100G", grams: 100, price: 199, stock: 0 },
          { sku: "GTT-250G", grams: 250, price: 199, stock: 0 },
        ],
      });
      productId = res.id;
    });

    it("admin.setProductStatus, admin.publishProduct, and admin.draftProduct update status cleanly", () => {
      const db = getDb();

      // Initially draft
      expect(db.prepare("SELECT status FROM products WHERE id = ?").get(productId)).toMatchObject({ status: "draft" });

      // Publish product
      mcpCall("admin.publishProduct", { slug: SLUG });
      expect(db.prepare("SELECT status FROM products WHERE id = ?").get(productId)).toMatchObject({ status: "published" });

      // Draft product
      mcpCall("admin.draftProduct", { slug: SLUG });
      expect(db.prepare("SELECT status FROM products WHERE id = ?").get(productId)).toMatchObject({ status: "draft" });

      // Set custom status (e.g. published, draft, archived)
      mcpCall("admin.setProductStatus", { id: productId, status: "archived" });
      expect(db.prepare("SELECT status FROM products WHERE id = ?").get(productId)).toMatchObject({ status: "archived" });

      mcpCall("admin.setProductStatus", { slug: SLUG, status: "published" });
      expect(db.prepare("SELECT status FROM products WHERE id = ?").get(productId)).toMatchObject({ status: "published" });
    });

    it("admin.updateProductDetails performs comprehensive updates across all sourcing fields", () => {
      const db = getDb();

      mcpCall("admin.updateProductDetails", {
        slug: SLUG,
        status: "published",
        ingredients: "100% Darjeeling Black Tea, Himalayan Lavender, Kashmiri Saffron",
        steeping: {
          temp: "96°C",
          seconds: 200,
          dose: 2.5,
          water: 220,
          steeps: 3,
          guide: "Pour boiling water and steep for 3 minutes 20 seconds.",
        },
        tasting_notes: "Honeyed saffron, delicate lavender, muscatel finish",
        floral: 5,
        sweetness: 4,
        origin: "Mirik Valley, Darjeeling, West Bengal, India",
        estate: "Gopaldhara Tea Estate",
        elevation_feet: 5500,
        stock: 45,
      });

      const updated = db.prepare("SELECT status, ingredients, brew_temp, brew_seconds, leaf_dose_grams, water_ml, steep_count, steep_instructions, tasting_notes, floral, sweetness, origin, estate, elevation_feet FROM products WHERE id = ?").get(productId);
      expect(updated).toMatchObject({
        status: "published",
        ingredients: "100% Darjeeling Black Tea, Himalayan Lavender, Kashmiri Saffron",
        brew_temp: 96,
        brew_seconds: 200,
        leaf_dose_grams: 2.5,
        water_ml: 220,
        steep_count: 3,
        steep_instructions: "Pour boiling water and steep for 3 minutes 20 seconds.",
        tasting_notes: "Honeyed saffron, delicate lavender, muscatel finish",
        floral: 5,
        sweetness: 4,
        origin: "Mirik Valley, Darjeeling, West Bengal, India",
        estate: "Gopaldhara Tea Estate",
        elevation_feet: 5500,
      });

      // Verify all variants got stock updated
      const vars = db.prepare("SELECT stock FROM variants WHERE product_id = ?").all(productId) as Array<{ stock: number }>;
      expect(vars.every((v) => v.stock === 45)).toBe(true);
    });

    it("admin.updateSteepingGuide supports flat fields and nested steeping object", () => {
      const db = getDb();

      // Flat parameters
      mcpCall("admin.updateSteepingGuide", {
        slug: SLUG,
        brew_temp: "92°C",
        brew_seconds: 180,
        leaf_dose_grams: 2.5,
        water_ml: 200,
        steep_count: 3,
        steep_instructions: "Brew with fresh spring water for 3 minutes.",
      });

      expect(db.prepare("SELECT brew_temp, brew_seconds, leaf_dose_grams, water_ml, steep_count, steep_instructions FROM products WHERE id = ?").get(productId)).toMatchObject({
        brew_temp: 92,
        brew_seconds: 180,
        leaf_dose_grams: 2.5,
        water_ml: 200,
        steep_count: 3,
        steep_instructions: "Brew with fresh spring water for 3 minutes.",
      });

      // Nested steeping object
      mcpCall("admin.updateSteepingGuide", {
        slug: SLUG,
        steeping: {
          temp: "95°C",
          seconds: 240,
          dose: 3,
          water: 250,
          steeps: 2,
          guide: "Second infusion can be steeped for 4 minutes.",
        },
      });

      expect(db.prepare("SELECT brew_temp, brew_seconds, leaf_dose_grams, water_ml, steep_count, steep_instructions FROM products WHERE id = ?").get(productId)).toMatchObject({
        brew_temp: 95,
        brew_seconds: 240,
        leaf_dose_grams: 3,
        water_ml: 250,
        steep_count: 2,
        steep_instructions: "Second infusion can be steeped for 4 minutes.",
      });
    });

    it("admin.updateIngredients supports string, array of strings, and array of ingredient objects", () => {
      const db = getDb();

      // 1. Array of string ingredients
      mcpCall("admin.updateIngredients", {
        slug: SLUG,
        ingredients: ["Black Tea", "Cardamom", "Ginger", "Cinnamon"],
      });
      expect(db.prepare("SELECT ingredients FROM products WHERE id = ?").get(productId)).toMatchObject({
        ingredients: "Black Tea, Cardamom, Ginger, Cinnamon",
      });

      // 2. Array of ingredient objects with percentages
      mcpCall("admin.updateIngredients", {
        slug: SLUG,
        ingredients: [
          { ingredient: "Single Estate Darjeeling FTGFOP1", percentage: 85 },
          { name: "Dried Damask Rose Petals", percent: 15 },
        ],
      });
      expect(db.prepare("SELECT ingredients FROM products WHERE id = ?").get(productId)).toMatchObject({
        ingredients: "Single Estate Darjeeling FTGFOP1 (85%), Dried Damask Rose Petals (15%)",
      });

      // 3. Simple text string
      mcpCall("admin.updateIngredients", {
        slug: SLUG,
        ingredients: "100% Pure Camellia Sinensis var. assamica",
      });
      expect(db.prepare("SELECT ingredients FROM products WHERE id = ?").get(productId)).toMatchObject({
        ingredients: "100% Pure Camellia Sinensis var. assamica",
      });
    });

    it("admin.updateSensoryProfile updates tasting notes, aroma tags and cupping scores", () => {
      const db = getDb();

      mcpCall("admin.updateSensoryProfile", {
        slug: SLUG,
        tasting_notes: "Wild orchid, muscatel grape, honeyed apricot with a crisp finish",
        aroma_tags: ["Muscatel", "Orchid", "Honey"],
        floral: 5,
        fruity: 4,
        sweetness: 4,
        body: 3,
        malty: 1,
        earthy: 0,
      });

      expect(db.prepare("SELECT tasting_notes, aroma_tags, floral, fruity, sweetness, body, malty, earthy FROM products WHERE id = ?").get(productId)).toMatchObject({
        tasting_notes: "Wild orchid, muscatel grape, honeyed apricot with a crisp finish",
        aroma_tags: JSON.stringify(["Muscatel", "Orchid", "Honey"]),
        floral: 5,
        fruity: 4,
        sweetness: 4,
        body: 3,
        malty: 1,
        earthy: 0,
      });
    });

    it("admin.updateLeafProfile updates dry leaf, liquor, and wet leaf profiles", () => {
      const db = getDb();

      mcpCall("admin.updateLeafProfile", {
        slug: SLUG,
        dry_leaf_grade: "FTGFOP1 First Flush",
        dry_leaf_appearance: "Crisp wiry dark green and brownish leaves with abundant silver tips",
        dry_leaf_aroma: "Fragrant floral muscatel and fresh spring meadows",
        liquor_hue_hex: "#E59866",
        liquor_hue_name: "Bright Amber Gold",
        liquor_clarity: "Brilliant",
        liquor_body: "Light-to-medium",
        wet_leaf_aroma: "Intense peach and sweet floral bouquet",
        wet_leaf_oxidation: "Lightly oxidized (20%)",
      });

      expect(db.prepare("SELECT dry_leaf_grade, dry_leaf_appearance, dry_leaf_aroma, liquor_hue_hex, liquor_hue_name, liquor_clarity, liquor_body, wet_leaf_aroma, wet_leaf_oxidation FROM products WHERE id = ?").get(productId)).toMatchObject({
        dry_leaf_grade: "FTGFOP1 First Flush",
        dry_leaf_appearance: "Crisp wiry dark green and brownish leaves with abundant silver tips",
        dry_leaf_aroma: "Fragrant floral muscatel and fresh spring meadows",
        liquor_hue_hex: "#E59866",
        liquor_hue_name: "Bright Amber Gold",
        liquor_clarity: "Brilliant",
        liquor_body: "Light-to-medium",
        wet_leaf_aroma: "Intense peach and sweet floral bouquet",
        wet_leaf_oxidation: "Lightly oxidized (20%)",
      });
    });

    it("admin.updateProvenance updates verified estate, origin, and terroir details", () => {
      const db = getDb();

      mcpCall("admin.updateProvenance", {
        slug: SLUG,
        origin: "Darjeeling, West Bengal, India",
        verified_origin: true,
        estate: "Gopaldhara Tea Estate",
        flush: "First Flush 2026",
        harvest_date: "2026-03-15",
        elevation_feet: 5500,
        elevation_display: "5,500 ft",
        lot_number: "EX-02/26",
        cultivar: "AV2 Clonal",
        estate_story: "Single batch harvested from high slopes during early morning mist.",
      });

      expect(db.prepare("SELECT origin, verified_origin, estate, flush, harvest_date, elevation_feet, elevation_display, lot_number, cultivar, estate_story FROM products WHERE id = ?").get(productId)).toMatchObject({
        origin: "Darjeeling, West Bengal, India",
        verified_origin: "Darjeeling, West Bengal, India",
        estate: "Gopaldhara Tea Estate",
        flush: "First Flush 2026",
        harvest_date: "2026-03-15",
        elevation_feet: 5500,
        elevation_display: "5,500 ft",
        lot_number: "EX-02/26",
        cultivar: "AV2 Clonal",
        estate_story: "Single batch harvested from high slopes during early morning mist.",
      });
    });

    it("admin.updateInventory updates stock for single variant or all variants of a product", () => {
      const db = getDb();

      // Update all variants of the product
      mcpCall("admin.updateInventory", {
        slug: SLUG,
        stock: 50,
      });

      const variants = db.prepare("SELECT sku, stock FROM variants WHERE product_id = ?").all(productId) as Array<{ sku: string; stock: number }>;
      expect(variants).toHaveLength(2);
      expect(variants.every((v) => v.stock === 50)).toBe(true);

      // Update specific variant by SKU
      mcpCall("admin.updateInventory", {
        sku: "GTT-100G",
        stock: 75,
      });

      expect(db.prepare("SELECT stock FROM variants WHERE sku = ?").get("GTT-100G")).toMatchObject({
        stock: 75,
      });
      expect(db.prepare("SELECT stock FROM variants WHERE sku = ?").get("GTT-250G")).toMatchObject({
        stock: 50,
      });
    });
  });
});

