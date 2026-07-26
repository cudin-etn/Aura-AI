# Aura AI — Product and Engineering Plan

Status: In progress
Date: 2026-07-23
Updated: 2026-07-25
Product name: Aura AI

## 1. Product Goal

Build one local application that connects AI coding clients to multiple model
providers, manages configuration and quota, and routes work to the cheapest
model that can complete it reliably.

The product is not a generic HTTP router. It manages:

- client compatibility;
- providers, accounts, models, and capabilities;
- agent roles and model assignment;
- thread affinity and prompt-cache preservation;
- safe fallback and escalation;
- token optimization backed by measurable results;
- GUI-driven setup, diagnostics, and restore.

## 2. Foundation

Fork OpenCodex because it already solves the highest-risk Codex-specific work:
Responses API translation, streaming, catalog injection, model metadata,
compaction, authentication, session affinity, provider adapters, and a local
dashboard.

Keep the fork easy to update:

- preserve the MIT license and attribution;
- retain an `upstream` Git remote;
- keep upstream compatibility changes separate from product features;
- avoid broad rewrites until baseline tests and protocol fixtures exist.

9router is initially an optional upstream and a source of proven product ideas,
not a runtime dependency:

- provider onboarding and discovery;
- quota and account pools;
- health checks and circuit breakers;
- fallback chains;
- usage and cost dashboards;
- conservative tool-result compression;
- reusable routing profiles.

## 3. Architecture

```text
Codex / Claude Code / OpenCode / experimental clients
                         |
                    Client adapters
                         |
        Responses / Chat Completions / Messages
                         |
                   Gateway core
        sessions | policy | quota | usage | auth
                         |
         Provider and capability adapters
                         |
 OpenAI / Anthropic / xAI / Z.ai / OpenRouter / Custom
```

Target source boundaries:

```text
src/
  core/          sessions, routing state, quota, auth, usage
  protocols/     OpenAI Responses, Chat Completions, Anthropic Messages
  clients/       Codex, Claude Code, OpenCode, experimental adapters
  providers/     direct provider integrations and discovery
  policy/        roles, profiles, escalation, fallback
  optimizer/     cache affinity, tool-result reduction, context budgets
  storage/       config, secrets references, migrations, backups
  server/        local API and lifecycle
gui/             setup, profiles, diagnostics, usage, route trace
```

The first refactor must preserve behavior. Moving code and changing behavior in
the same step is not allowed.

## 4. MVP Scope

### Supported platforms

- macOS: first-class desktop, CLI, service lifecycle, install, update, and
  recovery support.
- Windows: first-class desktop, CLI, service lifecycle, install, update, and
  recovery support.
- Linux: supported for CLI, service, and development workflows after the two
  desktop release paths are stable.

Platform-specific behavior must live behind lifecycle and filesystem adapters.
Core routing, protocol, provider, policy, optimizer, and storage logic must
remain platform-neutral.

### Supported clients

- Codex App and CLI: production-ready.
- Claude Code: production-ready where inherited from OpenCodex.
- OpenCode: production-ready basic gateway connection and configuration.
- ZCode and other clients: discovery spike only until their stable integration
  surfaces are verified.

### Supported providers

- OpenAI and ChatGPT/Codex account modes inherited from OpenCodex.
- Anthropic.
- xAI.
- OpenRouter.
- Custom OpenAI-compatible endpoint.
- 9router as an optional imported upstream.

### User workflows

1. Add a provider using API key, OAuth, or a custom endpoint.
2. Discover models and run compatibility probes.
3. Assign models to universal agent roles.
4. Connect one or more supported coding clients.
5. Select Saver, Balanced, or Quality.
6. Apply configuration with automatic backup and restore.
7. Inspect route decisions, quota, cache, token use, errors, and fallback.

### Routing profiles

| Profile | Parent | Explorer | Worker | Reviewer |
| --- | --- | --- | --- | --- |
| Saver | Terra low | Luna low | Luna/Terra low | Sol on escalation |
| Balanced | Terra medium | Luna low | Terra medium | Sol high when needed |
| Quality | Sol medium | Terra low | Terra medium | Sol high |

Model names are defaults, not hardcoded requirements. Roles are mapped to
capabilities so equivalent models from other providers can be used.

