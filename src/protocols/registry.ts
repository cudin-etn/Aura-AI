export type AuraProtocolId = "responses" | "chat-completions" | "messages";

export type AuraProtocolSurface = {
  id: AuraProtocolId;
  paths: readonly string[];
  streaming: boolean;
  tools: boolean;
};

export const AURA_PROTOCOLS: readonly AuraProtocolSurface[] = [
  {
    id: "responses",
    paths: ["/v1/responses", "/v1/responses/compact"],
    streaming: true,
    tools: true,
  },
  {
    id: "chat-completions",
    paths: ["/v1/chat/completions"],
    streaming: true,
    tools: true,
  },
  {
    id: "messages",
    paths: ["/v1/messages"],
    streaming: true,
    tools: true,
  },
];

export function auraProtocolForPath(pathname: string): AuraProtocolId | null {
  return AURA_PROTOCOLS.find(protocol => protocol.paths.includes(pathname))?.id ?? null;
}
