import { NextResponse } from "next/server";
import { z } from "zod";
import { recordWholesaleInquiry } from "@/lib/wholesale";
import { getStoreSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";

const inquirySchema = z.object({
  name: z.string().trim().min(2, "Contact person name is required (at least 2 characters)").max(100),
  business_name: z.string().trim().min(2, "Business / Cafe name is required").max(150),
  email: z.string().trim().email("Please provide a valid business email address"),
  phone: z.string().trim().min(6, "Please provide a valid phone or WhatsApp number").max(30),
  interest: z.string().trim().min(1, "Please select an interest category"),
  estimated_volume: z.string().trim().min(1, "Please specify an estimated volume"),
  location: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function GET() {
  try {
    const settings = getStoreSettings();
    return NextResponse.json({
      ok: true,
      whatsappNumber: settings.whatsapp_number,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to retrieve wholesale configuration." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = inquirySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id, whatsappUrl, whatsappNumber } = recordWholesaleInquiry(parsed.data);

    return NextResponse.json({
      ok: true,
      id,
      whatsappUrl,
      whatsappNumber,
      message: "Wholesale inquiry received and registered successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: "Failed to record inquiry", details: message },
      { status: 500 }
    );
  }
}
