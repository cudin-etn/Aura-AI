import { describe, expect, test } from "bun:test";
import {
  applyAuraProfile,
  AURA_ROLE_REQUIREMENTS,
  auraRouteMetadata,
  auraGptCandidates,
  buildAuraProfile,
  inferAuraRole,
  resolveAuraRoute,
} from "../src/policy/aura-profiles";
import type { OcxConfig } from "../src/types";
import { addFinalRequestLog, requestLogEntryFromPersistedUsage, type RequestLogEntry } from "../src/server/request-log";

const models = [
  "9router/cx/gpt-5.6-luna",
  "9router/cx/gpt-5.6-terra",
  "9router/cx/gpt-5.6-sol",
];

function config(): OcxConfig {
  return {
    port: 10100,
    providers: {
      "9router": { adapter: "openai-responses", baseUrl: "http://127.0.0.1:20128/v1" },
    },
    defaultProvider: "9router",
  };
}

describe("Aura profiles", () => {
  test("defines conservative capability requirements for every universal role", () => {
    expect(Object.keys(AURA_ROLE_REQUIREMENTS)).toEqual([
      "orchestrator", "explorer", "worker", "reviewer", "tester", "docs",
    ]);
    expect(AURA_ROLE_REQUIREMENTS.reviewer).toEqual({
      minTier: "sol",
      reasoning: "high",
      tools: true,
      vision: "optional",
    });
    expect(AURA_ROLE_REQUIREMENTS.docs.tools).toBe(false);
  });

  test("Balanced uses Terra for parent/work, Luna for exploration, and Sol for review", () => {
    const profile = buildAuraProfile("balanced", models);
    expect(profile.roles).toMatchObject({
      orchestrator: { model: models[1], effort: "medium" },
      explorer: { model: models[0], effort: "low" },
      worker: { model: models[1], effort: "medium" },
      reviewer: { model: models[2], effort: "high" },
    });
  });

  test("applies one profile through existing roster and injection controls", () => {
    const target = config();
    applyAuraProfile(target, buildAuraProfile("balanced", models));
    expect(target.subagentModels).toEqual([models[1], models[0], models[2]]);
    expect(target.injectionModel).toBe(models[1]);
    expect(target.injectionEffort).toBe("medium");
    expect(target.injectionPrompt).toContain("Never exceed 3 concurrent subagents.");
    expect(target.aura?.activeProfile).toBe("balanced");
    expect(target.aura?.maxSubagents).toBe(3);
    expect(target.aura?.tokenBudgetPerTask).toBe(500_000);
  });

  test("role inference is deterministic and route metadata exposes manual overrides", () => {
    expect(inferAuraRole(new Headers())).toBe("orchestrator");
    expect(inferAuraRole(new Headers({ "x-openai-subagent": "security_review" }))).toBe("reviewer");
    expect(inferAuraRole(new Headers({ "x-codex-turn-metadata": "{\"subagent_kind\":\"explorer\"}" }))).toBe("explorer");

    const target = config();
    applyAuraProfile(target, buildAuraProfile("balanced", models));
    expect(auraRouteMetadata(target, new Headers(), models[1])).toEqual({
      profile: "balanced",
      role: "orchestrator",
      reason: "profile_match",
    });
    expect(auraRouteMetadata(target, new Headers({ "x-openai-subagent": "review" }), models[0])).toEqual({
      profile: "balanced",
      role: "reviewer",
      reason: "manual_override",
    });
  });

  test("escalates only on explicit bounded risk and verification signals", () => {
    const target = config();
    applyAuraProfile(target, buildAuraProfile("balanced", models));

    expect(resolveAuraRoute(target, new Headers({
      "x-aura-risk": "security",
      "x-aura-role": "worker",
    }), models[1])).toEqual({
      profile: "balanced",
      role: "reviewer",
      reason: "risk_escalation",
      model: models[2],
    });
    expect(resolveAuraRoute(target, new Headers({
      "x-codex-turn-metadata": JSON.stringify({
        aura_role: "tester",
        aura_verification_failures: 2,
      }),
    }), models[1])).toEqual({
      profile: "balanced",
      role: "reviewer",
      reason: "verification_escalation",
      model: models[2],
    });
    expect(resolveAuraRoute(target, new Headers({
      "x-aura-risk": "hard-looking-task",
      "x-aura-verification-failures": "1",
    }), models[1])).toEqual({
      profile: "balanced",
      role: "orchestrator",
      reason: "profile_match",
      model: models[1],
    });
  });

  test("routes only configured GPT candidates when automatic routing is enabled", () => {
    const target = config();
    applyAuraProfile(target, buildAuraProfile("balanced", models));
    target.aura!.router = { mode: "safe", candidates: [...models, "other/provider-model"] };
    expect(auraGptCandidates(target.aura!.router.candidates)).toEqual(models);
    expect(resolveAuraRoute(target, new Headers({ "x-aura-role": "explorer" }), models[2])).toMatchObject({
      model: models[0], reason: "auto_safe", role: "explorer",
    });
    expect(resolveAuraRoute(target, new Headers({ "x-aura-role": "reviewer" }), models[0])).toMatchObject({
      model: models[2], reason: "auto_safe", role: "reviewer",
    });
  });

  test("route metadata survives final and persisted request-log projections", () => {
    const entries: RequestLogEntry[] = [];
    addFinalRequestLog("aura-route", Date.now(), {
      model: models[1],
      provider: "9router",
      auraProfile: "balanced",
      auraRole: "worker",
      auraRouteReason: "profile_match",
    }, 200, undefined, entry => entries.push(entry));
    expect(entries[0]).toMatchObject({
      auraProfile: "balanced",
      auraRole: "worker",
      auraRouteReason: "profile_match",
    });
    expect(requestLogEntryFromPersistedUsage({
      ...entries[0]!,
      usageStatus: "unreported",
    })).toMatchObject({
      auraProfile: "balanced",
      auraRole: "worker",
      auraRouteReason: "profile_match",
    });
  });
});
