import { afterEach, describe, expect, test } from "bun:test";
import { handleResponses } from "../src/server/responses";
import type { OcxConfig } from "../src/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Aura optimizer routed runtime", () => {
  test("optimizes parsed routed context and records savings without changing native wire input", async () => {
    const repeated = "ordinary generated tool output ".repeat(80);
    let upstreamBody: { messages?: Array<{ role?: string; content?: string }> } = {};
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      upstreamBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const config: OcxConfig = {
      port: 0,
      defaultProvider: "xai",
      providers: {
        xai: {
          adapter: "openai-chat",
          baseUrl: "https://api.x.ai/v1",
          authMode: "key",
          apiKey: "test-key",
        },
      },
      aura: {
        activeProfile: "balanced",
        roles: {
          orchestrator: { model: "xai/cheap", effort: "medium" },
        },
        optimizer: { enabled: true, deduplicate: true, reduceLogs: true },
      },
    };
    const log = { model: "", provider: "" } as Record<string, unknown>;
    const response = await handleResponses(new Request("http://localhost/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "xai/cheap",
        stream: false,
        input: [
          { type: "function_call", call_id: "call-a", name: "exec_command", arguments: "{}" },
          { type: "function_call_output", call_id: "call-a", output: repeated },
          { type: "function_call", call_id: "call-b", name: "exec_command", arguments: "{}" },
          { type: "function_call_output", call_id: "call-b", output: repeated },
        ],
      }),
    }), config, log as never);

    expect(response.status).toBe(200);
    const toolMessages = upstreamBody.messages?.filter(message => message.role === "tool") ?? [];
    expect(toolMessages).toHaveLength(2);
    expect(toolMessages[0]?.content).toBe(repeated);
    expect(toolMessages[1]?.content).toContain("Aura deduplicated identical tool output");
    expect(log.auraOptimizerActions).toBe(1);
    expect(Number(log.auraOptimizerSavedTokens)).toBeGreaterThan(0);
  });
});
