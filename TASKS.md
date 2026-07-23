# Aura AI — Execution Backlog

Status: Draft for approval  
Date: 2026-07-23

Priority:

- P0: blocks the next milestone or protects user data.
- P1: required for MVP.
- P2: valuable after the core workflow is stable.

## M0 — Upstream Baseline

- [ ] `FND-001` P0 Fork OpenCodex into this repository and preserve its MIT
  license, notices, tags, and commit history.
  - Done when: `origin` points to our repository, `upstream` points to OpenCodex,
    and upstream tags are visible.

- [x] `FND-002` P0 Document and run the exact baseline toolchain.
  - Depends on: `FND-001`.
  - Done when: install, typecheck, tests, GUI build/lint/doctor, privacy scan,
    and package build run from a clean checkout.

- [x] `FND-003` P0 Record baseline behavior and known failures.
  - Depends on: `FND-002`.
  - Done when: Codex, Claude Code, direct 9router, and OpenCodex-to-9router smoke
    results are recorded with versions and sanitized logs.

- [x] `FND-004` P1 Add an upstream-sync procedure.
  - Depends on: `FND-001`.
  - Done when: one documented command sequence fetches upstream and runs the
    regression gate before merge.

## M1 — Observability and Compatibility

- [x] `OBS-001` P0 Define a sanitized request, route, usage, and task-result
  schema.
  - Done when: secrets and raw private prompts are excluded by default.

- [x] `OBS-002` P0 Add request and thread correlation IDs across adapters.
  - Depends on: `OBS-001`.
  - Done when: one task can be traced from client request to provider response.

- [x] `OBS-003` P1 Normalize cached, uncached, output, reasoning, latency, retry,
  and quota measurements.
  - Depends on: `OBS-001`.

- [x] `CMP-001` P0 Capture sanitized protocol fixtures for GPT-5.6 streaming,
  tools, compact, cancellation, and error cases.
  - Depends on: `FND-003`, `OBS-001`.

- [x] `CMP-002` P0 Build a direct-versus-compatibility A/B runner.
  - Depends on: `CMP-001`, `OBS-002`.
  - Done when: direct 9router and OpenCodex-to-9router can run the same fixture
    and produce a machine-readable diff.

- [x] `CMP-003` P1 Implement capability grades and failure reasons.
  - Depends on: `CMP-002`.

## M2 — Generic Core

- [ ] `CORE-001` P0 Freeze public behavior with regression tests before moving
  modules.

- [ ] `CORE-002` P0 Extract protocol interfaces for Responses, Chat
  Completions, and Messages.
  - Depends on: `CORE-001`.

- [ ] `CORE-003` P0 Extract provider discovery, authentication, and capability
  interfaces.
  - Depends on: `CORE-001`.

- [ ] `CORE-004` P0 Extract client configuration and lifecycle interfaces.
  - Depends on: `CORE-001`.

- [ ] `CLT-001` P0 Move existing Codex behavior behind the Codex client adapter
  without behavior changes.
  - Depends on: `CORE-002`, `CORE-004`.

- [ ] `CLT-002` P1 Move existing Claude Code behavior behind the Claude client
  adapter without behavior changes.
  - Depends on: `CORE-002`, `CORE-004`.

- [ ] `CLT-003` P1 Add an OpenCode adapter for endpoint/model configuration and
  restore.
  - Depends on: `CORE-004`, `PRV-001`.

- [ ] `CLT-004` P2 Run a ZCode integration spike and document supported,
  unsupported, and unstable surfaces.
  - Done when: no production promise remains based on assumptions.

## M3 — Provider and Client GUI

- [ ] `PRV-001` P0 Define the generic provider/account/model configuration
  schema and migrations.

- [ ] `PRV-002` P1 Implement direct OpenAI, Anthropic, xAI, OpenRouter, custom
  OpenAI-compatible, and optional 9router upstream presets.
  - Depends on: `PRV-001`, `CORE-003`.

- [ ] `PRV-003` P1 Implement model discovery, normalization, deduplication, and
  capability probes.
  - Depends on: `PRV-002`, `CMP-003`.

- [ ] `CFG-001` P0 Implement atomic config backup, preview, apply, verification,
  rollback, and restore.
  - Done when: an interrupted write cannot destroy a client's original config.

- [ ] `GUI-001` P1 Build Add Provider and authentication flow.
  - Depends on: `PRV-002`, `CFG-001`.

- [ ] `GUI-002` P1 Build model selection, compatibility report, and role
  assignment.
  - Depends on: `PRV-003`.

- [ ] `GUI-003` P1 Build Connect Clients with Codex, Claude Code, and OpenCode
  toggles.
  - Depends on: `CLT-001`, `CLT-002`, `CLT-003`, `CFG-001`.

