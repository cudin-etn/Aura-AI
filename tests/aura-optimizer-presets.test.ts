import { describe, expect, test } from "bun:test";
import { buildAuraOptimizerPreset } from "../src/optimizer/presets";

describe("Aura optimizer presets", () => {
  test("Off and Safe are explicit conservative contracts", () => {
    expect(buildAuraOptimizerPreset("off")).toMatchObject({ enabled: false, deduplicate: false, reduceLogs: false });
    expect(buildAuraOptimizerPreset("safe")).toMatchObject({ enabled: true, deduplicate: false, reduceLogs: true });
  });

  test("Lite, Full, and Ultra are behaviorally distinct and ordered", () => {
    const lite = buildAuraOptimizerPreset("lite");
    const full = buildAuraOptimizerPreset("full");
    const ultra = buildAuraOptimizerPreset("ultra");
    expect(lite).toMatchObject({ enabled: true, deduplicate: false, reduceLogs: false });
    expect(full).toMatchObject({ enabled: true, deduplicate: true, reduceLogs: true });
    expect(ultra).toMatchObject({ enabled: true, deduplicate: true, reduceLogs: true });
    expect(lite.contextBudgets.worker).toBeGreaterThan(full.contextBudgets.worker);
    expect(full.contextBudgets.worker).toBeGreaterThan(ultra.contextBudgets.worker);
  });
});
