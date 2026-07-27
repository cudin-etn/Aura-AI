import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { atomicWriteFile } from "../config";
import { resolveCodexHomeDir } from "../codex/home";

const MANAGED_MARKER = "# Aura AI MCP — managed; remove with Aura restore";
const MANAGED_SECTION = `${MANAGED_MARKER}\n[mcp_servers.aura]\ncommand = "aura"\nargs = ["mcp"]\n`;

export interface CodexMcpConnectionState {
  clientId: "codex";
  path: string;
  backupPath?: string;
  created: boolean;
  appliedAt: number;
  appliedHash: string;
}

function hashBytes(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function defaultCodexMcpConfigPath(): string {
  return join(resolveCodexHomeDir(), "config.toml");
}

function managedBlockBounds(source: string): { start: number; end: number } | null {
  const start = source.indexOf(MANAGED_MARKER);
  if (start < 0) return null;
  const next = source.indexOf("\n[", start + MANAGED_MARKER.length);
  return { start, end: next < 0 ? source.length : next + 1 };
}

export function buildCodexMcpConnection(source: string | undefined): string {
  const current = source ?? "";
  const existingAuraSection = /^\s*\[mcp_servers\.aura\]\s*$/m.test(current);
  const managed = managedBlockBounds(current);
  if (existingAuraSection && !managed) {
    throw new Error("Codex already has an unmanaged [mcp_servers.aura] section; Aura will not overwrite it");
  }
  if (managed) return `${current.slice(0, managed.start).trimEnd()}\n\n${MANAGED_SECTION}${current.slice(managed.end).replace(/^\n+/, "")}`;
  return `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${MANAGED_SECTION}`;
}

export function previewCodexMcpConnection(path = defaultCodexMcpConfigPath()): { path: string; exists: boolean; changes: string[] } {
  const source = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  buildCodexMcpConnection(source);
  return { path, exists: source !== undefined, changes: ["mcp_servers.aura"] };
}

function validBackupPath(target: string, backupPath: string): boolean {
  const prefix = `${target}.aura-mcp-backup-`;
  return backupPath.startsWith(prefix)
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(backupPath.slice(prefix.length));
}

export function applyCodexMcpConnection(path = defaultCodexMcpConfigPath()): CodexMcpConnectionState {
  const target = resolve(path);
  const created = !existsSync(target);
  const source = created ? undefined : readFileSync(target, "utf8");
  const next = buildCodexMcpConnection(source);
  const backupPath = created ? undefined : `${target}.aura-mcp-backup-${randomUUID()}`;
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  if (backupPath) atomicWriteFile(backupPath, source!);
  try {
    atomicWriteFile(target, next);
    if (readFileSync(target, "utf8") !== next) throw new Error("Codex MCP verification failed after apply");
  } catch (error) {
    if (created) { if (existsSync(target)) rmSync(target); }
    else atomicWriteFile(target, source!);
    throw error;
  }
  return { clientId: "codex", path: target, ...(backupPath ? { backupPath } : {}), created, appliedAt: Date.now(), appliedHash: hashBytes(next) };
}

export function restoreCodexMcpConnection(state: CodexMcpConnectionState): void {
  const expected = resolve(defaultCodexMcpConfigPath());
  if (resolve(state.path) !== expected || !existsSync(expected)) throw new Error("Codex MCP restore target is missing or changed");
  if (hashBytes(readFileSync(expected, "utf8")) !== state.appliedHash) throw new Error("Codex config changed after Aura applied MCP; refusing to overwrite user edits");
  if (state.created) { rmSync(expected); return; }
  if (!state.backupPath || !validBackupPath(expected, state.backupPath) || !existsSync(state.backupPath)) {
    throw new Error("Codex MCP backup is missing or unsafe");
  }
  atomicWriteFile(expected, readFileSync(state.backupPath, "utf8"));
}