## 5. Smart Routing Rules

The parent model is sticky for the life of a thread. Automatic mid-thread parent
switching is out of scope because it can destroy prompt-cache value and change
behavior unpredictably.

Automatic routing uses roles and deterministic signals before considering any
model-based classifier:

- exploration and large read-only scans use an efficient model;
- scoped implementation uses the balanced worker;
- architecture, security, concurrency, and final high-risk review use the
  strongest model;
- two failed verification attempts trigger escalation;
- provider failure first changes account for the same model, then uses a
  compatible fallback;
- trivial work stays on one agent;
- default concurrent subagents are capped at three.

Every automatic decision must be visible in a route trace and manually
overridable.

## 6. Token Optimization

Measurement ships before compression.

Track per request and per completed task:

- provider, account, model, role, and reasoning effort;
- input, cached input, uncached input, output, and reasoning tokens;
- normalized cost or quota units;
- first-token and total latency;
- retries, fallbacks, escalations, and subagent count;
- verification result and task success.

Safe initial optimizations:

- preserve model and account affinity;
- deduplicate repeated tool output;
- reduce long logs to relevant errors plus bounded head and tail;
- store full output locally and expose a retrieval handle;
- avoid resending unchanged files;
- apply context budgets per role.

Source code, migrations, security evidence, and unresolved stack traces are not
lossily compressed.

## 7. Compatibility Testing

Each model receives a capability report:

| Grade | Meaning |
| --- | --- |
| Native | Streaming, tools, reasoning, compact, and required modalities pass |
| Compatible | Translation is required, but the supported workflow passes |
| Limited | Basic generation works; agentic use has known limitations |
| Failed | Hidden from normal role assignment |

Required probes:

- model discovery and authentication;
- non-streaming and streaming Responses;
- multi-turn tool calls;
- reasoning effort mapping;
- compact/resume behavior;
- cancellation and timeout handling;
- image input when advertised;
- client-specific smoke tests.

## 8. Success Gates

The MVP is releasable when:

- a new provider can be connected without manual config editing;
- Codex configuration can always be previewed, backed up, applied, and restored;
- GPT-5.6 direct and compatibility modes have reproducible test reports;
- route decisions are explainable and manually overridable;
- no failed compatibility probe is silently promoted to a normal model;
- the benchmark suite shows Balanced reduces normalized cost per successful
  task by a target of at least 20% versus an always-Sol baseline;
- benchmark task success is no more than five percentage points below the
  always-Sol baseline;
- security, migration, and configuration-loss tests pass.
- clean-install, upgrade, background-service, config-restore, and uninstall
  tests pass on both current macOS and Windows release environments.

The 20% target is a release hypothesis, not a claim. If measurements disprove
it, routing rules change before release.

## 9. Non-Goals for MVP

- supporting every provider or coding client;
- cloud sync or hosted account management;
- public plugin/provider marketplace;
- video and unrelated media workflows;
- an LLM call solely to classify every request;
- automatic multi-agent execution for trivial tasks;
- silent model switching without route trace;
- replacing 9router's entire provider catalog in the first release.

## 10. Milestones

### M0 — Upstream Baseline

Import OpenCodex, preserve history and license, establish upstream sync, and
pass the existing build, typecheck, tests, privacy scan, and GUI checks.

Exit: reproducible clean baseline with no product behavior changes.

### M1 — Observability and Compatibility Harness

Add sanitized protocol fixtures, direct-versus-compatibility tests, route IDs,
usage normalization, and task-level measurement.

Exit: GPT-5.6 and other models can be compared without relying on UI symptoms.

### M2 — Generic Core Boundaries

Separate client, protocol, provider, policy, optimizer, and storage boundaries
while preserving behavior.

Exit: Codex and Claude Code still pass the baseline through explicit adapters.

### M2.5 — Aura UX Foundation

Define Aura's product personality and five-area information architecture, then
replace the inherited long-form navigation with a light-first application shell
and contextual page navigation. Preserve existing routes and functionality.
Offer a readable single-column Focus layout and a responsive multi-column
Canvas layout so users can choose density without maintaining separate apps.
Use functional motion and small route/profile/token visuals to explain state;
respect reduced-motion preferences and never animate decoration at the expense
of data clarity.

