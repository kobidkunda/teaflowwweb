import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { homepageSchema } from "@/lib/homepageSchema";
import { getHomepageContent, saveHomepageContent } from "@/lib/homepage";
import { HomeTrialsSection } from "@/components/home/HomeTrialsSection";
import { dispatchToolCall, listToolDefinitions } from "@/lib/mcp";
import { GET as getHomepage, PUT as putHomepage } from "@/app/api/admin/homepage/route";
import { HOME_TRIAL_MEDIA_GUIDANCE } from "@/lib/homeTrialsPresentation";
import type { TrialPublicDto } from "@/lib/trials/types";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";

const mockFeaturedTrial: TrialPublicDto = {
  id: "trial-discovery-200g-001",
  slug: "tea-stall-discovery-kit",
  title: "TeaFloww Four-Tea Discovery Kit",
  tagline: "Four distinct craft milk teas formulated from Siliguri CTC and fresh whole spices.",
  description: "The definitive sample kit for discerning tea stalls and milk chai enthusiasts. Contains four 50g sachets.",
  status: "published",
  pack_format: "4x50g_sachets",
  net_weight_g: 200,
  price_paise: 26900, // ₹269.00
  compare_at_price_paise: 35000, // ₹350.00
  sku: "TRIAL-STALL-4X50G",
  in_stock: true,
  hero_image: {
    url: "/images/trials/discovery-packaging.jpg",
    alt_text: "TeaFloww Four-Tea Discovery Kit Outer Packaging",
  },
  components: [
    {
      slot_index: 0,
      name: "Strong Milk Chai",
      estate: "Moran Estate",
      grade: "Assam CTC BP",
      flush: "Second Flush 2026",
      elevation: "180m AMSL",
      weight_g: 50,
      tasting_notes: ["Full-bodied", "Malty", "Rich Liquor", "Sweet Finish"],
      brewing: { temp_c: 95, time_sec: 240, dose_g: 2.5 },
      bulk_link: null,
      assets: [
        {
          stage: "dry_leaf",
          url: "/images/trials/discovery-dry-leaf.jpg",
          alt_text: "Dry CTC granules",
        },
      ],
    },
    {
      slot_index: 1,
      name: "Elaichi Infused Chai",
      estate: "Siliguri Blend Hub",
      grade: "CTC & Green Cardamom",
      flush: "Monsoon Flush 2026",
      elevation: "120m AMSL",
      weight_g: 50,
      tasting_notes: ["Aromatic Cardamom", "Sweet Spice", "Brisk"],
      brewing: { temp_c: 95, time_sec: 240, dose_g: 2.5 },
      bulk_link: null,
      assets: [],
    },
    {
      slot_index: 2,
      name: "Ginger Spiced Chai",
      estate: "Upper Assam Estate",
      grade: "CTC & Ginger",
      flush: "Autumn Flush 2026",
      elevation: null,
      weight_g: 50,
      tasting_notes: ["Zesty Heat", "Warming", "Robust"],
      brewing: { temp_c: 95, time_sec: 240, dose_g: 2.5 },
      bulk_link: null,
      assets: [],
    },
    {
      slot_index: 3,
      name: "Balanced Masala Chai",
      estate: "Dooars Foothills",
      grade: "Orthodox BP Blend",
      flush: "Second Flush 2026",
      elevation: "250m AMSL",
      weight_g: 50,
      tasting_notes: ["Clove", "Cinnamon", "Cardamom", "Malty"],
      brewing: { temp_c: 95, time_sec: 240, dose_g: 2.5 },
      bulk_link: null,
      assets: [],
    },
  ],
  meta: { title: null, description: null },
  claims: [
    { claim_type: "origin", label: "100% Single-Estate Harvest", verified: true },
  ],
};

