import { describe, expect, it } from "vitest";
import { recordContactInquiry } from "@/lib/contact";
import { recordWholesaleInquiry } from "@/lib/wholesale";
import { captureLead } from "@/lib/leads";
import { saveNewsletterPreference } from "@/lib/newsletter";
import {
  addAdminConversationEntry,
  getAdminResponseDetail,
  listAdminResponses,
  updateAdminResponseStatus,
} from "@/lib/admin/responses";
import { GET as getAdminResponsesRoute } from "@/app/api/admin/responses/route";

describe("Admin Responses & Conversations Inbox", () => {
  it("rejects unauthenticated requests to GET /api/admin/responses with 401", () => {
    const req = new Request("http://localhost:3000/api/admin/responses");
    const res = getAdminResponsesRoute(req);
    expect(res.status).toBe(401);
  });

  it("lists submissions across categories, updates status, and persists conversation & feedback entries", async () => {
    const contact = recordContactInquiry({
      name: "Meera Rai",
      email: "meera@example.com",
      topic: "general",
      message: "Need details on First Flush Darjeeling harvest.",
    });
    const wholesale = recordWholesaleInquiry({
      name: "Kabir Das",
      business_name: "Bengal Chai Co",
      email: "kabir@bengalchai.in",
      phone: "+91 9876543211",
      interest: "Premium CTC & Special Masala Chai Blends",
      estimated_volume: "100 – 500 kg",
      location: "Kolkata",
    });
    const lead = captureLead({
      sessionId: `sess_resp_${Date.now()}`,
      phoneNumber: "+91 9832098765",
      customerName: "Sita",
      source: "cart_incentive",
    });
    saveNewsletterPreference(`inbox-${Date.now()}@example.com`, "I agree.");

    const all = listAdminResponses({ type: "all", limit: 50 });
    expect(all.counts.enquiry).toBeGreaterThanOrEqual(1);
    expect(all.counts.bulk_order).toBeGreaterThanOrEqual(1);
    expect(all.counts.lead_modal).toBeGreaterThanOrEqual(1);
    expect(all.counts.newsletter).toBeGreaterThanOrEqual(1);

    const enquiryId = String(contact.id);
    updateAdminResponseStatus("enquiry", enquiryId, "in_progress", "admin_test");

    await addAdminConversationEntry({
      entityType: "enquiry",
      entityId: enquiryId,
      entryType: "customer_feedback",
      author: "admin_test",
      message: "Customer called back and asked for 250g tin pricing.",
    });

    await addAdminConversationEntry({
      entityType: "enquiry",
      entityId: enquiryId,
      entryType: "note",
      author: "admin_test",
      message: "Shared wholesale rate card on WhatsApp.",
    });

    const detail = getAdminResponseDetail("enquiry", enquiryId);
    expect(detail.item).not.toBeNull();
    expect(detail.item?.status).toBe("in_progress");
    expect(detail.item?.payload.message).toContain("First Flush Darjeeling");
    expect(detail.conversation.length).toBe(3);
    expect(detail.conversation[0].entry_type).toBe("status_change");
    expect(detail.conversation[1].entry_type).toBe("customer_feedback");
    expect(detail.conversation[2].entry_type).toBe("note");

    // Also verify wholesale & lead detail lookup
    const wholesaleDetail = getAdminResponseDetail("bulk_order", `wholesale:${wholesale.id}`);
    expect(wholesaleDetail.item?.customerName).toContain("Bengal Chai Co");
    const leadDetail = getAdminResponseDetail("lead_modal", String(lead.leadId));
    expect(leadDetail.item?.phone).toContain("9832098765");
  });
});
