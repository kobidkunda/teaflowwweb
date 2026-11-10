import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { PrivateLabelPriceBooksClient } from "@/components/admin/private-label/PrivateLabelPriceBooksClient";

export const metadata = {
  title: "Price Books & MOQ Rules | Private Label | TeaFloww Admin",
  description: "Manage volume quantity pricing tiers, commercial margins, and multi-dimensional MOQ rules.",
};

export default function AdminPrivateLabelPriceBooksPage() {
  return (
    <AdminAuthGate>
      <PrivateLabelPriceBooksClient />
    </AdminAuthGate>
  );
}
