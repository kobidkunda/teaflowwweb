import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import {
  dispatchToolCall,
  listToolDefinitions,
  dispatchResourceRead,
  dispatchCompletion,
  McpError,
} from "../../src/lib/mcp";
import { createProjectDraft } from "../../src/lib/blend-lab/projects";
import { resetRateLimits } from "../../src/lib/rateLimit";

const TEST_DB = path.join(tmpdir(), `blend-lab-admin-mcp-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
process.env.ADMIN_USERNAME = "root";

const { hashPassword } = await import("../../src/lib/password");
process.env.ADMIN_PASSWORD_HASH = hashPassword("test-root-password-123");

const { POST: loginPOST } = await import("../../src/app/api/admin/login/route");
const { GET: plansGET, PUT: plansPUT } = await import("../../src/app/api/admin/blend-lab/plans/route");
const { GET: projectsGET } = await import("../../src/app/api/admin/blend-lab/projects/route");
const { GET: projectItemGET, PATCH: projectItemPATCH } = await import("../../src/app/api/admin/blend-lab/projects/[id]/route");
const { GET: coverageGET, POST: coveragePOST, DELETE: coverageDELETE } = await import("../../src/app/api/admin/blend-lab/coverage/route");
const { GET: contentGET, PUT: contentPUT } = await import("../../src/app/api/admin/blend-lab/content/route");

async function getAdminCookie(): Promise<string> {
  const res = await loginPOST(
    new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "root", password: "test-root-password-123" }),
    })
  );
  return res.headers.get("Set-Cookie") ?? "";
}

describe("TeaFloww Blend Lab — Admin & MCP Tooling Full Verification", () => {
  let cookie: string;

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
    resetRateLimits();
    cookie = await getAdminCookie();
  });

  afterAll(() => {
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try {
        rmSync(TEST_DB + suffix, { force: true });
      } catch {
        /* ignore */
      }
    }
  });

  describe("MCP Tool Definitions & Registration", () => {
    it("registers all 12 Blend Lab tools in MCP tool list", () => {
      const tools = listToolDefinitions();
      const names = tools.map((t) => t.name);

      expect(names).toContain("blendLab.listPlans");
      expect(names).toContain("blendLab.getPlan");
      expect(names).toContain("blendLab.upsertPlan");
      expect(names).toContain("blendLab.listProjects");
      expect(names).toContain("blendLab.getProject");
      expect(names).toContain("blendLab.updateProject");
      expect(names).toContain("blendLab.listCoverage");
      expect(names).toContain("blendLab.checkCoverage");
      expect(names).toContain("blendLab.upsertCoverage");
      expect(names).toContain("blendLab.deleteCoverage");
      expect(names).toContain("blendLab.getContent");
      expect(names).toContain("blendLab.updateContent");
    });
  });

  describe("MCP Plans Management (blendLab.listPlans, getPlan, upsertPlan)", () => {
    it("lists service plans with database-backed prices and features", () => {
      const res = dispatchToolCall("blendLab.listPlans", {}) as { plans: Array<{ code: string; totalPaise: number }> };
      expect(res.plans.length).toBeGreaterThanOrEqual(3);

      const codes = res.plans.map((p) => p.code);
      expect(codes).toContain("MATCH_QUOTE");
      expect(codes).toContain("QUALITY_AUDIT");
      expect(codes).toContain("SIGNATURE");
    });

    it("gets single plan details by code", () => {
      const res = dispatchToolCall("blendLab.getPlan", { code: "SIGNATURE" }) as {
        plan: { code: string; totalPaise: number; title: string };
      };
      expect(res.plan.code).toBe("SIGNATURE");
      expect(res.plan.totalPaise).toBe(299900);
      expect(res.plan.title).toContain("Signature Blend");
    });

    it("throws McpError on unknown plan code", () => {
      expect(() => dispatchToolCall("blendLab.getPlan", { code: "NON_EXISTENT" })).toThrow(McpError);
    });

    it("updates plan price and title via upsertPlan", () => {
      const updateRes = dispatchToolCall("blendLab.upsertPlan", {
        code: "MATCH_QUOTE",
        title: "Match & Quote Sourcing Tier",
        totalPaise: 34900,
        taxRateBps: 1800,
        features: ["Inbound sample collection", "Sensory report summary", "Wholesale offer"],
      }) as { plan: { code: string; totalPaise: number; title: string; features: string[] } };

      expect(updateRes.plan.totalPaise).toBe(34900);
      expect(updateRes.plan.title).toBe("Match & Quote Sourcing Tier");
      expect(updateRes.plan.features).toContain("Inbound sample collection");

      // Verify retrieval reflects the updated value
      const getRes = dispatchToolCall("blendLab.getPlan", { code: "MATCH_QUOTE" }) as {
        plan: { totalPaise: number; title: string };
      };
      expect(getRes.plan.totalPaise).toBe(34900);
      expect(getRes.plan.title).toBe("Match & Quote Sourcing Tier");
    });
  });

  describe("MCP Coverage Management (blendLab.listCoverage, checkCoverage, upsertCoverage, deleteCoverage)", () => {
    it("checks serviceable origin and hub PINs", () => {
      const checkRes = dispatchToolCall("blendLab.checkCoverage", { pincode: "734001" }) as {
        serviceable: boolean;
        city: string;
      };
      expect(checkRes.serviceable).toBe(true);
      expect(checkRes.city).toBe("Siliguri");
    });

    it("adds or updates a new PIN coverage override", () => {
      const upsertRes = dispatchToolCall("blendLab.upsertCoverage", {
        pincode: "734015",
        city: "Siliguri Works",
        state: "West Bengal",
        carrier: "Local Origin Express",
        estimatedDays: 1,
        serviceable: true,
      }) as { coverage: { pincode: string; city: string; carrier: string } };

      expect(upsertRes.coverage.pincode).toBe("734015");
      expect(upsertRes.coverage.city).toBe("Siliguri Works");

      const listRes = dispatchToolCall("blendLab.listCoverage", { search: "734015" }) as {
        coverage: Array<{ pincode: string }>;
        total: number;
      };
      expect(listRes.total).toBeGreaterThanOrEqual(1);
    });

    it("deletes a PIN coverage override", () => {
      const delRes = dispatchToolCall("blendLab.deleteCoverage", { pincode: "734015" }) as { success: boolean };
      expect(delRes.success).toBe(true);
    });
  });

  describe("MCP Content & Media Management (blendLab.getContent, updateContent)", () => {
    it("retrieves current Blend Lab content blocks and placements", () => {
      const res = dispatchToolCall("blendLab.getContent", {}) as {
        texts: { heroTitle: string; homeTitle: string };
        faqs: Array<{ question: string }>;
      };
      expect(res.texts).toBeDefined();
      expect(res.texts.heroTitle).toBeDefined();
      expect(res.faqs.length).toBeGreaterThan(0);
    });

    it("updates marketing copy, hero placement, and FAQs", () => {
      const updated = dispatchToolCall("blendLab.updateContent", {
        heroEyebrow: "ATELIER TEST LAB",
        heroTitle: "Precision Tea Diagnostics & Development",
        heroImage: {
          imageUrl: "/uploads/blend-lab-hero-test.jpg",
          altText: "Custom cupping atelier table",
        },
        faqs: [
          { question: "Can I submit 2 samples?", answer: "Yes, you can initiate two project tickets." },
        ],
      }) as {
        texts: { heroEyebrow: string; heroTitle: string };
        heroPlacement: { image_url: string; alt_text: string };
        faqs: Array<{ question: string }>;
      };

      expect(updated.texts.heroEyebrow).toBe("ATELIER TEST LAB");
      expect(updated.texts.heroTitle).toBe("Precision Tea Diagnostics & Development");
      expect(updated.heroPlacement.image_url).toBe("/uploads/blend-lab-hero-test.jpg");
      expect(updated.faqs[0].question).toBe("Can I submit 2 samples?");
    });
  });

  describe("MCP Projects Management (blendLab.listProjects, getProject, updateProject)", () => {
    let createdPublicId: string;

    beforeAll(() => {
      const { project } = createProjectDraft(
        {
          planCode: "SIGNATURE",
          sampleInfo: {
            category: "CTC",
            leafGrade: "BP",
            currentPurchasePricePerKg: 380,
            sampleWeightGrams: 200,
            primaryUseCase: "Cafe Chai",
          },
          commercialGoals: {
            goalType: "lower_cost",
            targetPricePerKg: 340,
            notes: "Needs strong malty liquor.",
            sensorySliders: { strength: 5, aroma: 4 },
          },
          pickupDetails: {
            contactName: "Arun Sharma",
            email: "arun@himalayancafe.in",
            phone: "9876543210",
            businessName: "Himalayan Cafe Chain",
            addressLine1: "12 Hill Cart Road",
            city: "Siliguri",
            state: "West Bengal",
            pincode: "734001",
          },
          acceptedTermsVersion: "2026-v1",
          idempotencyKey: "test-admin-mcp-key-1",
        },
        "customer-123"
      );
      createdPublicId = project.publicId;
    });

    it("lists intake projects including the test lead", () => {
      const res = dispatchToolCall("blendLab.listProjects", { search: "Arun" }) as {
        projects: Array<{ publicId: string; contactName: string }>;
        total: number;
      };
      expect(res.total).toBeGreaterThanOrEqual(1);
      expect(res.projects.some((p) => p.publicId === createdPublicId)).toBe(true);
    });

    it("retrieves full project record by public ID", () => {
      const res = dispatchToolCall("blendLab.getProject", { idOrPublicId: createdPublicId }) as {
        project: { publicId: string; sampleInfo?: { category: string } };
      };
      expect(res.project.publicId).toBe(createdPublicId);
      expect(res.project.sampleInfo?.category).toBe("CTC");
    });

    it("updates project workflow state and notes", () => {
      const res = dispatchToolCall("blendLab.updateProject", {
        idOrPublicId: createdPublicId,
        workflowState: "sample_received",
        notes: "Sample arrived intact in Siliguri lab.",
      }) as { project: { workflowState: string; commercialGoals?: { notes?: string } } };

      expect(res.project.workflowState).toBe("sample_received");
      expect(res.project.commercialGoals?.notes).toBe("Sample arrived intact in Siliguri lab.");
    });
  });

  describe("MCP Resources & Autocomplete Completion", () => {
    it("dispatches static resource reads for Blend Lab", () => {
      const plansRes = dispatchResourceRead("tea://blend-lab/plans");
      expect(plansRes.contents[0].text).toContain("MATCH_QUOTE");

      const contentRes = dispatchResourceRead("tea://blend-lab/content");
      expect(contentRes.contents[0].text).toContain("heroTitle");

      const projectsRes = dispatchResourceRead("tea://blend-lab/projects");
      expect(projectsRes.contents[0].text).toContain("projects");
    });

    it("provides autocomplete suggestions for planCode and workflowState", () => {
      const planComp = dispatchCompletion(null, { name: "planCode", value: "sign" });
      expect(planComp.completion.values).toContain("SIGNATURE");

      const statusComp = dispatchCompletion(null, { name: "workflowState", value: "sample" });
      expect(statusComp.completion.values).toContain("sample_received");
    });
  });

  describe("Admin HTTP APIs (/api/admin/blend-lab/*)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await plansGET(new Request("http://localhost/api/admin/blend-lab/plans"));
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/blend-lab/plans returns plans with staff cookie", async () => {
      const res = await plansGET(
        new Request("http://localhost/api/admin/blend-lab/plans", {
          headers: { Cookie: cookie },
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.plans.length).toBeGreaterThanOrEqual(3);
    });

    it("PUT /api/admin/blend-lab/plans updates plan", async () => {
      const res = await plansPUT(
        new Request("http://localhost/api/admin/blend-lab/plans", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            code: "QUALITY_AUDIT",
            title: "Commercial Quality Audit",
            totalPaise: 219900,
            taxRateBps: 1800,
          }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.plan.totalPaise).toBe(219900);
      expect(data.plan.title).toBe("Commercial Quality Audit");
    });

    it("GET /api/admin/blend-lab/projects returns projects list", async () => {
      const res = await projectsGET(
        new Request("http://localhost/api/admin/blend-lab/projects", {
          headers: { Cookie: cookie },
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.projects).toBeDefined();
    });

    it("GET & PATCH /api/admin/blend-lab/projects/[id] updates state", async () => {
      // First get any project id
      const listRes = await projectsGET(
        new Request("http://localhost/api/admin/blend-lab/projects", {
          headers: { Cookie: cookie },
        })
      );
      const listData = await listRes.json();
      const proj = listData.projects[0];

      const getRes = await projectItemGET(
        new Request(`http://localhost/api/admin/blend-lab/projects/${proj.id}`, {
          headers: { Cookie: cookie },
        }),
        { params: Promise.resolve({ id: proj.id }) }
      );
      expect(getRes.status).toBe(200);

      const patchRes = await projectItemPATCH(
        new Request(`http://localhost/api/admin/blend-lab/projects/${proj.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            workflowState: "cupping_in_progress",
            notes: "Cupping underway with lot 42.",
          }),
        }),
        { params: Promise.resolve({ id: proj.id }) }
      );
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.project.workflowState).toBe("cupping_in_progress");
    });

    it("GET, POST, DELETE /api/admin/blend-lab/coverage manages PIN codes", async () => {
      // POST
      const postRes = await coveragePOST(
        new Request("http://localhost/api/admin/blend-lab/coverage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            pincode: "110001",
            city: "New Delhi",
            state: "Delhi",
            carrier: "Blue Dart Air",
            estimatedDays: 2,
            serviceable: true,
          }),
        })
      );
      expect(postRes.status).toBe(200);

      // GET
      const getRes = await coverageGET(
        new Request("http://localhost/api/admin/blend-lab/coverage?search=110001", {
          headers: { Cookie: cookie },
        })
      );
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.coverage.some((c: { pincode: string }) => c.pincode === "110001")).toBe(true);

      // DELETE
      const delRes = await coverageDELETE(
        new Request("http://localhost/api/admin/blend-lab/coverage?pincode=110001", {
          method: "DELETE",
          headers: { Cookie: cookie },
        })
      );
      expect(delRes.status).toBe(200);
    });

    it("GET & PUT /api/admin/blend-lab/content updates content and image placements", async () => {
      const getRes = await contentGET(
        new Request("http://localhost/api/admin/blend-lab/content", {
          headers: { Cookie: cookie },
        })
      );
      expect(getRes.status).toBe(200);

      const putRes = await contentPUT(
        new Request("http://localhost/api/admin/blend-lab/content", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            homeTitle: "Is your tea as competitive as it could be?",
            heroTitle: "Your tea. Our expertise. A better way to blend.",
            homeImage: {
              imageUrl: "/uploads/home-blend-lab.jpg",
              altText: "Bespoke cupping table",
            },
          }),
        })
      );
      expect(putRes.status).toBe(200);
      const putData = await putRes.json();
      expect(putData.texts.homeTitle).toBe("Is your tea as competitive as it could be?");
      expect(putData.homePlacement.image_url).toBe("/uploads/home-blend-lab.jpg");
    });
  });
});
