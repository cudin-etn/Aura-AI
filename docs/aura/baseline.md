# Aura AI baseline

Date: 2026-07-23

## Source

- Upstream: `https://github.com/lidge-jun/opencodex.git`
- Imported tag: `v2.7.36`
- Imported commit: `9eb3df544a5e4471bd3e35969bf21328f92eea20`
- Aura branch: `codex/aura-ai`
- Local runtime under test: Bun `1.3.14`, Node `26.4.0`, macOS arm64
- Installed proxy used for live smoke tests: OpenCodex `2.7.33`
- Clients found: Codex CLI `0.145.0-alpha.30`, Claude Code `2.1.201`

The local branch preserves upstream history, tags, MIT license, and the
`upstream` remote. Publishing remains blocked only by the absence of an Aura
repository URL for `origin`.

## Verification

| Gate | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Pass |
| `gui: bun install --frozen-lockfile` | Pass |
| `bun run typecheck` | Pass |
| `bun run test` | Pass: 3,788 tests, 0 failures |
| `bun run lint:gui` | Pass |
| `bun run build:gui` | Pass; existing ~999 kB JS chunk warning |
| `bun run privacy:scan` | Pass |
| `npm pack --dry-run --json` | Pass |
| `bun run doctor:gui:full` | Completed; 212 inherited findings, including 3 errors |

The first full test run exposed a Bun/macOS test-helper race: dynamically
created executable command shims intermittently failed with `EACCES`. The
helper now uses one stable fixture plus symlinks on POSIX, reducing duplicated
test code and making the full suite deterministic.

React Doctor's three inherited errors are impure React state updaters in
`AddCodexAccountModal.tsx` and `Models.tsx`. They are recorded as baseline GUI
debt and are not caused by Aura changes.

## Live GPT-5.6 smoke

Sanitized payload: one non-streaming Responses request asking for the exact
text `OK`, using Sol at low reasoning effort.

| Path | HTTP | Result | Input | Output | Total time |
| --- | ---: | --- | ---: | ---: | ---: |
| Direct 9router `cx/gpt-5.6-sol` | 200 | `completed`, `OK` | 2,489 | 5 | 1,632 ms |
| OpenCodex → 9router `9router/cx/gpt-5.6-sol` | 200 | `completed`, `OK` | 2,489 | 5 | 3,280 ms |

This single request proves basic non-streaming parity, not general performance.
Streaming, tool calls, compact/resume, cancellation, and repeated samples
remain compatibility-suite work.

## Current local state

- OpenCodex proxy is healthy on loopback port `10100`.
- 9router is reachable on loopback port `20128`.
- Model discovery exposes Sol, Terra, and Luna through both paths.
- Codex restart safety is currently at risk because neither the service nor the
  autostart shim is installed.
- The configured 9router credential was inspected only for presence and used
  in-memory; it was never printed or written to project files.

## Reuse versus Aura work

OpenCodex already provides:

- provider GUI, presets, OAuth/key auth, model discovery, and connection tests;
- Codex and Claude Code protocol/client support;
- account pools, quota-aware affinity, cooldown, and failover;
- combo failover and weighted round-robin;
- subagent model selection, injection model, effort caps, and concurrency;
- request IDs, usage JSONL, retries/attempts, TTFT, cache tokens, and cost views;
- atomic writes, Codex journal restore, macOS/Linux/Windows services, and npm
  packaging.

Aura should add only the missing product layer:

- named Saver/Balanced/Quality profiles;
- universal role assignments and deterministic profile compilation into the
  existing OpenCodex controls;
- route-decision records explaining profile, role, fallback, and escalation;
- capability grades and repeatable direct-versus-proxy fixtures;
- GUI onboarding that combines provider, model, role, and client setup;
- benchmark scoring and release evidence for macOS and Windows;
- Aura naming/package identifiers after behavior stabilizes.