- [ ] `GUI-004` P1 Build health, configuration diff, apply, restore, and
  diagnostics views.
  - Depends on: `CFG-001`, `OBS-002`.

## M4 — Smart Profiles and Routing

- [ ] `POL-001` P0 Define universal roles and model capability requirements.

- [ ] `POL-002` P1 Implement Saver, Balanced, and Quality profile schemas.
  - Depends on: `POL-001`.

- [ ] `POL-003` P0 Implement sticky parent model and account affinity per
  thread.
  - Depends on: `OBS-002`.

- [ ] `POL-004` P1 Implement role-based subagent model selection.
  - Depends on: `POL-001`, `POL-003`.

- [ ] `POL-005` P1 Implement deterministic escalation after defined risk or
  verification signals.
  - Depends on: `POL-004`.

- [ ] `POL-006` P1 Implement safe retry, same-model account failover, circuit
  breaker, and compatible fallback.
  - Depends on: `PRV-003`, `POL-003`.

- [ ] `POL-007` P1 Add concurrency and per-task budget limits.
  - Depends on: `POL-004`.

- [ ] `GUI-005` P1 Build profile picker, advanced role editor, manual override,
  and route trace.
  - Depends on: `POL-002` through `POL-007`.

## M5 — Token Optimizer

- [ ] `OPT-001` P0 Establish unoptimized benchmark baselines before enabling any
  transformation.
  - Depends on: `OBS-003`, `EVAL-001`.

- [ ] `OPT-002` P1 Implement repeated-output deduplication.
  - Depends on: `OPT-001`.

- [ ] `OPT-003` P1 Implement bounded log reduction with local full-output
  retrieval.
  - Depends on: `OPT-001`.

- [ ] `OPT-004` P1 Implement per-role context budgets and unchanged-content
  suppression.
  - Depends on: `OPT-001`.

- [ ] `OPT-005` P0 Add protected-content rules for source, migrations, security
  evidence, and unresolved errors.
  - Depends on: `OPT-002`, `OPT-003`, `OPT-004`.

- [ ] `GUI-006` P1 Show cache rate, normalized cost, saved tokens, optimization
  actions, and retrieval links.
  - Depends on: `OBS-003`, `OPT-002` through `OPT-005`.

## M6 — Evaluation and Release

- [ ] `EVAL-001` P0 Define a representative benchmark corpus with trivial,
  routine, debugging, architecture, security, and large-repository tasks.

- [ ] `EVAL-002` P0 Implement repeatable task scoring and verification.
  - Depends on: `EVAL-001`, `OBS-003`.

- [ ] `EVAL-003` P0 Compare always-Sol, Saver, Balanced, and Quality using cost
  per successful task.
  - Depends on: `EVAL-002`, `POL-002`, `OPT-005`.

- [ ] `SEC-001` P0 Threat-model credentials, local APIs, config writes, logs,
  OAuth callbacks, and provider-controlled content.

- [ ] `SEC-002` P0 Test secret redaction, localhost binding, CSRF/origin rules,
  path safety, config rollback, and migration recovery.
  - Depends on: `SEC-001`, `CFG-001`, `OBS-001`.

- [ ] `REL-001` P1 Package and verify first-class macOS and Windows releases.
  - Done when: clean install, update, background service, restart, config
    restore, and uninstall pass on both platforms.

- [ ] `REL-002` P1 Document install, provider onboarding, client connection,
  profiles, route trace, recovery, and OpenCodex migration.

- [ ] `REL-003` P1 Verify Aura AI naming, package identifiers, executable names,
  repository names, and release metadata before public distribution.

- [ ] `REL-004` P2 Verify Linux CLI, service lifecycle, package, and recovery
  after the macOS and Windows release gates pass.

## Initial Execution Order

Start with one baseline sprint:

1. `FND-001`
2. `FND-002`
3. `FND-003`
4. `OBS-001`
5. `CMP-001`
6. `CMP-002`
7. `FND-004`

Do not start GUI redesign, smart routing, provider expansion, or compression
before this sequence passes. The first deliverable is evidence that the fork is
reproducible and that GPT-5.6 direct failures can be diagnosed mechanically.

## Current progress

- `FND-001`: local history, tags, license, `upstream`, and `codex/aura-ai` are
  complete. It remains open only because no Aura repository URL exists for
  `origin`.
- `FND-002` through `FND-004`: complete; see
  `docs/aura/baseline.md` and `docs/aura/upstream-sync.md`.
- `OBS-001` through `CMP-003`: complete; see
  `docs/aura/observability.md`, `docs/aura/compatibility.md`, and the sanitized
  live report in `docs/aura/gpt56-9router-compat.json`.
- Next: freeze the generic-core public behavior before extracting client and
  protocol boundaries.
