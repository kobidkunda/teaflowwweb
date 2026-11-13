import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { getDb } from "@/lib/db";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().trim().max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-]{10,20}$/, "Please enter a valid phone number.")
    .optional()
    .or(z.literal("")),
});

export async function GET(request: Request) {
  const customer = getCustomerSession(request);
  if (!customer) {
    const url = new URL(request.url);
    if (url.searchParams.get("optional") === "1") {
      return NextResponse.json({ customer: null });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ customer });
}

export async function PATCH(request: Request) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = updateProfileSchema.parse(body);
    const db = getDb();

    const name = input.name !== undefined ? (input.name.trim() || null) : customer.name;
    const phone = input.phone !== undefined ? (input.phone.trim() || null) : customer.phone;

    db.prepare(
      "UPDATE customers SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(name, phone, customer.id);

    return NextResponse.json({
      success: true,
      customer: {
        ...customer,
        name,
        phone,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
