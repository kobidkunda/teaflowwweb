import React from "react";
import { OrderCancelForm } from "@/components/admin/sales/OrderCancelForm";

export const metadata = {
  title: "Cancel Order | Admin | Himalayan Tea House",
  description: "Safe order cancellation confirmation with paid-order gateway guards.",
};

export default async function AdminOrderCancelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="order-cancel-page">
      <OrderCancelForm orderId={id} />
    </div>
  );
}
