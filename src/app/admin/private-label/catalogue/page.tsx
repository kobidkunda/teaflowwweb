import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { PrivateLabelCatalogueClient } from "@/components/admin/private-label/PrivateLabelCatalogueClient";

export const metadata = {
  title: "Catalogue Management | Private Label | TeaFloww Admin",
  description: "Manage packaging structures, tea sourcing options, print methods, and compatibility rules.",
};

export default function AdminPrivateLabelCataloguePage() {
  return (
    <AdminAuthGate>
      <PrivateLabelCatalogueClient />
    </AdminAuthGate>
  );
}
