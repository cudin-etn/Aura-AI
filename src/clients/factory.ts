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

function buildCustomModel(model: string, baseUrl: string, apiKey?: string): JsonObject {
  return {
    model,
    displayName: `Aura AI — ${model}`,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    provider: "openai",
    ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
  };
}

export function buildFactoryConnection(
  source: string | undefined,
  baseUrl: string,
  model: string,
  apiKey?: string,
): JsonObject {
  const root = source?.trim() ? asObject(JSON.parse(source), "Factory settings") : {};
  const customModels = root.customModels === undefined
    ? []
    : Array.isArray(root.customModels) ? root.customModels : (() => {
      throw new Error("customModels must be an array");
    })();
  const kept = customModels.filter(entry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return true;
    const row = entry as Record<string, unknown>;
    return !(row.displayName === `Aura AI — ${model}` || row.auraManaged === true);
  });
  return {
    ...root,
    customModels: [...kept, buildCustomModel(model, baseUrl, apiKey)],
  };
}

export function previewFactoryConnection(baseUrl: string, model: string): {
  path: string;
  exists: boolean;
  model: string;
  provider: string;
  changes: string[];
} {
  const path = defaultFactoryConfigPath();
  const source = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  buildFactoryConnection(source, baseUrl, model);
  return {
    path,
    exists: source !== undefined,
    model,
    provider: "openai",
    changes: ["customModels"],
  };
}

export function applyFactoryConnection(baseUrl: string, model: string, apiKey?: string): FactoryConnectionState {
  const path = defaultFactoryConfigPath();
  const created = !existsSync(path);
  const source = created ? undefined : readFileSync(path, "utf8");
  const nextBytes = JSON.stringify(buildFactoryConnection(source, baseUrl, model, apiKey), null, 2) + "\n";
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const backupPath = created ? undefined : `${path}.aura-backup-${randomUUID()}`;
  if (backupPath) atomicWriteFile(backupPath, source!);
  try {
    atomicWriteFile(path, nextBytes);
    const verified = asObject(JSON.parse(readFileSync(path, "utf8")), "Factory settings");
    const models = Array.isArray(verified.customModels) ? verified.customModels : [];
    const aura = models.find(entry => entry && typeof entry === "object" && (entry as JsonObject).displayName === `Aura AI — ${model}`);
    if (!aura || (aura as JsonObject).baseUrl !== baseUrl.replace(/\/+$/, "")) {
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
