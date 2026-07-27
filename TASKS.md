# Aura AI — Execution Backlog

Status: In progress
Date: 2026-07-23
Updated: 2026-07-25

Current M7 progress: CAT-001, CLT-008 through CLT-014, OPT-006, OPT-008, UX-009 through UX-012, and
SEC-003 are complete. Claude Desktop
now has a guarded backend/UI apply path with static/hybrid/discovery selection,
backup, atomic write, verification, and restore tests; CLT-015 remains
open until real macOS Desktop
compatibility/restart evidence are recorded.

Priority:

- P0: blocks the next milestone or protects user data.
- P1: required for MVP.
- P2: valuable after the core workflow is stable.

## M0 — Upstream Baseline

- [x] `FND-001` P0 Fork OpenCodex into this repository and preserve its MIT
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

- [x] `CORE-001` P0 Freeze public behavior with regression tests before moving
  modules.

- [x] `CORE-002` P0 Extract protocol interfaces for Responses, Chat
  Completions, and Messages.
  - Depends on: `CORE-001`.

- [x] `CORE-003` P0 Extract provider discovery, authentication, and capability
  interfaces.
  - Depends on: `CORE-001`.

- [x] `CORE-004` P0 Extract client configuration and lifecycle interfaces.
  - Depends on: `CORE-001`.

- [x] `CLT-001` P0 Move existing Codex behavior behind the Codex client adapter
  without behavior changes.
  - Depends on: `CORE-002`, `CORE-004`.

- [x] `CLT-002` P1 Move existing Claude Code behavior behind the Claude client
  adapter without behavior changes.
  - Depends on: `CORE-002`, `CORE-004`.

- [x] `CLT-003` P1 Add an OpenCode adapter for endpoint/model configuration and
  restore.
  - Depends on: `CORE-004`, `PRV-001`.

- [x] `CLT-004` P2 Run a ZCode integration spike and document supported,
  unsupported, and unstable surfaces.
  - Done when: no production promise remains based on assumptions.

- [x] `CLT-005` P1 Add a guarded Factory Droid adapter for the documented
  `customModels` settings schema, including preview, backup, verification, and
  restore without overwriting later user edits.
  - Depends on: `CLT-003`, `CFG-001`.

- [x] `CLT-006` P1 Turn ZCode's verified manual flow into a guided onboarding
  path with protocol, endpoint, model, authentication, and recovery steps.
  - Depends on: `CLT-004`, `GUI-003`.

- [x] `CLT-007` P1 Add a generic AI-agent compatibility guide for Responses,
  Chat Completions, and Messages clients, with copy-ready local Aura endpoints.
  - Depends on: `CORE-002`, `GUI-004`.

- [x] `CAP-001` P1 Add a capability registry and GUI matrix for Chat, Image,
  Vision, and Web Search, while marking unsupported 9Router-inspired surfaces
  as planned.
  - Depends on: `CORE-002`, `PRV-003`.

- [x] `CAP-002` P1 Expose measured Token Saver presets and safe optimizer
  controls from Aura Setup.
  - Depends on: `OPT-002` through `OPT-005`, `GUI-006`.

- [x] `ONB-002` P1 Include Factory Droid, ZCode, and generic compatible
  agents in the Quick Setup Wizard, with auto-apply or explicit manual-guide
  handoff.
  - Depends on: `CLT-005` through `CLT-007`, `ONB-001`.

## M2.5 — Aura UX Foundation

- [x] `UX-001` P0 Define product personality, information architecture, and
  visual design dials before restructuring the GUI.
  - Done when: the five primary areas and legacy-page mapping are documented.

- [x] `UX-002` P0 Build the five-area application shell while preserving all
  existing hashes and management actions.

- [x] `UX-003` P1 Add Aura light/dark design tokens and reusable navigation
  primitives inspired by the approved visual reference.

- [x] `UX-004` P1 Verify responsive navigation, keyboard focus, all locales,
  and representative legacy pages.

- [x] `UX-005` P1 Add selectable Focus and Canvas workspace layouts.
  - Done when: Focus preserves a readable single-column flow, Canvas expands
    cards responsively, both persist, and neither creates mobile overflow.

- [x] `UX-006` P1 Move contextual navigation into icon-labelled pill controls
  and place page content on a rounded elevated workspace surface.

