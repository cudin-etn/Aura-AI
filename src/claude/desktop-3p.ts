import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Desktop3pModelEntry {
  name: string;
  labelOverride: string;
  anthropicFamilyTier: "opus";
  isFamilyDefault?: boolean;
  /**
   * Desktop's documented 1M-context capability assertion. Set ONLY from an
   * authoritative routed contextWindow >= 1M — never guessed (devlog 136 B5).
   */
  supports1m?: true;
}

/**
 * static (default, Pro-verified devlog 138): pinned inferenceModels with
 * modelDiscoveryEnabled:false — a static list OVERRIDES discovery (no merge), so
 * this is the deterministic shape. hybrid keeps discovery:true alongside the list
 * (claude-code-router's version-defensive pattern). discovery: /v1/models only.
 */
export type Desktop3pConfigMode = "hybrid" | "discovery" | "static";

export interface Desktop3pRoutedModel {
  provider: string;
  id: string;
  /** Authoritative context window (CatalogModel.contextWindow); optional. */
  contextWindow?: number;
}

const SUPPORTS_1M_THRESHOLD = 1_000_000;

/** CLI arg parsing for `ocx claude desktop` mode flags (mutually exclusive). */
export function parseDesktop3pModeArgs(flags: string[]): { mode: Desktop3pConfigMode } | { error: string } {
  const known = new Map<string, Desktop3pConfigMode>([
    ["--static", "static"],
    ["--hybrid", "hybrid"],
    ["--discovery-only", "discovery"],
  ]);
  const unknown = flags.filter(a => !known.has(a));
  if (unknown.length > 0) return { error: `알 수 없는 옵션: ${unknown.join(" ")} (지원: --static, --hybrid, --discovery-only)` };
  const picked = [...new Set(flags.map(a => known.get(a)!))];
  if (picked.length > 1) return { error: "모드 옵션은 하나만 쓸 수 있습니다 (--static | --hybrid | --discovery-only)." };
  return { mode: picked[0] ?? "static" };
}

