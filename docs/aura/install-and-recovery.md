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

Aura installs only the `aura` command. It deliberately does not install or
overwrite `ocx`, `opencodex`, or `aura-ai`: those names can belong to an older
OpenCodex installation and caused Windows npm bin collisions during upgrade.
Aura continues to reuse the compatible local state directory, so provider
logins and existing client configuration are preserved.

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

Upgrade through the same package channel used for installation. On Windows,
close any running Aura/OpenCodex proxy before upgrading so npm can release old
package files. The release workflow runs clean-install, upgrade, service
lifecycle, restore, and uninstall gates on Linux, macOS, and Windows.

### Windows: recover from an old OpenCodex command collision

Aura releases from `0.1.0-preview.3` onward install **only** `aura`. This
prevents npm from trying to replace the legacy `opencodex.cmd` shim while an
older OpenCodex install still owns it. Aura keeps the compatible local state,
so this recovery does not require signing in to providers again.

If an older failed install reports `EEXIST ... opencodex.cmd` or `EPERM`:

1. Close Codex, Aura/OpenCodex dashboards, and terminals using the proxy. If a
   directory is still locked, restart Windows first.
2. Open **PowerShell** and run the following. It renames rather than deletes
   legacy shims and a failed partial installation.

```powershell
$npmBin = Join-Path $env:APPDATA "npm"
Rename-Item (Join-Path $npmBin "opencodex.cmd") "opencodex.cmd.backup" -ErrorAction SilentlyContinue
Rename-Item (Join-Path $npmBin "opencodex.ps1") "opencodex.ps1.backup" -ErrorAction SilentlyContinue
Rename-Item (Join-Path $env:APPDATA "npm\node_modules\@tungninh\aura-ai") "aura-ai.failed-install.backup" -ErrorAction SilentlyContinue

npm install -g @tungninh/aura-ai@preview
aura --version
aura ensure
aura status
aura doctor
```

`opencodex` and `ocx` remain available only if their original package is still
installed. Aura's supported command is `aura`; use `aura gui` to open its
dashboard. A renamed backup can be restored manually if it is ever needed.
