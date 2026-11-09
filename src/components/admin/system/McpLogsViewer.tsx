"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, ArrowLeft, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import type { McpLogEntry } from "@/app/api/admin/mcp/logs/route";

export function McpLogsViewer() {
  const [logs, setLogs] = useState<McpLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/mcp/logs?${params.toString()}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { logs: McpLogEntry[] };
      setLogs(data.logs || []);
    } catch {
      setError("Failed to load MCP execution logs. Please check network connection.");
    } finally {
      setLoading(false);
    }
  }, [limit, statusFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="mcp-logs-viewer" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <Link
            href="/admin/mcp"
            className="text-link"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", marginBottom: "6px" }}
          >
            <ArrowLeft size={13} /> Back to MCP Dashboard
          </Link>
          <h1 style={{ margin: "4px 0", fontSize: "26px", fontWeight: 700 }}>MCP Execution Logs</h1>
          <p style={{ margin: 0, color: "#63665e", fontSize: "13px" }}>
            Audit log of all tool executions handled by the Model Context Protocol server.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", background: "#fbf8f1" }}
          >
            <option value="">All Statuses</option>
            <option value="success">Success Only</option>
            <option value="error">Errors Only</option>
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", background: "#fbf8f1" }}
          >
            <option value={25}>25 logs</option>
            <option value={50}>50 logs</option>
            <option value={100}>100 logs</option>
          </select>

          <button
            type="button"
            onClick={() => void fetchLogs()}
            className="button button-outline"
            style={{ minHeight: "36px", padding: "6px 12px", fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: "12px", background: "rgba(143, 47, 42, 0.08)", border: "1px solid #8f2f2a", borderRadius: "6px", color: "#8f2f2a", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #d9d4c8", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#63665e", fontSize: "14px" }}>
            Loading execution logs...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#1d2a24" }}>No execution logs recorded yet.</h3>
            <p style={{ margin: 0, color: "#63665e", fontSize: "13px" }}>
              Execute tools from the MCP Dashboard interactive test runner or connect an external client.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <caption className="sr-only">MCP Tool Execution Logs</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ width: "70px" }}>ID</th>
                  <th scope="col" style={{ width: "160px" }}>Timestamp</th>
                  <th scope="col" style={{ width: "180px" }}>Tool Name</th>
                  <th scope="col" style={{ width: "100px" }}>Status</th>
                  <th scope="col" style={{ width: "90px" }}>Latency</th>
                  <th scope="col">Arguments / Error Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isSuccess = log.status === "success";
                  return (
                    <tr key={log.id}>
                      <td style={{ fontFamily: "monospace", color: "#63665e" }}>#{log.id}</td>
                      <td style={{ fontSize: "12px", color: "#555850", whiteSpace: "nowrap" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#1d2a24" }}>
                        {log.tool_name || log.method}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: isSuccess ? "rgba(35, 72, 58, 0.1)" : "rgba(143, 47, 42, 0.1)",
                            color: isSuccess ? "#23483a" : "#8f2f2a",
                          }}
                        >
                          {isSuccess ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", fontFamily: "monospace", color: "#555850" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Clock size={11} /> {log.duration_ms}ms
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ fontFamily: "monospace", fontSize: "11px", background: "#fbf8f1", padding: "4px 6px", borderRadius: "4px", maxWidth: "460px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {log.arguments}
                          </div>
                          {log.error_message && (
                            <div style={{ color: "#8f2f2a", fontSize: "12px", fontWeight: 500 }}>
                              Error {log.error_code ? `(${log.error_code})` : ""}: {log.error_message}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
