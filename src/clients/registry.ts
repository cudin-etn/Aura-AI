import { auraProtocolForPath, type AuraProtocolId } from "../protocols/registry";
export type { AuraProtocolId } from "../protocols/registry";

export type AuraClientId = "codex" | "claude-code" | "opencode" | "zcode";
export type AuraClientMaturity = "production" | "basic" | "experimental";

export type AuraClientAdapter = {
  id: AuraClientId;
  label: string;
  maturity: AuraClientMaturity;
  protocols: AuraProtocolId[];
  endpoints: string[];
  configurable: boolean;
};

export const AURA_CLIENT_ADAPTERS: AuraClientAdapter[] = [
  {
    id: "codex",
    label: "Codex",
    maturity: "production",
    protocols: ["responses"],
    endpoints: ["/v1/responses", "/v1/responses/compact"],
    configurable: true,
  },
  {
    id: "claude-code",
    label: "Claude Code",
    maturity: "production",
    protocols: ["messages"],
    endpoints: ["/v1/messages"],
    configurable: true,
  },
  {
    id: "opencode",
    label: "OpenCode",
    maturity: "basic",
    protocols: ["chat-completions"],
    endpoints: ["/v1/chat/completions"],
    configurable: true,
  },
  {
    id: "zcode",
    label: "ZCode",
    maturity: "experimental",
    protocols: [],
    endpoints: [],
    configurable: false,
  },
];

export function auraClientSurface(pathname: string): {
  client: AuraClientId;
  protocol: AuraProtocolId;
} | null {
  const protocol = auraProtocolForPath(pathname);
  if (protocol === "responses") return { client: "codex", protocol };
  if (protocol === "messages") return { client: "claude-code", protocol };
  if (protocol === "chat-completions") return { client: "opencode", protocol };
  return null;
}

export function auraClientLogFields(pathname: string): {
  auraClient?: AuraClientId;
  auraProtocol?: AuraProtocolId;
} {
  const surface = auraClientSurface(pathname);
  return surface
    ? { auraClient: surface.client, auraProtocol: surface.protocol }
    : {};
}