- [x] `UX-007` P1 Complete Vietnamese coverage and add functional routing,
  profile, and token-saving visuals with reduced-motion support.
  - Done when: every English key has a Vietnamese value with matching
    placeholders and the locale cannot silently fall back to English.

- [x] `UX-008` P1 Split the 9Router-inspired capability hub and Token Saver
  controls into dedicated Setup and Routing pages while keeping Overview as a
  compact summary.
  - Done when: one canonical page owns each control and navigation remains
    inside the five-area information architecture.

## M3 — Provider and Client GUI

- [x] `PRV-001` P0 Define the generic provider/account/model configuration
  schema and migrations.

- [x] `PRV-002` P1 Implement direct OpenAI, Anthropic, xAI, OpenRouter, custom
  OpenAI-compatible, and optional 9router upstream presets.
  - Depends on: `PRV-001`, `CORE-003`.

- [x] `PRV-003` P1 Implement model discovery, normalization, deduplication, and
  capability probes.
  - Depends on: `PRV-002`, `CMP-003`.

- [x] `CFG-001` P0 Implement atomic config backup, preview, apply, verification,
  rollback, and restore.
  - Done when: an interrupted write cannot destroy a client's original config.

- [x] `GUI-001` P1 Build Add Provider and authentication flow.
  - Depends on: `PRV-002`, `CFG-001`.

- [x] `GUI-002` P1 Build model selection, compatibility report, and role
  assignment.
  - Depends on: `PRV-003`.

- [x] `GUI-003` P1 Build Connect Clients with Codex, Claude Code, OpenCode,
  Factory Droid, ZCode guided setup, and a generic compatibility flow.
  - Depends on: `CLT-001` through `CLT-007`, `CFG-001`.

- [x] `GUI-004` P1 Build health, configuration diff, apply, restore, and
  diagnostics views.
  - Depends on: `CFG-001`, `OBS-002`.

- [x] `ONB-001` P1 Build a unified provider, model, client, and routing-profile
  setup wizard with connection testing and a final review step.
  - Depends on: `GUI-001` through `GUI-004`.

## M4 — Smart Profiles and Routing

- [x] `POL-001` P0 Define universal roles and model capability requirements.

- [x] `POL-002` P1 Implement Saver, Balanced, and Quality profile schemas.
  - Depends on: `POL-001`.

- [x] `POL-003` P0 Implement sticky parent model and account affinity per
  thread.
  - Depends on: `OBS-002`.

- [x] `POL-004` P1 Implement role-based subagent model selection.
  - Depends on: `POL-001`, `POL-003`.

- [x] `POL-005` P1 Implement deterministic escalation after defined risk or
  verification signals.
  - Depends on: `POL-004`.

- [x] `POL-006` P1 Implement safe retry, same-model account failover, circuit
  breaker, and compatible fallback.
  - Depends on: `PRV-003`, `POL-003`.

- [x] `POL-007` P1 Add concurrency and per-task budget limits.
  - Depends on: `POL-004`.

- [x] `GUI-005` P1 Build profile picker, advanced role editor, manual override,
  and route trace.
  - Depends on: `POL-002` through `POL-007`.

## M5 — Token Optimizer

- [x] `OPT-001` P0 Establish unoptimized benchmark baselines before enabling any
  transformation.
  - Depends on: `OBS-003`, `EVAL-001`.

- [x] `OPT-002` P1 Implement repeated-output deduplication.
  - Depends on: `OPT-001`.

- [x] `OPT-003` P1 Implement bounded log reduction with local full-output
  retrieval.
  - Depends on: `OPT-001`.

- [x] `OPT-004` P1 Implement per-role context budgets and unchanged-content
  suppression.
  - Depends on: `OPT-001`.

- [x] `OPT-005` P0 Add protected-content rules for source, migrations, security
  evidence, and unresolved errors.
  - Depends on: `OPT-002`, `OPT-003`, `OPT-004`.

- [x] `GUI-006` P1 Show cache rate, normalized cost, saved tokens, optimization
  actions, and retrieval links.
  - Depends on: `OBS-003`, `OPT-002` through `OPT-005`.

## M6 — Evaluation and Release

