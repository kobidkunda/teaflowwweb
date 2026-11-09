import React from "react";
import { OrderFulfillmentForm } from "@/components/admin/sales/OrderFulfillmentForm";

export const metadata = {
  title: "Order Fulfillment & Status | Admin | Himalayan Tea House",
  description: "Fulfillment dispatch state machine transitions and staff notes management.",
};

export default async function AdminOrderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="order-fulfillment-page">
      <OrderFulfillmentForm orderId={id} />
    </div>
  );
}
