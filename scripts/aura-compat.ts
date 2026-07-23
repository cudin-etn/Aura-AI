import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { loadConfig, resolveEnvValue } from "../src/config";
import {
  collectAuraCompatOutcome,
  compareAuraCompatOutcomes,
  gradeAuraCompatibility,
  materializeAuraCompatBody,
  type AuraCompatOutcome,
  type AuraCompatFixture,
} from "../src/compat/aura-ab";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const fixturePath = resolve(arg("--fixture") ?? "fixtures/aura/gpt56-basic.json");
const providerName = arg("--provider") ?? "9router";
const directModel = arg("--direct-model") ?? "cx/gpt-5.6-sol";
const proxyModel = arg("--proxy-model") ?? `${providerName}/cx-gpt-5.6-sol`;
const proxyBase = (arg("--proxy-base") ?? "http://127.0.0.1:10100/v1").replace(/\/+$/, "");
const outputPath = arg("--out");
const selectedCase = arg("--case");
const mode = arg("--mode") ?? "both";
const repeat = Number.parseInt(arg("--repeat") ?? "1", 10);
const dryRun = process.argv.includes("--dry-run");
if (!["both", "direct", "proxy"].includes(mode)) throw new Error("--mode must be both, direct, or proxy");
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error("--repeat must be an integer from 1 to 20");

const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as AuraCompatFixture;
if (fixture.version !== 1 || !Array.isArray(fixture.cases) || fixture.cases.length === 0) {
  throw new Error("fixture must be version 1 with at least one case");
}
const selectedCases = selectedCase
  ? fixture.cases.filter(testCase => testCase.id === selectedCase)
  : fixture.cases;
if (selectedCases.length === 0) throw new Error(`fixture case "${selectedCase}" was not found`);

const config = loadConfig();
const provider = config.providers[providerName];
if (!provider) throw new Error(`provider "${providerName}" is not configured`);
const directBase = provider.baseUrl.replace(/\/+$/, "");
const apiKey = resolveEnvValue(provider.apiKey);

async function proxyVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${proxyBase.replace(/\/v1$/, "")}/healthz`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json() as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

if (dryRun) {
  console.log(JSON.stringify({
    ok: true,
    fixture: relative(process.cwd(), fixturePath),
    cases: selectedCases.map(testCase => testCase.id),
    provider: providerName,
    directModel,
    proxyModel,
    mode,
    repeat,
  }, null, 2));
  process.exit(0);
}

async function execute(
  baseUrl: string,
  path: string,
  model: string,
  body: Record<string, unknown>,
  auth?: string,
  abortAfterMs?: number,
): Promise<AuraCompatOutcome> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), 120_000);
  const abort = abortAfterMs === undefined
    ? undefined
    : setTimeout(() => controller.abort("client_abort"), abortAfterMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(materializeAuraCompatBody(body, model)),
      signal: controller.signal,
    });
    const headersAt = performance.now();
    return collectAuraCompatOutcome(response, startedAt, headersAt);
  } catch (error) {
    const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
    return {
      httpStatus: 0,
      terminalStatus: null,
      eventTypes: [],
      outputDigest: null,
      outputChars: 0,
      toolNames: [],
      usage: null,
      error: controller.signal.reason === "client_abort"
        ? "client_abort"
        : error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      headersMs: elapsed,
      totalMs: elapsed,
    };
  } finally {
    clearTimeout(timeout);
    if (abort) clearTimeout(abort);
  }
}

const cases = [];
for (const testCase of selectedCases) {
  const path = testCase.path ?? "/responses";
  const direct = [];
  const proxy = [];
  const comparisons = [];
  for (let attempt = 0; attempt < repeat; attempt++) {
    const proxyOutcome = mode === "direct"
      ? undefined
      : await execute(proxyBase, path, proxyModel, testCase.body, undefined, testCase.abortAfterMs);
    const directOutcome = mode === "proxy"
      ? undefined
      : await execute(directBase, path, directModel, testCase.body, apiKey, testCase.abortAfterMs);
    if (proxyOutcome) proxy.push(proxyOutcome);
    if (directOutcome) direct.push(directOutcome);
    if (directOutcome && proxyOutcome) comparisons.push(compareAuraCompatOutcomes(directOutcome, proxyOutcome));
  }
  cases.push({
    id: testCase.id,
    ...(testCase.expect ? { expect: testCase.expect } : {}),
    ...(direct.length ? { direct } : {}),
    ...(proxy.length ? { proxy } : {}),
    ...(comparisons.length ? { comparisons } : {}),
  });
}

const outcomesPass = cases.every(testCase => {
  const outcomes = mode === "direct" ? testCase.direct : testCase.proxy;
  return !!outcomes?.length && outcomes.every(outcome => {
    if (testCase.expect?.aborted) return outcome.httpStatus === 0 && outcome.error === "client_abort";
    if (testCase.expect?.status !== undefined && outcome.httpStatus !== testCase.expect.status) return false;
    if (testCase.expect?.status === undefined && (outcome.httpStatus < 200 || outcome.httpStatus >= 300)) return false;
    return testCase.expect?.error === undefined || Boolean(outcome.error) === testCase.expect.error;
  });
});
const completeSuite = selectedCases.length === fixture.cases.length;
const capability = mode === "direct" || !completeSuite
  ? null
  : gradeAuraCompatibility(cases, provider.compactMode === "synthetic");
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  fixture: relative(process.cwd(), fixturePath),
  provider: providerName,
  directModel,
  proxyModel,
  proxyVersion: await proxyVersion(),
  mode,
  repeat,
  capability,
  compatible: outcomesPass
    && (!capability || capability.grade === "Native" || capability.grade === "Compatible"),
  cases,
};
const json = JSON.stringify(report, null, 2) + "\n";
if (outputPath) {
  const target = resolve(outputPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, json, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(json);
process.exitCode = report.compatible ? 0 : 1;
