import { describe, expect, test } from "bun:test";
import { buildAuraClientModelCatalog, modelsForAuraClient } from "../src/clients/catalog";

describe("Aura client export catalog", () => {
  test("normalizes native and routed models without exporting disabled entries", () => {
    const models = buildAuraClientModelCatalog({
      routedModels: [
        {
          provider: "custom",
          id: "vision-reasoner",
          reasoningEfforts: ["low", "high"],
          inputModalities: ["text", "image"],
          parallelToolCalls: true,
          contextWindow: 200_000,
        },
        { provider: "custom", id: "disabled" },
      ],
      nativeSlugs: ["gpt-5.6-sol"],
      disabledModels: ["custom/disabled"],
    });

    expect(models.map(model => model.id)).toEqual(["custom/vision-reasoner", "gpt-5.6-sol"]);
    expect(models[0]).toMatchObject({
      grade: "compatible",
      capabilities: { tools: "available", reasoning: "available", vision: "available" },
      contextWindow: 200_000,
    });
    expect(models[1]).toMatchObject({ native: true, grade: "native", provider: "openai" });
  });

  test("exports every gateway-representable model to OpenCode", () => {
    const models = buildAuraClientModelCatalog({
      routedModels: [{ provider: "ollama", id: "qwen" }],
      nativeSlugs: ["gpt-5.6-luna"],
    });
    expect(modelsForAuraClient(models, "opencode").map(model => model.id))
      .toEqual(["gpt-5.6-luna", "ollama/qwen"]);
  });
});
