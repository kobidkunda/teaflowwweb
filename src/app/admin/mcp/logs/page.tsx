import React from "react";
import { McpLogsViewer } from "@/components/admin/system/McpLogsViewer";

export const metadata = {
  title: "MCP Execution Logs | Himalayan Tea House Admin",
  description: "Inspection of historical MCP tool calls",
};

export default function McpLogsPage() {
  return <McpLogsViewer />;
}
