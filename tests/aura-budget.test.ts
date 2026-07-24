import { beforeEach, describe, expect, test } from "bun:test";
import {
  admitAuraTaskBudget,
  completeAuraTaskBudget,
  resetAuraTaskBudgetsForTests,
} from "../src/policy/aura-budget";
import type { OcxConfig } from "../src/types";
import { addFinalRequestLog } from "../src/server/request-log";

function config(): Pick<OcxConfig, "aura"> {
  return {
    aura: {
      maxSubagents: 2,
      tokenBudgetPerTask: 100,
    },
  };
}

beforeEach(() => {
  resetAuraTaskBudgetsForTests();
});

describe("Aura per-task budgets", () => {
  test("enforces concurrent subagent admissions per task", () => {
    const first = admitAuraTaskBudget(config(), "task-a", true);
    const second = admitAuraTaskBudget(config(), "task-a", true);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(admitAuraTaskBudget(config(), "task-a", true)).toMatchObject({
      ok: false,
      code: "aura_task_concurrency_exceeded",
    });

    if (first.ok) completeAuraTaskBudget(first.admission, 10);
    expect(admitAuraTaskBudget(config(), "task-a", true).ok).toBe(true);
    expect(admitAuraTaskBudget(config(), "task-b", true).ok).toBe(true);
  });

  test("rejects later turns once reported usage reaches the task ceiling", () => {
    const first = admitAuraTaskBudget(config(), "task-a", false);
    expect(first.ok).toBe(true);
    if (first.ok) completeAuraTaskBudget(first.admission, 100);

    expect(admitAuraTaskBudget(config(), "task-a", false)).toEqual({
      ok: false,
      code: "aura_task_budget_exhausted",
      message: "Aura task token budget exhausted (100/100)",
      usedTokens: 100,
      tokenLimit: 100,
    });
    expect(admitAuraTaskBudget(config(), "task-b", false).ok).toBe(true);
  });

  test("does not invent token usage when a provider reports none", () => {
    const first = admitAuraTaskBudget(config(), "task-a", false);
    if (first.ok) completeAuraTaskBudget(first.admission, undefined);
    const next = admitAuraTaskBudget(config(), "task-a", false);
    expect(next).toMatchObject({ ok: true, usedTokens: 0 });
  });

  test("final request logging commits reported usage and releases the admission", () => {
    const admitted = admitAuraTaskBudget(config(), "task-a", true);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;

    addFinalRequestLog("budget-log", Date.now(), {
      model: "reviewer",
      provider: "test",
      auraBudgetAdmission: admitted.admission,
      usage: { inputTokens: 60, outputTokens: 40, totalTokens: 100 },
    }, 200, undefined, () => {});

    expect(admitAuraTaskBudget(config(), "task-a", false)).toMatchObject({
      ok: false,
      code: "aura_task_budget_exhausted",
      usedTokens: 100,
    });
  });
});
