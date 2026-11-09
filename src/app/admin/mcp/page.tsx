import React from "react";
import {
  listToolDefinitions,
  listResourceDefinitions,
  listResourceTemplateDefinitions,
  listPromptDefinitions,
} from "@/lib/mcp";
import { McpDashboard } from "@/components/admin/system/McpDashboard";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";

export const metadata = {
  title: "MCP Server & Tools | Himalayan Tea House Admin",
  description: "MCP Server 100% capabilities dashboard, interactive bench, and test runner",
};

export default function McpAdminPage() {
  const tools = listToolDefinitions();
  const resources = listResourceDefinitions();
  const resourceTemplates = listResourceTemplateDefinitions();
  const prompts = listPromptDefinitions();

  return (
    <AdminAuthGate>
      <McpDashboard
        initialTools={tools}
        initialResources={resources}
        initialResourceTemplates={resourceTemplates}
        initialPrompts={prompts}
      />
    </AdminAuthGate>
  );
}
