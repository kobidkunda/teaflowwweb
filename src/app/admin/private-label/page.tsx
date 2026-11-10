import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { PrivateLabelOverviewClient } from "@/components/admin/private-label/PrivateLabelOverviewClient";

export const metadata = {
  title: "Private Label Studio Overview | Admin | TeaFloww",
  description: "Operational command center for B2B Private Label quotations, catalogue, and production pipeline.",
};

export default function AdminPrivateLabelOverviewPage() {
  return (
    <AdminAuthGate>
      <PrivateLabelOverviewClient />
    </AdminAuthGate>
  );
}
