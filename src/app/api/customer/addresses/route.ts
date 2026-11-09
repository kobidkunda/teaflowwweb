import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import {
  listCustomerAddresses,
  createCustomerAddress,
  customerAddressSchema,
} from "@/lib/customerAddresses";

export async function GET(request: Request) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const addresses = listCustomerAddresses(customer.id);
    return NextResponse.json({ addresses });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch addresses.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = customerAddressSchema.parse(body);
    const newAddress = createCustomerAddress(customer.id, validated);
    return NextResponse.json({ success: true, address: newAddress }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create address.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
