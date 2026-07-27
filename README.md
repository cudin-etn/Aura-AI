# Aura AI

Aura AI is a local gateway for AI coding agents. Connect Codex, Claude Code,
OpenCode, Factory Droid, Cursor, Kiro, Cline, Roo Code, Continue, and other
OpenAI-compatible clients to multiple providers from one clean dashboard.

**Languages:** [English](README.md) · [Tiếng Việt](README.vi.md) ·
[한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) ·
[日本語](README.ja.md)

Aura keeps the client workflow familiar while adding provider discovery,
account and quota management, model profiles, capability-aware routing,
fallbacks, guided client setup, route traces, and conservative token saving.

![Aura AI architecture](assets/architecture.png)

![Aura AI in action](assets/demo.gif)

> Public preview: Aura AI is experimental software. Review provider terms and
> test with non-critical projects before enabling automatic routing or token
> optimization.

## What Aura does

- Add OpenAI, Anthropic, Google, xAI, Kimi, OpenRouter, 9Router, Ollama Cloud,
  Azure, DeepSeek, GLM, custom OpenAI-compatible endpoints, and more.
- Discover models and show whether each capability is available, partial, or
  planned.
- Assign models to planning, implementation, review, fast-task, and fallback
  roles.
- Export one model, a multi-model profile, or all connected models to supported
  coding agents.
- Configure Codex automatically when its local configuration is detectable;
  other clients receive a copy-ready endpoint and guided manual setup.
- Use Token Saver in Off, Safe, Lite, Full, or Ultra mode. It compresses
  eligible tool output and context only; it does not rewrite credentials,
  model responses, or protected code. Safe Native remains opt-in and disabled
  by default until benchmark evidence supports it.
- Inspect usage, route decisions, quota warnings, failures, and token savings
  without logging API keys or request bodies.

## Install

Requires Node.js 18 or newer. Bun is bundled automatically by the package.

```bash
npm install -g @tungninh/aura-ai@preview
aura init
aura start
aura gui
```

Open `http://127.0.0.1:10100` and follow the setup wizard:

1. Add a provider or custom endpoint.
2. Test the connection and discover models.
3. Assign models to roles or choose a routing profile.
4. Select a coding client and apply the generated configuration.

Aura installs one command: `aura`. Existing `ocx` and `opencodex` commands
remain owned by an older OpenCodex package and Aura never overwrites them.

```bash
aura status
aura doctor
aura sync
aura service install
aura service status
aura stop
```

## Configure coding agents

In the dashboard, go to **Setup → Clients**. Aura supports automatic or guided
manual setup for:

| Client | Setup | Model transfer |
| --- | --- | --- |
| Codex App / CLI / SDK | Automatic when detected | Full catalog and profiles |
| Claude Code CLI | Automatic launch integration | Full catalog and aliases |
| Claude Desktop | Guided 3P configuration | Selected models and tools |
| OpenCode | Automatic or manual config | Selected, multi-select, or all |
| Factory Droid | Automatic or manual config | Selected, multi-select, or all |
| Cursor, Kiro, Cline, Roo Code, Continue, Kilo, Antigravity | Guided manual setup | Endpoint, model list, and steps |

For clients without a supported schema, Aura shows the endpoint, auth mode,
model ids, environment variables, and exact copy-ready steps. Aura never edits
an unknown application file without a detected schema and a backup.

### Integration MCP (preview)

**Setup → Integrations** can generate the credential-free local MCP declaration
for Codex, Claude, OpenCode, Cursor, and compatible clients:

```json
{ "mcpServers": { "aura": { "command": "aura", "args": ["mcp"] } } }
```

`aura mcp` currently exposes safe integration readiness and scope metadata only.
Official GitHub, Supabase, Firebase, Vercel, and other provider actions remain
explicit connector work; Aura never forwards API keys into an agent config.

## Routing and token saving

Use **Routing → Profiles** to create predictable policies:

- **Always Sol**: fixed quality-first model.
- **Saver**: lower-cost model for routine work, with explicit fallback.
- **Balanced**: role and capability aware routing.
- **Quality**: strongest eligible model for complex work.

Use **Insights → Token Saver** to choose a preset. Aura detects downstream
optimizers such as 9Router RTK and avoids applying the same compression twice.
Token Saver is deliberately conservative: it reduces redundant tool output and
context overhead; it does not bypass quotas or alter authentication.

## Providers and accounts

Providers are independent from clients. Add one provider once, discover its
models, then reuse those models across Codex, Claude, OpenCode, Droid, and
other agents. API keys are stored locally using the configured storage policy;
they are masked in the UI and excluded from diagnostics and logs.

Aura can keep multiple compatible accounts and apply cooldown and fallback
rules. Existing conversations remain pinned where the client supports stable
thread identity; new sessions can choose a healthy eligible account.

## Supported platforms

| Platform | Service manager | Status |
| --- | --- | --- |
| macOS arm64 / x64 | launchd | Preview-supported |
| Linux x64 / arm64 | systemd user service | Preview-supported |
| Windows x64 | Task Scheduler | Preview-supported |

No WSL is required on Windows. The preview is validated by automated
cross-platform CI and service lifecycle checks; provider behavior still
depends on each upstream service and account.

## Development

```bash
git clone https://github.com/cudin-etn/Aura-AI.git
cd Aura-AI
bun install --frozen-lockfile
bun run build:gui
bun run typecheck
bun run test
bun run lint:gui
bun run privacy:scan
```

See [docs/aura/](docs/aura/) for routing, client setup, Token Saver,
benchmarking, security, and release notes.

## License and attribution

Aura AI is released under the MIT License. It is an independent project and
is not affiliated with OpenAI, Anthropic, Google, xAI, 9Router, OpenCode,
Factory, or any other provider or client mentioned above.
