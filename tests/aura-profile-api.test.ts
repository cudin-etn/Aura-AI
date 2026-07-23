import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleManagementAPI } from "../src/server/management-api";
import type { OcxConfig } from "../src/types";

const savedHome = process.env.OPENCODEX_HOME;
let tempHome: string | null = null;

afterEach(() => {
  if (savedHome === undefined) delete process.env.OPENCODEX_HOME;
  else process.env.OPENCODEX_HOME = savedHome;
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
