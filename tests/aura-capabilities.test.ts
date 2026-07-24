import { describe, expect, test } from "bun:test";
import { AURA_CAPABILITIES } from "../src/aura/capabilities";

describe("Aura capability registry", () => {
  test("exposes 9Router-inspired surfaces with honest status", () => {
    const byId = Object.fromEntries(AURA_CAPABILITIES.map(item => [item.id, item]));
    expect(byId["model-discovery"]).toMatchObject({ status: "available", endpoint: "/v1/models" });
    expect(byId["fallback-combos"]).toMatchObject({ status: "available", endpoint: "/api/combos" });
    expect(byId.chat).toMatchObject({ status: "available", endpoint: "/v1/chat/completions" });
    expect(byId.image).toMatchObject({ status: "available", endpoint: "/v1/images/generations" });
    expect(byId["web-search"]).toMatchObject({ status: "available", endpoint: "/v1/alpha/search" });
    expect(byId.vision).toMatchObject({ status: "partial" });
    expect(byId.tts).toMatchObject({ status: "planned" });
    expect(byId.stt).toMatchObject({ status: "planned" });
    expect(byId.embeddings).toMatchObject({ status: "planned" });
  });
});
