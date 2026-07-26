import {
  catalogModelSlug,
  uniqueCatalogModelsForPublicList,
  type CatalogModel,
} from "../codex/catalog";
import { slugEquals } from "../providers/slug-codec";
import { AURA_CLIENT_ADAPTERS, type AuraClientId } from "./registry";
import type { AuraProtocolId } from "../protocols/registry";

export type AuraClientModelGrade = "native" | "compatible" | "limited" | "failed";
export type AuraCapabilityEvidence = "available" | "unknown";

export type AuraClientModel = {
  id: string;
  provider: string;
  model: string;
  native: boolean;
  grade: AuraClientModelGrade;
  protocols: AuraProtocolId[];
  compatibleClients: AuraClientId[];
  capabilities: {
    tools: AuraCapabilityEvidence;
    reasoning: AuraCapabilityEvidence;
    vision: AuraCapabilityEvidence;
  };
  contextWindow?: number;
  reasoningEfforts?: string[];
  inputModalities?: string[];
};

const ALL_GATEWAY_PROTOCOLS: AuraProtocolId[] = ["responses", "chat-completions", "messages"];

function isDisabledRouted(model: CatalogModel, disabled: ReadonlySet<string>): boolean {
  const slug = catalogModelSlug(model);
  return disabled.has(slug)
    || [...disabled].some(value => slugEquals(value, model.provider, model.id));
}

function compatibleClients(protocols: readonly AuraProtocolId[]): AuraClientId[] {
  return AURA_CLIENT_ADAPTERS
    .filter(client => client.protocols.some(protocol => protocols.includes(protocol)))
    .map(client => client.id);
}

export function buildAuraClientModelCatalog(input: {
  routedModels: readonly CatalogModel[];
  nativeSlugs: readonly string[];
  disabledModels?: readonly string[];
}): AuraClientModel[] {
  const disabled = new Set(input.disabledModels ?? []);
  const protocols = ALL_GATEWAY_PROTOCOLS;
  const clients = compatibleClients(protocols);
  const routed = uniqueCatalogModelsForPublicList([...input.routedModels])
    .filter(model => !isDisabledRouted(model, disabled))
    .map(model => ({
      id: catalogModelSlug(model),
      provider: model.provider,
      model: model.id,
      native: false,
      grade: "compatible" as const,
      protocols: [...protocols],
      compatibleClients: [...clients],
      capabilities: {
        tools: model.parallelToolCalls === true ? "available" as const : "unknown" as const,
        reasoning: model.reasoningEfforts?.length ? "available" as const : "unknown" as const,
        vision: model.inputModalities?.some(modality => modality !== "text")
          ? "available" as const
          : "unknown" as const,
      },
      ...(typeof model.contextWindow === "number" ? { contextWindow: model.contextWindow } : {}),
      ...(model.reasoningEfforts?.length ? { reasoningEfforts: [...model.reasoningEfforts] } : {}),
      ...(model.inputModalities?.length ? { inputModalities: [...model.inputModalities] } : {}),
    } satisfies AuraClientModel));
  const native = [...new Set(input.nativeSlugs)]
    .filter(id => !disabled.has(id))
    .map(id => ({
      id,
      provider: "openai",
      model: id,
      native: true,
      grade: "native" as const,
      protocols: [...protocols],
      compatibleClients: [...clients],
      capabilities: {
        tools: "available" as const,
        reasoning: "available" as const,
        vision: "unknown" as const,
      },
    } satisfies AuraClientModel));
  return [...routed, ...native].sort((a, b) => a.id.localeCompare(b.id));
}

export function modelsForAuraClient(
  models: readonly AuraClientModel[],
  clientId: AuraClientId,
): AuraClientModel[] {
  return models.filter(model =>
    model.grade !== "failed" && model.compatibleClients.includes(clientId));
}
