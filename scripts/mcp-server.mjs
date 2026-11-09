#!/usr/bin/env node
/**
 * Model Context Protocol (MCP) Stdio Server & MCPO Bridge
 *
 * Enables seamless integration with:
 * - MCPO (Open WebUI's Model Context Protocol to OpenAPI proxy):
 *     mcpo --port 8000 -- node scripts/mcp-server.mjs
 * - Claude Desktop / Cursor / Antigravity MCP stdio client configuration:
 *     { "command": "node", "args": ["scripts/mcp-server.mjs"], "env": { "MCP_TOKEN": "..." } }
 *
 * Communicates via JSON-RPC 2.0 over standard input and output (supporting both
 * newline-delimited JSON and Content-Length framed messages).
 */

import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch { /* ignore */ }
}
loadEnv();

const PORT = process.env.PORT || "3000";
const TOKEN = process.env.MCP_TOKEN || "test-token-123";
const MCP_ENDPOINT = process.env.MCP_URL || `http://localhost:${PORT}/mcp?token=${TOKEN}`;

function sendJsonRpc(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

async function handleRpcRequest(body) {
  try {
    const res = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 202) {
      return null;
    }

    const json = await res.json();
    return json;
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: {
        code: -32603,
        message: `MCPO bridge connection to ${MCP_ENDPOINT} failed: ${err.message}. Ensure Himalayan Tea House is running (npm run dev).`,
      },
    };
  }
}

let buffer = "";

let inFlight = 0;
let stdinEnded = false;

function checkExit() {
  if (stdinEnded && inFlight === 0) {
    process.exit(0);
  }
}

process.stdin.on("data", async (chunk) => {
  buffer += chunk.toString("utf8");

  // Check for Content-Length framing (LSP / MCP standard)
  while (true) {
    if (buffer.startsWith("Content-Length:")) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const lengthHeader = buffer.slice(0, headerEnd);
      const match = lengthHeader.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) break;
      const bodyStr = buffer.slice(bodyStart, bodyStart + length);
      buffer = buffer.slice(bodyStart + length);

      inFlight++;
      try {
        const parsed = JSON.parse(bodyStr);
        const response = await handleRpcRequest(parsed);
        if (response) {
          const respStr = JSON.stringify(response);
          process.stdout.write(`Content-Length: ${Buffer.byteLength(respStr, "utf8")}\r\n\r\n${respStr}`);
        }
      } catch (err) {
        const errResp = JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error: " + err.message },
        });
        process.stdout.write(`Content-Length: ${Buffer.byteLength(errResp, "utf8")}\r\n\r\n${errResp}`);
      } finally {
        inFlight--;
        checkExit();
      }
    } else {
      // Line-delimited fallback
      const newlineIdx = buffer.indexOf("\n");
      if (newlineIdx === -1) break;
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (!line) continue;

      inFlight++;
      try {
        const parsed = JSON.parse(line);
        const response = await handleRpcRequest(parsed);
        if (response) sendJsonRpc(response);
      } catch (err) {
        sendJsonRpc({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error: " + err.message },
        });
      } finally {
        inFlight--;
        checkExit();
      }
    }
  }
});

process.stdin.on("end", () => {
  stdinEnded = true;
  checkExit();
});

