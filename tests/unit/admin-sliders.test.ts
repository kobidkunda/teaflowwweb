import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { GET as slidersGET, POST as slidersPOST } from "@/app/api/admin/sliders/route";
import {
  GET as sliderDetailGET,
  PATCH as sliderDetailPATCH,
  DELETE as sliderDetailDELETE,
} from "@/app/api/admin/sliders/[id]/route";
import {
  listSliders,
  getSlider,
  createSlider,
  updateSlider,
  deleteSlider,
  upsertSlider,
} from "@/lib/sliders";

describe("Admin Sliders Module Unit Tests", () => {
  let env: TestEnv;
  let authCookie: string;
  let testSliderId: number;

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Sliders Library CRUD Functions", () => {
    it("creates a slider with createSlider() and retrieves it with getSlider()", () => {
      const created = createSlider({
        title: "Darjeeling Spring Bloom",
        subtitle: "Delicate spring flushes with floral notes.",
        image_url: "/uploads/test_darjeeling_hero.webp",
        cta_label: "Shop Darjeeling",
        cta_href: "/collections/darjeeling",
        sort_order: 10,
        is_active: 1,
        starts_at: null,
        ends_at: null,
      });

      expect(created.id).toBeTypeOf("number");
      expect(created.title).toBe("Darjeeling Spring Bloom");
      expect(created.subtitle).toBe("Delicate spring flushes with floral notes.");
      expect(created.sort_order).toBe(10);
      expect(created.is_active).toBe(1);

      const fetched = getSlider(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe("Darjeeling Spring Bloom");
      testSliderId = created.id;
    });

    it("lists sliders ordered by sort_order", () => {
      createSlider({
        title: "Assam Sunrise Harvest",
        subtitle: "Bold malty morning brew.",
        image_url: "/uploads/test_assam_hero.webp",
        cta_label: "Explore Assam",
        cta_href: "/collections/assam",
        sort_order: 5,
        is_active: 1,
        starts_at: null,
        ends_at: null,
      });

      const all = listSliders({});
      expect(all.length).toBeGreaterThanOrEqual(2);
      // Verify sort order: sort_order 5 should come before 10
      const assamIdx = all.findIndex((s) => s.title === "Assam Sunrise Harvest");
      const darjeelingIdx = all.findIndex((s) => s.title === "Darjeeling Spring Bloom");
      expect(assamIdx).toBeLessThan(darjeelingIdx);
    });

    it("partially updates a slider without overwriting unmentioned fields", () => {
      const updated = updateSlider(testSliderId, {
        title: "Darjeeling First Flush Royal Bloom",
        is_active: 0,
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe("Darjeeling First Flush Royal Bloom");
      expect(updated?.is_active).toBe(0);
      // Unmentioned fields remain intact
      expect(updated?.subtitle).toBe("Delicate spring flushes with floral notes.");
      expect(updated?.sort_order).toBe(10);
      expect(updated?.cta_label).toBe("Shop Darjeeling");
    });

    it("clears scheduling dates when null is passed to updateSlider", () => {
      updateSlider(testSliderId, {
        starts_at: "2026-10-01T00:00:00.000Z",
        ends_at: "2026-11-01T00:00:00.000Z",
      });

      let current = getSlider(testSliderId);
      expect(current?.starts_at).toBe("2026-10-01T00:00:00.000Z");

      // Clear dates
      updateSlider(testSliderId, {
        starts_at: null,
        ends_at: null,
      });

      current = getSlider(testSliderId);
      expect(current?.starts_at).toBeNull();
      expect(current?.ends_at).toBeNull();
    });

    it("supports idempotency key via upsertSlider()", () => {
      const key = "11111111-2222-3333-4444-555555555555";
      const first = upsertSlider({
        title: "Idempotent Hero Slider",
        subtitle: "Testing replay safety",
        image_url: "/images/hero.webp",
        cta_label: "Taste",
        cta_href: "/shop",
        sort_order: 99,
        is_active: 1,
        idempotencyKey: key,
      });
      expect(first.deduped).toBe(false);

      const second = upsertSlider({
        title: "Idempotent Hero Slider",
        subtitle: "Testing replay safety",
        image_url: "/images/hero.webp",
        cta_label: "Taste",
        cta_href: "/shop",
        sort_order: 99,
        is_active: 1,
        idempotencyKey: key,
      });
      expect(second.deduped).toBe(true);
      expect(second.id).toBe(first.id);
    });

    it("creates a slider with dual background (image_url) and foreground (fg_image_url) images", () => {
      const created = createSlider({
        title: "Dual Image Terroir Slider",
        subtitle: "Both mountain background and tea bowl card.",
        image_url: "/images/bg-terroir.webp",
        fg_image_url: "/images/fg-bowl.webp",
        cta_label: "Taste Terroir",
        cta_href: "/tea/terroir",
        sort_order: 12,
        is_active: 1,
      });

      expect(created.id).toBeTypeOf("number");
      expect(created.image_url).toBe("/images/bg-terroir.webp");
      expect(created.fg_image_url).toBe("/images/fg-bowl.webp");

      const fetched = getSlider(created.id);
      expect(fetched?.image_url).toBe("/images/bg-terroir.webp");
      expect(fetched?.fg_image_url).toBe("/images/fg-bowl.webp");

      // Update FG image independently
      const updated = updateSlider(created.id, {
        fg_image_url: "/images/fg-ceremony.webp",
      });
      expect(updated?.fg_image_url).toBe("/images/fg-ceremony.webp");
      expect(updated?.image_url).toBe("/images/bg-terroir.webp"); // Unchanged
    });

    it("deletes a slider via deleteSlider()", () => {
      const temp = createSlider({
        title: "Temporary Slider",
        subtitle: "To be deleted",
        image_url: "/images/temp.webp",
        fg_image_url: "/images/temp-fg.webp",
        cta_label: "Temp",
        cta_href: "/shop",
        sort_order: 100,
        is_active: 1,
      });

      expect(deleteSlider(temp.id)).toBe(true);
      expect(getSlider(temp.id)).toBeNull();
    });
  });

  describe("Sliders API Routes", () => {
    it("rejects unauthorized GET /api/admin/sliders", async () => {
      const req = new Request("http://localhost/api/admin/sliders", { method: "GET" });
      const res = await slidersGET(req);
      expect(res.status).toBe(401);
    });

    it("returns sliders list via authorized GET /api/admin/sliders", async () => {
      const req = new Request("http://localhost/api/admin/sliders", {
        method: "GET",
        headers: { Cookie: authCookie },
      });
      const res = await slidersGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.sliders)).toBe(true);
      expect(data.sliders.length).toBeGreaterThan(0);
    });

    it("creates a new slider via authorized POST /api/admin/sliders", async () => {
      const payload = {
        title: "Kangra Valley Misty Green",
        subtitle: "Hand-rolled orthodox green tea from western Himalayas.",
        image_url: "/uploads/test_kangra_hero.webp",
        cta_label: "Discover Kangra",
        cta_href: "/tea/kangra-green",
        sort_order: 15,
        is_active: 1,
      };

      const req = new Request("http://localhost/api/admin/sliders", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await slidersPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeTypeOf("number");

      // Verify fetched by detail route
      const detailReq = new Request(`http://localhost/api/admin/sliders/${data.id}`, {
        method: "GET",
        headers: { Cookie: authCookie },
      });
      const detailRes = await sliderDetailGET(detailReq, {
        params: Promise.resolve({ id: String(data.id) }),
      });
      expect(detailRes.status).toBe(200);
      const detailData = await detailRes.json();
      expect(detailData.slider.title).toBe("Kangra Valley Misty Green");
      expect(detailData.slider.cta_href).toBe("/tea/kangra-green");
    });

    it("rejects invalid slider creation payload (invalid URL)", async () => {
      const payload = {
        title: "Invalid Slider",
        image_url: "not-a-valid-url-format",
      };

      const req = new Request("http://localhost/api/admin/sliders", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await slidersPOST(req);
      expect(res.status).toBe(400);
    });

    it("partially updates a slider via PATCH /api/admin/sliders/[id]", async () => {
      const patchReq = new Request(`http://localhost/api/admin/sliders/${testSliderId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: 1, sort_order: 2 }),
      });

      const patchRes = await sliderDetailPATCH(patchReq, {
        params: Promise.resolve({ id: String(testSliderId) }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.slider.is_active).toBe(1);
      expect(patchData.slider.sort_order).toBe(2);
    });

    it("creates and patches both BG and FG images via API routes", async () => {
      const postReq = new Request("http://localhost/api/admin/sliders", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "API Dual Image Slider",
          image_url: "/uploads/test_bg1.webp",
          fg_image_url: "/uploads/test_fg1.webp",
          cta_label: "View",
          cta_href: "/shop",
        }),
      });

      const postRes = await slidersPOST(postReq);
      expect(postRes.status).toBe(201);
      const { id } = await postRes.json();

      // Check detail
      const getReq = new Request(`http://localhost/api/admin/sliders/${id}`, {
        method: "GET",
        headers: { Cookie: authCookie },
      });
      const getRes = await sliderDetailGET(getReq, {
        params: Promise.resolve({ id: String(id) }),
      });
      const getData = await getRes.json();
      expect(getData.slider.image_url).toBe("/uploads/test_bg1.webp");
      expect(getData.slider.fg_image_url).toBe("/uploads/test_fg1.webp");

      // Patch only fg_image_url
      const patchReq = new Request(`http://localhost/api/admin/sliders/${id}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ fg_image_url: "/uploads/test_fg2.webp" }),
      });
      const patchRes = await sliderDetailPATCH(patchReq, {
        params: Promise.resolve({ id: String(id) }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.slider.fg_image_url).toBe("/uploads/test_fg2.webp");
      expect(patchData.slider.image_url).toBe("/uploads/test_bg1.webp");
    });

    it("rejects slider creation when image_url is missing (does not default to mockup path)", async () => {
      const createReq = new Request("http://localhost/api/admin/sliders", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Slider Without Image",
          subtitle: "Should fail validation",
        }),
      });

      const res = await slidersPOST(createReq);
      expect(res.status).toBe(400);
    });

    it("saves empty fg_image_url cleanly without injecting mockup data", async () => {
      const createReq = new Request("http://localhost/api/admin/sliders", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Clean Real Slider",
          subtitle: "No mockup fg image",
          image_url: "/uploads/hero_real.webp",
          fg_image_url: "",
          cta_label: "Shop Now",
          cta_href: "/shop",
        }),
      });

      const res = await slidersPOST(createReq);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeTypeOf("number");

      const detailReq = new Request(`http://localhost/api/admin/sliders/${data.id}`, {
        headers: { Cookie: authCookie },
      });
      const detailRes = await sliderDetailGET(detailReq, {
        params: Promise.resolve({ id: String(data.id) }),
      });
      const detailData = await detailRes.json();
      expect(detailData.slider.image_url).toBe("/uploads/hero_real.webp");
      expect(detailData.slider.fg_image_url).toBe("");
    });

    it("creates a slider with full featured card content fields and retrieves it", () => {
      const created = createSlider({
        title: "Darjeeling High Terroir",
        subtitle: "Aromatic flushes from misty peaks.",
        image_url: "/uploads/hero_darjeeling.webp",
        fg_image_url: "/uploads/card_tin_darjeeling.webp",
        cta_label: "Explore Gardens",
        cta_href: "/shop",
        sort_order: 12,
        is_active: 1,
        starts_at: null,
        ends_at: null,
        card_tag: "2026 First Flush · Margaret's Hope",
        card_title: "Darjeeling First Flush Royal Reserve",
        card_subtitle: "Single Estate · 6,800 ft",
        card_tasting_notes: "Muscatel • Wild Orchid • Honey",
        card_quote: "From Our Gardens to Your Cup",
        card_badge: "RESERVE HARVEST",
        card_cta_label: "View This Harvest",
        card_cta_href: "/products/darjeeling-first-flush",
      });

      expect(created.id).toBeTypeOf("number");
      expect(created.card_tag).toBe("2026 First Flush · Margaret's Hope");
      expect(created.card_title).toBe("Darjeeling First Flush Royal Reserve");
      expect(created.card_subtitle).toBe("Single Estate · 6,800 ft");
      expect(created.card_tasting_notes).toBe("Muscatel • Wild Orchid • Honey");
      expect(created.card_quote).toBe("From Our Gardens to Your Cup");
      expect(created.card_badge).toBe("RESERVE HARVEST");
      expect(created.card_cta_label).toBe("View This Harvest");
      expect(created.card_cta_href).toBe("/products/darjeeling-first-flush");

      const fetched = getSlider(created.id);
      expect(fetched?.card_title).toBe("Darjeeling First Flush Royal Reserve");
      expect(fetched?.card_badge).toBe("RESERVE HARVEST");
    });

    it("partially updates featured card content fields via updateSlider", () => {
      const created = createSlider({
        title: "Assam Orthodox Heritage",
        subtitle: "Malty rich single-origin.",
        image_url: "/uploads/hero_assam.webp",
        cta_label: "Explore Assam",
        cta_href: "/collections/assam",
        sort_order: 15,
        is_active: 1,
        starts_at: null,
        ends_at: null,
        card_title: "Assam Golden Tippy",
        card_tag: "2026 Second Flush",
      });

      const updated = updateSlider(created.id, {
        card_title: "Assam Imperial Tippy Gold",
        card_tasting_notes: "Malty Cocoa • Raisin",
      });

      expect(updated?.card_title).toBe("Assam Imperial Tippy Gold");
      expect(updated?.card_tag).toBe("2026 Second Flush");
      expect(updated?.card_tasting_notes).toBe("Malty Cocoa • Raisin");
    });

    it("creates and patches slider card content via API routes", async () => {
      const createReq = new Request("http://localhost/api/admin/sliders", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Seasonal Festival Reserve",
          subtitle: "Celebratory Himalayan harvest.",
          image_url: "/uploads/festive_hero.webp",
          fg_image_url: "/uploads/festive_card.webp",
          cta_label: "Shop Festival",
          cta_href: "/festive",
          card_tag: "Autumnal Flush · Makaibari",
          card_title: "Silver Needle White",
          card_subtitle: "5,500 ft Elevation",
          card_tasting_notes: "Melon • Wild Honey • Jasmine",
          card_quote: "Sun-dried tender buds",
          card_badge: "LIMITED LOT",
          card_cta_label: "Explore Lot",
          card_cta_href: "/shop?category=White%20Tea",
        }),
      });

      const res = await slidersPOST(createReq);
      expect(res.status).toBe(201);
      const data = await res.json();

      const patchReq = new Request(`http://localhost/api/admin/sliders/${data.id}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          card_title: "Moonlight Silver Needle White",
          card_cta_label: "Reserve Now",
        }),
      });

      const patchRes = await sliderDetailPATCH(patchReq, {
        params: Promise.resolve({ id: String(data.id) }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.slider.card_title).toBe("Moonlight Silver Needle White");
      expect(patchData.slider.card_cta_label).toBe("Reserve Now");
      expect(patchData.slider.card_tag).toBe("Autumnal Flush · Makaibari");
    });

    it("supports disabling and re-enabling the front card (card_enabled)", async () => {
      // 1. Create a slider with card_enabled explicitly set to 0
      const disabledSlider = createSlider({
        title: "Clean Editorial Landscape Slider",
        subtitle: "Full-width photography without foreground card.",
        image_url: "/uploads/landscape_hero.webp",
        cta_label: "View Gallery",
        cta_href: "/gallery",
        sort_order: 20,
        is_active: 1,
        starts_at: null,
        ends_at: null,
        card_enabled: 0,
      });

      expect(disabledSlider.card_enabled).toBe(0);

      const fetched = getSlider(disabledSlider.id);
      expect(fetched?.card_enabled).toBe(0);

      // 2. Re-enable the card via updateSlider
      const reEnabled = updateSlider(disabledSlider.id, {
        card_enabled: 1,
        card_title: "Featured Landscape Harvest",
      });
      expect(reEnabled?.card_enabled).toBe(1);
      expect(reEnabled?.card_title).toBe("Featured Landscape Harvest");

      // 3. Disable again via PATCH API
      const patchReq = new Request(`http://localhost/api/admin/sliders/${disabledSlider.id}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ card_enabled: 0 }),
      });
      const patchRes = await sliderDetailPATCH(patchReq, {
        params: Promise.resolve({ id: String(disabledSlider.id) }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.slider.card_enabled).toBe(0);
    });

    it("supports setting custom chapter_label, button text, and links via API and library", async () => {
      const slider = createSlider({
        title: "Darjeeling Master Flush",
        subtitle: "Alpine misty slope harvest.",
        image_url: "/uploads/darjeeling_hero.webp",
        cta_label: "Shop Darjeeling Reserve",
        cta_href: "/collections/darjeeling-reserve",
        sort_order: 25,
        is_active: 1,
        starts_at: null,
        ends_at: null,
        card_title: "Darjeeling Queen Flush",
        card_cta_label: "Order Reserve Box",
        card_cta_href: "/products/darjeeling-queen",
        chapter_label: "01. Queen of Teas",
      });

      expect(slider.chapter_label).toBe("01. Queen of Teas");
      expect(slider.cta_label).toBe("Shop Darjeeling Reserve");
      expect(slider.cta_href).toBe("/collections/darjeeling-reserve");
      expect(slider.card_cta_label).toBe("Order Reserve Box");
      expect(slider.card_cta_href).toBe("/products/darjeeling-queen");

      // Patch chapter_label and button text via API
      const patchReq = new Request(`http://localhost/api/admin/sliders/${slider.id}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter_label: "01. First Flush Blossom",
          cta_label: "Explore First Flush",
          cta_href: "/collections/first-flush",
        }),
      });
      const patchRes = await sliderDetailPATCH(patchReq, {
        params: Promise.resolve({ id: String(slider.id) }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.slider.chapter_label).toBe("01. First Flush Blossom");
      expect(patchData.slider.cta_label).toBe("Explore First Flush");
      expect(patchData.slider.cta_href).toBe("/collections/first-flush");
    });

    it("creates, filters, and updates page_target and category_slug for /shop sliders", async () => {
      // 1. Create a shop-specific slider
      const shopSlider = createSlider({
        title: "Exclusive Assam Second Flush",
        subtitle: "Rich muscatel & malt for serious black tea enthusiasts.",
        image_url: "/uploads/assam-second-flush.webp",
        cta_label: "Shop Second Flush",
        cta_href: "/shop?category=Black%20Tea",
        sort_order: 15,
        is_active: 1,
        starts_at: null,
        ends_at: null,
        page_target: "shop",
        category_slug: "black",
      });

      expect(shopSlider.page_target).toBe("shop");
      expect(shopSlider.category_slug).toBe("black");

      // 2. Test listSliders filtering by pageTarget: "shop"
      const shopSliders = listSliders({ pageTarget: "shop" });
      const foundShop = shopSliders.find((s) => s.id === shopSlider.id);
      expect(foundShop).toBeDefined();

      // 3. Test listSliders filtering by pageTarget: "home" (should not include shop-only slider)
      const homeSliders = listSliders({ pageTarget: "home" });
      const foundHome = homeSliders.find((s) => s.id === shopSlider.id);
      expect(foundHome).toBeUndefined();

      // 4. Test categorySlug filtering
      const blackCatSliders = listSliders({ pageTarget: "shop", categorySlug: "black" });
      expect(blackCatSliders.some((s) => s.id === shopSlider.id)).toBe(true);

      const greenCatSliders = listSliders({ pageTarget: "shop", categorySlug: "green" });
      expect(greenCatSliders.some((s) => s.id === shopSlider.id)).toBe(false);

      // 5. Test PATCH API updating page_target and category_slug
      const patchReq = new Request(`http://localhost/api/admin/sliders/${shopSlider.id}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          page_target: "all",
          category_slug: "rare",
        }),
      });
      const patchRes = await sliderDetailPATCH(patchReq, {
        params: Promise.resolve({ id: String(shopSlider.id) }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.slider.page_target).toBe("all");
      expect(patchData.slider.category_slug).toBe("rare");

      // Now it should be visible in homeSliders since page_target is "all"
      const recheckedHome = listSliders({ pageTarget: "home" });
      expect(recheckedHome.some((s) => s.id === shopSlider.id)).toBe(true);

      // Clean up
      deleteSlider(shopSlider.id);
    });

    it("supports creating and updating dedicated hero slider for Everyday Milk Chai on /shop", async () => {
      // Create a slider specifically for Everyday Milk Chai on /shop
      const chaiSlider = createSlider({
        title: "Everyday Milk Chai — Bold Mountain Kadak",
        subtitle: "Strong Assam & Dooars CTC crafted for fragrant morning milk chai.",
        image_url: "/uploads/upload_1791923277105_f76cbe61db8c_teafloww-category-everyday-milk-chai-1200x800.webp",
        cta_label: "Shop Milk Chai Collection",
        cta_href: "/shop?category=Everyday+Milk+Chai",
        sort_order: 1,
        is_active: 1,
        starts_at: null,
        ends_at: null,
        page_target: "shop",
        category_slug: "everyday-milk-chai",
      });

      expect(chaiSlider.id).toBeTypeOf("number");
      expect(chaiSlider.page_target).toBe("shop");
      expect(chaiSlider.category_slug).toBe("everyday-milk-chai");

      // Verify filtered querying
      const matchingShop = listSliders({ pageTarget: "shop", categorySlug: "everyday-milk-chai" });
      expect(matchingShop.some((s) => s.id === chaiSlider.id)).toBe(true);

      // Verify updating image_url via PATCH
      const patchReq = new Request(`http://localhost/api/admin/sliders/${chaiSlider.id}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: "/uploads/custom-chai-hero-banner.webp",
          title: "Artisanal Milk Chai — Fresh Harvest",
        }),
      });
      const patchRes = await sliderDetailPATCH(patchReq, {
        params: Promise.resolve({ id: String(chaiSlider.id) }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.slider.image_url).toBe("/uploads/custom-chai-hero-banner.webp");
      expect(patchData.slider.title).toBe("Artisanal Milk Chai — Fresh Harvest");

      // Clean up
      deleteSlider(chaiSlider.id);
    });

    it("deletes a slider via DELETE /api/admin/sliders/[id]", async () => {
      const deleteReq = new Request(`http://localhost/api/admin/sliders/${testSliderId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const deleteRes = await sliderDetailDELETE(deleteReq, {
        params: Promise.resolve({ id: String(testSliderId) }),
      });
      expect(deleteRes.status).toBe(204);

      // Verify deleted
      const checkReq = new Request(`http://localhost/api/admin/sliders/${testSliderId}`, {
        method: "GET",
        headers: { Cookie: authCookie },
      });
      const checkRes = await sliderDetailGET(checkReq, {
        params: Promise.resolve({ id: String(testSliderId) }),
      });
      expect(checkRes.status).toBe(404);
    });
  });
});
