# Aura AI client and protocol core

Date: 2026-07-23

## Boundaries

Aura keeps the inherited request handlers intact and adds explicit registries
around them:

- `src/protocols/registry.ts` owns the public Responses, Chat Completions, and
  Messages surfaces.
- `src/clients/registry.ts` maps those surfaces to Codex, Claude Code, OpenCode,
  Factory Droid, ZCode, and a generic compatible-agent surface without
  duplicating the protocol implementations.
- `src/providers/aura.ts` exposes credential-free provider authentication,
  discovery, and declared capability metadata.
- request and usage logs record the client and protocol selected at the public
  boundary.

This is deliberately a behavior-preserving extraction. The mature Codex and
Claude handlers remain the implementation behind the registered surfaces.

## OpenCode lifecycle

Aura connects OpenCode through its OpenAI-compatible provider configuration.
The connector:

1. resolves the platform config path or `OPENCODE_CONFIG`;
2. parses JSON or JSONC;
3. previews the intended provider and model;
4. creates a byte-for-byte backup before replacing an existing file;
5. writes atomically;
6. reads back and verifies Aura's provider/model fields;
7. rolls back the original bytes if apply or verification fails;
8. restores only while the applied-byte hash still matches, so later user
   edits are never overwritten;
9. restores the original bytes, or removes only a file Aura created.

The management API never accepts an arbitrary filesystem path. Tests redirect
the connector with `OPENCODE_CONFIG` so verification cannot modify the user's
real OpenCode configuration.

## Clients workspace

Setup → Clients is the unified client control surface:

- Codex reports its production Responses connection and links to account/model
  controls.
- Claude Code reports Messages connection state, supports connect/disconnect,
  and keeps the inherited advanced aliases, context, sidecar, and launch
  settings available on demand.
- OpenCode selects a normalized routed model, previews only the target and
  changed paths, then applies or restores through the guarded transaction.
- Factory Droid uses the documented `customModels` settings schema. Aura adds
  one `openai` custom model pointing to the local Responses endpoint, writes
  atomically, verifies the resulting entry, and restores only when the file
  still has Aura's applied-byte hash. Existing non-Aura custom models are
  preserved.
- ZCode remains visibly experimental and manual-only rather than presenting an
  unsafe automatic setup action. Its card now exposes the compatible
  Chat Completions endpoint, model, authentication, and recovery instructions.
- Other AI agents receive the same copy-ready guide for Responses, Chat
  Completions, and Messages. This is the compatibility fallback for products
  such as ZCode, OpenCode, and future agent clients without a stable local
  settings file.

## Unified setup wizard

Aura Setup provides a four-step onboarding path:

1. select an existing provider or open Add Provider, then run its connection
   test;
2. select a model, narrowed to the selected provider when namespaced models
   are available;
3. choose Codex, Claude Code, OpenCode, Factory Droid, ZCode, or a generic
   compatible agent;
4. review the provider, model, client, and routing profile before applying.

Apply compiles the selected model into the orchestrator role. OpenCode and
Factory Droid additionally use their guarded client adapters; Codex already
consumes Aura's local Responses catalog and needs no separate client-file
write. Claude Code is enabled through its inbound settings. ZCode and generic
agents receive an explicit manual-guide handoff because their local settings
surface is not safely machine-editable. The original advanced provider, role,
and client controls remain available below the wizard.

## ZCode and generic compatibility guide

ZCode remains explicit but experimental. Its current official setup flow
documents provider/model configuration through the application UI, including
OpenAI and OpenRouter options, but does not document a stable external
configuration file or local management API that Aura can safely edit and
restore.

Aura therefore makes no production auto-config claim for ZCode. The guided
manual path is intentionally simple: choose the supported protocol, set the
matching `/v1` endpoint, choose an Aura model, and provide an API key only when
local Aura authentication is enabled. It also explains how to recover by
restoring the previous client settings.

References:

- https://zcode.z.ai/docs/getting-started/configure-model
- https://zcode.z.ai/docs/faq
