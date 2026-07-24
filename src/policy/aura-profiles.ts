import type { OcxConfig } from "../types";

export const AURA_PROFILE_IDS = ["saver", "balanced", "quality"] as const;
export type AuraProfileId = typeof AURA_PROFILE_IDS[number];

export const AURA_ROLES = ["orchestrator", "explorer", "worker", "reviewer", "tester", "docs"] as const;
export type AuraRole = typeof AURA_ROLES[number];

export type AuraRoleRequirement = {
  minTier: "luna" | "terra" | "sol";
  reasoning: "low" | "medium" | "high";
  tools: boolean;
  vision: "optional" | "required";
};

/** Minimum conservative capability contract used by profile defaults and the GUI. */
export const AURA_ROLE_REQUIREMENTS: Record<AuraRole, AuraRoleRequirement> = {
  orchestrator: { minTier: "terra", reasoning: "medium", tools: true, vision: "optional" },
  explorer: { minTier: "luna", reasoning: "low", tools: true, vision: "optional" },
  worker: { minTier: "luna", reasoning: "low", tools: true, vision: "optional" },
  reviewer: { minTier: "sol", reasoning: "high", tools: true, vision: "optional" },
  tester: { minTier: "terra", reasoning: "low", tools: true, vision: "optional" },
  docs: { minTier: "luna", reasoning: "low", tools: false, vision: "optional" },
};

export type AuraRoleAssignment = {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
};

export type AuraProfile = {
  id: AuraProfileId;
  roles: Record<AuraRole, AuraRoleAssignment>;
  maxSubagents: number;
};

export type AuraProfileOverrides = Partial<Record<AuraRole, Partial<AuraRoleAssignment>>>;

function findTier(models: readonly string[], tier: "sol" | "terra" | "luna"): string | undefined {
  return models.find(model => model.toLowerCase().includes(`gpt-5.6-${tier}`));
}

export function buildAuraProfile(
  id: AuraProfileId,
  models: readonly string[],
  overrides: AuraProfileOverrides = {},
): AuraProfile {
  const first = models[0] ?? "gpt-5.6-sol";
  const sol = findTier(models, "sol") ?? first;
  const terra = findTier(models, "terra") ?? sol;
  const luna = findTier(models, "luna") ?? terra;
  const defaults: Record<AuraProfileId, AuraProfile["roles"]> = {
    saver: {
      orchestrator: { model: terra, effort: "low" },
      explorer: { model: luna, effort: "low" },
      worker: { model: luna, effort: "low" },
      reviewer: { model: sol, effort: "high" },
      tester: { model: terra, effort: "low" },
      docs: { model: luna, effort: "low" },
    },
    balanced: {
      orchestrator: { model: terra, effort: "medium" },
      explorer: { model: luna, effort: "low" },
      worker: { model: terra, effort: "medium" },
      reviewer: { model: sol, effort: "high" },
      tester: { model: terra, effort: "medium" },
      docs: { model: luna, effort: "low" },
    },
    quality: {
      orchestrator: { model: sol, effort: "medium" },
      explorer: { model: terra, effort: "low" },
      worker: { model: terra, effort: "medium" },
      reviewer: { model: sol, effort: "high" },
      tester: { model: terra, effort: "medium" },
      docs: { model: terra, effort: "low" },
    },
  };
  const roles = Object.fromEntries(AURA_ROLES.map(role => [
    role,
    { ...defaults[id][role], ...overrides[role] },
  ])) as AuraProfile["roles"];
  return { id, roles, maxSubagents: 3 };
}

export function auraProfilePrompt(profile: AuraProfile): string {
  const lines = AURA_ROLES
    .filter(role => role !== "orchestrator")
    .map(role => {
      const assignment = profile.roles[role];
      return `- ${role}: model "${assignment.model}", reasoning_effort "${assignment.effort}"`;
    });
  return [
    `Aura profile "${profile.id}" is active.`,
    "Delegate only when it materially helps. Use these deterministic role assignments:",
    ...lines,
    `Never exceed ${profile.maxSubagents} concurrent subagents.`,
    "Escalate to reviewer after two failed verification attempts or for security, concurrency, migration, or data-loss risk.",
  ].join("\n");
}

export function applyAuraProfile(config: OcxConfig, profile: AuraProfile): void {
  const orderedRoles: AuraRole[] = ["worker", "explorer", "reviewer", "tester", "docs"];
  config.subagentModels = [...new Set(orderedRoles.map(role => profile.roles[role].model))].slice(0, 5);
  config.injectionModel = profile.roles.worker.model;
  config.injectionEffort = profile.roles.worker.effort;
  config.injectionPrompt = auraProfilePrompt(profile);
  config.multiAgentGuidanceEnabled = true;
  config.aura = {
    activeProfile: profile.id,
    roles: profile.roles,
    maxSubagents: profile.maxSubagents,
  };
}

export function inferAuraRole(headers: Headers): AuraRole {
  const marker = `${headers.get("x-openai-subagent") ?? ""} ${headers.get("x-codex-turn-metadata") ?? ""}`.toLowerCase();
  if (!marker.trim()) return "orchestrator";
  if (/review|audit|security/.test(marker)) return "reviewer";
  if (/explore|search|research/.test(marker)) return "explorer";
  if (/test|verify|qa/.test(marker)) return "tester";
  if (/doc|write/.test(marker)) return "docs";
  return "worker";
}

export function auraRouteMetadata(
  config: Pick<OcxConfig, "aura">,
  headers: Headers,
  requestedModel: string,
): { profile?: AuraProfileId; role?: AuraRole; reason?: "profile_match" | "manual_override" } {
  const profile = config.aura?.activeProfile;
  if (!profile || !AURA_PROFILE_IDS.includes(profile)) return {};
  const role = inferAuraRole(headers);
  const assigned = config.aura?.roles?.[role]?.model;
  return {
    profile,
    role,
    reason: assigned === requestedModel ? "profile_match" : "manual_override",
  };
}
