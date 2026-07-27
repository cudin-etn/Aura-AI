import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hasIntegrationSecret, readIntegrationSecret, removeIntegrationSecret, storeIntegrationSecret } from "../src/integrations/vault";

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Aura integration vault", () => {
  test("keeps a secret out of the public reference and supports revocation", () => {
    const dir = mkdtempSync(join(tmpdir(), "aura-integration-vault-"));
    created.push(dir);
    const path = join(dir, "vault.json");
    const ref = storeIntegrationSecret("super-secret-token", { path });
    expect(ref).toMatch(/^[a-zA-Z0-9_-]{16,128}$/);
    expect(hasIntegrationSecret(ref, path)).toBe(true);
    expect(readIntegrationSecret(ref, path)).toBe("super-secret-token");
    expect(statSync(path).mode & 0o077).toBe(0);
    expect(removeIntegrationSecret(ref, path)).toBe(true);
    expect(readIntegrationSecret(ref, path)).toBeNull();
  });
});