interface Desktop3pMetadataEntry {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Desktop3pStatus {
  supported: boolean;
  libraryPath: string;
  configPath: string | null;
  exists: boolean;
  backupExists: boolean;
  modelCount: number | null;
  mode: Desktop3pConfigMode | null;
}

type AuraDesktopMetadata = {
  backupPath?: string;
  appliedHash?: string;
  mode?: Desktop3pConfigMode;
  created?: boolean;
  originalName?: string;
};

interface Desktop3pMetadata {
  appliedId?: string;
  entries: Desktop3pMetadataEntry[];
  [key: string]: unknown;
}

let desktop3pRegistry = new Map<string, string>();

/** Derive a stable letter-first, three-character base36 code from a route key. */
export function deriveDesktop3pCode(route: string): string {
  const hash = createHash("sha256").update(route).digest();
  const n = hash.readUInt32BE(0) % 33696;
  const first = String.fromCharCode(97 + Math.floor(n / 1296));
  const rest = (n % 1296).toString(36).padStart(2, "0");
  return first + rest;
}

/**
 * Alias for one proxy model. Real Anthropic models pass through unchanged (they must
 * keep hitting the sk-ant native passthrough); everything else gets a Claude-shaped
 * `claude-opus-4-8-{code}` id. Opus 4.8 is chosen deliberately: Desktop's effort
 * selector is an allowlist keyed on exact supported model ids (Opus 4.8/4.7/4.6,
 * Sonnet 4.6 — devlog 131), and 4.6+ canonical ids are dateless, so the letter-first
 * 3-char suffix can never collide with a real id or a legacy date suffix.
 */
export function desktop3pAlias(provider: string, modelId: string): string {
  if (provider === "anthropic" && modelId.startsWith("claude-")) return modelId;
  return `claude-opus-4-8-${deriveDesktop3pCode(`${provider}/${modelId}`)}`;
}

/** Pre-rename alias shape (claude-opus-4-{code}) — still decoded for stale Desktop configs. */
export function legacyDesktop3pAlias(provider: string, modelId: string): string {
  return `claude-opus-4-${deriveDesktop3pCode(`${provider}/${modelId}`)}`;
}

function displayModelId(modelId: string): string {
  return modelId
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => {
      const lower = part.toLowerCase();
      if (lower === "gpt" || lower === "glm" || lower === "ai") return lower.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function collectDesktop3pModels(
  nativeSlugs: string[],
  routedModels: Array<Desktop3pRoutedModel>,
): { models: Desktop3pModelEntry[]; registry: Map<string, string> } {
  const registry = new Map<string, string>();
  const models: Desktop3pModelEntry[] = [];
  const candidates: Desktop3pRoutedModel[] = [
    ...nativeSlugs.map(id => ({ provider: "native", id })),
    ...routedModels,
  ];

  for (const { provider, id, contextWindow } of candidates) {
    const route = `${provider}/${id}`;
    const alias = desktop3pAlias(provider, id);
    const supports1m = typeof contextWindow === "number" && contextWindow >= SUPPORTS_1M_THRESHOLD
      ? { supports1m: true as const }
      : {};
    if (alias === id) {
      // Real Anthropic model: keep it OUT of the decode registry — registering it would
      // make resolveInboundModel() non-identity and kill the sk-ant native passthrough
      // (audit 133 #1). It still appears in the static Desktop model list below.
      models.push({
        name: alias,
        labelOverride: `${displayModelId(id)} (${provider})`,
        anthropicFamilyTier: "opus",
        ...supports1m,
      });
      continue;
    }
    const existingRoute = registry.get(alias);
    if (existingRoute !== undefined) {
      console.warn(`[opencodex] Claude Desktop 3P alias collision: ${alias} maps to both ${existingRoute} and ${route}; skipping ${route}`);
      continue;
    }

    registry.set(alias, route);
    // Back-compat decode for Desktop configs written before the opus-4-8 rename.
    const legacy = legacyDesktop3pAlias(provider, id);
    if (!registry.has(legacy)) registry.set(legacy, route);
    models.push({
      name: alias,
      labelOverride: `${displayModelId(id)} (${provider})`,
      anthropicFamilyTier: "opus",
      ...supports1m,
    });
  }

  if (models[0]) models[0].isFamilyDefault = true;
  return { models, registry };
}

/** Build and install the registry used to decode Desktop aliases. */
export function buildDesktop3pRegistry(
  nativeSlugs: string[],
  routedModels: Array<Desktop3pRoutedModel>,
): Map<string, string> {
  const { registry } = collectDesktop3pModels(nativeSlugs, routedModels);
  desktop3pRegistry = registry;
  return registry;
}

/** Generate Claude Desktop 3P model entries from the proxy's available models. */
export function generateDesktop3pModels(
  nativeSlugs: string[],
  routedModels: Array<Desktop3pRoutedModel>,
): Desktop3pModelEntry[] {
  const { models, registry } = collectDesktop3pModels(nativeSlugs, routedModels);
  desktop3pRegistry = registry;
  return models;
}

/** Resolve an alias using the most recently generated Desktop model registry. */
export function resolveDesktop3pAlias(alias: string): string | null {
  return desktop3pRegistry.get(alias) ?? null;
}

/**
 * Generate the complete Claude Desktop 3P gateway config.
 *
 * Default mode is "static" (Pro-verified, devlog 138): the static list is the ONLY
 * channel for supports1m/tier pins and it overrides discovery anyway (no merge), so
 * discovery stays off for determinism. supports1m makes Desktop offer a separate 1M
 * row; selecting it sends the bare id + `anthropic-beta: context-1m-2025-08-07`.
 */
export function generateDesktop3pConfig(
  port: number,
  nativeSlugs: string[],
  routedModels: Array<Desktop3pRoutedModel>,
  apiKey = "ocx",
  mode: Desktop3pConfigMode = "static",
): object {
  const base = {
    inferenceProvider: "gateway",
    inferenceCredentialKind: "static",
    inferenceGatewayBaseUrl: `http://127.0.0.1:${port}`,
    inferenceGatewayApiKey: apiKey,
  };
  if (mode === "discovery") {
    // Build/refresh the decode registry even though no static list is emitted.
    buildDesktop3pRegistry(nativeSlugs, routedModels);
    return { ...base, modelDiscoveryEnabled: true };
  }
  return {
    ...base,
    modelDiscoveryEnabled: mode === "hybrid",
    inferenceModels: generateDesktop3pModels(nativeSlugs, routedModels),
  };
}

function parseMetadata(path: string): Desktop3pMetadata {
  if (!existsSync(path)) return { entries: [] };
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Desktop3pMetadata>;
  if (!Array.isArray(parsed.entries)) throw new Error("Claude Desktop 3P _meta.json has no entries array");
  return { ...parsed, entries: parsed.entries };
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function desktop3pLibraryPath(home = homedir()): string {
  return join(home, "Library", "Application Support", "Claude-3p", "configLibrary");
}

function desktop3pEntry(libraryPath: string): { metadata: Desktop3pMetadata; entry: Desktop3pMetadataEntry | null; configPath: string | null } {
  const metadataPath = join(libraryPath, "_meta.json");
  const metadata = parseMetadata(metadataPath);
  const entry = metadata.entries.find(candidate =>
    candidate?.name === "aura" && typeof candidate.id === "string") ?? null;
  return {
    metadata,
    entry,
    configPath: entry ? join(libraryPath, `${entry.id}.json`) : null,
  };
}

/** Return secret-free Claude Desktop 3P installation/configuration state. */
export function getDesktop3pStatus(home = homedir()): Desktop3pStatus {
  const supported = process.platform === "darwin";
  const libraryPath = desktop3pLibraryPath(home);
  const { entry, configPath } = desktop3pEntry(libraryPath);
  const exists = !!configPath && existsSync(configPath);
  let modelCount: number | null = null;
  let mode: Desktop3pConfigMode | null = null;
  if (exists && configPath) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, "utf8")) as { inferenceModels?: unknown[]; modelDiscoveryEnabled?: boolean };
      modelCount = Array.isArray(parsed.inferenceModels) ? parsed.inferenceModels.length : 0;
      mode = parsed.modelDiscoveryEnabled === true
        ? (Array.isArray(parsed.inferenceModels) && parsed.inferenceModels.length > 0 ? "hybrid" : "discovery")
        : "static";
    } catch {
      modelCount = null;
    }
  }
  const aura = entry?.aura as AuraDesktopMetadata | undefined;
  return {
    supported,
    libraryPath,
    configPath,
    exists,
    backupExists: !!aura?.backupPath && existsSync(aura.backupPath),
    modelCount,
    mode,
  };
}

