import { describe, expect, test } from "bun:test";
import { buildProviderPostBody } from "../gui/src/provider-payload";
import {
  deriveProviderPresets,
  enrichProviderFromRegistry,
  providerConfigSeed,
} from "../src/providers/derive";
import { PROVIDER_REGISTRY } from "../src/providers/registry";
import { providerManagementConfigError } from "../src/server/auth-cors";
import type { OcxProviderConfig } from "../src/types";

describe("Aura 9router provider preset", () => {
  const entry = PROVIDER_REGISTRY.find(row => row.id === "9router");

  test("is a discoverable local Responses provider with safe GPT-5.6 compact defaults", () => {
    expect(entry).toMatchObject({
      adapter: "openai-responses",
      baseUrl: "http://127.0.0.1:20128/v1",
      compactMode: "synthetic",
      authKind: "local",
      allowPrivateNetworkByDefault: true,
      allowBaseUrlOverride: true,
      featured: true,
      liveModels: true,
    });

    const preset = deriveProviderPresets().find(row => row.id === "9router");
    expect(preset).toMatchObject({
      id: "9router",
      auth: "local",
      compactMode: "synthetic",
    });
  });

  test("persists synthetic compact without asking for or leaking a local API key", () => {
    const preset = deriveProviderPresets().find(row => row.id === "9router")!;
    const result = buildProviderPostBody(preset, {
      name: preset.id,
      adapter: preset.adapter,
      baseUrl: preset.baseUrl,
      compactMode: preset.compactMode,
      authMode: preset.auth,
      apiKey: "must-not-leak",
      defaultModel: "",
    });

    expect(result).toEqual({
      name: "9router",
      provider: {
        adapter: "openai-responses",
        baseUrl: "http://127.0.0.1:20128/v1",
        compactMode: "synthetic",
      },
    });
    expect(providerManagementConfigError(result.name, result.provider)).toBeNull();
  });

  test("enriches older saved 9router configs without overriding an explicit mode", () => {
    const legacy: OcxProviderConfig = {
      adapter: "openai-responses",
      baseUrl: "http://127.0.0.1:20128/v1",
    };
    enrichProviderFromRegistry("9router", legacy);
    expect(legacy.compactMode).toBe("synthetic");

    const explicit: OcxProviderConfig = { ...legacy, compactMode: "native" };
    enrichProviderFromRegistry("9router", explicit);
    expect(explicit.compactMode).toBe("native");
    expect(providerConfigSeed(entry!).compactMode).toBe("synthetic");
  });
});
