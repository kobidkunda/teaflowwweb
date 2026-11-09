import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { getCustomerOrderDetails, CustomerOrderError } from "@/lib/customerOrders";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const order = getCustomerOrderDetails(customer.id, customer.email, customer.phone, id);
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof CustomerOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.code });
    }
    const msg = error instanceof Error ? error.message : "Failed to fetch order.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
