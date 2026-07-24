import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyFactoryConnection,
  buildFactoryConnection,
  previewFactoryConnection,
  restoreFactoryConnection,
} from "../src/clients/factory";

const dirs: string[] = [];
const originalFactoryConfig = process.env.FACTORY_CONFIG;

afterEach(() => {
  if (originalFactoryConfig === undefined) delete process.env.FACTORY_CONFIG;
  else process.env.FACTORY_CONFIG = originalFactoryConfig;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function isolatedPath(): string {
  const dir = join(tmpdir(), `aura-factory-${crypto.randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  dirs.push(dir);
  const path = join(dir, "settings.json");
  process.env.FACTORY_CONFIG = path;
  return path;
}

describe("Factory Droid client connector", () => {
  test("preserves unrelated custom models and adds an Aura model without exposing a key in preview", () => {
    const next = buildFactoryConnection(JSON.stringify({
      theme: "dark",
      customModels: [{ model: "user-model", displayName: "My model", baseUrl: "http://user.test/v1" }],
    }), "http://127.0.0.1:4444/v1", "gpt-5.6-terra", "secret");
    expect(next.theme).toBe("dark");
    expect(next.customModels).toHaveLength(2);
    expect(JSON.stringify(next)).toContain("secret");
    const path = isolatedPath();
    writeFileSync(path, JSON.stringify({ customModels: [] }));
    const preview = previewFactoryConnection("http://127.0.0.1:4444/v1", "gpt-5.6-terra");
    expect(preview.path).toBe(path);
    expect(JSON.stringify(preview)).not.toContain("secret");
  });

  test("applies, verifies, and restores the original settings byte-for-byte", () => {
    const path = isolatedPath();
    const original = '{\n  "theme": "dark",\n  "customModels": []\n}\n';
    writeFileSync(path, original);
    const state = applyFactoryConnection("http://127.0.0.1:4444/v1", "gpt-5.6-terra");
    expect(readFileSync(path, "utf8")).toContain("Aura AI");
    expect(state.backupPath).toBeDefined();
    restoreFactoryConnection(state);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  test("refuses to restore over settings changed after Aura applied them", () => {
    const path = isolatedPath();
    writeFileSync(path, JSON.stringify({ customModels: [] }));
    const state = applyFactoryConnection("http://127.0.0.1:4444/v1", "gpt-5.6-terra");
    writeFileSync(path, JSON.stringify({ customModels: [], userChanged: true }));
    expect(() => restoreFactoryConnection(state)).toThrow("refusing to overwrite user edits");
  });

  test("removes only a file created by Aura", () => {
    const path = isolatedPath();
    const state = applyFactoryConnection("http://127.0.0.1:4444/v1", "gpt-5.6-terra");
    expect(existsSync(path)).toBe(true);
    restoreFactoryConnection(state);
    expect(existsSync(path)).toBe(false);
  });
});
