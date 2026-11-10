import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { PrivateLabelQuotesClient } from "@/components/admin/private-label/PrivateLabelQuotesClient";

export const metadata = {
  title: "Quote Review Queue | Private Label | TeaFloww Admin",
  description: "Manage B2B quotation requests, review manual price overrides, and issue firm quotes.",
};

export default function AdminPrivateLabelQuotesPage() {
  return (
    <AdminAuthGate>
      <PrivateLabelQuotesClient />
    </AdminAuthGate>
  );
}
