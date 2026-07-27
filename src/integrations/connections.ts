import { randomUUID } from "node:crypto";
import type { OcxConfig } from "../types";
import { saveConfig } from "../config";
import { getIntegrationDefinition } from "./registry";
import { removeIntegrationSecret } from "./vault";
import type {
  IntegrationCapability,
  IntegrationConnectionMetadata,
  IntegrationConnectionSummary,
  IntegrationAuthMode,
} from "./types";

function connectionStore(config: OcxConfig): IntegrationConnectionMetadata[] {
  return config.aura?.integrations?.connections ?? [];
}

export function listIntegrationConnections(config: OcxConfig): IntegrationConnectionSummary[] {
  return connectionStore(config).map(({ id, integrationId, label, status, authMode, scopes, resource, updatedAt }) => ({
    id, integrationId, label, status, authMode, scopes, ...(resource ? { resource } : {}), updatedAt,
  }));
}

export function prepareIntegrationConnection(
  config: OcxConfig,
  input: { integrationId: string; label: string; authMode: IntegrationAuthMode; scopes: IntegrationCapability[]; resource?: string; secretRef?: string },
  options: { persist?: boolean } = {},
): IntegrationConnectionSummary {
  const definition = getIntegrationDefinition(input.integrationId);
  if (!definition) throw new Error("unknown integration");
  if (!definition.authModes.includes(input.authMode)) throw new Error("unsupported authentication mode");
  if (input.scopes.length === 0 || input.scopes.some(scope => !definition.capabilities.includes(scope))) {
    throw new Error("requested scope is not supported by this integration");
  }
  const label = input.label.trim();
  if (!label || label.length > 80) throw new Error("label must be between 1 and 80 characters");
  const now = new Date().toISOString();
  const connection: IntegrationConnectionMetadata = {
    id: randomUUID(),
    integrationId: input.integrationId,
    label,
    status: "pending-auth",
    authMode: input.authMode,
    scopes: [...new Set(input.scopes)],
    ...(input.resource?.trim() ? { resource: input.resource.trim().slice(0, 240) } : {}),
    ...(input.secretRef ? { secretRef: input.secretRef } : {}),
    createdAt: now,
    updatedAt: now,
  };
  const previousAura = config.aura;
  config.aura = {
    ...config.aura,
    integrations: { ...config.aura?.integrations, connections: [...connectionStore(config), connection] },
  };
  if (options.persist !== false) {
    try { saveConfig(config); }
    catch (error) { config.aura = previousAura; throw error; }
  }
  return listIntegrationConnections(config).find(item => item.id === connection.id)!;
}

export function removeIntegrationConnection(config: OcxConfig, id: string, options: { persist?: boolean } = {}): boolean {
  const current = connectionStore(config);
  const next = current.filter(item => item.id !== id);
  if (next.length === current.length) return false;
  const previousAura = config.aura;
  config.aura = { ...config.aura, integrations: { ...config.aura?.integrations, connections: next } };
  if (options.persist !== false) {
    try { saveConfig(config); }
    catch (error) { config.aura = previousAura; throw error; }
  }
  // Credential revocation is intentionally after config persistence. If it
  // fails, the orphaned secret is safer than a connection referencing a missing
  // credential; a later vault cleanup can remove it.
  if (current.find(item => item.id === id)?.secretRef) {
    try { removeIntegrationSecret(current.find(item => item.id === id)!.secretRef!); } catch { /* best-effort revoke */ }
  }
  return true;
}
