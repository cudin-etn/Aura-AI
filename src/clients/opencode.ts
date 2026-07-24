import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { atomicWriteFile } from "../config";

export type OpenCodeConnectionState = {
  path: string;
  backupPath?: string;
  created: boolean;
  appliedAt: number;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonObject;
}

export function defaultOpenCodeConfigPath(): string {
  const override = process.env.OPENCODE_CONFIG?.trim();
  if (override) return resolve(override);
  const root = process.platform === "win32"
    ? process.env.APPDATA || join(homedir(), "AppData", "Roaming")
    : process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const dir = join(root, "opencode");
  const jsonc = join(dir, "opencode.jsonc");
  return existsSync(jsonc) ? jsonc : join(dir, "opencode.json");
}

export function buildOpenCodeConnection(
  source: string | undefined,
  baseUrl: string,
  model: string,
): JsonObject {
  const root = source?.trim() ? asObject(Bun.JSONC.parse(source), "OpenCode config") : {};
  const providers = root.provider === undefined ? {} : asObject(root.provider, "provider");
  return {
    ...root,
    provider: {
      ...providers,
      aura: {
        npm: "@ai-sdk/openai-compatible",
        name: "Aura AI",
        options: { baseURL: baseUrl.replace(/\/+$/, "") },
        models: {
          [model]: { name: model },
        },
      },
    },
    model: `aura/${model}`,
  };
}

export function previewOpenCodeConnection(baseUrl: string, model: string): {
  path: string;
  exists: boolean;
  model: string;
  provider: string;
} {
  const path = defaultOpenCodeConfigPath();
  const source = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  buildOpenCodeConnection(source, baseUrl, model);
  return { path, exists: source !== undefined, model: `aura/${model}`, provider: "aura" };
}

export function applyOpenCodeConnection(baseUrl: string, model: string): OpenCodeConnectionState {
  const path = defaultOpenCodeConfigPath();
  const created = !existsSync(path);
  const source = created ? undefined : readFileSync(path, "utf8");
  const next = buildOpenCodeConnection(source, baseUrl, model);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const backupPath = created ? undefined : `${path}.aura-backup-${Date.now()}`;
  if (backupPath) {
    copyFileSync(path, backupPath);
    chmodSync(backupPath, 0o600);
  }
  atomicWriteFile(path, JSON.stringify(next, null, 2) + "\n");
  return {
    path,
    ...(backupPath ? { backupPath } : {}),
    created,
    appliedAt: Date.now(),
  };
}

export function restoreOpenCodeConnection(state: OpenCodeConnectionState): void {
  const expected = defaultOpenCodeConfigPath();
  if (resolve(state.path) !== expected) throw new Error("OpenCode restore target no longer matches the configured path");
  if (state.created) {
    if (existsSync(expected)) rmSync(expected);
    return;
  }
  if (!state.backupPath || !existsSync(state.backupPath)) throw new Error("OpenCode backup is missing");
  atomicWriteFile(expected, readFileSync(state.backupPath, "utf8"));
}
