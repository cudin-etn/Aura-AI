import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyOpenCodeConnection,
  buildOpenCodeConnection,
  defaultOpenCodeConfigPath,
  previewOpenCodeConnection,
  restoreOpenCodeConnection,
} from "../src/clients/opencode";

const savedOverride = process.env.OPENCODE_CONFIG;
let root: string | null = null;

afterEach(() => {
  if (savedOverride === undefined) delete process.env.OPENCODE_CONFIG;
  else process.env.OPENCODE_CONFIG = savedOverride;
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

function target(): string {
  root = mkdtempSync(join(tmpdir(), "aura-opencode-"));
  const path = join(root, "opencode.jsonc");
  process.env.OPENCODE_CONFIG = path;
  return path;
}

describe("Aura OpenCode connector", () => {
  test("merges the Aura provider into JSONC without dropping unrelated providers", () => {
    const config = buildOpenCodeConnection(`{
      // keep this provider semantically
      "provider": { "existing": { "npm": "package" }, },
    }`, "http://127.0.0.1:10100/v1/", "cx/gpt-5.6-terra");
    expect(config.provider).toMatchObject({
      existing: { npm: "package" },
      aura: {
        npm: "@ai-sdk/openai-compatible",
        options: { baseURL: "http://127.0.0.1:10100/v1" },
      },
    });
    expect(config.model).toBe("aura/cx/gpt-5.6-terra");
  });

  test("backs up, applies, and restores an existing config byte-for-byte", () => {
    const path = target();
    const original = '{ // user comment\n  "provider": {"existing": {"npm": "package"}},\n}\n';
    writeFileSync(path, original);
    const state = applyOpenCodeConnection("http://127.0.0.1:10100/v1", "cx/gpt-5.6-terra");
    expect(defaultOpenCodeConfigPath()).toBe(path);
    expect(state.created).toBe(false);
    expect(state.appliedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(state.backupPath && existsSync(state.backupPath)).toBe(true);
    expect(Bun.JSONC.parse(readFileSync(path, "utf8"))).toMatchObject({
      model: "aura/cx/gpt-5.6-terra",
    });
    restoreOpenCodeConnection(state);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  test("restore removes only a config that Aura created", () => {
    const path = target();
    const state = applyOpenCodeConnection("http://127.0.0.1:10100/v1", "model");
    expect(state.created).toBe(true);
    expect(existsSync(path)).toBe(true);
    restoreOpenCodeConnection(state);
    expect(existsSync(path)).toBe(false);
  });

  test("previews only changed paths and never returns existing config values", () => {
    const path = target();
    writeFileSync(path, '{"privateToken":"must-not-leak"}\n');
    const preview = previewOpenCodeConnection("http://127.0.0.1:10100/v1", "model");
    expect(preview).toEqual({
      path,
      exists: true,
      model: "aura/model",
      provider: "aura",
      changes: ["provider.aura", "model"],
    });
    expect(JSON.stringify(preview)).not.toContain("must-not-leak");
  });

  test("refuses to overwrite user edits made after Aura applied", () => {
    const path = target();
    const original = '{"provider":{"existing":{"npm":"package"}}}\n';
    writeFileSync(path, original);
    const state = applyOpenCodeConnection("http://127.0.0.1:10100/v1", "model");
    writeFileSync(path, '{"userChanged":true}\n');

    expect(() => restoreOpenCodeConnection(state)).toThrow("refusing to overwrite user edits");
    expect(readFileSync(path, "utf8")).toBe('{"userChanged":true}\n');
    expect(readFileSync(state.backupPath!, "utf8")).toBe(original);
  });

  test("rejects a tampered backup path before reading it", () => {
    const path = target();
    writeFileSync(path, '{"original":true}\n');
    const state = applyOpenCodeConnection("http://127.0.0.1:10100/v1", "model");

    expect(() => restoreOpenCodeConnection({ ...state, backupPath: join(root!, "other-secret") }))
      .toThrow("backup is missing or unsafe");
  });
});