- [x] `EVAL-001` P0 Define a representative benchmark corpus with trivial,
  routine, debugging, architecture, security, and large-repository tasks.

- [x] `EVAL-002` P0 Implement repeatable task scoring and verification.
  - Depends on: `EVAL-001`, `OBS-003`.

- [ ] `EVAL-003` P0 Compare always-Sol, Saver, Balanced, and Quality using cost
  per successful task.
  - Depends on: `EVAL-002`, `POL-002`, `OPT-005`.

- [x] `SEC-001` P0 Threat-model credentials, local APIs, config writes, logs,
  OAuth callbacks, and provider-controlled content.

- [x] `SEC-002` P0 Test secret redaction, localhost binding, CSRF/origin rules,
  path safety, config rollback, and migration recovery.
  - Depends on: `SEC-001`, `CFG-001`, `OBS-001`.

- [ ] `REL-001` P1 Package and verify first-class macOS and Windows releases.
  - Done when: clean install, update, background service, restart, config
    restore, and uninstall pass on both platforms.

- [x] `REL-002` P1 Document install, provider onboarding, client connection,
  profiles, route trace, recovery, and OpenCodex migration.

- [x] `REL-003` P1 Verify Aura AI naming, package identifiers, executable names,
  repository names, and release metadata before public distribution.

- [ ] `REL-004` P2 Verify Linux CLI, service lifecycle, package, and recovery
  after the macOS and Windows release gates pass.

## M7 — Client Federation and Optimizer Hardening

- [x] `CAT-001` P0 Define one exportable Aura model-catalog contract containing
  protocol, tools, streaming, reasoning, modality, context, compatibility grade,
  provider/account route, and per-client representability.
  - Done when: client adapters consume one catalog and cannot silently export
    Failed or protocol-incompatible models.

- [x] `CLT-008` P0 Define the bulk client-configuration lifecycle: detect,
  select all compatible models, choose a default, preview, backup, atomic apply,
  verify, reconnect/update, and guarded restore.
  - Depends on: `CAT-001`, `CFG-001`.

- [x] `CLT-009` P0 Upgrade OpenCode from one-model apply to full compatible
  `provider.aura.models` export with a separately selected default model.
  - Done when: one Connect action registers all compatible Aura models, preserves
    unrelated OpenCode providers/settings, and restore refuses to clobber later
    user edits.
  - Depends on: `CLT-008`.

- [x] `CLT-010` P1 Upgrade Factory Droid to export every model its documented
  `customModels` schema can represent, with deduplication and one explicit
  default/recommended model where the client supports it.
  - Depends on: `CLT-008`.

- [x] `CLT-011` P1 Verify Cursor's current configuration and model surfaces,
  then implement the safest supported auto-config or a guided fallback without
  relying on private schema assumptions.
  - Depends on: `CAT-001`, `CLT-008`.

- [x] `CLT-012` P1 Verify and add Kiro and Antigravity client tracks, keeping
  provider OAuth/transport support separate from coding-client configuration.
  - Done when: each client is labelled Auto, Partial, or Guided with a tested
    connection path and recovery instructions.
  - Depends on: `CAT-001`, `CLT-008`.

- [x] `CLT-013` P2 Add evidence-backed templates for Cline, Roo Code, Continue,
  Kilo Code, Droid, OpenClaw, and generic Responses/Chat/Messages agents.
  - Depends on: `CAT-001`, `CLT-008`.

- [x] `CLT-014` P0 Freeze Claude Code CLI behavior with protocol, OAuth,
  environment, model-slot, compact, streaming, and auto-connect regression
  fixtures before changing Claude presentation.
  - Done when: all existing Claude Code CLI behavior is covered independently
    from Claude Desktop.

- [ ] `CLT-015` P1 Productize the existing Claude Desktop 3P foundation with
  installation detection, static/hybrid/discovery preview, Aura naming, config
  backup, atomic apply, verification, guarded restore, and macOS compatibility
  evidence.
  - Depends on: `CLT-014`, `CAT-001`, `CFG-001`.
  - Done when: Claude Desktop can receive all representable Aura models without
    changing Claude Code CLI state or native Anthropic passthrough behavior.

