import { AURA_ROLE_CONTEXT_BUDGETS, type AuraRole } from "../policy/aura-profiles";

export const AURA_OPTIMIZER_PRESET_IDS = ["lite", "full", "ultra"] as const;
export type AuraOptimizerPresetId = typeof AURA_OPTIMIZER_PRESET_IDS[number];

export type AuraOptimizerPreset = {
  enabled: true;
  preset: AuraOptimizerPresetId;
  deduplicate: boolean;
  reduceLogs: boolean;
  contextBudgets: Record<AuraRole, number>;
};

function scaledBudgets(scale: number): Record<AuraRole, number> {
  return Object.fromEntries(Object.entries(AURA_ROLE_CONTEXT_BUDGETS).map(([role, budget]) => [
    role,
    Math.round(budget * scale),
  ])) as Record<AuraRole, number>;
}

export function buildAuraOptimizerPreset(preset: AuraOptimizerPresetId): AuraOptimizerPreset {
  if (preset === "lite") {
    return { enabled: true, preset, deduplicate: false, reduceLogs: false, contextBudgets: scaledBudgets(1.5) };
  }
  if (preset === "ultra") {
    return { enabled: true, preset, deduplicate: true, reduceLogs: true, contextBudgets: scaledBudgets(0.6) };
  }
  return { enabled: true, preset, deduplicate: true, reduceLogs: true, contextBudgets: scaledBudgets(1) };
}
