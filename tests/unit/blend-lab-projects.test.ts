import { describe, it, expect } from "vitest";
import { createProjectDraft, getProjectByPublicId } from "@/lib/blend-lab/projects";
import { BLEND_LAB_PLANS } from "@/lib/blend-lab/plans";

describe("Blend Lab Projects Storage & Idempotency", () => {
  it("creates a draft project and preserves server-side integer pricing in paise", () => {
    const key = `test_idempotent_${Date.now()}_${Math.random()}`;
    const payload = {
      planCode: "MATCH_QUOTE" as const,
      idempotencyKey: key,
      sampleInfo: {
        category: "CTC" as const,
        leafGrade: "BP",
        sampleWeightGrams: 100,
        primaryUseCase: "Chai test",
      },
      commercialGoals: {
        goalType: "lower_cost" as const,
      },
      pickupDetails: {
        contactName: "Rajesh Sharma",
        email: "rajesh@example.com",
        phone: "9876543210",
        addressLine1: "Station Feeder Road",
        city: "Siliguri",
        state: "West Bengal",
        pincode: "734005",
      },
      acceptedTermsVersion: "2026-v1",
    };

    const res1 = createProjectDraft(payload);
    expect(res1.reused).toBe(false);
    expect(res1.project.totalPaise).toBe(BLEND_LAB_PLANS.MATCH_QUOTE.totalPaise);
    expect(res1.project.publicId).toMatch(/^bl_proj_/);

    // Test Idempotency: Re-submitting with identical key must return existing project
    const res2 = createProjectDraft(payload);
    expect(res2.reused).toBe(true);
    expect(res2.project.id).toBe(res1.project.id);
    expect(res2.project.publicId).toBe(res1.project.publicId);

    // Test fetch by publicId
    const fetched = getProjectByPublicId(res1.project.publicId);
    expect(fetched).not.toBeNull();
    expect(fetched?.publicId).toBe(res1.project.publicId);
    expect(fetched?.totalPaise).toBe(29900);
  });
});