- [x] `OPT-006` P0 Formalize Token Saver Off/Safe/Full/Ultra behavior by route,
  protocol, content class, and client surface; do not infer safety from model
  names alone.
  - Depends on: `CAT-001`, `OPT-005`.

- [ ] `OPT-007` P0 Add a separately gated Safe Native experiment for canonical
  Codex/OpenAI paths that never rewrites encrypted, signed, compact, source,
  migration, security, image, patch, or unresolved-error content.
  - Done when: disabled remains the default until protocol fixtures and quality
    benchmarks prove no behavior or cache regression.
  - Depends on: `CLT-014`, `OPT-006`, `CMP-001`.

- [x] `OPT-008` P1 Detect or declare downstream token compression and prevent
  accidental double optimization through 9router or another optimizer.
  - Depends on: `OPT-006`.

- [ ] `EVAL-004` P0 Benchmark Token Saver modes on eligible routed clients and
  Safe Native fixtures, recording real optimizer actions, saved input tokens,
  cache effects, latency, cost/quota, and task-quality deltas.
  - Depends on: `OPT-006` through `OPT-008`, `EVAL-003`.

- [x] `UX-009` P0 Replace clipped in-card dropdowns with accessible portal-based
  searchable popovers that collision-flip, scroll independently, and support
  keyboard navigation and reduced motion.

- [x] `UX-010` P1 Add a model multi-select with provider grouping, compatibility
  reasons, Select All Compatible, selection count, and separate default-model
  control for client connection flows.
  - Depends on: `CAT-001`, `UX-009`.

- [x] `UX-011` P1 Differentiate active parent, expanded parent, and active child
  sidebar states; label the Claude switch explicitly as Claude Code CLI and keep
  its behavior unchanged.
  - Depends on: `CLT-014`.

- [x] `UX-012` P1 Build the one-action client review surface showing detected
  app/config path, Auto/Partial/Guided grade, compatible/excluded model counts,
  default model, exact changes, connection test, and restore point.
  - Depends on: `CLT-008`, `UX-010`.

- [x] `SEC-003` P0 Extend the threat model and tests for client discovery,
  third-party config paths, model-list injection, local endpoint credentials,
  downstream optimizers, and Claude Desktop configuration.
  - Depends on: `CLT-008`, `CLT-015`, `OPT-008`.

- [ ] `REL-005` P1 Publish the next Aura preview only after M7 focused tests,
  full regression, privacy scan, package smoke, and exact-SHA macOS/Windows/Linux
  CI are green.
  - Depends on: `CLT-009`, `CLT-014`, `OPT-006`, `UX-009`, `UX-011`, `SEC-003`.

## M8 — Integration Hub and Agent Federation

- [x] `INT-001` P0 Define the normalized integration registry contract for
  service identity, auth mode, scopes, project selection, capabilities,
  upstream transport, and Auto/Partial/Guided client grades.
- [ ] `INT-002` P0 Add secret-safe connection metadata storage and migrations;
  credentials must use the platform secret store or existing OAuth store and
  must never appear in DTOs, logs, previews, or route traces.
- [ ] `INT-003` P0 Add a local Aura MCP gateway contract that can expose enabled
  upstream integration tools without leaking provider credentials to clients.
- [ ] `INT-004` P1 Add official-source connectors for GitHub, Supabase, Firebase,
  and Vercel with OAuth, scope review, project selection, health checks, and
  revoke actions.
- [ ] `INT-005` P1 Add Neon/PostgreSQL, Netlify, Cloudflare, Sentry, and Logtail
  connector tracks with the same normalized lifecycle.
- [ ] `INT-006` P2 Add Linear, Jira, Notion, Slack, and Discord connector tracks
  with explicit read/write capability boundaries.
- [ ] `INT-007` P0 Add agent discovery and integration export contracts for
  Codex, Claude Code/Desktop, OpenCode, Cursor, Kiro, Cline/Roo/Continue, and
  generic MCP clients.
- [ ] `INT-008` P0 Implement one reviewable Apply action: detect, preview,
  backup, write, verify, reconnect, and guarded restore.
- [ ] `INT-009` P1 Add permission center with Read, Write, Deploy, Migration,
  and Admin scopes plus per-agent approval policy.
- [ ] `INT-010` P1 Add integration audit events, health status, disconnect, and
  revoke flows without logging secrets or private payloads.

