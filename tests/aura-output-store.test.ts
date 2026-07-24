import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAuraToolOutput, storeAuraToolOutput } from "../src/optimizer/output-store";
import { handleManagementAPI } from "../src/server/management-api";
import type { OcxConfig } from "../src/types";

const previousHome = process.env.OPENCODEX_HOME;
let temporaryHome: string | null = null;

afterEach(() => {
  if (previousHome === undefined) delete process.env.OPENCODEX_HOME;
  else process.env.OPENCODEX_HOME = previousHome;
  if (temporaryHome) rmSync(temporaryHome, { recursive: true, force: true });
  temporaryHome = null;
});

describe("Aura full-output store", () => {
  test("stores by opaque digest and rejects path traversal handles", () => {
    temporaryHome = mkdtempSync(join(tmpdir(), "aura-output-"));
    process.env.OPENCODEX_HOME = temporaryHome;
    const content = "full local output\nwith details";
    const handle = storeAuraToolOutput(content);
    expect(handle).toMatch(/^[a-f0-9]{20}$/);
    expect(readAuraToolOutput(handle)).toBe(content);
    expect(readAuraToolOutput("../config.json")).toBeNull();
    expect(readAuraToolOutput(`${handle}/extra`)).toBeNull();
  });

  test("retrieves only an exact handle through the authenticated management route", async () => {
    temporaryHome = mkdtempSync(join(tmpdir(), "aura-output-api-"));
    process.env.OPENCODEX_HOME = temporaryHome;
    const handle = storeAuraToolOutput("private full output");
    const config: OcxConfig = { port: 10100, defaultProvider: "openai", providers: {} };

    const request = new Request(`http://localhost/api/aura/outputs/${handle}`);
    const response = await handleManagementAPI(request, new URL(request.url), config);
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("private full output");
    expect(response?.headers.get("cache-control")).toBe("no-store");

    const traversal = new Request("http://localhost/api/aura/outputs/..%2Fconfig.json");
    const rejected = await handleManagementAPI(traversal, new URL(traversal.url), config);
    expect(rejected?.status).toBe(404);
  });
});
