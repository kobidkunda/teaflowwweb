import React from "react";
import { OrderDossierView } from "@/components/admin/sales/OrderDossierView";

export const metadata = {
  title: "Order Dossier | Admin | Himalayan Tea House",
  description: "Read-only order inspection dossier with customer details, line items, and audit history.",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="order-dossier-page">
      <OrderDossierView orderId={id} />
    </div>
  );
}