## M9 — Structured Warmth UI Refresh

- [x] `UX-013` P0 Translate the Structured Warmth reference into Aura semantic
  tokens without importing Chia Tiền language, data, workflows, or motifs.
- [ ] `UX-014` P0 Rework the application shell so the sidebar blends into the
  canvas and the content area is a capped rounded panel with internal scroll.
- [ ] `UX-015` P1 Rebalance parent/child navigation, contextual sidebars, active
  states, tab hierarchy, and page transitions without layout jitter.
- [ ] `UX-016` P1 Refresh typography, Vietnamese glyph fallbacks, spacing,
  radii, shadows, focus rings, status colors, and reduced-motion behavior.
- [ ] `UX-017` P1 Add responsive Focus/Canvas rules for Home, Setup, Routing,
  Insights, Settings, and Integrations at 375/768/1280px and 200% zoom.
- [ ] `UX-018` P1 Rework selectors, dialogs, empty/error/loading/success states,
  and integration permission surfaces for keyboard and screen-reader use.
- [ ] `UX-019` P1 Add visual QA coverage for light/dark themes, long Vietnamese
  translations, narrow windows, and forced-colors/high-contrast behavior.

## M10 — Focused Aura Intelligence

- [x] `AUR-001` P0 Add an opt-in GPT-only router with Manual, Auto Safe, and
  Auto Adaptive modes. Selection is deterministic at request boundaries,
  preserves explicit risk/verification escalation, and records its reason.
- [x] `AUR-002` P0 Surface a human-readable route explanation in Insights logs;
  reuse the existing token/concurrency guard, account affinity, key failover,
  and circuit/cooldown recovery instead of creating competing mechanisms.
- [x] `AUR-003` P1 Make Integration Hub catalog status truthful: MCP export is
  usable now, while upstream connectors remain clearly marked as catalog work
  until OAuth/project-health/revoke handlers exist.
- [ ] `AUR-004` P1 Add measured adaptive inputs (price, latency, throughput,
  quota health) after a live benchmark corpus exists; do not claim optimisation
  from static model-name heuristics.
- [ ] `AUR-005` P1 Move uncommon subscription OAuth bridges into an Advanced /
  Labs provider surface while retaining Custom and local providers.

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

- `FND-001`: complete. `origin` points to
  `https://github.com/cudin-etn/Aura-AI`, `upstream` remains OpenCodex, and the
  public `dev` and `codex/aura-ai` branches preserve the fork history.
- `FND-002` through `FND-004`: complete; see
  `docs/aura/baseline.md` and `docs/aura/upstream-sync.md`.
- `OBS-001` through `CMP-003`: complete; see
  `docs/aura/observability.md`, `docs/aura/compatibility.md`, and the sanitized
  live report in `docs/aura/gpt56-9router-compat.json`.
- `CORE-001` through `CLT-004`: complete; see
  `docs/aura/client-core.md`. The isolated full regression gate passes 3,842
  tests, and Aura Setup exposes the client registry without changing the
  inherited Codex and Claude protocol behavior.
- `CLT-005` through `CLT-007`: complete. Factory Droid now has guarded
  auto-configuration; ZCode and other compatible coding agents have a
  copy-ready manual guide with explicit protocol and authentication steps.
- `CAP-001` and `CAP-002`: complete. Setup → Capabilities exposes a truthful
  capability matrix; Routing → Optimization owns behaviorally distinct
  Lite/Full/Ultra Token Saver controls backed by the measured optimizer.
- `ONB-002`: complete. Quick Setup now covers all supported client paths and
  clearly separates automatic configuration from manual completion.
- `UX-001` through `UX-008`: complete; see `docs/aura/ux-foundation.md`. The
  five-area shell preserves legacy hashes, adds persistent Focus/Canvas
  workspaces, icon pill navigation, a visually guided setup/profile/optimizer
  flow, complete Vietnamese coverage, and desktop/mobile browser verification.
- `PRV-001` through `PRV-003`, `CFG-001`, `GUI-001`, and `GUI-002`: complete; see
  `docs/aura/provider-core.md`. Aura reuses the normalized provider registry,
  adds a first-class 9router preset with synthetic GPT-5.6 compact, and protects
  client configuration with preview, atomic apply, verification, rollback, and
  guarded restore. Provider model views expose declared protocol/capability
  metadata and a live discovery probe; Routing exposes profile and per-role
  model assignment.
