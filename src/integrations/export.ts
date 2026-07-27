import type { OcxConfig } from "../types";
import { listIntegrationConnections } from "./connections";
import { getIntegrationDefinition } from "./registry";
import type { IntegrationClientGrade, IntegrationConnectionSummary } from "./types";

/** A credential-free, copy-ready MCP declaration shared by coding agents. */
export interface AuraMcpServerExport {
  command: "aura";
  args: ["mcp"];
}

export interface IntegrationMcpSnippet {
  syntax: "toml" | "json" | "shell";
  destination: string;
  content: string;
}

export interface IntegrationAgentExport {
  clientId: string;
  grade: IntegrationClientGrade;
  mcp: AuraMcpServerExport;
  snippet: IntegrationMcpSnippet;
  connections: Array<IntegrationConnectionSummary & { integrationName: string }>;
  note: string;
}

function mcpSnippetForClient(clientId: string): IntegrationMcpSnippet {
  const server = { command: "aura", args: ["mcp"] };
  switch (clientId) {
    case "codex":
      return {
        syntax: "toml",
        destination: "~/.codex/config.toml",
        content: '[mcp_servers.aura]\ncommand = "aura"\nargs = ["mcp"]',
      };
    case "claude-code":
      return {
        syntax: "shell",
        destination: "Claude Code user configuration",
        content: "claude mcp add --scope user aura -- aura mcp",
      };
    case "opencode":
      return {
        syntax: "json",
        destination: "OpenCode config: mcp.servers.aura",
        content: JSON.stringify({ mcp: { servers: { aura: { type: "local", command: [server.command, ...server.args] } } } }, null, 2),
      };
    case "claude-desktop":
    case "cursor":
      return {
        syntax: "json",
        destination: clientId === "cursor" ? "Cursor MCP configuration" : "Claude Desktop configuration",
        content: JSON.stringify({ mcpServers: { aura: server } }, null, 2),
      };
    default:
      return {
        syntax: "json",
        destination: "Compatible MCP client configuration",
        content: JSON.stringify({ mcpServers: { aura: server } }, null, 2),
      };
  }
}

/**
 * Build an export plan without mutating an agent's files. This is deliberately
 * the contract used by preview/apply UI: it never serializes API keys, OAuth
 * payloads, or a path that is specific to one operating system.
 */
export function buildIntegrationAgentExport(config: OcxConfig, clientId: string): IntegrationAgentExport {
  const normalizedClientId = clientId.trim().toLowerCase();
  const connections = listIntegrationConnections(config)
    .map(connection => {
      const definition = getIntegrationDefinition(connection.integrationId);
      if (!definition) return undefined;
      const support = definition.clientSupport.find(item => item.clientId === normalizedClientId);
      if (!support) return undefined;
      return { connection, name: definition.name, grade: support.grade };
    })
    .filter((item): item is { connection: IntegrationConnectionSummary; name: string; grade: IntegrationClientGrade } => !!item);

  const grades: IntegrationClientGrade[] = ["auto", "partial", "guided"];
  const grade = grades.find(candidate => connections.some(item => item.grade === candidate)) ?? "guided";
  const ready = connections
    .filter(item => item.connection.status === "connected")
    .map(({ connection, name }) => ({ ...connection, integrationName: name }));

  return {
    clientId: normalizedClientId || "generic",
    grade,
    mcp: { command: "aura", args: ["mcp"] },
    snippet: mcpSnippetForClient(normalizedClientId || "generic"),
    connections: ready,
    note: ready.length
      ? "Copy this MCP declaration into the agent. Aura exposes connection metadata only until an official provider adapter is enabled."
      : "No connected integration is ready to export yet. Complete the provider's official authentication flow first.",
  };
}
