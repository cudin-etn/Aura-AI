import { createHash } from "node:crypto";
import { decodeServerSentEvents } from "../lib/sse-decoder";
import { redactSecretString } from "../lib/redact";

export type AuraCompatCase = {
  id: string;
  path?: string;
  abortAfterMs?: number;
  expect?: {
    status?: number;
    error?: boolean;
    aborted?: boolean;
  };
  body: Record<string, unknown>;
};

export type AuraCompatFixture = {
  version: 1;
  cases: AuraCompatCase[];
};

export type AuraCompatOutcome = {
  httpStatus: number;
  terminalStatus: string | null;
  eventTypes: string[];
  outputDigest: string | null;
  outputChars: number;
  toolNames: string[];
  usage: Record<string, unknown> | null;
  error: string | null;
  headersMs: number;
  totalMs: number;
};

export type AuraCompatComparison = {
  compatible: boolean;
  differences: string[];
};

export type AuraCapabilityGrade = "Native" | "Compatible" | "Limited" | "Failed";

export type AuraCompatCaseResult = {
  id: string;
  expect?: AuraCompatCase["expect"];
  direct?: AuraCompatOutcome[];
  proxy?: AuraCompatOutcome[];
  comparisons?: AuraCompatComparison[];
};

function outputParts(body: unknown): { text: string; toolNames: string[] } {
  if (!body || typeof body !== "object") return { text: "", toolNames: [] };
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return { text: "", toolNames: [] };
  let text = "";
  const toolNames: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: unknown; name?: unknown; content?: unknown };
    if (row.type === "function_call" && typeof row.name === "string") toolNames.push(row.name);
    if (!Array.isArray(row.content)) continue;
    for (const content of row.content) {
      if (!content || typeof content !== "object") continue;
      const value = (content as { text?: unknown }).text;
      if (typeof value === "string") text += value;
    }
  }
  return { text, toolNames };
}

function responseBody(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const nested = record.response;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : record;
}

function toolNameFromItem(item: unknown): string | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as { type?: unknown; name?: unknown };
  return record.type === "function_call" && typeof record.name === "string" ? record.name : null;
}

function errorText(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  const error = body.error;
  if (typeof error === "string") return redactSecretString(error).slice(0, 500);
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return redactSecretString(message).slice(0, 500);
  }
  return null;
}

function digest(text: string): string | null {
  return text ? createHash("sha256").update(text).digest("hex") : null;
}

export async function collectAuraCompatOutcome(
  response: Response,
  startedAt: number,
  headersAt: number,
): Promise<AuraCompatOutcome> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const eventTypes: string[] = [];
  let terminalStatus: string | null = null;
  let usage: Record<string, unknown> | null = null;
  let error: string | null = null;
  let text = "";
  const toolNames: string[] = [];

  if (contentType.includes("text/event-stream") && response.body) {
    for await (const event of decodeServerSentEvents(response.body)) {
      if (event.event) eventTypes.push(event.event);
      if (!event.data || event.data === "[DONE]") continue;
      try {
        const payload = JSON.parse(event.data) as Record<string, unknown>;
        const type = typeof payload.type === "string" ? payload.type : event.event;
        if (type && !eventTypes.includes(type)) eventTypes.push(type);
        const delta = payload.delta;
        if (typeof delta === "string" && type?.includes("output_text")) text += delta;
        const body = responseBody(payload);
        const parts = outputParts(body);
        if (parts.text) text += parts.text;
        toolNames.push(...parts.toolNames);
        const itemTool = toolNameFromItem(payload.item);
        if (itemTool) toolNames.push(itemTool);
        if (typeof body?.status === "string") terminalStatus = body.status;
        if (body?.usage && typeof body.usage === "object" && !Array.isArray(body.usage)) {
          usage = body.usage as Record<string, unknown>;
        }
        error ??= errorText(body);
      } catch {
        error ??= "malformed_sse_json";
      }
    }
  } else {
    const raw = await response.text();
    try {
      const body = responseBody(JSON.parse(raw));
      const parts = outputParts(body);
      text = parts.text;
      toolNames.push(...parts.toolNames);
      terminalStatus = typeof body?.status === "string" ? body.status : null;
      usage = body?.usage && typeof body.usage === "object" && !Array.isArray(body.usage)
        ? body.usage as Record<string, unknown>
        : null;
      error = errorText(body);
    } catch {
      error = redactSecretString(raw).slice(0, 500) || "non_json_response";
    }
  }

  return {
    httpStatus: response.status,
    terminalStatus,
    eventTypes: [...new Set(eventTypes)],
    outputDigest: digest(text),
    outputChars: text.length,
    toolNames: [...new Set(toolNames)],
    usage,
    error,
    headersMs: Math.max(0, Math.round(headersAt - startedAt)),
    totalMs: Math.max(0, Math.round(performance.now() - startedAt)),
  };
}

export function compareAuraCompatOutcomes(
  direct: AuraCompatOutcome,
  proxy: AuraCompatOutcome,
): AuraCompatComparison {
  const differences: string[] = [];
  if (Math.floor(direct.httpStatus / 100) !== Math.floor(proxy.httpStatus / 100)) differences.push("http_status_class");
  if (direct.terminalStatus !== proxy.terminalStatus) differences.push("terminal_status");
  if (Boolean(direct.outputDigest) !== Boolean(proxy.outputDigest)) differences.push("output_presence");
  if (direct.toolNames.length !== proxy.toolNames.length) differences.push("tool_call_count");
  if (Boolean(direct.usage) !== Boolean(proxy.usage)) differences.push("usage_presence");
  if (Boolean(direct.error) !== Boolean(proxy.error)) differences.push("error_presence");
  return { compatible: differences.length === 0, differences };
}

export function auraOutcomeMatches(
  outcome: AuraCompatOutcome,
  expect: AuraCompatCase["expect"] = {},
): boolean {
  if (expect.aborted) return outcome.httpStatus === 0 && outcome.error === "client_abort";
  if (expect.status !== undefined && outcome.httpStatus !== expect.status) return false;
  if (expect.status === undefined && (outcome.httpStatus < 200 || outcome.httpStatus >= 300)) return false;
  if (expect.error !== undefined && Boolean(outcome.error) !== expect.error) return false;
  return true;
}

export function gradeAuraCompatibility(
  cases: AuraCompatCaseResult[],
  translationRequired = false,
): { grade: AuraCapabilityGrade; reasons: string[] } {
  const reasons: string[] = [];
  const passes = (id: string) => {
    const row = cases.find(testCase => testCase.id === id);
    return !!row?.proxy?.length && row.proxy.every(outcome => auraOutcomeMatches(outcome, row.expect));
  };
  if (!passes("responses-json") || !passes("responses-stream")) {
    return { grade: "Failed", reasons: ["basic_generation_failed"] };
  }
  for (const row of cases) {
    if (!row.proxy?.length || row.proxy.some(outcome => !auraOutcomeMatches(outcome, row.expect))) {
      reasons.push(`${row.id}_failed`);
    }
  }
  if (reasons.length > 0) return { grade: "Limited", reasons };
  const translated = translationRequired || cases.some(row =>
    row.comparisons?.some(comparison => !comparison.compatible)
    || (row.direct?.some(outcome => !auraOutcomeMatches(outcome, row.expect))
      && row.proxy?.every(outcome => auraOutcomeMatches(outcome, row.expect))));
  return translated
    ? { grade: "Compatible", reasons: ["translation_required"] }
    : { grade: "Native", reasons: [] };
}

export function materializeAuraCompatBody(
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const clone = structuredClone(body);
  clone.model = model;
  return clone;
}
