import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import { getStoreSettings, updateStoreSettings } from "@/lib/storeSettings";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/paymentSettings";

describe("Wholesale Payment Settings & Bank Details", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = setupAdminTestEnv();
  });

  afterAll(() => {
    env.cleanup();
  });

  it("reads default wholesale payment settings and bank details from storeSettings", () => {
    const settings = getStoreSettings();
    expect(typeof settings.wholesale_advance_percent).toBe("number");
    expect(settings.wholesale_advance_percent).toBeGreaterThanOrEqual(0);
    expect(settings.wholesale_advance_percent).toBeLessThanOrEqual(100);
    expect(settings.wholesale_bank_beneficiary).toBeDefined();
    expect(settings.wholesale_bank_name).toBeDefined();
  });

  it("updates wholesale advance percent and bank details via updateStoreSettings", () => {
    const updated = updateStoreSettings({
      wholesale_advance_percent: 25,
      wholesale_bank_beneficiary: "Nirva Tea Estate Pvt Ltd",
      wholesale_bank_name: "Kotak Mahindra Bank",
      wholesale_bank_account_number: "987654321012",
      wholesale_bank_ifsc: "KKBK0001234",
      wholesale_bank_branch: "Siliguri Commercial",
      wholesale_bank_upi_id: "nirva@kotak",
    });

    expect(updated.wholesale_advance_percent).toBe(25);
    expect(updated.wholesale_bank_beneficiary).toBe("Nirva Tea Estate Pvt Ltd");
    expect(updated.wholesale_bank_name).toBe("Kotak Mahindra Bank");
    expect(updated.wholesale_bank_account_number).toBe("987654321012");
    expect(updated.wholesale_bank_ifsc).toBe("KKBK0001234");
    expect(updated.wholesale_bank_branch).toBe("Siliguri Commercial");
    expect(updated.wholesale_bank_upi_id).toBe("nirva@kotak");

    // Verify persistence via getStoreSettings
    const fresh = getStoreSettings();
    expect(fresh.wholesale_advance_percent).toBe(25);
    expect(fresh.wholesale_bank_name).toBe("Kotak Mahindra Bank");
  });

  it("reads and updates wholesale settings via paymentSettings", () => {
    const current = getPaymentSettings();
    expect(current.wholesale_advance_percent).toBe(25);
    expect(current.wholesale_bank_name).toBe("Kotak Mahindra Bank");

    const updatedPayment = updatePaymentSettings({
      wholesale_advance_percent: 15,
      wholesale_bank_name: "State Bank of India",
      wholesale_bank_account_number: "112233445566",
      wholesale_bank_ifsc: "SBIN0000123",
      wholesale_bank_branch: "Darjeeling Main",
      wholesale_bank_beneficiary: "Nirva Wholesale",
      wholesale_bank_upi_id: "nirva@sbi",
    });

    expect(updatedPayment.wholesale_advance_percent).toBe(15);
    expect(updatedPayment.wholesale_bank_name).toBe("State Bank of India");

    // Parity check across storeSettings
    const freshStore = getStoreSettings();
    expect(freshStore.wholesale_advance_percent).toBe(15);
    expect(freshStore.wholesale_bank_name).toBe("State Bank of India");
    expect(freshStore.wholesale_bank_branch).toBe("Darjeeling Main");
  });

  it("handles 0% advance configuration for 100% direct bank transfer", () => {
    updatePaymentSettings({
      wholesale_advance_percent: 0,
    });

    const settings = getPaymentSettings();
    expect(settings.wholesale_advance_percent).toBe(0);

    const store = getStoreSettings();
    expect(store.wholesale_advance_percent).toBe(0);
  });
});
