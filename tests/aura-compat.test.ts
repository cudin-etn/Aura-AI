import { describe, expect, test } from "bun:test";
import {
  collectAuraCompatOutcome,
  compareAuraCompatOutcomes,
  gradeAuraCompatibility,
  materializeAuraCompatBody,
} from "../src/compat/aura-ab";

describe("Aura compatibility reports", () => {
  test("materializes a model without mutating the fixture", () => {
    const fixture = { input: "hello", stream: false };
    expect(materializeAuraCompatBody(fixture, "provider/model")).toEqual({
      input: "hello",
      stream: false,
      model: "provider/model",
    });
    expect(fixture).not.toHaveProperty("model");
  });

  test("collects secret-safe JSON outcomes", async () => {
    const start = performance.now();
    const outcome = await collectAuraCompatOutcome(new Response(JSON.stringify({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "OK" }] }],
      usage: { input_tokens: 2, output_tokens: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } }), start, start + 1);
    expect(outcome).toMatchObject({
      httpStatus: 200,
      terminalStatus: "completed",
      outputChars: 2,
      toolNames: [],
      usage: { input_tokens: 2, output_tokens: 1 },
      error: null,
    });
    expect(outcome.outputDigest).toHaveLength(64);
  });

  test("reports structural parity without requiring identical generated text", () => {
    const base = {
      httpStatus: 200,
      terminalStatus: "completed",
      eventTypes: [],
      outputDigest: "a",
      outputChars: 1,
      toolNames: [],
      usage: {},
      error: null,
      headersMs: 1,
      totalMs: 2,
    };
    expect(compareAuraCompatOutcomes(base, { ...base, outputDigest: "b", outputChars: 20 })).toEqual({
      compatible: true,
      differences: [],
    });
    expect(compareAuraCompatOutcomes(base, { ...base, httpStatus: 500, error: "failed" })).toEqual({
      compatible: false,
      differences: ["http_status_class", "error_presence"],
    });
  });

  test("collects tool names from a streaming terminal event", async () => {
    const sse = [
      'event: response.output_item.done',
      'data: {"type":"response.output_item.done","item":{"type":"function_call","name":"ping","arguments":"{}"}}',
      "",
      'event: response.completed',
      'data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"function_call","name":"ping","arguments":"{}"}]}}',
      "",
    ].join("\n");
    const start = performance.now();
    const outcome = await collectAuraCompatOutcome(new Response(sse, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }), start, start + 1);
    expect(outcome.toolNames).toEqual(["ping"]);
    expect(outcome.terminalStatus).toBe("completed");
  });

  test("grades translated success separately from limited and failed providers", () => {
    const success = {
      httpStatus: 200,
      terminalStatus: "completed",
      eventTypes: [],
      outputDigest: "a",
      outputChars: 1,
      toolNames: [],
      usage: {},
      error: null,
      headersMs: 1,
      totalMs: 2,
    };
    const translated = [
      { id: "responses-json", direct: [{ ...success, httpStatus: 500, error: "failed" }], proxy: [success] },
      { id: "responses-stream", direct: [success], proxy: [success] },
      { id: "responses-compact", direct: [{ ...success, httpStatus: 400, error: "unsupported" }], proxy: [success] },
    ];
    expect(gradeAuraCompatibility(translated)).toEqual({
      grade: "Compatible",
      reasons: ["translation_required"],
    });
    expect(gradeAuraCompatibility(translated.map(row => ({ ...row, direct: undefined })), true)).toEqual({
      grade: "Compatible",
      reasons: ["translation_required"],
    });
    expect(gradeAuraCompatibility([
      ...translated,
      { id: "responses-compact", proxy: [{ ...success, httpStatus: 500, error: "failed" }] },
    ])).toMatchObject({ grade: "Limited" });
    expect(gradeAuraCompatibility([
      { id: "responses-json", proxy: [{ ...success, httpStatus: 500, error: "failed" }] },
      { id: "responses-stream", proxy: [success] },
    ])).toEqual({ grade: "Failed", reasons: ["basic_generation_failed"] });
  });
});
