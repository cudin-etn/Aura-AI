# Aura AI client and protocol core

Date: 2026-07-23

## Boundaries

Aura keeps the inherited request handlers intact and adds explicit registries
around them:

- `src/protocols/registry.ts` owns the public Responses, Chat Completions, and
  Messages surfaces.
- `src/clients/registry.ts` maps those surfaces to Codex, Claude Code, and
  OpenCode without duplicating the protocol implementations.
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

## ZCode spike

ZCode remains explicit but experimental. Its current official setup flow
documents provider/model configuration through the application UI, including
OpenAI and OpenRouter options, but does not document a stable external
configuration file or local management API that Aura can safely edit and
restore.

Aura therefore makes no production compatibility claim and exposes no ZCode
configuration action. Add an adapter only after a versioned, machine-editable
integration surface can be verified with backup and restore tests.

References:

- https://zcode.z.ai/docs/getting-started/configure-model
- https://zcode.z.ai/docs/faq
