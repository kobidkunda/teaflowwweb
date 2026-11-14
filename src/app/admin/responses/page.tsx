import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { AdminResponsesInbox } from "@/components/admin/responses/AdminResponsesInbox";

export const metadata = {
  title: "Responses & Inbox | TeaFloww Admin",
  description: "View all form submissions, quotes, orders, subscriptions, statuses, and customer conversations",
};

export default function AdminResponsesPage() {
  return (
    <AdminAuthGate>
      <AdminResponsesInbox />
    </AdminAuthGate>
  );
}
