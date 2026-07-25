# Aura AI install, setup, and recovery

Date: 2026-07-24

## Install and launch

Aura has a public source repository and the package name `@tungninh/aura-ai`
is reserved. Until the first preview is published, install the current build
from the `dev` branch:

```bash
git clone --branch dev https://github.com/cudin-etn/Aura-AI.git
cd Aura-AI
bun install --frozen-lockfile
bun run build:gui
npm install -g .
aura start
```

After the preview is published, the shorter install is:

```bash
npm install -g @tungninh/aura-ai@preview
```

The existing `ocx` and `opencodex` commands remain supported; `aura` and
`aura-ai` are aliases to the same runtime. This avoids breaking service files,
scripts, and upgrades during the Aura transition.

Open the local dashboard printed by the command. Aura binds to loopback by
default. A non-loopback bind requires `OPENCODEX_API_AUTH_TOKEN`.

## First setup

1. Open **Setup → Overview**.
2. Choose or add a provider. `9router (local)` is a first-class preset.
3. Test the connection and select a provider model.
4. Choose Codex, Claude Code, or OpenCode.
5. Review the routing profile and apply.

Advanced provider, account, model, role, and client controls remain available
in their Setup and Routing sections.

## Profiles and optimization

- Saver minimizes cost and caps a task at two concurrent subagents.
- Balanced is the default cost/quality profile with three subagents.
- Quality prefers stronger orchestration and permits four subagents.

Insights shows route trace, fallback attempts, cache use, normalized
list-price equivalent, optimizer status, and estimated saved tokens.

## Recovery

- Preview client changes before apply.
- OpenCode restore is available only while the Aura-applied file hash still
  matches; later user edits are never overwritten.
- `aura restore` returns Codex to native routing.
- `aura doctor` reports provider, service, config, and dual-install problems.
- Background service and launcher-shim repair commands remain available in
  Settings → Startup.
- Configuration and full-output artifacts remain under the existing
  OpenCodex-compatible local directory during migration.

## Upgrade and uninstall

Upgrade through the same package channel used for installation. The release
workflow runs clean-install, upgrade, service lifecycle, restore, and uninstall
gates on Linux, macOS, and Windows. Do not remove the compatibility command
aliases until a separately published Aura package and migration release have
been verified.
