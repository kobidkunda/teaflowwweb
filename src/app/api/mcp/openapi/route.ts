import { NextResponse } from "next/server";
import { listToolDefinitions } from "@/lib/mcp";

export const runtime = "nodejs";

export function GET(request: Request) {
  const tools = listToolDefinitions();
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const paths: Record<string, unknown> = {};

  for (const tool of tools) {
    const pathKey = `/api/mcp/tools/${tool.name}`;
    paths[pathKey] = {
      post: {
        summary: tool.name,
        description: tool.description,
        operationId: tool.name.replace(/\./g, "_"),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: tool.inputSchema,
            },
          },
        },
        responses: {
          "200": {
            description: "Successful tool execution",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          "400": { description: "Invalid arguments" },
          "401": { description: "Unauthorized" },
          "404": { description: "Record not found" },
          "409": { description: "Conflict / Operation not allowed" },
        },
      },
    };
  }

  const openapiSpec = {
    openapi: "3.1.0",
    info: {
      title: "TeaFloww MCP & MCPO API",
      version: "1.1.0",
      description:
        "Full OpenAPI specification generated directly from the Himalayan Tea House Model Context Protocol (MCP) server. Enables direct integration with Open WebUI, MCPO proxies, and LLM agent toolchains.",
    },
    servers: [{ url: baseUrl }],
    paths,
  };

  return NextResponse.json(openapiSpec, { headers: { "Cache-Control": "no-store" } });
}
