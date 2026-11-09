import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { TrialDraftWizard } from "@/components/admin/trials/TrialDraftWizard";

export const metadata = {
  title: "New Trial Kit | Admin | TeaFloww",
  description: "Create a new 4x50g tea discovery kit draft with automatic placeholder sachet slots.",
};

export default function AdminNewTrialPage() {
  return (
    <AdminAuthGate>
      <TrialDraftWizard />
    </AdminAuthGate>
  );
}