Exit: Home, Setup, Routing, Insights, and Settings organize every inherited
surface without breaking deep links, responsive navigation, localization, or
accessibility.

### M3 — Provider and Client GUI

Implement provider onboarding, model discovery, capability grades, role
assignment, client connection, config preview, backup, apply, and restore.

Exit: a user can configure Codex, OpenCode, and Factory Droid without editing
files; ZCode and other compatible agents have a copy-ready guided manual path
with explicit protocol and recovery steps.

### M4 — Smart Profiles

Implement sticky parent routing, universal roles, Saver/Balanced/Quality,
conditional escalation, safe fallback, limits, and route trace.

Exit: routing is useful with optimization disabled.

### M5 — Token Optimizer

Add conservative tool-result reduction, context budgets, cache-affinity
reporting, and retrieval of full local output.

Exit: every optimization is measurable, reversible, and covered by fixtures.

### M6 — Evaluation and Release

Run the benchmark corpus, tune policies, complete security/privacy review,
package first-class macOS and Windows installers, verify their service
lifecycles, and document migration and recovery. Verify Linux CLI and service
paths after the desktop gates pass.

Exit: all success gates pass and an upgrade path from OpenCodex is documented.

### M7 — Client Federation and Optimizer Hardening

Turn the client registry into a capability-driven federation layer. A supported
coding client should receive every Aura model that its protocol and model
surface can represent, while Aura chooses one safe default and keeps routing,
fallback, and role policy behind the gateway. The normal path is one reviewable
Connect action: auto-detect the client and config path, select all compatible
models, preview the exact diff, apply atomically, verify, and retain guarded
restore. Unknown or unstable schemas fall back to a copy-ready guided flow
instead of speculative file mutation.

Promote OpenCode and Factory Droid from single-model configuration to full
compatible-catalog export. Add verified client tracks for Cursor, Kiro,
Antigravity, Cline/Roo/Continue/Kilo, and other compatible agents in that order.
Each track must declare whether it supports automatic configuration, model-list
registration, one-default-only configuration, or manual guidance.

Claude remains a protected integration family:

- freeze Claude Code CLI Messages, OAuth, environment injection, model slots,
  compact, and auto-connect behavior before UI changes;
- keep the Claude Code CLI enable switch behaviorally unchanged and label it
  explicitly;
- productize the existing Claude Desktop 3P static/hybrid/discovery foundation
  behind detection, preview, backup, verification, restore, and macOS-specific
  compatibility gates;
- never make Claude Desktop promotion a prerequisite for Claude Code CLI.

Harden Token Saver around route and content capability rather than model names.
Expose Off, Safe, Full, and Ultra contracts; keep canonical native/encrypted
paths unchanged unless a separately tested Safe Native transform proves byte
and behavior safety. Detect downstream compression to avoid double-reducing
content through providers such as 9router. Every saved-token claim must come
from persisted optimizer actions and a quality-scored benchmark.

Polish the client workflow with portal-based searchable model selectors,
select-all-compatible plus explicit default selection, model counts and grouped
compatibility reasons. Sidebar parent, expanded, and active-child states must
use distinct visual hierarchy. Claude Code status may remain a quick control,
but its label and placement must not imply that it controls every Claude model
or Claude Desktop.

Exit: OpenCode receives all compatible Aura models with one Connect action;
every listed client has an evidence-backed auto or guided integration grade;
Claude Code CLI retains its frozen behavior; Claude Desktop passes guarded
macOS apply/restore tests; Token Saver reports measured non-zero actions on
eligible fixtures without changing protected content; and the next preview
passes full macOS, Windows, Linux, privacy, migration, and rollback gates.

## 11. Principal Risks

- Upstream Codex protocols and model catalogs change quickly.
- A large fork can become impossible to update.
- Cross-provider fallback can alter tool behavior or invalidate context.
- Aggressive compression can remove the evidence needed to fix a bug.
- Multi-agent workflows can increase total tokens despite using cheaper models.
- Provider OAuth and local secret storage expand the security surface.
- Supporting too many clients early can prevent any client from being reliable.

Mitigations are upstream isolation, protocol fixtures, conservative defaults,
sticky sessions, explicit compatibility grades, benchmark gates, and a narrow
MVP.
