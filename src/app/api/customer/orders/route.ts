import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { listCustomerOrders } from "@/lib/customerOrders";

export async function GET(request: Request) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = listCustomerOrders(customer.id, customer.email, customer.phone);
    return NextResponse.json({ orders });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch orders.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
