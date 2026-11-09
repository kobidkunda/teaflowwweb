import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { TrialListingClient } from "@/components/admin/trials/TrialListingClient";

export const metadata = {
  title: "Trials Management | Admin | TeaFloww",
  description: "Admin Trial Studio for TeaFloww 4x50g discovery kits, sample management, and optical proofing.",
};

export default function AdminTrialsPage() {
  return (
    <AdminAuthGate>
      <TrialListingClient />
    </AdminAuthGate>
  );
}
