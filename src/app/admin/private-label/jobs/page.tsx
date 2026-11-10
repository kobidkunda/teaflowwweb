import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { PrivateLabelJobsClient } from "@/components/admin/private-label/PrivateLabelJobsClient";

export const metadata = {
  title: "Production Pipeline & QC | Private Label | TeaFloww Admin",
  description: "Track released production jobs, enforce release gates, and record 7-stage QC milestones.",
};

export default function AdminPrivateLabelJobsPage() {
  return (
    <AdminAuthGate>
      <PrivateLabelJobsClient />
    </AdminAuthGate>
  );
}
