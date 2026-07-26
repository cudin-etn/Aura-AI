import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { atomicWriteFile } from "../config";

export type OpenCodeConnectionState = {
  path: string;
  backupPath?: string;
  created: boolean;
  appliedAt: number;
  /** SHA-256 of the exact Aura-authored bytes; restore refuses to clobber later user edits. */
  appliedHash?: string;
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
  models: readonly string[] | string,
  defaultModel?: string,
): JsonObject {
  const normalizedModels = [...new Set((typeof models === "string" ? [models] : models).map(model => model.trim()).filter(Boolean))];
  if (normalizedModels.length === 0) throw new Error("OpenCode requires at least one Aura model");
  const resolvedDefault = defaultModel?.trim() || normalizedModels[0];
  if (!normalizedModels.includes(resolvedDefault)) throw new Error("OpenCode default model must be included in the Aura model list");
  const root = source?.trim() ? asObject(Bun.JSONC.parse(source), "OpenCode config") : {};
  const providers = root.provider === undefined ? {} : asObject(root.provider, "provider");
  const previousAura = providers.aura === undefined ? {} : asObject(providers.aura, "provider.aura");
  const previousOptions = previousAura.options === undefined ? {} : asObject(previousAura.options, "provider.aura.options");
  return {
    ...root,
    provider: {
      ...providers,
      aura: {
        ...previousAura,
        npm: "@ai-sdk/openai-compatible",
        name: "Aura AI",
        options: { ...previousOptions, baseURL: baseUrl.replace(/\/+$/, "") },
        models: Object.fromEntries(normalizedModels.map(model => [model, { name: model }])),
      },
    },
    model: `aura/${resolvedDefault}`,
  };
}

export function previewOpenCodeConnection(baseUrl: string, models: readonly string[] | string, defaultModel?: string): {
  path: string;
  exists: boolean;
  model: string;
  models: string[];
  modelCount: number;
  provider: string;
  changes: string[];
} {
  const path = defaultOpenCodeConfigPath();
  const source = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  const normalizedModels = [...new Set((typeof models === "string" ? [models] : models).map(model => model.trim()).filter(Boolean))];
  const resolvedDefault = defaultModel?.trim() || normalizedModels[0];
  buildOpenCodeConnection(source, baseUrl, normalizedModels, resolvedDefault);
  return {
    path,
    exists: source !== undefined,
    model: `aura/${resolvedDefault}`,
    models: normalizedModels,
    modelCount: normalizedModels.length,
    provider: "aura",
    changes: ["provider.aura", "model"],
  };
}

function hashBytes(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validBackupPath(target: string, backupPath: string): boolean {
  const prefix = `${target}.aura-backup-`;
  if (!backupPath.startsWith(prefix)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(backupPath.slice(prefix.length));
}

export function applyOpenCodeConnection(
  baseUrl: string,
  models: readonly string[] | string,
  defaultModel?: string,
): OpenCodeConnectionState {
  const path = defaultOpenCodeConfigPath();
  const created = !existsSync(path);
  const source = created ? undefined : readFileSync(path, "utf8");
  const normalizedModels = [...new Set((typeof models === "string" ? [models] : models).map(model => model.trim()).filter(Boolean))];
  const resolvedDefault = defaultModel?.trim() || normalizedModels[0];
  const next = buildOpenCodeConnection(source, baseUrl, normalizedModels, resolvedDefault);
  const nextBytes = JSON.stringify(next, null, 2) + "\n";
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const backupPath = created ? undefined : `${path}.aura-backup-${randomUUID()}`;
  if (backupPath) {
    atomicWriteFile(backupPath, source!);
  }
  try {
    atomicWriteFile(path, nextBytes);
    const verifiedBytes = readFileSync(path, "utf8");
    const verified = asObject(Bun.JSONC.parse(verifiedBytes), "OpenCode config");
    const provider = asObject(verified.provider, "provider");
    const aura = asObject(provider.aura, "provider.aura");
    const options = asObject(aura.options, "provider.aura.options");
    const verifiedModels = asObject(aura.models, "provider.aura.models");
    if (
      verified.model !== `aura/${resolvedDefault}`
      || options.baseURL !== baseUrl.replace(/\/+$/, "")
      || normalizedModels.some(model => !(model in verifiedModels))
      || Object.keys(verifiedModels).length !== normalizedModels.length
    ) {
      throw new Error("OpenCode verification failed after apply");
    }
  } catch (cause) {
    if (created) {
      if (existsSync(path)) rmSync(path);
    } else {
      atomicWriteFile(path, source!);
    }
    throw cause;
  }
  return {
    path,
    ...(backupPath ? { backupPath } : {}),
    created,
    appliedAt: Date.now(),
    appliedHash: hashBytes(nextBytes),
  };
}

export function restoreOpenCodeConnection(state: OpenCodeConnectionState): void {
  const expected = defaultOpenCodeConfigPath();
  if (resolve(state.path) !== expected) throw new Error("OpenCode restore target no longer matches the configured path");
  if (!existsSync(expected)) throw new Error("OpenCode Aura-managed config is missing");
  if (!state.appliedHash) {
    throw new Error("OpenCode Aura state predates verified restore; reconnect before using automatic restore");
  }
  if (hashBytes(readFileSync(expected, "utf8")) !== state.appliedHash) {
    throw new Error("OpenCode config changed after Aura applied it; refusing to overwrite user edits");
  }
  if (state.created) {
    rmSync(expected);
    return;
  }
  if (!state.backupPath || !validBackupPath(expected, state.backupPath) || !existsSync(state.backupPath)) {
    throw new Error("OpenCode backup is missing or unsafe");
  }
  atomicWriteFile(expected, readFileSync(state.backupPath, "utf8"));
}
