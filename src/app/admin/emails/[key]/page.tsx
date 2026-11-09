import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { EmailTemplateEditor } from "@/components/admin/emails/EmailTemplateEditor";

export const metadata = {
  title: "Email template editor | TeaFloww Admin",
  description: "Edit transactional email copy, generate drafts from a prompt, insert logo references, and test-send.",
};

export default async function AdminEmailEditorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return (
    <AdminAuthGate>
      <EmailTemplateEditor templateKey={decodeURIComponent(key)} />
    </AdminAuthGate>
  );
}
