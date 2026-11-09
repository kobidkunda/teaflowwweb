import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getFeedCatalogData,
  generateGoogleMerchantXml,
  generateMetaCatalogCsv,
  escapeXml,
  isFeedAuthorized,
  feedUnauthorizedResponse,
  resolveBaseUrl,
  isPrivateHost,
  type FeedItem,
} from "@/lib/feeds";
import { GET as getGoogleXmlRoute } from "@/app/feeds/google.xml/route";
import { GET as getApiGoogleRoute } from "@/app/api/feeds/google-merchant/route";
import { GET as getCatalogCsvRoute } from "@/app/feeds/catalog.csv/route";
import { GET as getApiMetaRoute } from "@/app/api/feeds/meta/route";
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
        expect(item.link).toMatch(/^https:\/\/himalayantea\.com\/tea\/[a-z0-9-]+(\?sku=.+)?$/);
        expect(item.imageLink).toMatch(/^https?:\/\/.+/);
        expect(["in_stock", "out_of_stock"]).toContain(item.availability);
        expect(item.price).toMatch(/^\d+\.\d{2} [A-Z]{3}$/);
        expect(item.brand).toBe("Himalayan Tea House");
        expect(item.condition).toBe("new");
        expect(item.googleProductCategory).toBe(
          "Food, Beverages & Tobacco > Beverages > Tea & Infusions"
        );
        expect(item.productType).toMatch(/^Tea( > .*)?$/);
        expect(typeof item.stock).toBe("number");
        expect(item.stock).toBeGreaterThanOrEqual(0);
      }
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

    it("correctly includes packaging format and size in grams in variant title", () => {
      const items = getFeedCatalogData();
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
      expect(xml).toContain("<title>Himalayan Tea House Catalog</title>");
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
        "id,title,description,availability,condition,price,link,image_link,brand,google_product_category,item_group_id"
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
});
