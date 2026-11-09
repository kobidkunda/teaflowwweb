import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { POST as publicProductsPOST } from "@/app/api/products/route";
import { POST as adminProductsPOST } from "@/app/api/admin/products/route";
import { PUT as adminProductPUT, GET as adminProductGET } from "@/app/api/admin/products/[id]/route";
import { dispatchToolCall } from "@/lib/mcp";

describe("Live ₹199 Pricing & Minimal Product Creation Suite", () => {
  let env: TestEnv;
  let authCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  it("POST /api/products allows minimal product creation with price: 199", async () => {
    const payload = {
      name: "Public Quick Flush",
      price: 199,
    };
    const req = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await publicProductsPOST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.product.name).toBe("Public Quick Flush");
    expect(body.product.price).toBe(199);
    expect(body.product.price_paise).toBe(19900);
    expect(body.product.slug).toBe("public-quick-flush");
  });

  it("POST /api/admin/products allows minimal product creation with price: 199", async () => {
    const payload = {
      name: "Admin Quick Green",
      price: 199,
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
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe("admin-quick-green");
    expect(body.price).toBe(199);
    expect(body.price_paise).toBe(19900);
  });

  it("PUT /api/admin/products/[id] allows direct price editing", async () => {
    // 1. Create a product first
    const createReq = new Request("http://localhost/api/admin/products", {
      method: "POST",
      headers: {
        Cookie: authCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Price Editable Tea", price: 749 }),
    });
    const createRes = await adminProductsPOST(createReq);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const productId = created.id;

    // 2. Update price to 199
    const updateReq = new Request(`http://localhost/api/admin/products/${productId}`, {
      method: "PUT",
      headers: {
        Cookie: authCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ price: 199 }),
    });
    const updateRes = await adminProductPUT(updateReq, {
      params: Promise.resolve({ id: String(productId) }),
    });
    expect(updateRes.status).toBe(200);

    // 3. Verify updated product has price: 199
    const getReq = new Request(`http://localhost/api/admin/products/${productId}`, {
      headers: { Cookie: authCookie },
    });
    const getRes = await adminProductGET(getReq, {
      params: Promise.resolve({ id: String(productId) }),
    });
    const got = await getRes.json();
    expect(got.product.price).toBe(199);
    expect(got.product.price_paise).toBe(19900);
    expect(got.product.variants[0].price_paise).toBe(19900);
  });

  it("MCP admin.upsertProduct creates and updates products with direct price", () => {
    // Create minimal
    const res = dispatchToolCall("admin.upsertProduct", {
      name: "MCP 199 Fresh Tea",
      price: 199,
    }) as { id: number; slug: string; price: number; price_paise: number };

    expect(res.id).toBeGreaterThan(0);
    expect(res.price).toBe(199);
    expect(res.price_paise).toBe(19900);

    // Update price
    const updated = dispatchToolCall("admin.upsertProduct", {
      slug: res.slug,
      price: 249,
    }) as { price: number; price_paise: number };

    expect(updated.price).toBe(249);
    expect(updated.price_paise).toBe(24900);
  });
});
