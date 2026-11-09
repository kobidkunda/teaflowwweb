import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customerSessions";
import { cancelCustomerOrder, CustomerOrderError } from "@/lib/customerOrders";
import { z } from "zod";

const cancelReasonSchema = z.object({
  reason: z.string().trim().min(3, "Please provide a reason for cancellation.").max(300),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = getCustomerSession(request);
  if (!customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const { reason } = cancelReasonSchema.parse(body);

    const updatedOrder = cancelCustomerOrder(
      customer.id,
      customer.email,
      customer.phone,
      id,
      reason
    );

    return NextResponse.json({
      success: true,
      message: "Your order has been cancelled successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    if (error instanceof CustomerOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.code });
    }
    const msg = error instanceof Error ? error.message : "Failed to cancel order.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
