import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "../config";
import { listIntegrationConnections } from "./connections";
import { getIntegrationDefinition } from "./registry";

function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

/**
 * Local MCP entry point. It is intentionally read-only today: agents can
 * discover the user's Aura integration inventory without receiving credentials.
 * Provider actions land only after an official adapter has been implemented.
 */
export async function runAuraMcpServer(): Promise<void> {
  const server = new McpServer({ name: "aura-ai", version: "0.1.0" });
  server.registerTool(
    "aura_list_integrations",
    {
      description: "List Aura integration connections and their safe readiness state. Never returns credentials.",
      inputSchema: {},
    },
    async () => {
      const config = loadConfig();
      const connections = listIntegrationConnections(config).map(connection => ({
        ...connection,
        name: getIntegrationDefinition(connection.integrationId)?.name ?? connection.integrationId,
      }));
      return text({ connections, safety: "Credentials stay in Aura and are never returned through MCP." });
    },
  );
  server.registerTool(
    "aura_integration_status",
    {
      description: "Read the safe status and declared capabilities of one Aura integration.",
      inputSchema: { integrationId: z.string().min(1).max(80) },
    },
    async ({ integrationId }) => {
      const definition = getIntegrationDefinition(integrationId);
      if (!definition) return text({ error: "Unknown Aura integration" });
      const connections = listIntegrationConnections(loadConfig()).filter(item => item.integrationId === definition.id);
      return text({
        id: definition.id,
        name: definition.name,
        capabilities: definition.capabilities,
        authModes: definition.authModes,
        connections,
        safety: "This MCP server is read-only until an official provider adapter is enabled.",
      });
    },
  );
  await server.connect(new StdioServerTransport());
}
