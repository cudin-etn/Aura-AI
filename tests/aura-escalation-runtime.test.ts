import { afterEach, describe, expect, test } from "bun:test";
import { handleResponses } from "../src/server/responses";
import type { OcxConfig } from "../src/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function config(): OcxConfig {
  return {
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
        worker: { model: "xai/cheap", effort: "medium" },
        reviewer: { model: "xai/reviewer", effort: "high" },
      },
    },
  };
}

async function post(headers: HeadersInit): Promise<{ upstreamModel: string; log: Record<string, unknown> }> {
  let upstreamModel = "";
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
    upstreamModel = body.model ?? "";
    return new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const log: Record<string, unknown> = { model: "", provider: "" };
  const response = await handleResponses(new Request("http://localhost/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers)) },
    body: JSON.stringify({
      model: "xai/cheap",
      input: "review this change",
      stream: false,
    }),
  }), config(), log as never);
  expect(response.status).toBe(200);
  return { upstreamModel, log };
}

describe("Aura deterministic runtime escalation", () => {
  test("routes an explicit security-risk turn to the reviewer model", async () => {
    const result = await post({ "x-aura-risk": "security", "x-aura-role": "worker" });
    expect(result.upstreamModel).toBe("reviewer");
    expect(result.log).toMatchObject({
      requestedModel: "xai/cheap",
      model: "reviewer",
      auraRole: "reviewer",
      auraRouteReason: "risk_escalation",
    });
  });

  test("does not escalate an unrecognized risk hint", async () => {
    const result = await post({ "x-aura-risk": "looks-difficult" });
    expect(result.upstreamModel).toBe("cheap");
    expect(result.log).toMatchObject({
      auraRole: "orchestrator",
      auraRouteReason: "profile_match",
    });
  });
});
