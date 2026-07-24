import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildUnoptimizedBaseline,
  scoreAuraBenchmark,
  type AuraBenchmarkCorpus,
  type AuraBenchmarkOutcome,
} from "../src/eval/aura-benchmark";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const mode = process.argv[2] ?? "baseline";
const corpusPath = resolve(arg("--corpus") ?? "benchmarks/aura/corpus.json");
const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as AuraBenchmarkCorpus;
const outputPath = arg("--out");

function emit(value: unknown): void {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) {
    console.log(text.trimEnd());
    return;
  }
  const target = resolve(outputPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

if (mode === "baseline") {
  emit(buildUnoptimizedBaseline(corpus));
} else if (mode === "score") {
  const resultsPath = arg("--results");
  if (!resultsPath) throw new Error("score requires --results <path>");
  const outcomes = JSON.parse(readFileSync(resolve(resultsPath), "utf8")) as AuraBenchmarkOutcome[];
  emit({ version: 1, scores: scoreAuraBenchmark(corpus, outcomes) });
} else {
  throw new Error("usage: aura-benchmark.ts baseline | score --results <path>");
}
