import { describe, it, expect } from "vitest";
import {
  pincodeCoverageSchema,
  intakeDraftSchema,
  sampleInfoSchema,
  pickupDetailsSchema,
} from "@/lib/blend-lab/validation";

describe("Blend Lab Zod Validation Schemas", () => {
  it("validates 6-digit Indian PIN codes correctly", () => {
    expect(pincodeCoverageSchema.safeParse({ pincode: "700001" }).success).toBe(true);
    expect(pincodeCoverageSchema.safeParse({ pincode: "110001" }).success).toBe(true);
    expect(pincodeCoverageSchema.safeParse({ pincode: "734005" }).success).toBe(true);

    // Invalid PIN codes
    expect(pincodeCoverageSchema.safeParse({ pincode: "012345" }).success).toBe(false); // starts with 0
    expect(pincodeCoverageSchema.safeParse({ pincode: "70001" }).success).toBe(false); // only 5 digits
    expect(pincodeCoverageSchema.safeParse({ pincode: "7000001" }).success).toBe(false); // 7 digits
    expect(pincodeCoverageSchema.safeParse({ pincode: "ABCDEF" }).success).toBe(false); // letters
  });

  it("validates sample details correctly", () => {
    const validSample = {
      category: "CTC",
      leafGrade: "BP Standard",
      currentPurchasePricePerKg: 320,
      sampleWeightGrams: 100,
      primaryUseCase: "Milk chai commercial preparation",
    };
    expect(sampleInfoSchema.safeParse(validSample).success).toBe(true);

    // Too small sample
    expect(
      sampleInfoSchema.safeParse({
        ...validSample,
        sampleWeightGrams: 10,
      }).success
    ).toBe(false);
  });

  it("validates pickup contact information and rejects malformed phones/emails", () => {
    const validPickup = {
      contactName: "Vikram Sen",
      businessName: "Sen Tea Traders",
      email: "vikram@example.com",
      phone: "9876543210",
      addressLine1: "12/4 Hill Cart Road",
      city: "Siliguri",
      state: "West Bengal",
      pincode: "734001",
    };
    expect(pickupDetailsSchema.safeParse(validPickup).success).toBe(true);

    // Invalid phone (not 10 digits or doesn't start with 6-9)
    expect(
      pickupDetailsSchema.safeParse({
        ...validPickup,
        phone: "12345",
      }).success
    ).toBe(false);

    // Invalid email
    expect(
      pickupDetailsSchema.safeParse({
        ...validPickup,
        email: "invalid-email",
      }).success
    ).toBe(false);
  });

  it("validates full intake draft submissions with idempotency key", () => {
    const validDraft = {
      planCode: "QUALITY_AUDIT",
      idempotencyKey: "test_key_12345678",
      sampleInfo: {
        category: "orthodox",
        leafGrade: "FTGFOP1",
        sampleWeightGrams: 100,
        primaryUseCase: "Single-origin restaurant service",
      },
      commercialGoals: {
        goalType: "consistent_cup",
        sensorySliders: {
          strength: 4,
          astringency: 3,
          aroma: 5,
          sweetness: 4,
        },
      },
      pickupDetails: {
        contactName: "Ananya Roy",
        email: "ananya@example.com",
        phone: "9830123456",
        addressLine1: "54 Park Street, Flat 3B",
        city: "Kolkata",
        state: "West Bengal",
        pincode: "700016",
      },
      acceptedTermsVersion: "2026-v1",
    };

    expect(intakeDraftSchema.safeParse(validDraft).success).toBe(true);
  });
});
