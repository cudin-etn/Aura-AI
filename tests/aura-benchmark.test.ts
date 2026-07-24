import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AURA_TASK_CLASSES,
  buildUnoptimizedBaseline,
  scoreAuraBenchmark,
  type AuraBenchmarkCorpus,
  type AuraBenchmarkOutcome,
} from "../src/eval/aura-benchmark";

const corpus = JSON.parse(readFileSync("benchmarks/aura/corpus.json", "utf8")) as AuraBenchmarkCorpus;

describe("Aura benchmark", () => {
  test("covers every required task class with verifiable fixtures", () => {
    expect(new Set(corpus.tasks.map(task => task.class))).toEqual(new Set(AURA_TASK_CLASSES));
    expect(corpus.tasks.length).toBe(12);
    expect(corpus.tasks.every(task => task.requiredChecks.length > 0)).toBe(true);
  });

  test("records a byte-identical zero-savings optimizer baseline", () => {
    const baseline = buildUnoptimizedBaseline(corpus);
    expect(baseline.tasks.every(task => task.byteIdentical && task.savedTokens === 0)).toBe(true);
    expect(baseline.totals.estimatedTokens).toBeGreaterThan(0);
    expect(baseline.totals.savedTokens).toBe(0);
  });

  test("scores complete strategies by verified success and normalized cost", () => {
    const outcomes: AuraBenchmarkOutcome[] = corpus.tasks.map((task, index) => ({
      taskId: task.id,
      strategy: "balanced",
      taskSuccess: index !== 0,
      passedChecks: index === 0 ? task.requiredChecks.slice(1) : task.requiredChecks,
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 30,
      reasoningTokens: 10,
      normalizedCost: 2,
      latencyMs: 100 + index,
      escalations: 0,
      subagents: 1,
    }));
    expect(scoreAuraBenchmark(corpus, outcomes)).toEqual([{
      strategy: "balanced",
      tasks: 12,
      successfulTasks: 11,
      taskSuccessRate: 11 / 12,
      verificationRate: 37 / 38,
      totalTokens: 1_680,
      cachedInputTokens: 240,
      normalizedCost: 24,
      costPerSuccessfulTask: 24 / 11,
      medianLatencyMs: 105.5,
      escalations: 0,
      subagents: 12,
    }]);
  });

  test("rejects partial strategy coverage", () => {
    expect(() => scoreAuraBenchmark(corpus, [])).not.toThrow();
    const one: AuraBenchmarkOutcome[] = [{
      taskId: corpus.tasks[0]!.id,
      strategy: "sol",
      taskSuccess: true,
      passedChecks: corpus.tasks[0]!.requiredChecks,
      inputTokens: 1,
      cachedInputTokens: 0,
      outputTokens: 1,
      reasoningTokens: 0,
      normalizedCost: 1,
      latencyMs: 1,
      escalations: 0,
      subagents: 0,
    }];
    expect(() => scoreAuraBenchmark(corpus, one)).toThrow("sol covers 1/12 tasks");
  });
});
