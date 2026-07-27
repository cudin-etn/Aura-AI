import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyCodexMcpConnection, buildCodexMcpConnection, defaultCodexMcpConfigPath, previewCodexMcpConnection, restoreCodexMcpConnection } from "../src/clients/codex-mcp";

const savedHome = process.env.CODEX_HOME;
let root: string | undefined;

afterEach(() => {
  if (savedHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = savedHome;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function target(): string {
  root = mkdtempSync(join(tmpdir(), "aura-codex-mcp-"));
  process.env.CODEX_HOME = root;
  return join(root, "config.toml");
}

describe("Aura Codex MCP apply", () => {
  test("adds one managed TOML table without changing unrelated config", () => {
    const result = buildCodexMcpConnection('model = "gpt-5.6"\n');
    expect(result).toContain('model = "gpt-5.6"');
    expect(result).toContain("[mcp_servers.aura]");
    expect(result).toContain('command = "aura"');
  });

  test("backs up, verifies, and restores exact Codex config bytes", () => {
    const path = target();
    const original = 'model = "gpt-5.6"\n[features]\nweb_search = true\n';
    writeFileSync(path, original);
    expect(previewCodexMcpConnection()).toEqual({ path, exists: true, changes: ["mcp_servers.aura"] });
    const state = applyCodexMcpConnection();
    expect(defaultCodexMcpConfigPath()).toBe(path);
    expect(readFileSync(path, "utf8")).toContain("[mcp_servers.aura]");
    restoreCodexMcpConnection(state);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  test("refuses to replace an unmanaged Aura MCP table or later user edits", () => {
    const path = target();
    writeFileSync(path, '[mcp_servers.aura]\ncommand = "custom"\n');
    expect(() => applyCodexMcpConnection()).toThrow("will not overwrite");

    writeFileSync(path, 'model = "gpt-5.6"\n');
    const state = applyCodexMcpConnection();
    writeFileSync(path, 'model = "user-edit"\n');
    expect(() => restoreCodexMcpConnection(state)).toThrow("refusing to overwrite user edits");
    expect(existsSync(state.backupPath!)).toBe(true);
  });
});
