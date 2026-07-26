import { createHash } from "node:crypto";
import { estimateTokens } from "../lib/token-estimate";
import type { OcxMessage, OcxToolResultMessage } from "../types";
import { storeAuraToolOutput } from "./output-store";

export type AuraOptimizerOptions = {
  deduplicate: boolean;
  reduceLogs: boolean;
  downstreamOptimizer?: "none" | "9router-rtk" | "unknown";
  logThresholdChars?: number;
  logHeadChars?: number;
  logTailChars?: number;
  contextBudgetTokens?: number;
  storeOutput?: (content: string) => string;
};

export type AuraOptimizerResult = {
  deduplicated: number;
  reducedLogs: number;
  protectedOutputs: number;
  budgetedOutputs: number;
  inputTokens: number;
  outputTokens: number;
  savedTokens: number;
};

const PROTECTED_TOOL_NAMES = new Set(["apply_patch", "view_image", "imagegen"]);
const STACK_TRACE_RE = /(?:^|\n)\s*at\s+\S+\s+\([^)]+:\d+:\d+\)|Traceback \(most recent call last\):/m;
const SOURCE_RE = /```|(?:^|\n)(?:diff --git|@@\s|[+-]{3}\s|(?:export\s+)?(?:async\s+)?function\s|class\s+\w+|interface\s+\w+)/m;
const MIGRATION_RE = /\b(?:migration|migrate|schema change|ALTER TABLE|CREATE TABLE|DROP TABLE)\b/i;
const SECURITY_RE = /\b(?:security|credential|secret|api[_ -]?key|authorization|oauth|csrf|injection|vulnerability)\b/i;

export function isProtectedAuraToolOutput(message: OcxToolResultMessage): boolean {
  if (message.containsEncryptedContent || typeof message.content !== "string") return true;
  if (PROTECTED_TOOL_NAMES.has(message.toolName)) return true;
  return STACK_TRACE_RE.test(message.content)
    || SOURCE_RE.test(message.content)
    || MIGRATION_RE.test(message.content)
    || SECURITY_RE.test(message.content);
}

type AuraToolFilter = "git-diff" | "git-status" | "grep" | "find" | "ls" | "tree" | "log" | "generic";

function detectToolFilter(message: OcxToolResultMessage): AuraToolFilter {
  const name = `${message.toolName} ${message.content.slice(0, 1_024)}`.toLowerCase();
  if (/git\s+diff|diff --git/.test(name)) return "git-diff";
  if (/git\s+status|##\s+(?:main|master|head|develop)/.test(name)) return "git-status";
  if (/\b(?:rg|grep)\b|^\s*\d+:/.test(name)) return "grep";
  if (/\bfind\b|^\s*\.\/?[^\n]*\//.test(name)) return "find";
  if (/\bls\b|\btree\b/.test(name)) return name.includes("tree") ? "tree" : "ls";
  if (/\b(?:log|tail|journalctl|npm test|bun test|pytest)\b|\b(?:info|warn|error|debug)\b/.test(name)) return "log";
  return "generic";
}

function looksLikeReducibleLog(content: string, filter: AuraToolFilter): boolean {
  const lines = content.split("\n");
  if (lines.length < 20) return false;
  if (["git-status", "grep", "find", "ls", "tree"].includes(filter)) return true;
  const signalLines = lines.filter(line =>
    /\b(?:info|warn|error|debug|pass|fail|running|completed)\b/i.test(line)
    || /^\s*\d{2}:\d{2}:\d{2}/.test(line)
    || /^\s*\[\d+\/\d+\]/.test(line));
  return signalLines.length >= Math.min(20, Math.ceil(lines.length / 4));
}

function compressCommandOutput(content: string, filter: AuraToolFilter): string {
  if (!["git-status", "grep", "find", "ls", "tree"].includes(filter)) return content;
  const lines = content.split("\n");
  const output: string[] = [];
  let previous = "";
  let repeats = 0;
  for (const line of lines) {
    if (line === previous && line.trim() !== "") {
      repeats += 1;
      continue;
    }
    if (repeats > 0) output.push(`[Aura compacted repeated line ×${repeats + 1}]`);
    output.push(line);
    previous = line;
    repeats = 0;
  }
  if (repeats > 0) output.push(`[Aura compacted repeated line ×${repeats + 1}]`);
  return output.join("\n");
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

export function optimizeAuraToolOutputs(
  messages: OcxMessage[],
  options: AuraOptimizerOptions,
): AuraOptimizerResult {
  const threshold = options.logThresholdChars ?? 12_000;
  const headChars = options.logHeadChars ?? 4_000;
  const tailChars = options.logTailChars ?? 4_000;
  const storeOutput = options.storeOutput ?? storeAuraToolOutput;
  const seen = new Map<string, { callId: string; digest: string }>();
  let deduplicated = 0;
  let reducedLogs = 0;
  let protectedOutputs = 0;
  let budgetedOutputs = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const message of messages) {
    if (message.role !== "toolResult" || typeof message.content !== "string") continue;
    const original = message.content;
    inputTokens += estimateTokens(original);
    if (isProtectedAuraToolOutput(message)) {
      protectedOutputs += 1;
      outputTokens += estimateTokens(original);
      continue;
    }

    const contentDigest = digest(original);
    const filter = detectToolFilter(message);
    const prior = seen.get(contentDigest);
    if (options.deduplicate && prior && original.length >= 256) {
      message.content = `[Aura deduplicated identical tool output; original call=${prior.callId}; sha256=${prior.digest}.]`;
      deduplicated += 1;
      outputTokens += estimateTokens(message.content);
      continue;
    }
    seen.set(contentDigest, { callId: message.toolCallId, digest: contentDigest });

    if (options.reduceLogs && original.length > threshold && looksLikeReducibleLog(original, filter)) {
      const handle = storeOutput(original);
      const compacted = compressCommandOutput(original, filter);
      message.content = [
        compacted.slice(0, headChars),
        `\n\n[Aura reduced ${Math.max(0, original.length - headChars - tailChars)} ${filter} output characters; full local output handle=${handle}.]\n\n`,
        compacted.slice(-tailChars),
      ].join("");
      reducedLogs += 1;
    }
    outputTokens += estimateTokens(message.content);
  }

  const budget = options.contextBudgetTokens;
  if (budget && outputTokens > budget) {
    for (const message of messages) {
      if (outputTokens <= budget) break;
      if (message.role !== "toolResult" || typeof message.content !== "string") continue;
      if (isProtectedAuraToolOutput(message) || message.content.length <= 2_400) continue;
      const original = message.content;
      const originalTokens = estimateTokens(original);
      const handle = storeOutput(original);
      message.content = [
        original.slice(0, 1_000),
        `\n\n[Aura context budget elided ${original.length - 2_000} characters; full local output handle=${handle}.]\n\n`,
        original.slice(-1_000),
      ].join("");
      const nextTokens = estimateTokens(message.content);
      outputTokens -= Math.max(0, originalTokens - nextTokens);
      budgetedOutputs += 1;
    }
  }

  return {
    deduplicated,
    reducedLogs,
    protectedOutputs,
    budgetedOutputs,
    inputTokens,
    outputTokens,
    savedTokens: Math.max(0, inputTokens - outputTokens),
  };
}
