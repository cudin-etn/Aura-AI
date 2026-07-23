#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { basename } from "node:path";

const knownCommands = new Set(["bun", "gh", "git", "npm"]);
const invokedAs = basename(process.argv[1]).replace(/\.(?:cmd|js)$/i, "");
const command = knownCommands.has(invokedAs) ? invokedAs : process.argv[2];
const args = process.argv.slice(knownCommands.has(invokedAs) ? 2 : 3);

appendFileSync(process.env.FAKE_RELEASE_LOG, JSON.stringify({ name: command, args }) + "\n");

const stdout = (text) => process.stdout.write(text);
const stderr = (text) => process.stderr.write(text);
const headSha = process.env.FAKE_GIT_HEAD_SHA ?? "abc123def456";

if (command === "bun") {
  const exitCode =
    args[0] === "x" && args[1] === "tsc" ? Number(process.env.FAKE_BUN_TSC_EXIT_CODE ?? "0")
    : args[0] === "test" && args[1] === "--isolate" && args[2] === "tests" ? Number(process.env.FAKE_BUN_TEST_EXIT_CODE ?? "0")
    : args[0] === "run" && args[1] === "privacy:scan" ? Number(process.env.FAKE_BUN_PRIVACY_EXIT_CODE ?? "0")
    : 0;

  if (exitCode !== 0) stderr(`fake bun failure: ${args.join(" ")}\n`);
  process.exit(exitCode);
}

if (command === "git") {
  const branch = process.env.FAKE_GIT_BRANCH ?? "main";

  if (args[0] === "rev-parse" && args[1] === "--abbrev-ref" && args[2] === "HEAD") {
    stdout(branch + "\n");
    process.exit(0);
  }
  if (args[0] === "status" && args[1] === "--porcelain") {
    stdout((process.env.FAKE_GIT_STATUS ?? "") + "\n");
    process.exit(0);
  }
  if (args[0] === "ls-remote") {
    if (args.some(arg => typeof arg === "string" && arg.startsWith("refs/heads/"))) {
      const branchRef = args.find(arg => typeof arg === "string" && arg.startsWith("refs/heads/"));
      stdout(`${process.env.FAKE_GIT_REMOTE_HEAD_SHA ?? headSha}\t${branchRef}\n`);
    }
    process.exit(0);
  }
  if (args[0] === "add" || args[0] === "commit" || args[0] === "push") process.exit(0);
  if (args[0] === "rev-parse" && args[1] === "HEAD") {
    stdout(headSha + "\n");
    process.exit(0);
  }
  if (args[0] === "rev-parse" && args[1]?.startsWith("origin/")) {
    stdout(headSha + "\n");
    process.exit(0);
  }

  stderr(`unexpected git args: ${args.join(" ")}\n`);
  process.exit(1);
}

if (command === "npm") {
  if (args[0] === "view") {
    stderr("npm ERR! code E404\n");
    process.exit(1);
  }
  if (args[0] === "version") process.exit(0);

  stderr(`unexpected npm args: ${args.join(" ")}\n`);
  process.exit(1);
}

if (command === "gh") {
  if (args[0] === "release" && args[1] === "view") {
    stderr("release not found\n");
    process.exit(1);
  }
  if (args[0] === "run" && args[1] === "list") {
    if (args.includes("ci.yml")) {
      stdout(JSON.stringify([{ conclusion: "success", databaseId: 7, headSha, status: "completed", url: "https://example.test/ci" }]));
      process.exit(0);
    }
    if (args.includes("service-lifecycle.yml")) {
      stdout(JSON.stringify([{ conclusion: "success", databaseId: 8, headSha, status: "completed", url: "https://example.test/service" }]));
      process.exit(0);
    }
    if (args.includes("release.yml")) {
      stdout(JSON.stringify([{ createdAt: new Date().toISOString(), databaseId: 9, headSha, status: "queued", url: "https://example.test/release" }]));
      process.exit(0);
    }
  }
  if (args[0] === "workflow" && args[1] === "run") process.exit(0);
  if (args[0] === "run" && args[1] === "watch") process.exit(0);

  stderr(`unexpected gh args: ${args.join(" ")}\n`);
  process.exit(1);
}

stderr(`unexpected fake release command: ${String(command)}\n`);
process.exit(1);
