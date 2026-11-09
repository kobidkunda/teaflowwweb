import React from "react";
import { TrackingSettingsForm } from "@/components/admin/tracking/TrackingSettingsForm";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Marketing Tags & Analytics | Himalayan Tea House Admin",
  description: "Manage Google Tag Manager (GTM), Meta / Facebook Pixel, and Google Analytics conversion tracking",
};

export default function AdminTrackingPage() {
  return (
    <AdminAuthGate>
      <TrackingSettingsForm />
    </AdminAuthGate>
  );
}