- `GUI-003`, `GUI-004`, and `ONB-001`: complete. Setup → Clients now shows Codex,
  Claude Code, OpenCode, Factory Droid, ZCode, and a generic agent surface;
  exposes guarded auto-config where the client schema is known and a guided
  manual path elsewhere. Aura Setup adds a four-step provider/model/client/
  profile wizard with provider-aware model selection, connection testing, and a
  non-mutating review step.
- `INT-001`: complete. Aura now has one secret-free registry for 17 initial
  developer-service integrations, including auth modes, capabilities, upstream
  transport, and Auto/Partial/Guided client grades. The management API exposes
  the catalog and guarded pending-connection metadata without returning
  credentials. `INT-002` remains open until platform-vault credential storage
  and migrations are implemented.
- `INT-002`: local-vault groundwork is complete. Prepared connections now keep
  only an opaque secret reference in `config.json`; API-key material is written
  atomically to a separate hardened vault file and is revoked on connection
  removal. Native platform-keychain backends, migrations, and connector OAuth
  completion remain open before this task can be closed.
- `INT-003` and `INT-007`: the first shared export path is complete. Aura now
  provides `aura mcp`, a real local stdio MCP server with read-only integration
  status tools, plus a credential-free export contract and copy-ready client
  declaration in Setup → Integrations. Upstream execution tools and the
  guarded per-client Apply lifecycle remain open before either task can close.
- `UX-013`: complete. The shared shell now maps the Structured Warmth grammar to
  Aura semantic paper/ink, coral action, mint success, butter attention, and
  lavender secondary tokens while retaining the Aura gradient as a restrained
  brand accent. Setup → Integrations is the first page using the refreshed
  hierarchy; the remaining shell/page work stays tracked by `UX-014`–`UX-019`.
- M3 is complete. Next: finish the remaining smart-routing policy in M4.
- `POL-001` through `POL-007` and `GUI-005`: complete; see
  `docs/aura/smart-routing.md`. Aura reuses bounded account affinity, key
  failover, combo cooldown/circuit behavior, and concurrency controls while
  compiling universal roles and profiles into the existing subagent surfaces.
  Explicit security, concurrency, migration, data-loss, and repeated
  verification signals escalate to the reviewer model; per-task concurrency
  and reported-token budgets fail closed and are visible with each profile.
- M4 is complete. Next: establish the unoptimized benchmark baseline before
  enabling token transformations in M5.
- `EVAL-001`, `EVAL-002`, and `OPT-001`: complete; see
  `docs/aura/benchmarking.md` and `docs/aura/optimizer-baseline.json`. The
  corpus covers all six required task classes, scoring fails on incomplete
  strategy coverage, and the frozen unoptimized baseline is byte-identical
  with zero claimed savings.
- Next: implement protected repeated-output deduplication and bounded log
  reduction, then run live always-Sol/profile comparisons for `EVAL-003`.
- `OPT-002` through `OPT-005` and `GUI-006`: complete; see
  `docs/aura/token-optimizer.md`. Optimizations are routed-only, reversible,
  measured per request, and preserve source, migration, security, stack-trace,
  encrypted, image, and patch output byte-for-byte.
- M5 is complete. Next: live strategy evaluation, security gates, packaging,
  release documentation, and cross-platform release verification in M6.
- `SEC-001`, `SEC-002`, `REL-002`, and `REL-003`: complete; see
  `docs/aura/security.md`, `docs/aura/install-and-recovery.md`, and
  `docs/aura/release-readiness.md`. Aura adds `aura`/`aura-ai` executable
  aliases while preserving OpenCodex package and command compatibility for the
  migration release.
- Remaining external gates: live profile comparison (`EVAL-003`) and
  exact-SHA macOS/Windows/Linux CI and service
  lifecycle evidence (`REL-001`, `REL-004`).
- M7 is approved for the next preview track. Its first deliverable is the shared
  export catalog plus OpenCode Connect All; Claude Code CLI is frozen before the
  existing Claude Desktop 3P foundation is exposed through guarded Aura UX.
