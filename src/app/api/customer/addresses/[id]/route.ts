import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import {
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from "@/lib/customerAddresses";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const updated = updateCustomerAddress(customer.id, id, body);
    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update address.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const success = deleteCustomerAddress(customer.id, id);
    if (!success) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Address deleted." });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete address.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const updated = setDefaultCustomerAddress(customer.id, id);
    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to set default address.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
