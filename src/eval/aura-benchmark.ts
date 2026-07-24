import { estimateTokens } from "../lib/token-estimate";

export const AURA_TASK_CLASSES = [
  "trivial",
  "routine",
  "debugging",
  "architecture",
  "security",
  "large_repository",
] as const;

export type AuraTaskClass = typeof AURA_TASK_CLASSES[number];

export type AuraBenchmarkTask = {
  id: string;
  class: AuraTaskClass;
  description: string;
  fixture: string;
  requiredChecks: string[];
  protectedContent?: Array<"source" | "migration" | "security" | "stack_trace">;
};

export type AuraBenchmarkCorpus = {
  version: 1;
  tasks: AuraBenchmarkTask[];
};

export type AuraBenchmarkOutcome = {
  taskId: string;
  strategy: string;
  taskSuccess: boolean;
  passedChecks: string[];
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  normalizedCost: number;
  latencyMs: number;
  escalations: number;
  subagents: number;
};

export type AuraStrategyScore = {
  strategy: string;
  tasks: number;
  successfulTasks: number;
  taskSuccessRate: number;
  verificationRate: number;
  totalTokens: number;
  cachedInputTokens: number;
  normalizedCost: number;
  costPerSuccessfulTask: number | null;
  medianLatencyMs: number;
  escalations: number;
  subagents: number;
};

function finiteNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be finite and non-negative`);
  return value;
}

export function validateAuraCorpus(corpus: AuraBenchmarkCorpus): void {
  if (corpus.version !== 1 || !Array.isArray(corpus.tasks) || corpus.tasks.length === 0) {
    throw new Error("corpus must be version 1 with at least one task");
  }
  const ids = new Set<string>();
  const classes = new Set<AuraTaskClass>();
  for (const task of corpus.tasks) {
    if (!task.id || ids.has(task.id)) throw new Error(`duplicate or empty task id: ${task.id}`);
    if (!AURA_TASK_CLASSES.includes(task.class)) throw new Error(`unsupported task class: ${task.class}`);
    if (!task.fixture || task.requiredChecks.length === 0) throw new Error(`task ${task.id} is not verifiable`);
    ids.add(task.id);
    classes.add(task.class);
  }
  for (const taskClass of AURA_TASK_CLASSES) {
    if (!classes.has(taskClass)) throw new Error(`corpus is missing class: ${taskClass}`);
  }
}

export function scoreAuraBenchmark(
  corpus: AuraBenchmarkCorpus,
  outcomes: AuraBenchmarkOutcome[],
): AuraStrategyScore[] {
  validateAuraCorpus(corpus);
  const tasks = new Map(corpus.tasks.map(task => [task.id, task]));
  const byStrategy = new Map<string, AuraBenchmarkOutcome[]>();
  for (const outcome of outcomes) {
    if (!tasks.has(outcome.taskId)) throw new Error(`unknown task outcome: ${outcome.taskId}`);
    if (!outcome.strategy) throw new Error("outcome strategy is required");
    for (const field of ["inputTokens", "cachedInputTokens", "outputTokens", "reasoningTokens", "normalizedCost", "latencyMs", "escalations", "subagents"] as const) {
      finiteNonNegative(outcome[field], field);
    }
    const rows = byStrategy.get(outcome.strategy) ?? [];
    if (rows.some(row => row.taskId === outcome.taskId)) {
      throw new Error(`duplicate outcome for ${outcome.strategy}/${outcome.taskId}`);
    }
    rows.push(outcome);
    byStrategy.set(outcome.strategy, rows);
  }

  return [...byStrategy.entries()].map(([strategy, rows]) => {
    if (rows.length !== corpus.tasks.length) {
      throw new Error(`${strategy} covers ${rows.length}/${corpus.tasks.length} tasks`);
    }
    let passed = 0;
    let required = 0;
    let successfulTasks = 0;
    const latencies: number[] = [];
    const totals = {
      totalTokens: 0,
      cachedInputTokens: 0,
      normalizedCost: 0,
      escalations: 0,
      subagents: 0,
    };
    for (const row of rows) {
      const task = tasks.get(row.taskId)!;
      const passedSet = new Set(row.passedChecks);
      const checkCount = task.requiredChecks.filter(check => passedSet.has(check)).length;
      passed += checkCount;
      required += task.requiredChecks.length;
      if (row.taskSuccess && checkCount === task.requiredChecks.length) successfulTasks += 1;
      totals.totalTokens += row.inputTokens + row.outputTokens + row.reasoningTokens;
      totals.cachedInputTokens += row.cachedInputTokens;
      totals.normalizedCost += row.normalizedCost;
      totals.escalations += row.escalations;
      totals.subagents += row.subagents;
      latencies.push(row.latencyMs);
    }
    latencies.sort((a, b) => a - b);
    const middle = Math.floor(latencies.length / 2);
    const medianLatencyMs = latencies.length % 2
      ? latencies[middle]!
      : (latencies[middle - 1]! + latencies[middle]!) / 2;
    return {
      strategy,
      tasks: rows.length,
      successfulTasks,
      taskSuccessRate: successfulTasks / rows.length,
      verificationRate: passed / required,
      ...totals,
      costPerSuccessfulTask: successfulTasks ? totals.normalizedCost / successfulTasks : null,
      medianLatencyMs,
    };
  }).sort((a, b) => a.strategy.localeCompare(b.strategy));
}

export function buildUnoptimizedBaseline(corpus: AuraBenchmarkCorpus): {
  version: 1;
  mode: "unoptimized";
  tasks: Array<{
    id: string;
    class: AuraTaskClass;
    chars: number;
    estimatedTokens: number;
    outputChars: number;
    outputEstimatedTokens: number;
    savedTokens: 0;
    byteIdentical: true;
  }>;
  totals: { chars: number; estimatedTokens: number; savedTokens: 0 };
} {
  validateAuraCorpus(corpus);
  const tasks = corpus.tasks.map(task => {
    const estimatedTokens = estimateTokens(task.fixture);
    return {
      id: task.id,
      class: task.class,
      chars: task.fixture.length,
      estimatedTokens,
      outputChars: task.fixture.length,
      outputEstimatedTokens: estimatedTokens,
      savedTokens: 0 as const,
      byteIdentical: true as const,
    };
  });
  return {
    version: 1,
    mode: "unoptimized",
    tasks,
    totals: {
      chars: tasks.reduce((sum, task) => sum + task.chars, 0),
      estimatedTokens: tasks.reduce((sum, task) => sum + task.estimatedTokens, 0),
      savedTokens: 0,
    },
  };
}

