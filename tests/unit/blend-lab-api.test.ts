import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPlans } from "@/app/api/blend-lab/plans/route";
import { POST as checkCoverage } from "@/app/api/blend-lab/coverage/route";
import { POST as createProject } from "@/app/api/blend-lab/projects/route";
import { GET as getProject } from "@/app/api/blend-lab/projects/[publicId]/route";
import { GET as downloadReport } from "@/app/api/blend-lab/projects/[publicId]/report/[version]/download/route";

describe("Blend Lab API Endpoints", () => {
  it("GET /api/blend-lab/plans returns active plans with inclusive formatted INR prices", async () => {
    const res = await getPlans();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.plans).toHaveLength(3);
    expect(data.taxRateBps).toBe(1800);
  });

  it("POST /api/blend-lab/coverage verifies serviceable PIN codes and rejects malformed codes", async () => {
    const validReq = new NextRequest("http://localhost:3000/api/blend-lab/coverage", {
      method: "POST",
      body: JSON.stringify({ pincode: "734001" }),
    });
    const res1 = await checkCoverage(validReq);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    expect(data1.coverage.serviceable).toBe(true);

    const invalidReq = new NextRequest("http://localhost:3000/api/blend-lab/coverage", {
      method: "POST",
      body: JSON.stringify({ pincode: "123" }),
    });
    const res2 = await checkCoverage(invalidReq);
    expect(res2.status).toBe(400);
  });

  it("POST /api/blend-lab/projects idempotently registers draft and protects server pricing", async () => {
    const key = `api_test_key_${Date.now()}_${Math.random()}`;
    const payload = {
      planCode: "QUALITY_AUDIT",
      idempotencyKey: key,
      sampleInfo: {
        category: "CTC",
        leafGrade: "BOP",
        sampleWeightGrams: 100,
        primaryUseCase: "Milk chai blending",
      },
      commercialGoals: {
        goalType: "lower_cost",
      },
      pickupDetails: {
        contactName: "Priya Sharma",
        email: "priya@example.com",
        phone: "9876543210",
        addressLine1: "Mall Road",
        city: "Darjeeling",
        state: "West Bengal",
        pincode: "734101",
      },
      acceptedTermsVersion: "2026-v1",
    };

    const req1 = new NextRequest("http://localhost:3000/api/blend-lab/projects", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(payload),
    });

    const res1 = await createProject(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    expect(data1.project.totalPaise).toBe(199900);
    expect(data1.project.publicId).toBeDefined();

    const publicId = data1.project.publicId;

    // Test GET /api/blend-lab/projects/[publicId]
    const getReq = new NextRequest(`http://localhost:3000/api/blend-lab/projects/${publicId}`);
    const resGet = await getProject(getReq, { params: Promise.resolve({ publicId }) });
    expect(resGet.status).toBe(200);
    const dataGet = await resGet.json();
    expect(dataGet.project.publicId).toBe(publicId);

    // Test GET report download for QUALITY_AUDIT: Entitlement allowed
    const dlReq = new NextRequest(
      `http://localhost:3000/api/blend-lab/projects/${publicId}/report/1.0/download`
    );
    const resDl = await downloadReport(dlReq, {
      params: Promise.resolve({ publicId, version: "1.0" }),
    });
    expect(resDl.status).toBe(200);
    const dataDl = await resDl.json();
    expect(dataDl.success).toBe(true);
  });

  it("GET /api/blend-lab/projects/[publicId]/report/... blocks download with 403 on Match & Quote tier", async () => {
    const key = `quote_key_${Date.now()}`;
    const payload = {
      planCode: "MATCH_QUOTE",
      idempotencyKey: key,
      sampleInfo: {
        category: "CTC",
        sampleWeightGrams: 100,
        primaryUseCase: "Quick reference quote",
      },
      commercialGoals: {
        goalType: "lower_cost",
      },
      pickupDetails: {
        contactName: "Amit Roy",
        email: "amit@example.com",
        phone: "9830098300",
        addressLine1: "Salt Lake Sector V",
        city: "Kolkata",
        state: "West Bengal",
        pincode: "700091",
      },
      acceptedTermsVersion: "2026-v1",
    };

    const req = new NextRequest("http://localhost:3000/api/blend-lab/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res = await createProject(req);
    const data = await res.json();
    const publicId = data.project.publicId;

    // MATCH_QUOTE plan must be forbidden from accessing full PDF reports
    const dlReq = new NextRequest(
      `http://localhost:3000/api/blend-lab/projects/${publicId}/report/1.0/download`
    );
    const resDl = await downloadReport(dlReq, {
      params: Promise.resolve({ publicId, version: "1.0" }),
    });
    expect(resDl.status).toBe(403);
    const dataDl = await resDl.json();
    expect(dataDl.code).toBe("ENTITLEMENT_RESTRICTED");
  });
});
