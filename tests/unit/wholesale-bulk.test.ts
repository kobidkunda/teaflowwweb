import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import {
  cleanWhatsAppNumber,
  buildWhatsAppInquiryUrl,
  recordWholesaleInquiry,
  getWholesaleInquiries,
  type WholesaleInquiryInput,
} from "@/lib/wholesale";
import { getStoreSettings } from "@/lib/storeSettings";
import { GET as wholesaleGET, POST as wholesalePOST } from "@/app/api/wholesale/route";
import { PUT as settingsPUT } from "@/app/api/admin/settings/route";

describe("Wholesale & Bulk Orders Feature", () => {
  let env: TestEnv;
  let rootCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    rootCookie = getAuthCookie(env.db, "root");

    // Ensure wholesale_inquiries table exists in test DB if not yet migrated
    env.db.exec(`
      CREATE TABLE IF NOT EXISTS wholesale_inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        business_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        interest TEXT NOT NULL,
        estimated_volume TEXT NOT NULL,
        location TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_wholesale_inquiries_created_at ON wholesale_inquiries(created_at DESC);
    `);
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("WhatsApp Number Formatting and URL Generation", () => {
    it("cleans phone numbers into E.164 digits for WhatsApp wa.me links", () => {
      expect(cleanWhatsAppNumber("+91 98320 12345")).toBe("919832012345");
      expect(cleanWhatsAppNumber("+91-98320-12345")).toBe("919832012345");
      expect(cleanWhatsAppNumber("919832012345")).toBe("919832012345");
      expect(cleanWhatsAppNumber("")).toBe("919832012345"); // fallback default
    });

    it("constructs a properly encoded wa.me URL with all inquiry details", () => {
      const inquiry: WholesaleInquiryInput = {
        name: "Vikram Sen",
        business_name: "The Himalayan Roastery & Tea Bar",
        email: "vikram@himalayanroastery.com",
        phone: "+91 98765 43210",
        interest: "Single-Estate Orthodox Teas (Darjeeling, Assam, Kangra)",
        estimated_volume: "25 – 100 kg",
        location: "Kolkata, West Bengal",
        notes: "Require FTGFOP1 First Flush sample lots.",
      };

      const url = buildWhatsAppInquiryUrl({
        whatsappNumber: "+91 98320 12345",
        inquiry,
      });

      expect(url).toContain("https://wa.me/919832012345?text=");
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain("Vikram Sen");
      expect(decoded).toContain("The Himalayan Roastery & Tea Bar");
      expect(decoded).toContain("vikram@himalayanroastery.com");
      expect(decoded).toContain("+91 98765 43210");
      expect(decoded).toContain("Single-Estate Orthodox Teas");
      expect(decoded).toContain("25 – 100 kg");
      expect(decoded).toContain("Kolkata, West Bengal");
      expect(decoded).toContain("Require FTGFOP1 First Flush sample lots.");
    });
  });

  describe("Wholesale Inquiry Persistence", () => {
    it("records a wholesale inquiry to SQLite database and returns generated whatsappUrl", () => {
      const inquiry: WholesaleInquiryInput = {
        name: "Ananya Roy",
        business_name: "Darjeeling Mist Cafe",
        email: "ananya@darjeelingmist.in",
        phone: "+91 94321 00000",
        interest: "Specialty High-Grown Green & White Teas",
        estimated_volume: "5 – 25 kg",
        location: "Siliguri, India",
        notes: "Interested in Silver Needle white tea samples.",
      };

      const result = recordWholesaleInquiry(inquiry);
      expect(result.id).toBeGreaterThan(0);
      expect(result.whatsappUrl).toContain("https://wa.me/");

      const list = getWholesaleInquiries(10);
      const found = list.find((i) => i.id === result.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe("Ananya Roy");
      expect(found?.business_name).toBe("Darjeeling Mist Cafe");
      expect(found?.email).toBe("ananya@darjeelingmist.in");
      expect(found?.status).toBe("new");
    });
  });

  describe("API Route: /api/wholesale", () => {
    it("returns active whatsappNumber via GET /api/wholesale", async () => {
      const res = await wholesaleGET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.whatsappNumber).toBeDefined();
    });

    it("rejects invalid submission with 400 Bad Request", async () => {
      const req = new Request("http://localhost/api/wholesale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "A", // too short
          email: "not-an-email",
        }),
      });

      const res = await wholesalePOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Validation failed");
    });

    it("accepts valid inquiry submission via POST /api/wholesale and returns WhatsApp URL", async () => {
      const validPayload = {
        name: "Rohit Malhotra",
        business_name: "Altitude Tea Lounge",
        email: "rohit@altitudetea.com",
        phone: "+91 98111 22233",
        interest: "Premium CTC & Special Masala Chai Blends",
        estimated_volume: "100 – 500 kg",
        location: "New Delhi",
        notes: "Bulk export to UAE distributor.",
      };

      const req = new Request("http://localhost/api/wholesale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const res = await wholesalePOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.id).toBeGreaterThan(0);
      expect(data.whatsappUrl).toContain("https://wa.me/");
      expect(data.whatsappUrl).toContain(encodeURIComponent("Altitude Tea Lounge"));
    });
  });

  describe("Settings Integration: Dynamic WhatsApp Number in Settings", () => {
    it("allows admin to configure custom WhatsApp helpline in operational settings", async () => {
      const updatePayload = {
        store_name: "Himalayan Tea House",
        currency: "INR",
        tax_rate_percent: 5,
        shipping_flat_fee_paise: 9900,
        free_shipping_threshold_paise: 150000,
        contact_email: "concierge@himalayantea.com",
        whatsapp_number: "+91 70012 34567",
      };

      const req = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const res = await settingsPUT(req);
      expect(res.status).toBe(200);

      // Verify settings in DB
      const current = getStoreSettings();
      expect(current.whatsapp_number).toBe("+91 70012 34567");

      // Verify new wholesale inquiry uses the updated WhatsApp number
      const testInquiry: WholesaleInquiryInput = {
        name: "Pooja Mehta",
        business_name: "Mountain Mist Boutique",
        email: "pooja@mountainmist.in",
        phone: "+91 98222 33445",
        interest: "Estate Sample Tasting Kit (5 Selected Grades)",
        estimated_volume: "5 – 25 kg",
      };

      const recorded = recordWholesaleInquiry(testInquiry);
      expect(recorded.whatsappUrl).toContain("https://wa.me/917001234567");
    });
  });
});
