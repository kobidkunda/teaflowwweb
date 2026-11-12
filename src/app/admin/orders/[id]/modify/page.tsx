import React from "react";
import { OrderModifyForm } from "@/components/admin/sales/OrderModifyForm";

export const metadata = {
  title: "Modify Order | Admin | Himalayan Tea House",
  description: "Modify customer details, delivery address, and staff notes.",
};

export default async function AdminOrderModifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="order-modify-page">
      <OrderModifyForm orderId={id} />
    </div>
  );
}
