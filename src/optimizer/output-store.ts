import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config";

export function storeAuraToolOutput(content: string): string {
  const handle = createHash("sha256").update(content).digest("hex").slice(0, 20);
  const directory = join(getConfigDir(), "aura-outputs");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { chmodSync(directory, 0o700); } catch { /* best effort on Windows */ }
  const target = join(directory, `${handle}.txt`);
  writeFileSync(target, content, { encoding: "utf8", mode: 0o600, flag: "w" });
  try { chmodSync(target, 0o600); } catch { /* best effort on Windows */ }
  return handle;
}

export function readAuraToolOutput(handle: string): string | null {
  if (!/^[a-f0-9]{20}$/.test(handle)) return null;
  const target = join(getConfigDir(), "aura-outputs", `${handle}.txt`);
  if (!existsSync(target)) return null;
  return readFileSync(target, "utf8");
}