describe("Homepage Trials Showcase & Dynamic Admin Management", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = setupAdminTestEnv();
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Domain & Schema Validation", () => {
    it("validates homepageSchema with default trials configuration", () => {
      const minimalHomepage = {
        brand: "TeaFloww",
        tagline: "Single Estate Orthodox",
        navigation: [],
        footer_links: [],
        hero: {
          eyebrow: "ORIGIN FLUSH",
          title: "Fresh from the Himalayas",
          emphasis: "uncut",
          description: "Estate teas.",
          image_url: "/images/hero.jpg",
          image_alt: "Hero",
          primary: { label: "Shop", href: "/shop" },
          secondary: { label: "Learn", href: "/about" },
        },
        discovery: {
          eyebrow: "EXPLORE",
          title: "Categories",
          emphasis: "handcrafted",
          description: "Browse",
          tiles: [],
        },
        shelf: {
          eyebrow: "CURATED",
          title: "Our Blends",
          emphasis: "signature",
          cta: { label: "View All", href: "/shop" },
          empty_title: "Empty",
          empty_description: "Check back soon",
          fallback_image_url: "/images/tea.jpg",
          fallback_image_alt: "Tea",
        },
        trials: {
          enabled: true,
          eyebrow: "CURATED FLAVOUR FLIGHTS",
          title: "Taste Before You Commit",
          emphasis: "in your own kettle.",
          description: "Four 50g craft pouches.",
          badge_text: "4x50g Craft Kit",
          cta: { label: "Explore Trials", href: "/trials" },
          trial_slug: "tea-stall-discovery-kit",
        },
        disclosure: "Direct from Siliguri.",
        footer_text: "Nirva · All rights reserved.",
      };

      const parsed = homepageSchema.safeParse(minimalHomepage);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.trials?.enabled).toBe(true);
        expect(parsed.data.trials?.title).toBe("Taste Before You Commit");
        expect(parsed.data.trials?.trial_slug).toBe("tea-stall-discovery-kit");
      }
    });

    it("rejects non-local CTA hrefs in trials schema", () => {
      const invalid = {
        enabled: true,
        eyebrow: "TEST",
        title: "Test",
        emphasis: "Test",
        description: "Test",
        badge_text: "Test",
        cta: { label: "External", href: "https://external.example.com" }, // Non-local path
      };

      const base = {
        brand: "TeaFloww",
        tagline: "Single Estate",
        navigation: [],
        footer_links: [],
        hero: {
          eyebrow: "E",
          title: "T",
          emphasis: "E",
          description: "D",
          image_url: "/images/hero.jpg",
          image_alt: "Alt",
          primary: { label: "P", href: "/shop" },
          secondary: { label: "S", href: "/about" },
        },
        discovery: { eyebrow: "E", title: "T", emphasis: "E", description: "D", tiles: [] },
        shelf: {
          eyebrow: "E",
          title: "T",
          emphasis: "E",
          cta: { label: "C", href: "/shop" },
          empty_title: "ET",
          empty_description: "ED",
          fallback_image_url: "/images/tea.jpg",
          fallback_image_alt: "Alt",
        },
        trials: invalid,
        disclosure: "D",
        footer_text: "F",
      };

      expect(homepageSchema.safeParse(base).success).toBe(false);
    });

    it("automatically defaults trials configuration in getHomepageContent when unset in DB", () => {
      // Save content without trials
      env.db
        .prepare(
          "INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES ('homepage_content_v1', ?, CURRENT_TIMESTAMP)"
        )
        .run(
          JSON.stringify({
            brand: "TeaFloww",
            tagline: "Single Estate",
            navigation: [],
            footer_links: [],
            hero: {
              eyebrow: "E",
              title: "T",
              emphasis: "E",
              description: "D",
              image_url: "/images/hero.jpg",
              image_alt: "Alt",
              primary: { label: "P", href: "/shop" },
              secondary: { label: "S", href: "/about" },
            },
            discovery: { eyebrow: "E", title: "T", emphasis: "E", description: "D", tiles: [] },
            shelf: {
              eyebrow: "E",
              title: "T",
              emphasis: "E",
              cta: { label: "C", href: "/shop" },
              empty_title: "ET",
              empty_description: "ED",
              fallback_image_url: "/images/tea.jpg",
              fallback_image_alt: "Alt",
            },
            disclosure: "D",
            footer_text: "F",
          })
        );

      const content = getHomepageContent();
      expect(content).not.toBeNull();
      expect(content?.trials).toBeDefined();
      expect(content?.trials?.enabled).toBe(true);
      expect(content?.trials?.title).toBe("Find");
    });
  });

  describe("Storefront HomeTrialsSection UI Component", () => {
    it("renders the selected invitation and a single collection action without sales claims", () => {
      const html = renderToStaticMarkup(React.createElement(HomeTrialsSection, { featuredTrial: mockFeaturedTrial }));
      expect(html).toContain("Find");
      expect(html).toContain("your cup.");
      expect(html).toContain("Start with a sample.");
      expect(html).toContain('href="/trials#top"');
      expect(html).toContain("home-discovery-desktop.webp");
      expect(html).toContain("home-discovery-mobile.webp");
      expect(html).toContain('media="(max-width: 640px)"');
      expect(html).toContain("200g per kit");
      expect(html).not.toContain('role="tablist"');
      for (const unsafe of ["Voucher Guarantee", "Within 24 Hours", "UPI", "Origin Guaranteed", "MCP competing", "Add Discovery Flight", "₹269"]) expect(html).not.toContain(unsafe);
    });

    it("renders custom copy when configured via config prop", () => {
      const customConfig = {
        enabled: true,
        eyebrow: "EXCLUSIVE HIMALAYAN SAMPLER",
        title: "Discover Your Signature Steep",
        emphasis: "at your breakfast table.",
        description: "Four limited release lots roasted to perfection.",
        badge_text: "Handpicked 4-Pack",
        cta: { label: "View Collection", href: "/trials" },
      };

      const html = renderToStaticMarkup(
        React.createElement(HomeTrialsSection, {
          config: customConfig,
          featuredTrial: mockFeaturedTrial,
        })
      );

      expect(html).toContain("EXCLUSIVE HIMALAYAN SAMPLER");
      expect(html).toContain("Discover Your Signature Steep");
      expect(html).toContain("at your breakfast table.");
      expect(html).toContain("Four limited release lots roasted to perfection.");
      expect(html).not.toContain("Handpicked 4-Pack");
    });

    it("honours image edits, captions and clearing while always linking the kit collection", () => {
      const html = renderToStaticMarkup(React.createElement(HomeTrialsSection, { featuredTrial: mockFeaturedTrial,
        config: { image_url: "/uploads/desktop.webp", mobile_image_url: "/uploads/mobile.webp", image_alt: "Our sample kit photo", image_caption: "Our product photography", cta: { label: "Browse kits", href: "/shop" } } }));
      expect(html).toContain(encodeURIComponent("/uploads/desktop.webp"));
      expect(html).toContain("/uploads/mobile.webp");
      expect(html).toContain("Our product photography");
      expect(html).toContain('href="/trials#top"');
      expect(html).not.toContain('href="/shop"');
      const cleared = renderToStaticMarkup(React.createElement(HomeTrialsSection, { featuredTrial: mockFeaturedTrial, config: { image_url: "", mobile_image_url: "" } }));
      expect(cleared).not.toContain("<picture");
      expect(cleared).toContain("Explore all sample kits");
    });

    it("hides the invitation when disabled", () => {
      expect(renderToStaticMarkup(React.createElement(HomeTrialsSection, { featuredTrial: mockFeaturedTrial, config: { enabled: false } }))).toBe("");
    });

    it("returns null cleanly if featuredTrial is not provided", () => {
      // @ts-expect-error Testing null fallback
      const html = renderToStaticMarkup(React.createElement(HomeTrialsSection, { featuredTrial: null }));
      expect(html).toBe("");
    });
  });
  describe("Admin and MCP artwork parity", () => {
    it("saves both artwork paths through authenticated HTTP and returns exact-size guidance", async () => {
      const content = getHomepageContent()!;
      const next = { ...content, trials: { ...content.trials!, image_url: "/uploads/admin-desktop.webp", mobile_image_url: "/uploads/admin-mobile.webp", image_alt: "Approved image", image_caption: "Product photography" } };
      const cookie = getAuthCookie(env.db);
      const response = await putHomepage(new Request("http://localhost/api/admin/homepage", { method: "PUT", headers: { cookie, origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(next) }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.content.trials.image_url).toBe(next.trials.image_url);
      expect(data.content.trials.mobile_image_url).toBe(next.trials.mobile_image_url);
      expect(data.media_guidance.trials).toEqual(HOME_TRIAL_MEDIA_GUIDANCE);
      const read = await getHomepage(new Request("http://localhost/api/admin/homepage", { headers: { cookie } }));
      expect((await read.json()).content.trials.image_alt).toBe("Approved image");
      const denied = await putHomepage(new Request("http://localhost/api/admin/homepage", { method: "PUT", body: JSON.stringify(next) }));
      expect(denied.status).toBe(401);
    });

    it("round-trips MCP edits without touching other homepage sections and rejects unsafe artwork", () => {
      const read = dispatchToolCall("store.getHomepageContent", {}) as { content: NonNullable<ReturnType<typeof getHomepageContent>>; media_guidance: { trials: typeof HOME_TRIAL_MEDIA_GUIDANCE } };
      expect(read.media_guidance.trials.desktop.width).toBe(1920);
      expect(read.media_guidance.trials.mobile.height).toBe(1080);
      const content = { ...read.content, trials: { ...read.content.trials!, image_url: "/uploads/mcp-desktop.webp", mobile_image_url: "/uploads/mcp-mobile.webp" } };
      dispatchToolCall("admin.updateHomepageContent", { content });
      expect(getHomepageContent()?.trials?.mobile_image_url).toBe("/uploads/mcp-mobile.webp");
      expect(getHomepageContent()?.hero).toEqual(read.content.hero);
      for (const bad of ["https://evil.example/a.webp", "//evil.example/a.webp", "javascript:alert(1)"]) {
        expect(() => dispatchToolCall("admin.updateHomepageContent", { content: { ...content, trials: { ...content.trials, image_url: bad } } })).toThrow();
      }
      expect(getHomepageContent()?.trials?.image_url).toBe("/uploads/mcp-desktop.webp");
      expect(listToolDefinitions().find(tool => tool.name === "admin.updateHomepageContent")?.description).toContain("1920x720");
    });
  });

});
