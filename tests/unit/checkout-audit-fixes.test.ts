import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET as pincodeLookupGet } from "@/app/api/shipping/pincode-lookup/route";
import { getAnnouncementSettings } from "@/lib/contentBlocks";
import { getStoreSettings } from "@/lib/storeSettings";
import { getDeliverySettings } from "@/lib/deliverySettings";

describe("Checkout & Storefront Audit Fixes", () => {
  test("pincode-lookup resolves Siliguri / West Bengal for 734001 and rejects invalid PINs", async () => {
    const badReq = new NextRequest("http://localhost:3000/api/shipping/pincode-lookup?pincode=12345");
    const badRes = await pincodeLookupGet(badReq);
    expect(badRes.status).toBe(400);

    const okReq = new NextRequest("http://localhost:3000/api/shipping/pincode-lookup?pincode=734001");
    const okRes = await pincodeLookupGet(okReq);
    expect(okRes.status).toBe(200);
    const data = await okRes.json();
    expect(data.ok).toBe(true);
    expect(data.state).toBe("West Bengal");
    expect(data.city.toLowerCase()).toContain("siliguri");
  });

  test("free-shipping announcement and store settings stay unified with deliverySettings", () => {
    const delivery = getDeliverySettings();
    const store = getStoreSettings();
    const announcement = getAnnouncementSettings();

    const expectedRupees = Math.round(store.free_shipping_threshold_paise / 100);
    expect(delivery.free_shipping_threshold_rupees).toBe(expectedRupees);
    if (announcement.text.includes("FREE SHIPPING ON ORDERS ABOVE")) {
      expect(announcement.text).toContain(`₹${expectedRupees}`);
    }
    expect(announcement.text).not.toContain("₹999");
  });
});
