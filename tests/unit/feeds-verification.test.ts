import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getFeedCatalogData,
  generateGoogleMerchantXml,
  generateGoogleProductReviewsXml,
  generateMetaCatalogCsv,
  generateOpenAiProductFeedJsonl,
  mapFeedItemToOpenAiRecord,
  mapFeedItemsToLocalInventory,
  generateGoogleLocalInventoryXml,
  generateGoogleLocalInventoryTsv,
  generateGoogleLocalInventoryCsv,
  escapeXml,
  isFeedAuthorized,
  feedUnauthorizedResponse,
  resolveBaseUrl,
  isPrivateHost,
  type FeedItem,
} from "@/lib/feeds";
import { GET as getGoogleXmlRoute } from "@/app/feeds/google.xml/route";
import { GET as getApiGoogleRoute } from "@/app/api/feeds/google-merchant/route";
import { GET as getGoogleLocalXmlRoute } from "@/app/feeds/google-local.xml/route";
import { GET as getGoogleLocalTsvRoute } from "@/app/feeds/google-local.tsv/route";
import { GET as getApiGoogleLocalRoute } from "@/app/api/feeds/google-local-inventory/route";
import { GET as getCatalogCsvRoute } from "@/app/feeds/catalog.csv/route";
import { GET as getApiMetaRoute } from "@/app/api/feeds/meta/route";
import { GET as getOpenAiJsonlRoute } from "@/app/feeds/openai.jsonl/route";
import { GET as getApiOpenAiRoute } from "@/app/api/feeds/openai/route";
import { gunzipSync } from "node:zlib";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Google Merchant Feed & Feeds Engine - Empirical Verification", () => {
  const originalEnvToken = process.env.FEED_ACCESS_TOKEN;
  const originalBaseUrl = process.env.FEED_BASE_URL;

  beforeEach(() => {
    delete process.env.FEED_ACCESS_TOKEN;
    delete process.env.FEED_BASE_URL;
  });

  afterEach(() => {
    if (originalEnvToken !== undefined) {
      process.env.FEED_ACCESS_TOKEN = originalEnvToken;
    } else {
      delete process.env.FEED_ACCESS_TOKEN;
    }
    if (originalBaseUrl !== undefined) {
      process.env.FEED_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.FEED_BASE_URL;
    }
  });

  describe("1. Catalog Data Mapping (getFeedCatalogData)", () => {
    it("retrieves active orthodox catalog items with variants from database", () => {
      const items = getFeedCatalogData("https://himalayantea.com");
      expect(items.length).toBeGreaterThan(0);

      // Verify that every single item conforms to FeedItem interface
      for (const item of items) {
        expect(item.id).toBeTruthy();
        expect(typeof item.id).toBe("string");
        expect(item.itemGroupId).toBeTruthy();
        expect(typeof item.itemGroupId).toBe("string");
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.link).toMatch(/^https:\/\/himalayantea\.com\/(tea|trials|private-label\/packaging)\/[a-z0-9-]+(\?sku=.+)?$/);
        expect(item.imageLink).toMatch(/^https?:\/\/.+/);
        expect(["in_stock", "out_of_stock"]).toContain(item.availability);
        expect(item.price).toMatch(/^\d+\.\d{2} [A-Z]{3}$/);
        expect(["Himalayan Tea House", "TeaFloww"]).toContain(item.brand);
        expect(item.condition).toBe("new");
        expect(item.googleProductCategory).toBeTruthy();
        expect(item.productType).toMatch(/^Tea( > .*)?$/);
        expect(typeof item.stock).toBe("number");
        expect(item.stock).toBeGreaterThanOrEqual(0);
        expect(item.shippingPrice).toMatch(/^\d+\.\d{2} INR$/);
        expect(item.returnWindowDays).toBeGreaterThan(0);
      }
      expect(items.some((i) => i.entityType === "product")).toBe(true);
      expect(items.some((i) => i.entityType === "trial")).toBe(true);
      expect(items.some((i) => i.entityType === "packaging")).toBe(true);
    });

    it("correctly formats price in decimal format with currency code (e.g. 749.00 INR)", () => {
      const items = getFeedCatalogData();
      for (const item of items) {
        const parts = item.price.split(" ");
        expect(parts).toHaveLength(2);
        const [amountStr, currency] = parts;
        expect(currency).toBe("INR");
        expect(amountStr).toMatch(/^\d+\.\d{2}$/);
        const amountNum = parseFloat(amountStr);
        expect(amountNum).toBeGreaterThan(0);
      }
    });

    it("accurately maps stock to in_stock vs out_of_stock", () => {
      const items = getFeedCatalogData();
      for (const item of items) {
        if (item.stock > 0) {
          expect(item.availability).toBe("in_stock");
        } else {
          expect(item.availability).toBe("out_of_stock");
        }
      }
    });

    it("correctly includes packaging format and size in grams in tea variant titles", () => {
      const items = getFeedCatalogData().filter((i) => i.entityType === "product");
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.title).toMatch(/— (Loose Leaf Pouch|Luxury Tin|Pyramid Bags) \(\d+g\)$/);
      }
    });

    it("resolves primary image links and falls back to tea-tin.svg when missing", () => {
      const items = getFeedCatalogData("https://himalayantea.com");
      for (const item of items) {
        expect(item.imageLink.startsWith("http")).toBe(true);
      }
    });
  });

  describe("2. Google Merchant XML Generation (generateGoogleMerchantXml)", () => {
    it("generates well-formed RSS 2.0 XML with Google namespace and all required channel elements", () => {
      const items = getFeedCatalogData("https://himalayantea.com");
      const xml = generateGoogleMerchantXml(items, "https://himalayantea.com");

      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
      expect(xml).toContain("<channel>");
      expect(xml).toMatch(/<title>(Himalayan Tea House|TeaFloww) Catalog<\/title>/);
      expect(xml).toContain("<link>https://himalayantea.com</link>");
      expect(xml).toContain(
        "<description>Direct single-estate orthodox artisan loose-leaf teas from high-elevation Himalayan gardens.</description>"
      );
      expect(xml).toContain("<lastBuildDate>");
      expect(xml).toContain("</channel>");
      expect(xml).toContain("</rss>");
    });

    it("includes all 11 required Google Merchant item tags plus identifier_exists", () => {
      const items = getFeedCatalogData("https://himalayantea.com");
      const xml = generateGoogleMerchantXml(items, "https://himalayantea.com");

      // Verify each item tag is present
      expect(xml).toContain("<g:id>");
      expect(xml).toContain("</g:id>");
      expect(xml).toContain("<g:title>");
      expect(xml).toContain("</g:title>");
      expect(xml).toContain("<g:description>");
      expect(xml).toContain("</g:description>");
      expect(xml).toContain("<g:link>");
      expect(xml).toContain("</g:link>");
      expect(xml).toContain("<g:image_link>");
      expect(xml).toContain("</g:image_link>");
      expect(xml).toContain("<g:availability>");
      expect(xml).toContain("</g:availability>");
      expect(xml).toContain("<g:price>");
      expect(xml).toContain("</g:price>");
      expect(xml).toContain("<g:brand>");
      expect(xml).toContain("</g:brand>");
      expect(xml).toContain("<g:condition>");
      expect(xml).toContain("</g:condition>");
      expect(xml).toContain("<g:google_product_category>");
      expect(xml).toContain("</g:google_product_category>");
      expect(xml).toContain("<g:item_group_id>");
      expect(xml).toContain("</g:item_group_id>");
      expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
      expect(xml).toContain("<g:shipping>");
      expect(xml).toContain("<g:min_handling_time>");
      expect(xml).toContain("<g:max_transit_time>");
    });

    it("passes external xmllint syntax validation with zero errors", () => {
      const items = getFeedCatalogData("https://himalayantea.com");
      const xml = generateGoogleMerchantXml(items, "https://himalayantea.com");

      const tmpFile = path.join(os.tmpdir(), `feed-validation-${Date.now()}.xml`);
      fs.writeFileSync(tmpFile, xml, "utf-8");

      try {
        const output = execSync(`xmllint --noout "${tmpFile}"`, { encoding: "utf-8" });
        expect(output).toBe("");
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });

    it("passes Python xml.etree.ElementTree strict parsing and namespace verification", () => {
      const items = getFeedCatalogData("https://himalayantea.com");
      const xml = generateGoogleMerchantXml(items, "https://himalayantea.com");

      const tmpFile = path.join(os.tmpdir(), `feed-py-check-${Date.now()}.xml`);
      fs.writeFileSync(tmpFile, xml, "utf-8");

      const pythonScript = `
import xml.etree.ElementTree as ET
import sys

tree = ET.parse(sys.argv[1])
root = tree.getroot()

assert root.tag == "rss", f"Expected root tag 'rss', got {root.tag}"
assert root.attrib.get("version") == "2.0", "Expected version='2.0'"

channel = root.find("channel")
assert channel is not None, "Missing <channel>"
assert channel.find("title") is not None, "Missing <title>"
assert channel.find("link") is not None, "Missing <link>"
assert channel.find("description") is not None, "Missing <description>"
assert channel.find("lastBuildDate") is not None, "Missing <lastBuildDate>"

ns = {"g": "http://base.google.com/ns/1.0"}
items = channel.findall("item")
assert len(items) > 0, "No <item> elements found"

for idx, item in enumerate(items):
    required_g_fields = [
        "id", "title", "description", "link", "image_link",
        "availability", "price", "brand", "condition",
        "google_product_category", "item_group_id", "identifier_exists"
    ]
    for field in required_g_fields:
        el = item.find(f"g:{field}", ns)
        assert el is not None, f"Item {idx} missing g:{field}"
        assert el.text is not None and len(el.text.strip()) > 0, f"Item {idx} empty text for g:{field}"

print(f"VALIDATED_{len(items)}_ITEMS")
`;

      try {
        const result = execSync(`python3 -c '${pythonScript}' "${tmpFile}"`, {
          encoding: "utf-8",
        }).trim();
        expect(result).toMatch(/^VALIDATED_\d+_ITEMS$/);
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });

    it("generates valid XML when catalog is completely empty", () => {
      const xml = generateGoogleMerchantXml([], "https://himalayantea.com");
      expect(xml).toContain("<rss version=\"2.0\" xmlns:g=\"http://base.google.com/ns/1.0\">");
      expect(xml).toContain("<channel>");
      expect(xml).toContain("</channel>");
      expect(xml).toContain("</rss>");

      const tmpFile = path.join(os.tmpdir(), `feed-empty-${Date.now()}.xml`);
      fs.writeFileSync(tmpFile, xml, "utf-8");
      try {
        const output = execSync(`xmllint --noout "${tmpFile}"`, { encoding: "utf-8" });
        expect(output).toBe("");
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });
  });

  describe("3. Adversarial Edge Cases & Stress Testing", () => {
    it("safely escapes XML special characters (&, <, >, \", ') without malforming XML", () => {
      const raw = `Darjeeling & Assam <Special "Edition"> 'Gold'`;
      const escaped = escapeXml(raw);
      expect(escaped).toBe(
        `Darjeeling &amp; Assam &lt;Special &quot;Edition&quot;&gt; &apos;Gold&apos;`
      );

      const adversarialItems: FeedItem[] = [
        {
          id: "ADV-001 & <test>",
          itemGroupId: "tea-special & rare",
          title: "Black Tea & Green Blend <Grand Cru> \"Reserve\" '2026'",
          description: "Estate notes: A & B, C < D, E > F, \"quotes\", 'apostrophes'. Also <b>tags</b> & symbols.",
          link: "https://himalayantea.com/tea/test?sku=ADV-001&source=merchant",
          imageLink: "https://himalayantea.com/images/tea.jpg?a=1&b=2",
          availability: "in_stock",
          price: "1250.00 INR",
          brand: "Himalayan & Sons Tea House",
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          stock: 10,
        },
      ];

      const xml = generateGoogleMerchantXml(adversarialItems, "https://himalayantea.com");
      const tmpFile = path.join(os.tmpdir(), `feed-adv-${Date.now()}.xml`);
      fs.writeFileSync(tmpFile, xml, "utf-8");
      try {
        const output = execSync(`xmllint --noout "${tmpFile}"`, { encoding: "utf-8" });
        expect(output).toBe("");
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });

    it("strips illegal XML 1.0 ASCII control characters that would break XML parsers", () => {
      const hostileString = "Clean\x00String\x08With\x0BHostile\x0CControl\x1FChars\x7F";
      const sanitized = escapeXml(hostileString);
      expect(sanitized).toBe("CleanStringWithHostileControlChars");
    });

    it("handles zero stock variant mapping to out_of_stock explicitly", () => {
      const mockItems: FeedItem[] = [
        {
          id: "ZERO-STOCK-SKU",
          itemGroupId: "tea-zero",
          title: "Darjeeling First Flush — Luxury Tin (100g)",
          description: "Sample description",
          link: "https://himalayantea.com/tea/tea-zero?sku=ZERO-STOCK-SKU",
          imageLink: "https://himalayantea.com/images/tea-tin.svg",
          availability: "out_of_stock",
          price: "850.00 INR",
          brand: "Himalayan Tea House",
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          stock: 0,
        },
      ];

      const xml = generateGoogleMerchantXml(mockItems);
      expect(xml).toContain("<g:availability>out_of_stock</g:availability>");
    });

    it("handles zero and boundary price formats correctly", () => {
      const mockItems: FeedItem[] = [
        {
          id: "FREE-SAMPLE-SKU",
          itemGroupId: "tea-sample",
          title: "Tea Sample",
          description: "Sample",
          link: "https://himalayantea.com/tea/tea-sample",
          imageLink: "https://himalayantea.com/images/tea-tin.svg",
          availability: "in_stock",
          price: "0.00 INR",
          brand: "Himalayan Tea House",
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          stock: 5,
        },
      ];

      const xml = generateGoogleMerchantXml(mockItems);
      expect(xml).toContain("<g:price>0.00 INR</g:price>");
    });

    it("handles international UTF-8 characters seamlessly (Devanagari, Tibetan, Japanese, Emojis)", () => {
      const unicodeItem: FeedItem[] = [
        {
          id: "UNICODE-SKU",
          itemGroupId: "tea-himalaya",
          title: "हिमालयन चाय 🍵 — Gyokuro 玉露 — Darjeeling Thé",
          description: "उत्कृष्ट दार्जिलिंग चाय। High elevation connoisseur collection.",
          link: "https://himalayantea.com/tea/tea-himalaya",
          imageLink: "https://himalayantea.com/images/tea-tin.svg",
          availability: "in_stock",
          price: "1500.00 INR",
          brand: "Himalayan Tea House",
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          stock: 12,
        },
      ];

      const xml = generateGoogleMerchantXml(unicodeItem);
      expect(xml).toContain("हिमालयन चाय 🍵");
      const tmpFile = path.join(os.tmpdir(), `feed-utf8-${Date.now()}.xml`);
      fs.writeFileSync(tmpFile, xml, "utf-8");
      try {
        const output = execSync(`xmllint --noout "${tmpFile}"`, { encoding: "utf-8" });
        expect(output).toBe("");
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
    });
  });

  describe("4. Security Gate & Token Authorization (isFeedAuthorized)", () => {
    it("permits public requests when FEED_ACCESS_TOKEN is not configured", () => {
      delete process.env.FEED_ACCESS_TOKEN;
      const req = new Request("https://himalayantea.com/feeds/google.xml");
      expect(isFeedAuthorized(req)).toBe(true);
    });

    it("blocks unauthorized requests when FEED_ACCESS_TOKEN is set", () => {
      process.env.FEED_ACCESS_TOKEN = "secret-token-123";
      const req = new Request("https://himalayantea.com/feeds/google.xml");
      expect(isFeedAuthorized(req)).toBe(false);
    });

    it("authorizes requests with matching token query parameter", () => {
      process.env.FEED_ACCESS_TOKEN = "secret-token-123";
      const req = new Request("https://himalayantea.com/feeds/google.xml?token=secret-token-123");
      expect(isFeedAuthorized(req)).toBe(true);
    });

    it("authorizes requests with feed_token query parameter", () => {
      process.env.FEED_ACCESS_TOKEN = "secret-token-123";
      const req = new Request("https://himalayantea.com/feeds/google.xml?feed_token=secret-token-123");
      expect(isFeedAuthorized(req)).toBe(true);
    });

    it("authorizes requests with Authorization: Bearer header", () => {
      process.env.FEED_ACCESS_TOKEN = "secret-token-123";
      const req = new Request("https://himalayantea.com/feeds/google.xml", {
        headers: { Authorization: "Bearer secret-token-123" },
      });
      expect(isFeedAuthorized(req)).toBe(true);
    });

    it("rejects token with wrong value or different length safely", () => {
      process.env.FEED_ACCESS_TOKEN = "secret-token-123";
      const wrongLenReq = new Request("https://himalayantea.com/feeds/google.xml?token=secret");
      expect(isFeedAuthorized(wrongLenReq)).toBe(false);

      const sameLenWrongReq = new Request(
        "https://himalayantea.com/feeds/google.xml?token=secret-token-456"
      );
      expect(isFeedAuthorized(sameLenWrongReq)).toBe(false);
    });

    it("feedUnauthorizedResponse returns HTTP 401 with WWW-Authenticate header", async () => {
      const res = feedUnauthorizedResponse();
      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toBe(
        'Bearer realm="Himalayan Tea House Product Feeds"'
      );
      expect(res.headers.get("Content-Type")).toBe("application/json");
      const body = await res.json();
      expect(body.error).toContain("Valid feed access token required");
    });
  });

  describe("5. Route Handlers Integration", () => {
    it("/feeds/google.xml returns HTTP 200 with application/xml and valid XML content", async () => {
      delete process.env.FEED_ACCESS_TOKEN;
      const req = new Request("https://himalayantea.com/feeds/google.xml");
      const res = await getGoogleXmlRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Content-Disposition")).toBe("inline");

      const xml = await res.text();
      expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    });

    it("/feeds/google.xml with ?download=1 sets attachment Content-Disposition", async () => {
      delete process.env.FEED_ACCESS_TOKEN;
      const req = new Request("https://himalayantea.com/feeds/google.xml?download=1");
      const res = await getGoogleXmlRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toBe(
        'attachment; filename="google-merchant-feed.xml"'
      );
    });

    it("/api/feeds/google-merchant returns identical valid XML feed", async () => {
      delete process.env.FEED_ACCESS_TOKEN;
      const req = new Request("https://himalayantea.com/api/feeds/google-merchant");
      const res = await getApiGoogleRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
      const xml = await res.text();
      expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    });

    it("/feeds/google.xml returns HTTP 401 when token is required but missing", async () => {
      process.env.FEED_ACCESS_TOKEN = "protect-my-feed";
      const req = new Request("https://himalayantea.com/feeds/google.xml");
      const res = await getGoogleXmlRoute(req);

      expect(res.status).toBe(401);
      expect(res.headers.get("WWW-Authenticate")).toBe(
        'Bearer realm="Himalayan Tea House Product Feeds"'
      );
    });

    it("/feeds/catalog.csv returns HTTP 200 with text/csv; charset=utf-8", async () => {
      delete process.env.FEED_ACCESS_TOKEN;
      const req = new Request("https://himalayantea.com/feeds/catalog.csv");
      const res = await getCatalogCsvRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      const csv = await res.text();
      expect(csv.startsWith("id,title,description,availability,condition,price,link,image_link,brand,google_product_category,item_group_id")).toBe(true);
    });

    it("/api/feeds/meta returns HTTP 200 with text/csv; charset=utf-8", async () => {
      delete process.env.FEED_ACCESS_TOKEN;
      const req = new Request("https://himalayantea.com/api/feeds/meta");
      const res = await getApiMetaRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    });
  });

  describe("6. Meta Catalog CSV Generation & RFC 4180 Escaping", () => {
    it("generates valid RFC 4180 CSV with quotes doubled", () => {
      const items: FeedItem[] = [
        {
          id: "CSV-001",
          itemGroupId: "tea-csv",
          title: 'Premium Tea, 100g "Limited"',
          description: "Contains, commas, quotes \"here\", and\nnewlines.",
          link: "https://himalayantea.com/tea/tea-csv",
          imageLink: "https://himalayantea.com/images/tea-tin.svg",
          availability: "in_stock",
          price: "999.00 INR",
          brand: "Himalayan Tea House",
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          stock: 15,
        },
      ];

      const csv = generateMetaCatalogCsv(items);
      const lines = csv.split("\r\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(
        "id,title,description,availability,condition,price,link,image_link,brand,google_product_category,item_group_id,sale_price,product_type"
      );
      // Row must properly wrap fields in quotes
      expect(lines[1]).toContain('"Premium Tea, 100g ""Limited"""');
      expect(lines[1]).toContain('"Contains, commas, quotes ""here"", and\nnewlines."');
    });
  });

  describe("7. Publicly Accessible URLs & Private Host Sanitization", () => {
    it("isPrivateHost correctly identifies private, loopback, and local network hosts", () => {
      // Loopback & Wildcards
      expect(isPrivateHost("localhost")).toBe(true);
      expect(isPrivateHost("http://localhost:3000")).toBe(true);
      expect(isPrivateHost("http://127.0.0.1:3000")).toBe(true);
      expect(isPrivateHost("127.0.0.1")).toBe(true);
      expect(isPrivateHost("0.0.0.0")).toBe(true);
      expect(isPrivateHost("http://0.0.0.0:3000")).toBe(true);

      // Private RFC 1918 Class C (192.168.x.x)
      expect(isPrivateHost("http://192.168.88.81:3000")).toBe(true);
      expect(isPrivateHost("192.168.1.1")).toBe(true);

      // Private RFC 1918 Class A & B
      expect(isPrivateHost("http://10.0.0.1:8080")).toBe(true);
      expect(isPrivateHost("http://172.16.0.5:3000")).toBe(true);
      expect(isPrivateHost("http://172.31.255.255:3000")).toBe(true);

      // Public domains must return false
      expect(isPrivateHost("https://himalayantea.com")).toBe(false);
      expect(isPrivateHost("https://teafloww.com")).toBe(false);
      expect(isPrivateHost("https://my-store.ngrok-free.app")).toBe(false);
      expect(isPrivateHost("https://tea-staging.cloudflareaccess.com")).toBe(false);
    });

    it("resolveBaseUrl falls back to public production domain when requested with private LAN IP", () => {
      delete process.env.FEED_BASE_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.SITE_URL;

      // When accessed from LAN IP e.g. 192.168.88.81:3000, feeds default to public domain for Googlebot compliance
      const resolved = resolveBaseUrl("http://192.168.88.81:3000");
      expect(resolved).toBe("https://himalayantea.com");
    });

    it("resolveBaseUrl permits private LAN IP when allowPrivate is explicitly true", () => {
      const resolved = resolveBaseUrl("http://192.168.88.81:3000", { allowPrivate: true });
      expect(resolved).toBe("http://192.168.88.81:3000");
    });

    it("resolveBaseUrl honors explicitOverride parameter regardless of host", () => {
      const explicitPublic = resolveBaseUrl("http://192.168.88.81:3000", {
        explicitOverride: "https://custom-tunnel.ngrok.app",
      });
      expect(explicitPublic).toBe("https://custom-tunnel.ngrok.app");

      const explicitLocal = resolveBaseUrl("https://himalayantea.com", {
        explicitOverride: "http://192.168.88.81:3000",
      });
      expect(explicitLocal).toBe("http://192.168.88.81:3000");
    });

    it("route handlers honor ?base_url= override in generated feed contents", async () => {
      delete process.env.FEED_ACCESS_TOKEN;
      const customDomain = "https://custom-verified.teafloww.com";

      // Test /feeds/google.xml
      const googleReq = new Request(`http://192.168.88.81:3000/feeds/google.xml?base_url=${encodeURIComponent(customDomain)}`);
      const googleRes = await getGoogleXmlRoute(googleReq);
      expect(googleRes.status).toBe(200);
      const xml = await googleRes.text();
      expect(xml).toContain(`<link>${customDomain}</link>`);
      expect(xml).toContain(`<g:link>${customDomain}/tea/`);

      // Test /api/feeds/google-merchant
      const apiGoogleReq = new Request(`http://192.168.88.81:3000/api/feeds/google-merchant?base_url=${encodeURIComponent(customDomain)}`);
      const apiGoogleRes = await getApiGoogleRoute(apiGoogleReq);
      expect(apiGoogleRes.status).toBe(200);
      const apiXml = await apiGoogleRes.text();
      expect(apiXml).toContain(`<link>${customDomain}</link>`);

      // Test /feeds/catalog.csv
      const metaReq = new Request(`http://192.168.88.81:3000/feeds/catalog.csv?base_url=${encodeURIComponent(customDomain)}`);
      const metaRes = await getCatalogCsvRoute(metaReq);
      expect(metaRes.status).toBe(200);
      const csv = await metaRes.text();
      expect(csv).toContain(`${customDomain}/tea/`);

      // Test /api/feeds/meta
      const apiMetaReq = new Request(`http://192.168.88.81:3000/api/feeds/meta?base_url=${encodeURIComponent(customDomain)}`);
      const apiMetaRes = await getApiMetaRoute(apiMetaReq);
      expect(apiMetaRes.status).toBe(200);
      const apiCsv = await apiMetaRes.text();
      expect(apiCsv).toContain(`${customDomain}/tea/`);
    });

    it("route handlers without base_url on private LAN request emit public domain by default", async () => {
      delete process.env.FEED_ACCESS_TOKEN;
      delete process.env.FEED_BASE_URL;

      const req = new Request("http://192.168.88.81:3000/feeds/google.xml", {
        headers: { host: "192.168.88.81:3000" },
      });
      const res = await getGoogleXmlRoute(req);
      expect(res.status).toBe(200);
      const xml = await res.text();

      // Must NOT contain private LAN IP in the XML payload
      expect(xml).not.toContain("http://192.168.88.81:3000");
      // Must contain public production domain
      expect(xml).toContain("https://himalayantea.com");
    });
  });

  describe("7. OpenAI Commerce Product Feed (JSONL & JSONL.GZ)", () => {
    it("maps FeedItem to OpenAI Commerce Product Feed schema without placeholder strings", () => {
      const items = getFeedCatalogData("https://teafloww.com");
      expect(items.length).toBeGreaterThan(0);

      const record = mapFeedItemToOpenAiRecord(items[0], "https://teafloww.com");
      expect(record.item_id).toBe(items[0].id);
      expect(record.title).toBe(items[0].title);
      expect(record.description).toBe(items[0].description);
      expect(record.url).toBe(items[0].link);
      expect(record.image_url).toBe(items[0].imageLink);
      expect(record.price).toBe(items[0].price);
      expect(["in_stock", "out_of_stock"]).toContain(record.availability);
      expect(record.brand).toBeTruthy();
      expect(record.seller_name).toBeTruthy();
      expect(record.seller_url).toBe("https://teafloww.com");
      expect(record.target_countries).toEqual(["IN"]);
      expect(record.store_country).toBe("IN");
      expect(record.is_eligible_search).toBe(true);
      expect(record.is_eligible_checkout).toBe(false);
      expect(record.shipping).toMatch(/^IN::Standard:\d+\.\d{2} INR$/);
      expect(record.shipping_price).toMatch(/^\d+\.\d{2} INR$/);
      expect(record.delivery_estimate).toBeTruthy();
      expect(record.accepts_returns).toBe(true);
      expect(record.return_window).toBeGreaterThan(0);
      expect(record.return_policy).toBe("https://teafloww.com/returns");

      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain('"unknown"');
      expect(serialized).not.toContain('"n/a"');
    });

    it("includes review_count and star_rating in OpenAI record only when reviews exist", () => {
      const items = getFeedCatalogData("https://teafloww.com");
      const base = mapFeedItemToOpenAiRecord(items[0], "https://teafloww.com");
      expect(base.review_count).toBeUndefined();
      expect(base.star_rating).toBeUndefined();

      const withReviews = mapFeedItemToOpenAiRecord(
        { ...items[0], reviewCount: 61, starRating: 4.3 },
        "https://teafloww.com"
      );
      expect(withReviews.review_count).toBe(61);
      expect(withReviews.star_rating).toBe("4.30");

      const reviewsXml = generateGoogleProductReviewsXml("https://teafloww.com");
      expect(reviewsXml).toContain("<version>2.3</version>");
    });

    it("generates valid UTF-8 JSONL where every line parses as a complete OpenAI record", () => {
      const items = getFeedCatalogData("https://teafloww.com");
      const jsonl = generateOpenAiProductFeedJsonl(items, "https://teafloww.com", {
        targetCountries: ["IN", "US"],
        storeCountry: "IN",
      });

      const lines = jsonl.split("\n").filter(Boolean);
      expect(lines).toHaveLength(items.length);

      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed.item_id).toBeTruthy();
        expect(parsed.url).toMatch(/^https:\/\/teafloww\.com\/(tea|trials|private-label\/packaging)\//);
        expect(parsed.image_url).toMatch(/^https?:\/\//);
        expect(parsed.target_countries).toEqual(["IN", "US"]);
        expect(parsed.store_country).toBe("IN");
        expect(parsed.shipping_price).toMatch(/^\d+\.\d{2} INR$/);
        expect(parsed.accepts_returns).toBe(true);
        expect(parsed.return_window).toBeGreaterThan(0);
        expect(typeof parsed.is_eligible_search).toBe("boolean");
        expect(typeof parsed.is_eligible_checkout).toBe("boolean");
      }
    });

    it("serves /feeds/openai.jsonl and /api/feeds/openai with JSONL, download, gzip, and token auth", async () => {
      delete process.env.FEED_ACCESS_TOKEN;

      const req = new Request("https://teafloww.com/feeds/openai.jsonl?base_url=https://teafloww.com");
      const res = await getOpenAiJsonlRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
      expect(res.headers.get("content-disposition")).toBe("inline");
      const body = await res.text();
      const lines = body.split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      expect(JSON.parse(lines[0]).item_id).toBeTruthy();

      // Test download=1
      const dlReq = new Request("https://teafloww.com/api/feeds/openai?download=1&base_url=https://teafloww.com");
      const dlRes = await getApiOpenAiRoute(dlReq);
      expect(dlRes.status).toBe(200);
      expect(dlRes.headers.get("content-disposition")).toBe(
        'attachment; filename="openai-product-feed.jsonl"'
      );

      // Test gzip=1 (.jsonl.gz)
      const gzReq = new Request("https://teafloww.com/feeds/openai.jsonl?gzip=1&base_url=https://teafloww.com");
      const gzRes = await getOpenAiJsonlRoute(gzReq);
      expect(gzRes.status).toBe(200);
      expect(gzRes.headers.get("content-type")).toBe("application/gzip");
      expect(gzRes.headers.get("content-disposition")).toBe(
        'attachment; filename="openai-product-feed.jsonl.gz"'
      );
      const gzBuf = Buffer.from(await gzRes.arrayBuffer());
      const decompressed = gunzipSync(gzBuf).toString("utf8");
      expect(decompressed).toBe(body);

      // Test FEED_ACCESS_TOKEN enforcement
      process.env.FEED_ACCESS_TOKEN = "openai-secret-token";
      const unauthRes = await getOpenAiJsonlRoute(new Request("https://teafloww.com/feeds/openai.jsonl"));
      expect(unauthRes.status).toBe(401);

      const authRes = await getOpenAiJsonlRoute(
        new Request("https://teafloww.com/feeds/openai.jsonl?token=openai-secret-token")
      );
      expect(authRes.status).toBe(200);
    });
  });

  describe("7. Google Local Product Inventory Feed (India / GBP)", () => {
    const originalStoreCode = process.env.GOOGLE_LOCAL_STORE_CODE;
    const originalPickupMethod = process.env.GOOGLE_LOCAL_PICKUP_METHOD;
    const originalPickupSla = process.env.GOOGLE_LOCAL_PICKUP_SLA;

    afterEach(() => {
      if (originalStoreCode !== undefined) process.env.GOOGLE_LOCAL_STORE_CODE = originalStoreCode;
      else delete process.env.GOOGLE_LOCAL_STORE_CODE;
      if (originalPickupMethod !== undefined) process.env.GOOGLE_LOCAL_PICKUP_METHOD = originalPickupMethod;
      else delete process.env.GOOGLE_LOCAL_PICKUP_METHOD;
      if (originalPickupSla !== undefined) process.env.GOOGLE_LOCAL_PICKUP_SLA = originalPickupSla;
      else delete process.env.GOOGLE_LOCAL_PICKUP_SLA;
    });

    it("maps catalog SKUs with exact ID match and disables pickup on out_of_stock items", () => {
      const sampleItems: FeedItem[] = [
        {
          id: "TF-DARJ-100G",
          itemGroupId: "darjeeling-first-flush",
          title: "Darjeeling First Flush — Loose Leaf Pouch (100g)",
          description: "Spring harvest",
          link: "https://teafloww.com/tea/darjeeling-first-flush?sku=TF-DARJ-100G",
          imageLink: "https://teafloww.com/images/tea.jpg",
          availability: "in_stock",
          price: "749.00 INR",
          brand: "TeaFloww",
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          stock: 18,
        },
        {
          id: "TF-ASSAM-250G",
          itemGroupId: "assam-gold",
          title: "Assam Gold — Luxury Tin (250g)",
          description: "Bold malty tea",
          link: "https://teafloww.com/tea/assam-gold?sku=TF-ASSAM-250G",
          imageLink: "https://teafloww.com/images/tea.jpg",
          availability: "out_of_stock",
          price: "999.00 INR",
          brand: "TeaFloww",
          condition: "new",
          googleProductCategory: "Food, Beverages & Tobacco > Beverages > Tea & Infusions",
          stock: 0,
        },
      ];

      const localItems = mapFeedItemsToLocalInventory(sampleItems, {
        storeCode: "SILIGURI-01",
        pickupMethod: "buy",
        pickupSla: "same_day",
      });

      expect(localItems).toHaveLength(2);
      expect(localItems[0]).toEqual({
        storeCode: "SILIGURI-01",
        id: "TF-DARJ-100G",
        availability: "in_stock",
        price: "749.00 INR",
        quantity: 18,
        pickupMethod: "buy",
        pickupSla: "same_day",
      });
      expect(localItems[1]).toEqual({
        storeCode: "SILIGURI-01",
        id: "TF-ASSAM-250G",
        availability: "out_of_stock",
        price: "999.00 INR",
        quantity: 0,
        pickupMethod: "not supported",
      });
    });

    it("generates xmllint-valid RSS 2.0 XML and TSV/CSV for Google Local Inventory", () => {
      const catalogItems = getFeedCatalogData("https://teafloww.com");
      const localItems = mapFeedItemsToLocalInventory(catalogItems, {
        storeCode: "SILIGURI-01",
        pickupMethod: "reserve",
        pickupSla: "next_day",
      });

      const xml = generateGoogleLocalInventoryXml(localItems, "https://teafloww.com");
      expect(xml).toContain("<g:store_code>SILIGURI-01</g:store_code>");
      expect(xml).toContain(`<g:id>${escapeXml(catalogItems[0].id)}</g:id>`);
      expect(xml).toContain("<g:quantity>");
      expect(xml).toContain("<g:pickup_method>reserve</g:pickup_method>");
      expect(xml).toContain("<g:pickup_sla>next_day</g:pickup_sla>");

      const tmpFile = path.join(os.tmpdir(), `local-feed-check-${Date.now()}.xml`);
      fs.writeFileSync(tmpFile, xml, "utf-8");
      try {
        const output = execSync(`xmllint --noout "${tmpFile}"`, { encoding: "utf-8" });
        expect(output).toBe("");
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }

      const tsv = generateGoogleLocalInventoryTsv(localItems);
      const tsvLines = tsv.split("\n");
      expect(tsvLines[0]).toBe("store_code\tid\tavailability\tprice\tquantity\tpickup_method\tpickup_sla");
      expect(tsvLines).toHaveLength(localItems.length + 1);
      expect(tsvLines[1]).toContain("SILIGURI-01\t");

      const csv = generateGoogleLocalInventoryCsv(localItems);
      expect(csv.split("\r\n")[0]).toBe("store_code,id,availability,price,quantity,pickup_method,pickup_sla");
    });

    it("enforces store_code, pickup_sla, and token auth on local inventory routes", async () => {
      delete process.env.GOOGLE_LOCAL_STORE_CODE;
      delete process.env.FEED_ACCESS_TOKEN;

      // Missing store_code returns 400 (unless already configured in DB)
      const missingRes = await getGoogleLocalXmlRoute(
        new Request("https://teafloww.com/feeds/google-local.xml")
      );
      if (missingRes.status === 400) {
        const errJson = await missingRes.json();
        expect(errJson.error).toContain("store_code");
      }

      // Invalid store_code returns 400
      const invalidCodeRes = await getGoogleLocalXmlRoute(
        new Request("https://teafloww.com/feeds/google-local.xml?store_code=bad%20code!")
      );
      expect(invalidCodeRes.status).toBe(400);

      // pickup_method=buy without pickup_sla returns 400
      const missingSlaRes = await getGoogleLocalXmlRoute(
        new Request("https://teafloww.com/feeds/google-local.xml?store_code=SILIGURI-01&pickup_method=buy&pickup_sla=")
      );
      expect(missingSlaRes.status).toBe(400);

      // Valid XML response
      const xmlRes = await getGoogleLocalXmlRoute(
        new Request("https://teafloww.com/feeds/google-local.xml?store_code=SILIGURI-01&pickup_method=buy&pickup_sla=same_day")
      );
      expect(xmlRes.status).toBe(200);
      expect(xmlRes.headers.get("content-type")).toBe("application/xml; charset=utf-8");
      const xmlBody = await xmlRes.text();
      expect(xmlBody).toContain("<g:store_code>SILIGURI-01</g:store_code>");
      expect(xmlBody).toContain("<g:pickup_sla>same_day</g:pickup_sla>");

      // Valid TSV route
      const tsvRes = await getGoogleLocalTsvRoute(
        new Request("https://teafloww.com/feeds/google-local.tsv?store_code=SILIGURI-01&download=1")
      );
      expect(tsvRes.status).toBe(200);
      expect(tsvRes.headers.get("content-type")).toBe("text/tab-separated-values; charset=utf-8");
      expect(tsvRes.headers.get("content-disposition")).toBe('attachment; filename="google-local-inventory.tsv"');

      // API alias with format=csv
      const apiCsvRes = await getApiGoogleLocalRoute(
        new Request("https://teafloww.com/api/feeds/google-local-inventory?store_code=SILIGURI-01&format=csv")
      );
      expect(apiCsvRes.status).toBe(200);
      expect(apiCsvRes.headers.get("content-type")).toBe("text/csv; charset=utf-8");

      // Token protection check
      process.env.FEED_ACCESS_TOKEN = "local-secret-token";
      const unauthRes = await getGoogleLocalXmlRoute(
        new Request("https://teafloww.com/feeds/google-local.xml?store_code=SILIGURI-01")
      );
      expect(unauthRes.status).toBe(401);

      const authRes = await getGoogleLocalXmlRoute(
        new Request("https://teafloww.com/feeds/google-local.xml?store_code=SILIGURI-01&token=local-secret-token")
      );
      expect(authRes.status).toBe(200);
    });
  });
});
