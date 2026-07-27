import { jsonResponse } from "../auth-cors";
import { AURA_INTEGRATIONS } from "../../integrations/registry";
import { listIntegrationConnections, prepareIntegrationConnection, removeIntegrationConnection } from "../../integrations/connections";
import { removeIntegrationSecret, storeIntegrationSecret } from "../../integrations/vault";
import { buildIntegrationAgentExport } from "../../integrations/export";
import { applyCodexMcpConnection, previewCodexMcpConnection, restoreCodexMcpConnection } from "../../clients/codex-mcp";
import { saveConfig } from "../../config";
import type { IntegrationAuthMode, IntegrationCapability } from "../../integrations/types";
import type { ManagementContext } from "./context";

const AUTH_MODES = new Set<IntegrationAuthMode>(["oauth2", "api-key", "cli", "mcp"]);
const CAPABILITIES = new Set<IntegrationCapability>(["read", "write", "deploy", "migration", "admin"]);

/** Management surface for the secret-free Integration Hub foundation. */
export async function handleIntegrationRoutes(ctx: ManagementContext): Promise<Response | null> {
  const { req, url, config } = ctx;
  if (url.pathname === "/api/integrations" && req.method === "GET") {
    return jsonResponse({
      integrations: AURA_INTEGRATIONS,
      connections: listIntegrationConnections(config),
    });
  }

  if (url.pathname === "/api/integrations/export" && req.method === "GET") {
    const clientId = url.searchParams.get("client")?.trim() || "generic";
    return jsonResponse({ export: buildIntegrationAgentExport(config, clientId) });
  }

  if (url.pathname === "/api/integrations/mcp/codex/preview" && req.method === "GET") {
    try { return jsonResponse({ preview: previewCodexMcpConnection(), applied: config.aura?.integrations?.mcpApplies?.codex ?? null }); }
    catch (error) { return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 400); }
  }

  if (url.pathname === "/api/integrations/mcp/codex/apply" && req.method === "POST") {
    try {
      const state = applyCodexMcpConnection();
      const previous = config.aura?.integrations?.mcpApplies?.codex;
      config.aura = {
        ...config.aura,
        integrations: { ...config.aura?.integrations, mcpApplies: { ...config.aura?.integrations?.mcpApplies, codex: state } },
      };
      try { saveConfig(config); }
      catch (error) {
        try { restoreCodexMcpConnection(state); } catch { /* best-effort rollback */ }
        config.aura = { ...config.aura, integrations: { ...config.aura?.integrations, mcpApplies: { ...config.aura?.integrations?.mcpApplies, ...(previous ? { codex: previous } : {}) } } };
        throw error;
      }
      return jsonResponse({ ok: true, state }, 201);
    } catch (error) { return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 400); }
  }

  if (url.pathname === "/api/integrations/mcp/codex" && req.method === "DELETE") {
    const state = config.aura?.integrations?.mcpApplies?.codex;
    if (!state) return jsonResponse({ error: "Aura has no managed Codex MCP apply to restore" }, 404);
    try {
      restoreCodexMcpConnection(state);
      const previous = config.aura;
      const { codex: _removed, ...mcpApplies } = previous?.integrations?.mcpApplies ?? {};
      config.aura = { ...previous, integrations: { ...previous?.integrations, mcpApplies } };
      try { saveConfig(config); }
      catch (error) { config.aura = previous; throw error; }
      return jsonResponse({ ok: true });
    } catch (error) { return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 400); }
  }

  if (url.pathname === "/api/integrations/connection" && req.method === "POST") {
    let raw: unknown;
    try { raw = await req.json(); } catch { return jsonResponse({ error: "invalid JSON body" }, 400); }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return jsonResponse({ error: "body must be a JSON object" }, 400);
    const body = raw as Record<string, unknown>;
    const integrationId = typeof body.integrationId === "string" ? body.integrationId : "";
    const label = typeof body.label === "string" ? body.label : "";
    const authMode = body.authMode;
    const scopes = body.scopes;
    if (!integrationId || !label || typeof authMode !== "string" || !AUTH_MODES.has(authMode as IntegrationAuthMode)) {
      return jsonResponse({ error: "integrationId, label, and a supported authMode are required" }, 400);
    }
    if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some(scope => typeof scope !== "string" || !CAPABILITIES.has(scope as IntegrationCapability))) {
      return jsonResponse({ error: "scopes must contain at least one supported capability" }, 400);
    }
    const secret = typeof body.secret === "string" ? body.secret : undefined;
    if (authMode === "api-key" && !secret?.trim()) return jsonResponse({ error: "an API key is required for api-key authentication" }, 400);
    if (secret !== undefined && secret.length > 64 * 1024) return jsonResponse({ error: "integration secret is too long" }, 400);
    let secretRef: string | undefined;
    try {
      if (secret?.trim()) secretRef = storeIntegrationSecret(secret);
      const connection = prepareIntegrationConnection(config, {
        integrationId,
        label,
        authMode: authMode as IntegrationAuthMode,
        scopes: scopes as IntegrationCapability[],
        resource: typeof body.resource === "string" ? body.resource : undefined,
        secretRef,
      });
      return jsonResponse({ ok: true, connection, next: "authenticate" }, 201);
    } catch (error) {
      if (secretRef) {
        try { removeIntegrationSecret(secretRef); } catch { /* best-effort rollback */ }
      }
      return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  if (url.pathname.startsWith("/api/integrations/connection/") && req.method === "DELETE") {
    const id = url.pathname.slice("/api/integrations/connection/".length);
    if (!id || !removeIntegrationConnection(config, id)) return jsonResponse({ error: "integration connection not found" }, 404);
    return jsonResponse({ ok: true, id });
  }

  return null;
}
