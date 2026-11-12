import React from "react";
import { OrderDispatchView } from "@/components/admin/sales/OrderDispatchView";

export const metadata = {
  title: "Dispatch & Fulfillment | Admin | Himalayan Tea House",
  description: "Carrier logistics, AWB generation, packing manifest, and status state machine.",
};

export default async function AdminOrderDispatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="order-dispatch-page">
      <OrderDispatchView orderId={id} />
    </div>
  );
}
