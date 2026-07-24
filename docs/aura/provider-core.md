# Aura AI provider and configuration core

Date: 2026-07-24

## Reused provider architecture

Aura keeps OpenCodex's mature provider registry and management boundary instead
of introducing a second provider format:

- `ProviderRegistryEntry` is the built-in provider descriptor.
- `OcxProviderConfig` is the persisted normalized provider schema.
- registry enrichment supplies newly introduced defaults to older saved
  providers without overwriting explicit user choices.
- the management API validates provider names, URL shape, DNS-resolved
  destinations, private-network access, headers, authentication mode, and
  registry-only fields before writing.
- model discovery and the public catalog share the same normalized,
  deduplicated route.

The GUI receives credential-free presets. API keys are accepted only on the
provider write boundary and are represented elsewhere as `hasApiKey`.

Each provider's Models view combines two evidence levels without overstating
them:

- declared protocol, compact mode, reasoning, and vision metadata from the
  normalized Aura provider descriptor;
- an explicit live discovery probe that calls the provider's real `/models`
  route and reports latency or a sanitized failure.

The live probe is not presented as a full tool/streaming compatibility grade.
Those grades remain owned by the sanitized A/B compatibility harness and its
fixtures. Routing's profile editor consumes the same deduplicated model catalog
for per-role assignments.

## 9router preset

Aura includes a first-class local `9router` preset:

- endpoint: `http://127.0.0.1:20128/v1` (editable for another local port);
- adapter: OpenAI Responses;
- authentication: local, so the GUI does not request or persist an API key;
- live model discovery: enabled;
- private-network destination: allowed by the named registry entry;
- compact: synthetic by default.

Synthetic compact is intentional. 9router 0.5.40 can add `stream` to GPT-5.6
compact requests, while that compact backend rejects the parameter. Normal
Responses traffic remains unchanged. An explicit user `compactMode` always
wins over the registry default.

## Transaction and recovery contract

Client configuration writes use this contract:

1. preview validates the source and returns changed paths, never source values;
2. an existing file is backed up byte-for-byte under a generated,
   target-bound path;
3. the new file is written with the shared atomic temp-and-rename primitive;
4. Aura reads and verifies the applied configuration;
5. a failed apply restores the original bytes immediately;
6. automatic restore checks the hash of Aura's applied bytes and refuses to
   overwrite later user edits;
7. restore paths are derived internally and validated before use.

Codex already uses the same safety properties through its journal and injected
state hashes. OpenCode now follows the contract directly. Claude Code's current
adapter does not rewrite a user-owned client config file.

Backups can contain credentials and therefore use the same `0600` and Windows
secret-ACL hardening as the main config. Changes to this boundary require the
security review mandated by `MAINTAINERS.md`.
