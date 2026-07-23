import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

setDefaultTimeout(30_000);

const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const releaseScriptPath = join(repoRoot, "scripts", "release.ts");
const commandShimPath = join(import.meta.dir, "fixtures", "release-command-shim.js");

interface LoggedCall {
  args: string[];
  name: string;
}

interface ReleaseScenario {
  branch?: string;
  headSha?: string;
  remoteHeadSha?: string;
  privacyExitCode?: number;
  testExitCode?: number;
  typecheckExitCode?: number;
}

function installCommandShim(binDir: string, name: "bun" | "gh" | "git" | "npm"): void {
  const launcherPath = join(binDir, name);
  const cmdPath = join(binDir, `${name}.cmd`);

  if (process.platform === "win32") {
    writeFileSync(cmdPath, `@echo off\r\n"${process.execPath}" "${commandShimPath}" ${name} %*\r\n`, "utf8");
  } else {
    symlinkSync(commandShimPath, launcherPath);
  }
}

function readLoggedCalls(logPath: string): LoggedCall[] {
  const raw = readFileSync(logPath, "utf8").trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as LoggedCall);
}

function findCallIndex(calls: LoggedCall[], name: string, matcher: (call: LoggedCall) => boolean): number {
  return calls.findIndex(call => call.name === name && matcher(call));
}

function runRelease(version: string, scenario: ReleaseScenario = {}) {
  const shimDir = mkdtempSync(join(tmpdir(), "ocx-release-helper-"));
  const logPath = join(shimDir, "release-log.jsonl");
  writeFileSync(logPath, "", "utf8");

  for (const name of ["bun", "gh", "git", "npm"] as const) {
    installCommandShim(shimDir, name);
  }

  const result = spawnSync(process.execPath, [releaseScriptPath, version], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${shimDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
      FAKE_RELEASE_LOG: logPath,
      FAKE_GIT_BRANCH: scenario.branch ?? "main",
      FAKE_GIT_HEAD_SHA: scenario.headSha ?? "abc123def456",
      ...(scenario.remoteHeadSha ? { FAKE_GIT_REMOTE_HEAD_SHA: scenario.remoteHeadSha } : {}),
      FAKE_BUN_TSC_EXIT_CODE: String(scenario.typecheckExitCode ?? 0),
      FAKE_BUN_TEST_EXIT_CODE: String(scenario.testExitCode ?? 0),
      FAKE_BUN_PRIVACY_EXIT_CODE: String(scenario.privacyExitCode ?? 0),
    },
    encoding: "utf8",
  });

  const calls = readLoggedCalls(logPath);
  rmSync(shimDir, { recursive: true, force: true });
  return { calls, result };
}

describe("release helper", () => {
  test("preflight runs typecheck, test suite, and privacy scan before version bump on main dry-runs", () => {
    const { calls, result } = runRelease("9.9.9");

    expect(result.status).toBe(0);

    const typecheckIndex = findCallIndex(calls, "bun", call => call.args.join(" ") === "x tsc --noEmit");
    const testIndex = findCallIndex(calls, "bun", call => call.args.join(" ") === "test --isolate tests");
    const privacyIndex = findCallIndex(calls, "bun", call => call.args.join(" ") === "run privacy:scan");
    const versionIndex = findCallIndex(calls, "npm", call => call.args.join(" ") === "version 9.9.9 --no-git-tag-version");
    const dispatchIndex = findCallIndex(calls, "gh", call =>
      call.args[0] === "workflow"
      && call.args[1] === "run"
      && call.args.includes("release.yml")
      && call.args.includes("tag=latest")
      && call.args.includes("dry-run=true"),
    );

    expect(typecheckIndex).toBeGreaterThanOrEqual(0);
    expect(testIndex).toBeGreaterThan(typecheckIndex);
    expect(privacyIndex).toBeGreaterThan(testIndex);
    expect(versionIndex).toBeGreaterThan(privacyIndex);
    expect(dispatchIndex).toBeGreaterThan(versionIndex);
  });

  test("failed privacy scan aborts before version bump, commit, and push", () => {
    const { calls, result } = runRelease("9.9.9", { privacyExitCode: 1 });

    expect(result.status).not.toBe(0);
    expect(findCallIndex(calls, "bun", call => call.args.join(" ") === "run privacy:scan")).toBeGreaterThanOrEqual(0);
    expect(findCallIndex(calls, "npm", call => call.args[0] === "version")).toBe(-1);
    expect(findCallIndex(calls, "git", call => call.args[0] === "commit")).toBe(-1);
    expect(findCallIndex(calls, "git", call => call.args[0] === "push")).toBe(-1);
  });

  test("preview branch still defaults to preview tag and dry-run dispatch", () => {
    const { calls, result } = runRelease("9.9.9-preview.1", { branch: "preview" });

    expect(result.status).toBe(0);
    expect(findCallIndex(calls, "gh", call =>
      call.args[0] === "workflow"
      && call.args[1] === "run"
      && call.args.includes("release.yml")
      && call.args.includes("tag=preview")
      && call.args.includes("dry-run=true"),
    )).toBeGreaterThanOrEqual(0);
  });

  test("dispatch pins the audited release SHA via expected-sha", () => {
    const { calls, result } = runRelease("9.9.9", { headSha: "deadbeefcafe1234" });

    expect(result.status).toBe(0);
    expect(findCallIndex(calls, "gh", call =>
      call.args[0] === "workflow"
      && call.args[1] === "run"
      && call.args.includes("release.yml")
      && call.args.includes("expected-sha=deadbeefcafe1234"),
    )).toBeGreaterThanOrEqual(0);
  });

  test("aborts before dispatch when the remote branch moved during the CI wait", () => {
    const { calls, result } = runRelease("9.9.9", {
      headSha: "abc123def456",
      remoteHeadSha: "9999999999999999999999999999999999999999",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("moved while waiting for CI");
    expect(findCallIndex(calls, "gh", call => call.args[0] === "workflow" && call.args[1] === "run")).toBe(-1);
  });
});
