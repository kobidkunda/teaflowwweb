import React from "react";
import { PaymentSettingsForm } from "@/components/admin/settings/PaymentSettingsForm";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "Payment Settings | Admin | TeaFloww",
  description: "Configure Razorpay credentials, webhook secret, and domestic Cash on Delivery options.",
};

export default function AdminPaymentSettingsPage() {
  return (
    <AdminAuthGate>
      <div className="payment-settings-shell">
        <PaymentSettingsForm />
      </div>
    </AdminAuthGate>
  );
}
