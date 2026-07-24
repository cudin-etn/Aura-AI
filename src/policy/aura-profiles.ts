import type { OcxConfig } from "../types";

export const AURA_PROFILE_IDS = ["saver", "balanced", "quality"] as const;
export type AuraProfileId = typeof AURA_PROFILE_IDS[number];
export type AuraRouteReason =
  | "profile_match"
  | "manual_override"
  | "risk_escalation"
  | "verification_escalation";

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
  tokenBudgetPerTask: number;
};

export type AuraProfileOverrides = Partial<Record<AuraRole, Partial<AuraRoleAssignment>>>;

export const AURA_ROLE_CONTEXT_BUDGETS: Record<AuraRole, number> = {
  orchestrator: 80_000,
  explorer: 20_000,
  worker: 40_000,
  reviewer: 60_000,
  tester: 30_000,
  docs: 20_000,
};

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
  const limits: Record<AuraProfileId, { maxSubagents: number; tokenBudgetPerTask: number }> = {
    saver: { maxSubagents: 2, tokenBudgetPerTask: 250_000 },
    balanced: { maxSubagents: 3, tokenBudgetPerTask: 500_000 },
    quality: { maxSubagents: 4, tokenBudgetPerTask: 1_000_000 },
  };
  return { id, roles, ...limits[id] };
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
    tokenBudgetPerTask: profile.tokenBudgetPerTask,
    optimizer: {
      enabled: true,
      deduplicate: true,
      reduceLogs: true,
      ...config.aura?.optimizer,
      contextBudgets: {
        ...AURA_ROLE_CONTEXT_BUDGETS,
        ...config.aura?.optimizer?.contextBudgets,
      },
    },
  };
}

export function inferAuraRole(headers: Headers): AuraRole {
  const explicit = headers.get("x-aura-role")?.trim().toLowerCase();
  if (AURA_ROLES.includes(explicit as AuraRole)) return explicit as AuraRole;
  const metadata = auraTurnMetadata(headers);
  const metadataRole = typeof metadata.aura_role === "string"
    ? metadata.aura_role.trim().toLowerCase()
    : "";
  if (AURA_ROLES.includes(metadataRole as AuraRole)) return metadataRole as AuraRole;
  const marker = `${headers.get("x-openai-subagent") ?? ""} ${headers.get("x-codex-turn-metadata") ?? ""}`.toLowerCase();
  if (!marker.trim()) return "orchestrator";
  if (/review|audit|security/.test(marker)) return "reviewer";
  if (/explore|search|research/.test(marker)) return "explorer";
  if (/test|verify|qa/.test(marker)) return "tester";
  if (/doc|write/.test(marker)) return "docs";
  return "worker";
}

function auraTurnMetadata(headers: Headers): Record<string, unknown> {
  const raw = headers.get("x-codex-turn-metadata");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function normalizedRiskSignal(headers: Headers): string | undefined {
  const metadata = auraTurnMetadata(headers);
  const raw = headers.get("x-aura-risk")
    ?? (typeof metadata.aura_risk === "string" ? metadata.aura_risk : undefined);
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase().replaceAll("-", "_");
  return ["security", "concurrency", "migration", "data_loss"].includes(normalized)
    ? normalized
    : undefined;
}

function verificationFailures(headers: Headers): number {
  const metadata = auraTurnMetadata(headers);
  const raw = headers.get("x-aura-verification-failures") ?? metadata.aura_verification_failures;
  const count = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export function resolveAuraRoute(
  config: Pick<OcxConfig, "aura">,
  headers: Headers,
  requestedModel: string,
): { profile?: AuraProfileId; role?: AuraRole; reason?: AuraRouteReason; model: string } {
  const profile = config.aura?.activeProfile;
  if (!profile || !AURA_PROFILE_IDS.includes(profile)) return { model: requestedModel };
  const role = inferAuraRole(headers);
  const assigned = config.aura?.roles?.[role]?.model;
  const reviewerModel = config.aura?.roles?.reviewer?.model;
  const risk = normalizedRiskSignal(headers);
  if (risk && reviewerModel) {
    return { profile, role: "reviewer", reason: "risk_escalation", model: reviewerModel };
  }
  if (verificationFailures(headers) >= 2 && reviewerModel) {
    return { profile, role: "reviewer", reason: "verification_escalation", model: reviewerModel };
  }
  return {
    profile,
    role,
    reason: assigned === requestedModel ? "profile_match" : "manual_override",
    model: requestedModel,
  };
}

export function auraRouteMetadata(
  config: Pick<OcxConfig, "aura">,
  headers: Headers,
  requestedModel: string,
): Omit<ReturnType<typeof resolveAuraRoute>, "model"> {
  const { model: _model, ...metadata } = resolveAuraRoute(config, headers, requestedModel);
  return metadata;
}
