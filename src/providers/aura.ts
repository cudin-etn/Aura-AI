import type { OcxProviderConfig } from "../types";
import type { AuraProtocolId } from "../protocols/registry";
import { getProviderRegistryEntry, type ProviderAuthKind } from "./registry";

export type AuraProviderDescriptor = {
  id: string;
  adapter: string;
  protocol: AuraProtocolId;
  authentication: {
    kind: ProviderAuthKind | "key";
    keyOptional: boolean;
  };
  discovery: {
    live: boolean;
    models: readonly string[];
  };
  capabilities: {
    compact: "native" | "synthetic";
    reasoningDeclared: boolean;
    visionDeclared: boolean;
  };
};

function providerProtocol(adapter: string): AuraProtocolId {
  if (adapter === "openai-responses") return "responses";
  if (adapter === "anthropic") return "messages";
  return "chat-completions";
}

export function describeAuraProvider(id: string, provider: OcxProviderConfig): AuraProviderDescriptor {
  const registry = getProviderRegistryEntry(id);
  const modelInputModalities = provider.modelInputModalities ?? registry?.modelInputModalities;
  return {
    id,
    adapter: provider.adapter,
    protocol: providerProtocol(provider.adapter),
    authentication: {
      kind: provider.authMode ?? registry?.authKind ?? "key",
      keyOptional: provider.keyOptional ?? registry?.keyOptional ?? false,
    },
    discovery: {
      live: provider.liveModels ?? registry?.liveModels ?? true,
      models: provider.models ?? registry?.models ?? [],
    },
    capabilities: {
      compact: provider.compactMode ?? registry?.compactMode ?? "native",
      reasoningDeclared: Boolean(
        provider.reasoningEfforts?.length
        || Object.keys(provider.modelReasoningEfforts ?? {}).length
        || registry?.reasoningEfforts?.length
        || Object.keys(registry?.modelReasoningEfforts ?? {}).length,
      ),
      visionDeclared: Object.values(modelInputModalities ?? {}).some(modalities => modalities.includes("image")),
    },
  };
}
