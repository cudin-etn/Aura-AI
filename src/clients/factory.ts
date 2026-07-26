import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { atomicWriteFile } from "../config";

export type FactoryConnectionState = {
  path: string;
  backupPath?: string;
  created: boolean;
  appliedAt: number;
  appliedHash?: string;
  models?: string[];
  defaultModel?: string;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonObject;
}

function hashBytes(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validBackupPath(target: string, backupPath: string): boolean {
  const prefix = `${target}.aura-backup-`;
  return backupPath.startsWith(prefix)
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(backupPath.slice(prefix.length));
}

export function defaultFactoryConfigPath(): string {
  const override = process.env.FACTORY_CONFIG?.trim();
  if (override) return resolve(override);
  return join(homedir(), ".factory", "settings.json");
}

function normalizeModels(models: string | readonly string[], defaultModel?: string): { models: string[]; defaultModel: string } {
  const values = Array.isArray(models) ? models : [models];
  const normalized = [...new Set(values.map(model => model.trim()).filter(Boolean))];
  if (normalized.length === 0) throw new Error("Factory requires at least one model");
  const chosen = defaultModel?.trim() || normalized[0];
  if (!normalized.includes(chosen)) throw new Error("Factory default model must be included in models");
  return { models: normalized, defaultModel: chosen };
}

function buildCustomModel(model: string, baseUrl: string, apiKey?: string): JsonObject {
  return {
    model,
    displayName: `Aura AI — ${model}`,
    auraManaged: true,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    provider: "openai",
    ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
  };
}

export function buildFactoryConnection(
  source: string | undefined,
  baseUrl: string,
  models: string | readonly string[],
  apiKey?: string,
  defaultModel?: string,
): JsonObject {
  const selected = normalizeModels(models, defaultModel);
  const root = source?.trim() ? asObject(JSON.parse(source), "Factory settings") : {};
  const customModels = root.customModels === undefined
    ? []
    : Array.isArray(root.customModels) ? root.customModels : (() => {
      throw new Error("customModels must be an array");
    })();
  const kept = customModels.filter(entry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return true;
    const row = entry as Record<string, unknown>;
    return !(row.auraManaged === true || typeof row.displayName === "string" && row.displayName.startsWith("Aura AI — "));
  });
  return {
    ...root,
    customModels: [...kept, ...selected.models.map(model => buildCustomModel(model, baseUrl, apiKey))],
    ...(selected.defaultModel ? { defaultModel: `aura/${selected.defaultModel}` } : {}),
  };
}

export function previewFactoryConnection(baseUrl: string, models: string | readonly string[], defaultModel?: string): {
  path: string;
  exists: boolean;
  model: string;
  models: string[];
  modelCount: number;
  provider: string;
  changes: string[];
} {
  const path = defaultFactoryConfigPath();
  const source = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  const selected = normalizeModels(models, defaultModel);
  buildFactoryConnection(source, baseUrl, selected.models, undefined, selected.defaultModel);
  return {
    path,
    exists: source !== undefined,
    model: selected.defaultModel,
    models: selected.models,
    modelCount: selected.models.length,
    provider: "openai",
    changes: ["customModels"],
  };
}

export function applyFactoryConnection(baseUrl: string, models: string | readonly string[], apiKey?: string, defaultModel?: string): FactoryConnectionState {
  const selected = normalizeModels(models, defaultModel);
  const path = defaultFactoryConfigPath();
  const created = !existsSync(path);
  const source = created ? undefined : readFileSync(path, "utf8");
  const nextBytes = JSON.stringify(buildFactoryConnection(source, baseUrl, selected.models, apiKey, selected.defaultModel), null, 2) + "\n";
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const backupPath = created ? undefined : `${path}.aura-backup-${randomUUID()}`;
  if (backupPath) atomicWriteFile(backupPath, source!);
  try {
    atomicWriteFile(path, nextBytes);
    const verified = asObject(JSON.parse(readFileSync(path, "utf8")), "Factory settings");
    const models = Array.isArray(verified.customModels) ? verified.customModels : [];
    const auraRows = models.filter(entry => entry && typeof entry === "object" && (entry as JsonObject).auraManaged === true);
    if (auraRows.length !== selected.models.length || auraRows.some(entry => (entry as JsonObject).baseUrl !== baseUrl.replace(/\/+$/, ""))) {
      throw new Error("Factory verification failed after apply");
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
    models: selected.models,
    defaultModel: selected.defaultModel,
  };
}

export function restoreFactoryConnection(state: FactoryConnectionState): void {
  const expected = defaultFactoryConfigPath();
  if (resolve(state.path) !== expected) throw new Error("Factory restore target no longer matches the configured path");
  if (!existsSync(expected)) throw new Error("Factory Aura-managed config is missing");
  if (!state.appliedHash) throw new Error("Factory Aura state predates verified restore; reconnect before using automatic restore");
  if (hashBytes(readFileSync(expected, "utf8")) !== state.appliedHash) {
    throw new Error("Factory settings changed after Aura applied it; refusing to overwrite user edits");
  }
  if (state.created) {
    rmSync(expected);
    return;
  }
  if (!state.backupPath || !validBackupPath(expected, state.backupPath) || !existsSync(state.backupPath)) {
    throw new Error("Factory backup is missing or unsafe");
  }
  atomicWriteFile(expected, readFileSync(state.backupPath, "utf8"));
}
