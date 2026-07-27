/**
 * Integration secret vault.
 *
 * The public config only stores an opaque reference. Secret material lives in a
 * separate hardened file so previews, config exports, diagnostics, and normal
 * config backups cannot accidentally serialize it. A platform-keychain backend
 * can replace this implementation without changing connection metadata.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile, getConfigDir, hardenConfigDir, hardenExistingSecret } from "../config";

type VaultRecord = { version: 1; secrets: Record<string, { value: string; updatedAt: string }> };

function emptyVault(): VaultRecord { return { version: 1, secrets: {} }; }

export function getIntegrationVaultPath(): string {
  return join(getConfigDir(), "integrations-secrets.json");
}

function readVault(path = getIntegrationVaultPath()): VaultRecord {
  hardenConfigDir();
  hardenExistingSecret(path);
  if (!existsSync(path)) return emptyVault();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<VaultRecord>;
    if (raw.version !== 1 || !raw.secrets || typeof raw.secrets !== "object" || Array.isArray(raw.secrets)) return emptyVault();
    const secrets: VaultRecord["secrets"] = {};
    for (const [ref, value] of Object.entries(raw.secrets)) {
      if (!/^[a-zA-Z0-9_-]{16,128}$/.test(ref) || !value || typeof value !== "object") continue;
      const candidate = value as { value?: unknown; updatedAt?: unknown };
      if (typeof candidate.value !== "string" || !candidate.value || candidate.value.length > 64 * 1024) continue;
      if (typeof candidate.updatedAt !== "string" || !candidate.updatedAt) continue;
      secrets[ref] = { value: candidate.value, updatedAt: candidate.updatedAt };
    }
    return { version: 1, secrets };
  } catch {
    // A malformed vault is treated as unavailable instead of exposing partial
    // material. A later explicit recovery path can decide whether to archive it.
    return emptyVault();
  }
}

function writeVault(vault: VaultRecord, path = getIntegrationVaultPath()): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  hardenConfigDir();
  atomicWriteFile(path, `${JSON.stringify(vault, null, 2)}\n`);
}

/** Store a secret and return an opaque reference. Never log or return the secret itself. */
export function storeIntegrationSecret(value: string, options: { ref?: string; path?: string } = {}): string {
  const secret = value.trim();
  if (!secret || secret.length > 64 * 1024) throw new Error("integration secret must be between 1 and 65536 characters");
  const ref = options.ref ?? crypto.randomUUID().replaceAll("-", "");
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(ref)) throw new Error("integration secret reference is invalid");
  const path = options.path ?? getIntegrationVaultPath();
  const vault = readVault(path);
  vault.secrets[ref] = { value: secret, updatedAt: new Date().toISOString() };
  writeVault(vault, path);
  return ref;
}

/** Adapter-only read. Management routes must never call this function. */
export function readIntegrationSecret(ref: string, path = getIntegrationVaultPath()): string | null {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(ref)) return null;
  return readVault(path).secrets[ref]?.value ?? null;
}

export function removeIntegrationSecret(ref: string, path = getIntegrationVaultPath()): boolean {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(ref)) return false;
  const vault = readVault(path);
  if (!Object.hasOwn(vault.secrets, ref)) return false;
  delete vault.secrets[ref];
  writeVault(vault, path);
  return true;
}

export function hasIntegrationSecret(ref: string, path = getIntegrationVaultPath()): boolean {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(ref)) return false;
  return Object.hasOwn(readVault(path).secrets, ref);
}

