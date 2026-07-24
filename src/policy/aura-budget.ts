import type { OcxConfig } from "../types";

const TASK_STATE_TTL_MS = 6 * 60 * 60 * 1_000;
const MAX_TASK_STATES = 1_000;

type TaskBudgetState = {
  activeSubagents: number;
  usedTokens: number;
  touchedAt: number;
};

export type AuraBudgetAdmission = {
  taskKey: string;
  subagent: boolean;
};

export type AuraBudgetDecision =
  | { ok: true; admission?: AuraBudgetAdmission; usedTokens: number; tokenLimit?: number }
  | {
    ok: false;
    code: "aura_task_budget_exhausted" | "aura_task_concurrency_exceeded";
    message: string;
    usedTokens: number;
    tokenLimit?: number;
  };

const taskStates = new Map<string, TaskBudgetState>();

function pruneTaskStates(now: number): void {
  for (const [key, state] of taskStates) {
    if (now - state.touchedAt > TASK_STATE_TTL_MS) taskStates.delete(key);
  }
  while (taskStates.size > MAX_TASK_STATES) {
    const oldest = taskStates.keys().next().value as string | undefined;
    if (!oldest) break;
    taskStates.delete(oldest);
  }
}

function taskState(taskKey: string, now: number): TaskBudgetState {
  const existing = taskStates.get(taskKey);
  if (existing) {
    existing.touchedAt = now;
    taskStates.delete(taskKey);
    taskStates.set(taskKey, existing);
    return existing;
  }
  const created = { activeSubagents: 0, usedTokens: 0, touchedAt: now };
  taskStates.set(taskKey, created);
  return created;
}

export function admitAuraTaskBudget(
  config: Pick<OcxConfig, "aura">,
  taskKey: string | undefined,
  subagent: boolean,
): AuraBudgetDecision {
  const now = Date.now();
  pruneTaskStates(now);
  const tokenLimit = config.aura?.tokenBudgetPerTask;
  const concurrencyLimit = config.aura?.maxSubagents;
  if (!taskKey || (!tokenLimit && !concurrencyLimit)) {
    return { ok: true, usedTokens: 0, ...(tokenLimit ? { tokenLimit } : {}) };
  }
  const state = taskState(taskKey, now);
  if (tokenLimit && state.usedTokens >= tokenLimit) {
    return {
      ok: false,
      code: "aura_task_budget_exhausted",
      message: `Aura task token budget exhausted (${state.usedTokens}/${tokenLimit})`,
      usedTokens: state.usedTokens,
      tokenLimit,
    };
  }
  if (subagent && concurrencyLimit && state.activeSubagents >= concurrencyLimit) {
    return {
      ok: false,
      code: "aura_task_concurrency_exceeded",
      message: `Aura task subagent limit reached (${state.activeSubagents}/${concurrencyLimit})`,
      usedTokens: state.usedTokens,
      ...(tokenLimit ? { tokenLimit } : {}),
    };
  }
  if (subagent) state.activeSubagents += 1;
  return {
    ok: true,
    admission: { taskKey, subagent },
    usedTokens: state.usedTokens,
    ...(tokenLimit ? { tokenLimit } : {}),
  };
}

export function completeAuraTaskBudget(
  admission: AuraBudgetAdmission | undefined,
  totalTokens: number | undefined,
): void {
  if (!admission) return;
  const state = taskStates.get(admission.taskKey);
  if (!state) return;
  if (admission.subagent) state.activeSubagents = Math.max(0, state.activeSubagents - 1);
  if (typeof totalTokens === "number" && Number.isFinite(totalTokens) && totalTokens > 0) {
    state.usedTokens += Math.ceil(totalTokens);
  }
  state.touchedAt = Date.now();
}

export function resetAuraTaskBudgetsForTests(): void {
  taskStates.clear();
}

