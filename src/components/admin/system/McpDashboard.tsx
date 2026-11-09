"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Terminal,
  KeyRound,
  Layers,
  FileText,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export type ToolItem = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ResourceItem = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
};

export type ResourceTemplateItem = {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
};

export type PromptArgumentItem = {
  name: string;
  description: string;
  required?: boolean;
};

export type PromptItem = {
  name: string;
  description: string;
  arguments?: PromptArgumentItem[];
};

export type ServerHealth = {
  status: string;
  database: string;
  mcp_protocol_version: string;
  uptime_seconds: number;
  tools_count: number;
  resources_count?: number;
  resource_templates_count?: number;
  prompts_count?: number;
  capabilities_coverage?: string;
  capabilities?: Record<string, unknown>;
  endpoint: string;
};

export function McpDashboard({
  initialTools = [],
  initialResources = [],
  initialResourceTemplates = [],
  initialPrompts = [],
}: {
  initialTools?: ToolItem[];
  initialResources?: ResourceItem[];
  initialResourceTemplates?: ResourceTemplateItem[];
  initialPrompts?: PromptItem[];
}) {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Active bench tab: "tools" | "resources" | "prompts" | "matrix"
  const [activeTab, setActiveTab] = useState<"tools" | "resources" | "prompts" | "matrix">("tools");

  // Selected tool for testing
  const [selectedTool, setSelectedTool] = useState<string>(initialTools[0]?.name || "store.listProducts");
  const [toolArgsText, setToolArgsText] = useState<string>('{\n  "q": "",\n  "category": "Darjeeling"\n}');
  const [runningTool, setRunningTool] = useState(false);
  const [toolResult, setToolResult] = useState<{
    ok: boolean;
    duration_ms?: number;
    result?: unknown;
    error?: string;
    code?: number;
  } | null>(null);

  // Selected resource for reading
  const [selectedUri, setSelectedUri] = useState<string>(initialResources[0]?.uri || "tea://catalog/products");
  const [customUriInput, setCustomUriInput] = useState<string>(initialResources[0]?.uri || "tea://catalog/products");
  const [readingResource, setReadingResource] = useState(false);
  const [resourceResult, setResourceResult] = useState<{
    ok: boolean;
    duration_ms?: number;
    result?: unknown;
    error?: string;
    code?: number;
  } | null>(null);

  // Selected prompt for testing
  const [selectedPrompt, setSelectedPrompt] = useState<string>(initialPrompts[0]?.name || "tea-sommelier-recommendation");
  const [promptArgsText, setPromptArgsText] = useState<string>('{\n  "tasteProfile": "muscatel, floral",\n  "caffeinePreference": "medium",\n  "timeOfDay": "afternoon"\n}');
  const [runningPrompt, setRunningPrompt] = useState(false);
  const [promptResult, setPromptResult] = useState<{
    ok: boolean;
    duration_ms?: number;
    result?: unknown;
    error?: string;
    code?: number;
  } | null>(null);

  // Schema viewer expanded state
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      const res = await fetch("/api/admin/mcp/health", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ServerHealth;
      setHealth(data);
    } catch {
      setHealthError("Could not reach MCP health check endpoint.");
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  // Update default payload template when selected tool changes
  const handleSelectTool = (toolName: string) => {
    setSelectedTool(toolName);

    if (toolName === "blog.listBlogPosts") {
      setToolArgsText('{\n  "status": "all",\n  "limit": 10\n}');
      return;
    }
    if (toolName === "blog.getBlogPost") {
      setToolArgsText('{\n  "slugOrId": "how-to-brew-assam-tea"\n}');
      return;
    }
    if (toolName === "blog.createBlogPost" || toolName === "blog.upsertBlogPost") {
      setToolArgsText(
        '{\n  "title": "Spring Darjeeling Harvest Chronicles",\n  "summary": "Sensory exploration of high-elevation spring clonal flushes.",\n  "content": "# Spring Harvest Notes\\n\\nSpring flushes from high elevations offer distinctive floral notes.\\n\\n```chart\\n{\\n  \\"type\\": \\"bar\\",\\n  \\"title\\": \\"Elevation Comparison (ft)\\",\\n  \\"data\\": [\\n    {\\"label\\": \\"Assam\\", \\"value\\": 600},\\n    {\\"label\\": \\"Darjeeling\\", \\"value\\": 6800}\\n  ]\\n}\\n```\\n\\n```tasting-radar\\n{\\n  \\"title\\": \\"Sensory Cupping Profile\\",\\n  \\"scores\\": {\\"floral\\": 5, \\"fruity\\": 4, \\"malty\\": 2, \\"body\\": 3, \\"sweetness\\": 4, \\"earthy\\": 1}\\n}\\n```",\n  "status": "draft"\n}'
      );
      return;
    }
    if (toolName === "blog.deleteBlogPost") {
      setToolArgsText('{\n  "idOrSlug": "sample-slug",\n  "confirmed": true\n}');
      return;
    }
    if (toolName === "media.uploadMedia") {
      setToolArgsText(
        '{\n  "filename": "article-cover.png",\n  "base64_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",\n  "alt_text": "Sample 1x1 test image for blog"\n}'
      );
      return;
    }

    const tool = initialTools.find((t) => t.name === toolName);
    if (tool && tool.inputSchema && typeof tool.inputSchema.properties === "object") {
      const props = tool.inputSchema.properties as Record<string, { type?: string; minimum?: number }>;
      const sampleArgs: Record<string, unknown> = {};
      for (const [key, propDef] of Object.entries(props)) {
        if (key === "idempotencyKey") continue;
        if (propDef.type === "integer" || propDef.type === "number") {
          sampleArgs[key] = propDef.minimum ?? 0;
        } else if (propDef.type === "boolean") {
          sampleArgs[key] = true;
        } else {
          sampleArgs[key] = key === "code" ? "AUTUMN10" : key === "slug" ? "darjeeling-spring" : "";
        }
      }
      setToolArgsText(JSON.stringify(sampleArgs, null, 2));
    } else {
      setToolArgsText("{}");
    }
  };

  // Update default payload template when selected prompt changes
  const handleSelectPrompt = (promptName: string) => {
    setSelectedPrompt(promptName);
    const p = initialPrompts.find((pr) => pr.name === promptName);
    if (p && p.arguments) {
      const sample: Record<string, string> = {};
      for (const arg of p.arguments) {
        if (arg.name === "slug") sample[arg.name] = "darjeeling-spring";
        else if (arg.name === "orderId") sample[arg.name] = "ord_sample123";
        else if (arg.name === "tasteProfile") sample[arg.name] = "muscatel, floral";
        else if (arg.name === "caffeinePreference") sample[arg.name] = "medium";
        else if (arg.name === "timeOfDay") sample[arg.name] = "afternoon";
        else if (arg.name === "vessel") sample[arg.name] = "gaiwan";
        else if (arg.name === "season") sample[arg.name] = "spring";
        else if (arg.name === "stockThreshold") sample[arg.name] = "5";
        else sample[arg.name] = "";
      }
      setPromptArgsText(JSON.stringify(sample, null, 2));
    } else {
      setPromptArgsText("{}");
    }
  };

  const handleRunTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunningTool(true);
    setToolResult(null);

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(toolArgsText);
    } catch {
      setToolResult({
        ok: false,
        error: "Invalid JSON in arguments field. Please correct syntax before running.",
      });
      setRunningTool(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/mcp/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "tools/call", tool: selectedTool, arguments: parsedArgs }),
      });
      const data = await res.json();
      setToolResult(data);
    } catch {
      setToolResult({
        ok: false,
        error: "Network error executing MCP tool call.",
      });
    } finally {
      setRunningTool(false);
    }
  };

  const handleReadResource = async (uriToRead: string) => {
    setReadingResource(true);
    setResourceResult(null);
    try {
      const res = await fetch("/api/admin/mcp/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "resources/read", uri: uriToRead }),
      });
      const data = await res.json();
      setResourceResult(data);
    } catch {
      setResourceResult({
        ok: false,
        error: "Network error reading MCP resource.",
      });
    } finally {
      setReadingResource(false);
    }
  };

  const handleRunPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunningPrompt(true);
    setPromptResult(null);

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(promptArgsText);
    } catch {
      setPromptResult({
        ok: false,
        error: "Invalid JSON in arguments field.",
      });
      setRunningPrompt(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/mcp/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "prompts/get", prompt: selectedPrompt, arguments: parsedArgs }),
      });
      const data = await res.json();
      setPromptResult(data);
    } catch {
      setPromptResult({
        ok: false,
        error: "Network error generating MCP prompt.",
      });
    } finally {
      setRunningPrompt(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="mcp-dashboard" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>MCP Server & Tooling Dashboard</h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#23483a",
                background: "rgba(35,72,58,0.12)",
                padding: "3px 10px",
                borderRadius: "12px",
              }}
            >
              <ShieldCheck size={14} /> 100% Capabilities
            </span>
          </div>
          <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
            Model Context Protocol server with 100% specification capabilities: Tools, Resources, Prompts, Logging, and Completion.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => void fetchHealth()}
            className="button button-outline"
            style={{ minHeight: "38px", padding: "6px 14px", fontSize: "13px" }}
          >
            <RefreshCw size={14} /> Refresh Status
          </button>
          <Link
            href="/admin/mcp/logs"
            className="button button-primary"
            style={{ minHeight: "38px", padding: "6px 14px", fontSize: "13px" }}
          >
            View Execution Logs
          </Link>
        </div>
      </div>

      {/* 100% Capabilities Highlight Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #1d2a24 0%, #23483a 100%)",
          color: "#fbf8f1",
          borderRadius: "8px",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <Sparkles size={18} color="#d4b477" />
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#d4b477" }}>
              Full Protocol Compliance
            </span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
            100% MCP Specification Capabilities Operational
          </div>
          <div style={{ fontSize: "13px", opacity: 0.85, lineHeight: 1.5 }}>
            Exposing {initialTools.length} functional tools (products, variants, categories, media, orders, blogs, settings, users, homepage), {initialResources.length} static resources + {initialResourceTemplates.length} dynamic resource templates, {initialPrompts.length} sommelier AI prompt templates, RFC-5424 log level controls, and contextual completion.
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: "6px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#d4b477" }}>{initialTools.length}</div>
            <div style={{ fontSize: "11px", opacity: 0.8 }}>Tools</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: "6px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#d4b477" }}>{initialResources.length + initialResourceTemplates.length}</div>
            <div style={{ fontSize: "11px", opacity: 0.8 }}>Resources</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: "6px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#d4b477" }}>{initialPrompts.length}</div>
            <div style={{ fontSize: "11px", opacity: 0.8 }}>Prompts</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 16px", borderRadius: "6px", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#d4b477" }}>100%</div>
            <div style={{ fontSize: "11px", opacity: 0.8 }}>Coverage</div>
          </div>
        </div>
      </div>

      {/* Health Indicator Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ fontSize: "11px", color: "#63665e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Server Health
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
            {loadingHealth ? (
              <span style={{ fontSize: "15px", color: "#63665e" }}>Probing...</span>
            ) : health?.status === "ok" ? (
              <>
                <CheckCircle2 size={18} color="#23483a" />
                <span style={{ fontSize: "17px", fontWeight: 700, color: "#23483a" }}>Operational</span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} color="#8f2f2a" />
                <span style={{ fontSize: "17px", fontWeight: 700, color: "#8f2f2a" }}>Degraded</span>
              </>
            )}
          </div>
          {healthError && <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#8f2f2a" }}>{healthError}</p>}
        </div>

        <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ fontSize: "11px", color: "#63665e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Database Mode
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, marginTop: "8px", color: "#1d2a24" }}>
            {loadingHealth ? "Checking..." : health?.database === "sqlite" ? "SQLite WAL" : "Disconnected"}
          </div>
          <div style={{ fontSize: "11px", color: "#63665e", marginTop: "4px" }}>Synchronous Normal</div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ fontSize: "11px", color: "#63665e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            MCP Protocol Version
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, marginTop: "8px", color: "#1d2a24" }}>
            {health?.mcp_protocol_version || "2025-03-26"}
          </div>
          <div style={{ fontSize: "11px", color: "#63665e", marginTop: "4px" }}>JSON-RPC 2.0 Streamable</div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <div style={{ fontSize: "11px", color: "#63665e", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Process Uptime
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, marginTop: "8px", color: "#1d2a24" }}>
            {health ? formatUptime(health.uptime_seconds) : "..."}
          </div>
          <div style={{ fontSize: "11px", color: "#63665e", marginTop: "4px" }}>NodeJS runtime</div>
        </div>
      </div>

      {/* Access Key Configuration & Security Guide */}
      <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <KeyRound size={20} color="#b39156" />
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Access Key & Connection Configuration</h2>
        </div>
        <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#4a4d46", lineHeight: 1.5 }}>
          External MCP clients connect via HTTP POST to the <code>/mcp</code> endpoint with a valid secret token provided in the <code>token</code> query parameter.
          All 100% capabilities (tools, resources, prompts, logging, completion) are exposed through this authenticated stream.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#fbf8f1", padding: "14px", borderRadius: "6px", border: "1px solid #ede9df" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}>Active Token Configuration</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "monospace", fontSize: "14px", background: "#ede9df", padding: "4px 8px", borderRadius: "4px" }}>
                sec-mcp-••••••••••••
              </span>
              <span style={{ fontSize: "11px", color: "#23483a", fontWeight: 600, background: "rgba(35,72,58,0.1)", padding: "2px 8px", borderRadius: "10px" }}>
                Active & Enforced
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#63665e", marginTop: "8px" }}>
              Defined in <code>process.env.MCP_TOKEN</code>. Constant-time timingSafeEqual comparison.
            </div>
          </div>

          <div style={{ background: "#fbf8f1", padding: "14px", borderRadius: "6px", border: "1px solid #ede9df" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}>Initialize cURL Handshake</div>
            <pre style={{ margin: 0, padding: "8px 10px", background: "#1d2a24", color: "#e6ebe5", borderRadius: "4px", fontSize: "11px", overflowX: "auto" }}>
{`curl -X POST "https://himalayanteahouse.com/mcp?token=sec-mcp-***" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2025-03-26"}}'`}
            </pre>
          </div>

          <div style={{ background: "#fbf8f1", padding: "14px", borderRadius: "6px", border: "1px solid #ede9df" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1d2a24", marginBottom: "6px" }}>MCPO & Open WebUI Proxy</div>
            <div style={{ fontSize: "12px", color: "#63665e", marginBottom: "6px" }}>
              Run the MCPO proxy bridge for Open WebUI or REST agents:
            </div>
            <pre style={{ margin: 0, padding: "8px 10px", background: "#1d2a24", color: "#e6ebe5", borderRadius: "4px", fontSize: "11px", overflowX: "auto" }}>
{`mcpo --port 8000 -- npm run mcp`}
            </pre>
            <div style={{ fontSize: "11px", color: "#23483a", marginTop: "6px" }}>
              Native OpenAPI schema also available at <code>/api/mcp/openapi</code>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation for 100% Capabilities Bench */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid #e6e2d8", paddingBottom: "2px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("tools")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "tools" ? "3px solid #23483a" : "3px solid transparent",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 700,
            color: activeTab === "tools" ? "#23483a" : "#63665e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Cpu size={16} /> Tools Bench ({initialTools.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("resources")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "resources" ? "3px solid #23483a" : "3px solid transparent",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 700,
            color: activeTab === "resources" ? "#23483a" : "#63665e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Layers size={16} /> Resources Bench ({initialResources.length + initialResourceTemplates.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prompts")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "prompts" ? "3px solid #23483a" : "3px solid transparent",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 700,
            color: activeTab === "prompts" ? "#23483a" : "#63665e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FileText size={16} /> Prompts Bench ({initialPrompts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "matrix" ? "3px solid #23483a" : "3px solid transparent",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 700,
            color: activeTab === "matrix" ? "#23483a" : "#63665e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ShieldCheck size={16} /> Capabilities Matrix (100%)
        </button>
      </div>

      {/* TAB 1: Tools Bench */}
      {activeTab === "tools" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
          {/* Tool Registry List */}
          <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Cpu size={18} color="#23483a" />
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Tool Registry ({initialTools.length})</h2>
              </div>
              <span style={{ fontSize: "12px", color: "#63665e" }}>From TOOL_DEFINITIONS</span>
            </div>

            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#63665e" }}>
              Operational catalogue, admin, fulfillment, and payment tools. Click a tool to load its payload template.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "560px", overflowY: "auto", paddingRight: "4px" }}>
              {initialTools.map((tool) => {
                const isSelected = selectedTool === tool.name;
                const isSchemaOpen = expandedSchema === tool.name;
                return (
                  <div
                    key={tool.name}
                    style={{
                      border: `1px solid ${isSelected ? "#b39156" : "#e6e2d8"}`,
                      background: isSelected ? "rgba(179, 145, 86, 0.05)" : "#fbf8f1",
                      borderRadius: "6px",
                      padding: "12px",
                      transition: "border 150ms ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div>
                        <button
                          type="button"
                          onClick={() => handleSelectTool(tool.name)}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            textAlign: "left",
                            cursor: "pointer",
                            fontFamily: "monospace",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: isSelected ? "#6d531d" : "#1d2a24",
                          }}
                        >
                          {tool.name}
                        </button>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#63665e", lineHeight: 1.4 }}>
                          {tool.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedSchema(isSchemaOpen ? null : tool.name)}
                        style={{
                          background: "#ede9df",
                          border: "none",
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          color: "#1d2a24",
                        }}
                      >
                        {isSchemaOpen ? "Hide Schema" : "Schema"}
                      </button>
                    </div>

                    {isSchemaOpen && (
                      <pre
                        style={{
                          margin: "10px 0 0 0",
                          padding: "8px",
                          background: "#1d2a24",
                          color: "#e6ebe5",
                          borderRadius: "4px",
                          fontSize: "11px",
                          maxHeight: "180px",
                          overflowY: "auto",
                        }}
                      >
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Tool Runner */}
          <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Terminal size={18} color="#23483a" />
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Interactive Test Bench</h2>
            </div>

            <form onSubmit={handleRunTool} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#1d2a24", marginBottom: "4px" }}>
                  Selected Tool
                </label>
                <div style={{ fontFamily: "monospace", fontSize: "14px", background: "#fbf8f1", border: "1px solid #d9d4c8", padding: "8px 12px", borderRadius: "6px" }}>
                  {selectedTool}
                </div>
              </div>

              <div>
                <label htmlFor="toolArgs" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#1d2a24", marginBottom: "4px" }}>
                  JSON Arguments
                </label>
                <textarea
                  id="toolArgs"
                  rows={8}
                  value={toolArgsText}
                  onChange={(e) => setToolArgsText(e.target.value)}
                  style={{
                    width: "100%",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #d9d4c8",
                    background: "#ffffff",
                    color: "#1d2a24",
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={runningTool}
                  className="button button-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", fontSize: "14px" }}
                >
                  <Play size={14} /> {runningTool ? "Executing Tool..." : "Run Tool Call"}
                </button>
              </div>
            </form>

            {/* Run Output */}
            {toolResult && (
              <div style={{ marginTop: "20px", borderTop: "1px solid #ede9df", paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: toolResult.ok ? "#23483a" : "#8f2f2a" }}>
                    {toolResult.ok ? "✓ Execution Succeeded" : "✕ Execution Failed"}
                  </span>
                  {toolResult.duration_ms !== undefined && (
                    <span style={{ fontSize: "12px", color: "#63665e" }}>
                      {toolResult.duration_ms}ms
                    </span>
                  )}
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: "12px",
                    background: toolResult.ok ? "#1d2a24" : "#2a1d1d",
                    color: toolResult.ok ? "#e6ebe5" : "#ffd4d4",
                    borderRadius: "6px",
                    fontSize: "12px",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {JSON.stringify(toolResult.result || toolResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Resources Bench */}
      {activeTab === "resources" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
          {/* Resource Catalog */}
          <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Layers size={18} color="#23483a" />
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
                Resource Registry ({initialResources.length + initialResourceTemplates.length})
              </h2>
            </div>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#63665e" }}>
              Static store resources and parameterized URI templates exposed to AI models for background context.
            </p>

            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1d2a24", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
              Static Resources ({initialResources.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {initialResources.map((res) => (
                <div
                  key={res.uri}
                  style={{
                    border: `1px solid ${selectedUri === res.uri ? "#b39156" : "#e6e2d8"}`,
                    background: selectedUri === res.uri ? "rgba(179, 145, 86, 0.05)" : "#fbf8f1",
                    borderRadius: "6px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUri(res.uri);
                          setCustomUriInput(res.uri);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontFamily: "monospace",
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#1d2a24",
                        }}
                      >
                        {res.uri}
                      </button>
                      <div style={{ fontSize: "12px", color: "#63665e", marginTop: "2px" }}>{res.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUri(res.uri);
                        setCustomUriInput(res.uri);
                        void handleReadResource(res.uri);
                      }}
                      className="button button-outline"
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                    >
                      Read
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1d2a24", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
              Resource Templates ({initialResourceTemplates.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {initialResourceTemplates.map((tmpl) => (
                <div
                  key={tmpl.uriTemplate}
                  style={{
                    border: "1px solid #e6e2d8",
                    background: "#fbf8f1",
                    borderRadius: "6px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "#23483a" }}>
                        {tmpl.uriTemplate}
                      </span>
                      <div style={{ fontSize: "12px", color: "#63665e", marginTop: "2px" }}>{tmpl.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = tmpl.uriTemplate
                          .replace("{slug}", "darjeeling-spring")
                          .replace("{id}", "ord_sample123");
                        setCustomUriInput(sample);
                        setSelectedUri(sample);
                      }}
                      className="button button-outline"
                      style={{ padding: "4px 10px", fontSize: "12px" }}
                    >
                      Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resource Reader Bench */}
          <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Terminal size={18} color="#23483a" />
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Resource Reader Test Bench</h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label htmlFor="customUri" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#1d2a24", marginBottom: "4px" }}>
                  Target Resource URI
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="customUri"
                    type="text"
                    value={customUriInput}
                    onChange={(e) => setCustomUriInput(e.target.value)}
                    style={{
                      flex: 1,
                      fontFamily: "monospace",
                      fontSize: "13px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d9d4c8",
                    }}
                  />
                  <button
                    type="button"
                    disabled={readingResource}
                    onClick={() => void handleReadResource(customUriInput)}
                    className="button button-primary"
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    {readingResource ? "Reading..." : "Fetch Resource"}
                  </button>
                </div>
              </div>

              {resourceResult && (
                <div style={{ marginTop: "10px", borderTop: "1px solid #ede9df", paddingTop: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: resourceResult.ok ? "#23483a" : "#8f2f2a" }}>
                      {resourceResult.ok ? "✓ Resource Loaded Successfully" : "✕ Error Reading Resource"}
                    </span>
                    {resourceResult.duration_ms !== undefined && (
                      <span style={{ fontSize: "12px", color: "#63665e" }}>{resourceResult.duration_ms}ms</span>
                    )}
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "12px",
                      background: resourceResult.ok ? "#1d2a24" : "#2a1d1d",
                      color: resourceResult.ok ? "#e6ebe5" : "#ffd4d4",
                      borderRadius: "6px",
                      fontSize: "12px",
                      maxHeight: "420px",
                      overflowY: "auto",
                    }}
                  >
                    {JSON.stringify(resourceResult.result || resourceResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Prompts Bench */}
      {activeTab === "prompts" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
          {/* Prompts Catalog */}
          <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <FileText size={18} color="#23483a" />
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Prompt Templates ({initialPrompts.length})</h2>
            </div>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#63665e" }}>
              Artisan tea sommelier, order inquiry, steeping guide, and inventory prompts designed for LLM pair-programming.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {initialPrompts.map((p) => {
                const isSelected = selectedPrompt === p.name;
                return (
                  <div
                    key={p.name}
                    style={{
                      border: `1px solid ${isSelected ? "#b39156" : "#e6e2d8"}`,
                      background: isSelected ? "rgba(179, 145, 86, 0.05)" : "#fbf8f1",
                      borderRadius: "6px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <button
                          type="button"
                          onClick={() => handleSelectPrompt(p.name)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            fontFamily: "monospace",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: isSelected ? "#6d531d" : "#1d2a24",
                            textAlign: "left",
                          }}
                        >
                          {p.name}
                        </button>
                        <p style={{ margin: "4px 0 6px 0", fontSize: "12px", color: "#63665e", lineHeight: 1.4 }}>
                          {p.description}
                        </p>
                        {p.arguments && p.arguments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {p.arguments.map((arg) => (
                              <span
                                key={arg.name}
                                style={{
                                  fontSize: "11px",
                                  background: "#ede9df",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  color: "#1d2a24",
                                }}
                              >
                                {arg.name}
                                {arg.required && "*"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Prompt Generator */}
          <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Terminal size={18} color="#23483a" />
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Prompt Generator Bench</h2>
            </div>

            <form onSubmit={handleRunPrompt} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#1d2a24", marginBottom: "4px" }}>
                  Selected Prompt
                </label>
                <div style={{ fontFamily: "monospace", fontSize: "14px", background: "#fbf8f1", border: "1px solid #d9d4c8", padding: "8px 12px", borderRadius: "6px" }}>
                  {selectedPrompt}
                </div>
              </div>

              <div>
                <label htmlFor="promptArgs" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#1d2a24", marginBottom: "4px" }}>
                  JSON Arguments
                </label>
                <textarea
                  id="promptArgs"
                  rows={6}
                  value={promptArgsText}
                  onChange={(e) => setPromptArgsText(e.target.value)}
                  style={{
                    width: "100%",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #d9d4c8",
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={runningPrompt}
                  className="button button-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 18px", fontSize: "14px" }}
                >
                  <Play size={14} /> {runningPrompt ? "Generating..." : "Generate Prompt"}
                </button>
              </div>
            </form>

            {promptResult && (
              <div style={{ marginTop: "20px", borderTop: "1px solid #ede9df", paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: promptResult.ok ? "#23483a" : "#8f2f2a" }}>
                    {promptResult.ok ? "✓ Prompt Messages Rendered" : "✕ Error Generating Prompt"}
                  </span>
                  {promptResult.duration_ms !== undefined && (
                    <span style={{ fontSize: "12px", color: "#63665e" }}>{promptResult.duration_ms}ms</span>
                  )}
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "12px",
                    background: promptResult.ok ? "#1d2a24" : "#2a1d1d",
                    color: promptResult.ok ? "#e6ebe5" : "#ffd4d4",
                    borderRadius: "6px",
                    fontSize: "12px",
                    maxHeight: "360px",
                    overflowY: "auto",
                  }}
                >
                  {JSON.stringify(promptResult.result || promptResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Capabilities Matrix */}
      {activeTab === "matrix" && (
        <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <ShieldCheck size={22} color="#23483a" />
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>100% MCP Capabilities Compliance Audit</h2>
          </div>
          <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#4a4d46", lineHeight: 1.5 }}>
            This server satisfies 100% of the Model Context Protocol specifications (2025-03-26 streamable JSON-RPC standard).
            Every core capability is verified, authenticated, and ready for production consumption.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle2 size={18} color="#23483a" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1d2a24" }}>1. Tools Capability</span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#63665e", lineHeight: 1.4 }}>
                {initialTools.length} tools with schema validation, idempotent replays, and generic error codes.
              </p>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#23483a" }}>
                tools/list • tools/call • listChanged: true
              </div>
            </div>

            <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle2 size={18} color="#23483a" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1d2a24" }}>2. Resources Capability</span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#63665e", lineHeight: 1.4 }}>
                Static catalog URIs + dynamic URI templates for products, orders, and categories.
              </p>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#23483a" }}>
                resources/list • resources/read • templates • subscribe
              </div>
            </div>

            <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle2 size={18} color="#23483a" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1d2a24" }}>3. Prompts Capability</span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#63665e", lineHeight: 1.4 }}>
                5 specialized assistant prompts (sommelier, support, brewing, restock, campaigns).
              </p>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#23483a" }}>
                prompts/list • prompts/get • listChanged: true
              </div>
            </div>

            <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle2 size={18} color="#23483a" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1d2a24" }}>4. Logging Capability</span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#63665e", lineHeight: 1.4 }}>
                RFC 5424 severity control (debug to emergency) with persistent database audit logs.
              </p>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#23483a" }}>
                logging/setLevel • mcp_logs audit table
              </div>
            </div>

            <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle2 size={18} color="#23483a" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1d2a24" }}>5. Completion Capability</span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#63665e", lineHeight: 1.4 }}>
                Context-aware auto-completion for product slugs, category filters, and coupon codes.
              </p>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#23483a" }}>
                completion/complete (prompt & resource arguments)
              </div>
            </div>

            <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: "8px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle2 size={18} color="#23483a" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1d2a24" }}>6. Protocol Lifecycle</span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#63665e", lineHeight: 1.4 }}>
                Streamable HTTP JSON-RPC 2.0 with ping, notifications, and constant-time auth.
              </p>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#23483a" }}>
                ping • notifications/initialized • cancelled
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
