import { describe, expect, test } from "bun:test";
import { AURA_PROTOCOLS, auraProtocolForPath } from "../src/protocols/registry";
import { describeAuraProvider } from "../src/providers/aura";
import type { OcxProviderConfig } from "../src/types";

describe("Aura generic core boundaries", () => {
  test("registers the three public protocol surfaces", () => {
    expect(AURA_PROTOCOLS.map(protocol => protocol.id)).toEqual([
      "responses",
      "chat-completions",
      "messages",
    ]);
    expect(auraProtocolForPath("/v1/responses/compact")).toBe("responses");
    expect(auraProtocolForPath("/unknown")).toBeNull();
  });

  test("normalizes provider auth, discovery, and declared capabilities", () => {
    const descriptor = describeAuraProvider("custom", {
      adapter: "openai-chat",
      baseUrl: "https://example.com/v1",
      authMode: "key",
      liveModels: false,
      models: ["vision-model"],
      compactMode: "synthetic",
      modelInputModalities: { "vision-model": ["text", "image"] },
      modelReasoningEfforts: { "vision-model": ["low", "high"] },
    } satisfies OcxProviderConfig);

    expect(descriptor).toEqual({
      id: "custom",
      adapter: "openai-chat",
      protocol: "chat-completions",
      authentication: { kind: "key", keyOptional: false },
      discovery: { live: false, models: ["vision-model"] },
      capabilities: {
        compact: "synthetic",
        reasoningDeclared: true,
        visionDeclared: true,
      },
    });
  });
});
