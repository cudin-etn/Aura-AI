import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleManagementAPI } from "../src/server/management-api";
import type { OcxConfig } from "../src/types";

const savedHome = process.env.OPENCODEX_HOME;
const savedOpenCodeConfig = process.env.OPENCODE_CONFIG;
let tempHome: string | null = null;

afterEach(() => {
  if (savedHome === undefined) delete process.env.OPENCODEX_HOME;
  else process.env.OPENCODEX_HOME = savedHome;
  if (savedOpenCodeConfig === undefined) delete process.env.OPENCODE_CONFIG;
  else process.env.OPENCODE_CONFIG = savedOpenCodeConfig;
  if (tempHome) rmSync(tempHome, { recursive: true, force: true });
  tempHome = null;
});

function config(): OcxConfig {
  tempHome = mkdtempSync(join(tmpdir(), "aura-profile-api-"));
  process.env.OPENCODEX_HOME = tempHome;
  return {
    port: 10100,
    providers: {
      "9router": {
        adapter: "openai-responses",
        baseUrl: "http://127.0.0.1:20128/v1",
        allowPrivateNetwork: true,
        liveModels: false,
        models: ["cx/gpt-5.6-luna", "cx/gpt-5.6-terra", "cx/gpt-5.6-sol"],
      },
    },
    defaultProvider: "9router",
  };
}

async function request(config: OcxConfig, method = "GET", body?: unknown): Promise<Response> {
  const req = new Request("http://localhost/api/aura/profile", {
    method,
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  return (await handleManagementAPI(req, new URL(req.url), config))!;
}

describe("/api/aura/profile", () => {
  test("exposes normalized provider boundaries without credentials", async () => {
    const target = config();
    const req = new Request("http://localhost/api/aura/providers");
    const response = (await handleManagementAPI(req, new URL(req.url), target))!;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      providers: [{
        id: "9router",
        adapter: "openai-responses",
        protocol: "responses",
        authentication: { kind: "key", keyOptional: false },
        discovery: {
          live: false,
          models: ["cx/gpt-5.6-luna", "cx/gpt-5.6-terra", "cx/gpt-5.6-sol"],
        },
        capabilities: {
          compact: "native",
          reasoningDeclared: false,
          visionDeclared: false,
        },
      }],
    });
  });

  test("lists explicit client adapters and does not overstate experimental support", async () => {
    const target = config();
    const req = new Request("http://localhost/api/aura/clients");
    const response = (await handleManagementAPI(req, new URL(req.url), target))!;
    const body = await response.json() as {
      clients: { id: string; maturity: string; configurable: boolean }[];
    };
    expect(response.status).toBe(200);
    expect(body.clients.find(client => client.id === "codex")).toMatchObject({
      maturity: "production",
      configurable: true,
    });
    expect(body.clients.find(client => client.id === "zcode")).toMatchObject({
      maturity: "experimental",
      configurable: false,
    });
  });

  test("previews, applies, and restores OpenCode configuration", async () => {
    const target = config();
    process.env.OPENCODE_CONFIG = join(tempHome!, "opencode.jsonc");
    const model = "9router/cx-gpt-5.6-terra";
    const previewReq = new Request(`http://localhost/api/aura/clients/opencode?model=${encodeURIComponent(model)}`);
    const preview = (await handleManagementAPI(previewReq, new URL(previewReq.url), target))!;
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ exists: false, model: `aura/${model}` });

    const applyReq = new Request("http://localhost/api/aura/clients/opencode", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
    });
    const applied = (await handleManagementAPI(applyReq, new URL(applyReq.url), target))!;
    expect(applied.status).toBe(200);
    expect(target.aura?.clients?.opencode?.created).toBe(true);

    const restoreReq = new Request("http://localhost/api/aura/clients/opencode", { method: "DELETE" });
    const restored = (await handleManagementAPI(restoreReq, new URL(restoreReq.url), target))!;
    expect(restored.status).toBe(200);
    expect(target.aura?.clients?.opencode).toBeUndefined();
  });

  test("applies Balanced to the existing OpenCodex controls", async () => {
    const target = config();
    const response = await request(target, "PUT", { profile: "balanced" });
    expect(response.status).toBe(200);
    expect(target.aura?.activeProfile).toBe("balanced");
    expect(target.injectionModel).toBe("9router/cx-gpt-5.6-terra");
    expect(target.injectionEffort).toBe("medium");
    expect(target.subagentModels).toEqual([
      "9router/cx-gpt-5.6-terra",
      "9router/cx-gpt-5.6-luna",
      "9router/cx-gpt-5.6-sol",
    ]);
  });

  test("accepts role overrides and rejects unavailable models", async () => {
    const target = config();
    const ok = await request(target, "PUT", {
      profile: "saver",
      roles: { reviewer: { model: "9router/cx-gpt-5.6-terra", effort: "medium" } },
    });
    expect(ok.status).toBe(200);
    expect(target.aura?.roles?.reviewer).toEqual({
      model: "9router/cx-gpt-5.6-terra",
      effort: "medium",
    });

    const before = structuredClone(target);
    const bad = await request(target, "PUT", {
      profile: "quality",
      roles: { worker: { model: "missing/model" } },
    });
    expect(bad.status).toBe(400);
    expect(target).toEqual(before);
  });

  test("GET returns the active effective profile and available models", async () => {
    const target = config();
    await request(target, "PUT", { profile: "quality" });
    const response = await request(target);
    const body = await response.json() as {
      activeProfile: string;
      profile: { roles: { orchestrator: { model: string } } };
      available: string[];
    };
    expect(body.activeProfile).toBe("quality");
    expect(body.profile.roles.orchestrator.model).toBe("9router/cx-gpt-5.6-sol");
    expect(body.available).toContain("9router/cx-gpt-5.6-luna");
  });
});
