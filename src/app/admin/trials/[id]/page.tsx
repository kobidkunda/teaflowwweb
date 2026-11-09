import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { TrialStudioClient } from "@/components/admin/trials/TrialStudioClient";

export const metadata = {
  title: "Trial Studio | Admin | TeaFloww",
  description: "Curate 4x50g tea discovery assortments, inspect optical proofs, and configure bulk ladders.",
};

export default async function AdminTrialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AdminAuthGate>
      <TrialStudioClient trialId={id} />
    </AdminAuthGate>
  );
}
