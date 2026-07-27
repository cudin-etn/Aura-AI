import { describe, expect, test } from "bun:test";
import { getIntegrationDefinition, AURA_INTEGRATIONS } from "../src/integrations/registry";
import { listIntegrationConnections, prepareIntegrationConnection, removeIntegrationConnection } from "../src/integrations/connections";
import { buildIntegrationAgentExport } from "../src/integrations/export";
import type { OcxConfig } from "../src/types";

function config(): OcxConfig {
  return {
    port: 10100,
    providers: {},
    defaultProvider: "openai",
    aura: { integrations: { connections: [] } },
  };
}

describe("Aura Integration Hub registry", () => {
  test("contains the initial integration families without secrets", () => {
    expect(AURA_INTEGRATIONS.length).toBeGreaterThanOrEqual(15);
    expect(getIntegrationDefinition("supabase")?.upstream).toBe("official-mcp");
    expect(getIntegrationDefinition("github")?.capabilities).toContain("write");
  });

  test("prepares secret-free metadata and can remove it", () => {
    const current = config();
    const connection = prepareIntegrationConnection(current, {
      integrationId: "vercel",
      label: "Personal Vercel",
      authMode: "oauth2",
      scopes: ["read", "deploy"],
      resource: "team-example",
    }, { persist: false });
    expect(connection.status).toBe("pending-auth");
    expect(connection).not.toHaveProperty("token");
    expect(listIntegrationConnections(current)).toHaveLength(1);
    expect(removeIntegrationConnection(current, connection.id, { persist: false })).toBe(true);
    expect(listIntegrationConnections(current)).toHaveLength(0);
  });

  test("exports a credential-free MCP declaration only for connected integrations", () => {
    const current = config();
    const connection = prepareIntegrationConnection(current, {
      integrationId: "github", label: "Work GitHub", authMode: "oauth2", scopes: ["read"],
    }, { persist: false });
    const pending = buildIntegrationAgentExport(current, "codex");
    expect(pending.mcp).toEqual({ command: "aura", args: ["mcp"] });
    expect(pending.connections).toHaveLength(0);

    const stored = current.aura!.integrations!.connections![0]!;
    stored.status = "connected";
    const ready = buildIntegrationAgentExport(current, "codex");
    expect(ready.connections).toHaveLength(1);
    expect(ready.connections[0]).not.toHaveProperty("secretRef");
    expect(ready.connections[0]?.id).toBe(connection.id);
  });
});
