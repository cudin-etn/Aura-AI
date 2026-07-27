/**
 * Provider-neutral integration contracts.
 *
 * This layer describes what Aura can connect to and what an agent may receive;
 * it intentionally contains no access tokens or private provider payloads.
 */

export type IntegrationCategory =
  | "code"
  | "backend"
  | "deploy"
  | "monitoring"
  | "project"
  | "communication";

export type IntegrationAuthMode = "oauth2" | "api-key" | "cli" | "mcp";

export type IntegrationCapability = "read" | "write" | "deploy" | "migration" | "admin";

export type IntegrationClientGrade = "auto" | "partial" | "guided";
export type IntegrationAvailability = "planned" | "catalog" | "available";

export type IntegrationConnectionStatus = "disconnected" | "pending-auth" | "connected" | "error";

export interface IntegrationClientSupport {
  clientId: string;
  grade: IntegrationClientGrade;
  /** Why this client cannot receive the integration automatically, if applicable. */
  note?: string;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  authModes: IntegrationAuthMode[];
  capabilities: IntegrationCapability[];
  upstream: "official-mcp" | "official-api" | "official-cli" | "generic-api";
  clientSupport: IntegrationClientSupport[];
  /** What Aura can do today. Catalog entries do not claim a live provider adapter. */
  availability?: IntegrationAvailability;
  /** Optional documentation URL; never contains a user credential. */
  docsUrl?: string;
}

export interface IntegrationConnectionMetadata {
  id: string;
  integrationId: string;
  label: string;
  status: IntegrationConnectionStatus;
  authMode: IntegrationAuthMode;
  scopes: IntegrationCapability[];
  resource?: string;
  createdAt: string;
  updatedAt: string;
  /** Opaque keychain/OAuth reference only; never the secret itself. */
  secretRef?: string;
  lastError?: string;
}

export interface IntegrationConnectionSummary {
  id: string;
  integrationId: string;
  label: string;
  status: IntegrationConnectionStatus;
  authMode: IntegrationAuthMode;
  scopes: IntegrationCapability[];
  resource?: string;
  updatedAt: string;
}