/** Write and apply the opencodex config in Claude Desktop 3P's config library. */
export function writeDesktop3pConfig(
  port: number,
  nativeSlugs: string[],
  routedModels: Array<Desktop3pRoutedModel>,
  apiKey?: string,
  mode: Desktop3pConfigMode = "static",
  home = homedir(),
): { written: boolean; path: string; reason?: string } {
  const libraryPath = desktop3pLibraryPath(home);
  const metadataPath = join(libraryPath, "_meta.json");
  let configPath = libraryPath;

  try {
    mkdirSync(libraryPath, { recursive: true, mode: 0o700 });
    const metadata = parseMetadata(metadataPath);
    const existing = metadata.entries.find(entry =>
      (entry?.name === "aura" || entry?.name === "opencodex") && typeof entry.id === "string");
    const id = existing?.id ?? randomUUID();
    configPath = join(libraryPath, `${id}.json`);
    const backupPath = `${configPath}.aura-backup`;
    const existingContent = existsSync(configPath) ? readFileSync(configPath, "utf8") : null;
    const originalName = existing?.name;
    if (existingContent !== null && !existsSync(backupPath)) writeFileSync(backupPath, existingContent, { encoding: "utf8", mode: 0o600 });
    const generated = JSON.stringify(generateDesktop3pConfig(port, nativeSlugs, routedModels, apiKey, mode), null, 2) + "\n";
    const tempPath = `${configPath}.aura-tmp-${process.pid}`;
    writeFileSync(tempPath, generated, { encoding: "utf8", mode: 0o600 });
    renameSync(tempPath, configPath);
    const entry: Desktop3pMetadataEntry = existing
      ? { ...existing, id, name: "aura", aura: { backupPath, appliedHash: hashText(generated), mode, created: existingContent === null, originalName } }
      : { id, name: "aura", aura: { backupPath, appliedHash: hashText(generated), mode, created: true } };
    const entries = existing
      ? metadata.entries.map(current => current === existing ? entry : current)
      : [...metadata.entries, entry];
    writeFileSync(metadataPath, JSON.stringify({ ...metadata, appliedId: id, entries }, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    return { written: true, path: configPath };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { written: false, path: configPath, reason };
  }
}

/** Restore the pre-Aura Claude Desktop config only when Aura still owns the file. */
export function restoreDesktop3pConfig(home = homedir()): { restored: boolean; reason?: string; path?: string } {
  const libraryPath = desktop3pLibraryPath(home);
  const { entry, configPath } = desktop3pEntry(libraryPath);
  if (!entry || !configPath) return { restored: false, reason: "Claude Desktop 3P is not configured by Aura" };
  const aura = entry.aura as AuraDesktopMetadata | undefined;
  if (!aura?.appliedHash || !existsSync(configPath)) {
    return { restored: false, reason: "Aura backup metadata is incomplete" };
  }
  const currentHash = hashText(readFileSync(configPath, "utf8"));
  if (currentHash !== aura.appliedHash) return { restored: false, reason: "Claude Desktop config changed after Aura applied it" };
  if (aura.created && !existsSync(aura.backupPath ?? "")) {
    unlinkSync(configPath);
    const metadataPath = join(libraryPath, "_meta.json");
    const metadata = parseMetadata(metadataPath);
    writeFileSync(metadataPath, JSON.stringify({
      ...metadata,
      appliedId: metadata.appliedId === entry.id ? undefined : metadata.appliedId,
      entries: metadata.entries.filter(candidate => candidate.id !== entry.id),
    }, null, 2) + "\n");
    return { restored: true, path: configPath };
  }
  if (!aura.backupPath) return { restored: false, reason: "Aura backup metadata is incomplete" };
  if (!existsSync(aura.backupPath)) return { restored: false, reason: "Aura backup file is missing" };
  const restored = readFileSync(aura.backupPath, "utf8");
  const tempPath = `${configPath}.aura-restore-${process.pid}`;
  writeFileSync(tempPath, restored, { encoding: "utf8", mode: 0o600 });
  renameSync(tempPath, configPath);
  const metadataPath = join(libraryPath, "_meta.json");
  const metadata = parseMetadata(metadataPath);
  const restoredEntry: Desktop3pMetadataEntry = { ...entry, name: aura.originalName ?? "opencodex" };
  delete restoredEntry.aura;
  writeFileSync(metadataPath, JSON.stringify({
    ...metadata,
    appliedId: metadata.appliedId === entry.id ? undefined : metadata.appliedId,
    entries: metadata.entries.map(candidate => candidate.id === entry.id ? restoredEntry : candidate),
  }, null, 2) + "\n");
  return { restored: true, path: configPath };
}
