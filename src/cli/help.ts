import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));

type HelpEntry = {
  usage: string;
  summary: string;
  details?: string[];
};

const helpEntries: Record<string, HelpEntry> = {
  init: { usage: "aura init", summary: "Interactive setup for providers and Codex config injection." },
  start: { usage: "aura start [--port <port>]", summary: "Start the proxy server and sync models to Codex." },
  stop: { usage: "aura stop", summary: "Stop the proxy and restore native Codex config." },
  restore: {
    usage: "aura restore [back]",
    summary: "Restore native Codex config without stopping the proxy; `restore back` re-points codex at the running proxy.",
  },
  eject: {
    usage: "aura eject [back]",
    summary: "Restore native Codex config without stopping the proxy; `eject back` re-points codex at the running proxy.",
  },
  "recover-history": {
    usage: "aura recover-history --legacy-openai",
    summary: "Explicitly recover pre-backup syncResumeHistory rows.",
  },
  uninstall: {
    usage: "aura uninstall",
    summary: "Remove service/shim/config and restore native Codex.",
    details: ["Alias: aura remove"],
  },
  remove: {
    usage: "aura remove",
    summary: "Remove service/shim/config and restore native Codex.",
    details: ["Alias of: aura uninstall"],
  },
  service: {
    usage: "aura service [install|start|stop|status|uninstall|remove]",
    summary: "Run as a background service.",
    details: [
      "With no subcommand, installs/updates and starts the background service.",
      "Use `aura service status` to see diagnostics and log paths.",
    ],
  },
  "codex-shim": {
    usage: "aura codex-shim <install|status|uninstall|remove>",
    summary: "Auto-start the proxy when `codex` launches.",
    details: ["Use `remove` as an alias for `uninstall`."],
  },
  tray: {
    usage: "aura tray <install|start|stop|status|uninstall|remove> [--json] [--no-start]",
    summary: "Install and control the Windows status tray icon.",
    details: [
      "The tray starts at Windows login and provides one-click proxy controls.",
      "Tray start/stop controls the icon only; use its menu to start or stop the proxy.",
      "--no-start (install only) installs the tray without launching it immediately.",
    ],
  },
  ensure: { usage: "aura ensure", summary: "Ensure the proxy is running and Codex config/cache are current." },
  sync: { usage: "aura sync", summary: "Fetch provider models and inject them into Codex config." },
  "sync-cache": { usage: "aura sync-cache", summary: "Refresh Codex's model cache from the active catalog." },
  status: { usage: "aura status", summary: "Check proxy server status." },
  doctor: { usage: "aura doctor", summary: "Diagnose environment/network issues (paths, WSL /mnt, proxy env, ChatGPT reachability)." },
  debug: {
    usage: "aura debug [provider on|off|status|reset|logs [-f]|usage on|off|status|reset|logs [-f]]",
    summary: "Show or toggle runtime provider debug logging on the running proxy.",
    details: [
      "Provider: aura debug provider on | off | status | reset | logs [-f]",
      "Usage JSONL: aura debug usage on | off | status | reset | logs [-f]",
      "Env default: OCX_DEBUG=1 (legacy OCX_DEBUG_FRAMES still works)",
    ],
  },
  login: { usage: "aura login <provider>", summary: "OAuth or API-key login for a provider." },
  logout: { usage: "aura logout <provider>", summary: "Remove a stored provider login." },
  gui: { usage: "aura gui", summary: "Open the Aura dashboard." },
  update: {
    usage: "aura update [--tag latest|preview]",
    summary: "Update Aura AI. Preview installs stay on the preview tag unless overridden.",
  },
  provider: {
    usage: "aura provider <list|add|remove|show|set-default>",
    summary: "Non-interactive provider management.",
    details: [
      "Subcommands: list, add <name>, remove <name>, show <name>, set-default <name>",
      "Registry providers are auto-configured by name. Custom providers need --adapter and --base-url.",
      "Run `aura provider --help` for full usage and examples.",
    ],
  },
  account: {
    usage: "aura account <list|current|use|refresh|auto-switch|remove|add-key> ...",
    summary: "List and switch provider accounts and API-key pools (GUI parity).",
    details: [
      "list [provider]     Codex account pool, OAuth accounts and API keys (identifiers shown masked as the API returns them).",
      "current <provider>  Show the active account or key.",
      "use <provider> <id> Switch the active credential; 'main' selects the Codex App login.",
      "refresh <provider>  Force-refresh Codex or provider quota reports.",
      "auto-switch <provider> <on|off|status|threshold N>  Control the Codex pool threshold.",
      "remove <provider> <id> --yes  Remove a stored account or key after an existence check.",
      "add-key <provider> [--label <label>]  Add a key read only from piped stdin.",
      "Codex pool switches apply to new sessions; running threads keep their account.",
    ],
  },
  models: {
    usage: "aura models [list] [--provider <name>] [--json] | add <provider> <modelId> [opts] | remove <id|provider/modelId> [--yes] | list-custom [--json]",
    summary: "List models and manage custom (manually registered) models.",
    details: [
      "List available models from static config with no subcommand (liveModels may add more at runtime).",
      "add: register a model the provider catalog does not advertise yet.",
      "  --display-name <name>     Human label (no slashes).",
      "  --context-window <tokens> e.g. 200000.",
      "  --modalities text,image   Comma-separated (text|image|audio).",
      "remove: delete a custom model by UUID or <provider>/<modelId>.",
      "list-custom: show all custom models.",
      "Changes apply immediately to a running proxy (catalog sync).",
    ],
  },
  claude: {
    usage: "aura claude [claude args...]",
    summary: "Launch Claude Code wired to the proxy (env injection + gateway model discovery).",
    details: [
      "Ensures the proxy is running, then execs `claude` with ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN,",
      "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1 and model slots from config.claudeCode.",
      "Routed models appear in the native /model picker as claude-ocx-<provider>--<model> (Claude Code >= 2.1.129).",
      "Older versions: pick models via ANTHROPIC_MODEL or /model <id> directly (any string passes through).",
      "User-exported ANTHROPIC_* variables always take precedence.",
    ],
  },
  restart: {
    usage: "aura restart",
    summary: "Stop the proxy and restart it (background). Equivalent to stop + ensure.",
  },
  v2: {
    usage: "aura v2 <status|on|off|mode <v1|default|v2>|threads <n>>",
    summary: "Toggle the Codex multi_agent_v2 feature (multi-agent surface).",
    details: [
      "status                Show flag, multi-agent mode, and thread limit.",
      "on | off              Enable/disable multi_agent_v2 (catalog resyncs).",
      "mode <v1|default|v2>  Force all models to one surface, or respect upstream pins.",
      "threads <n>           Set max_concurrent_threads_per_session (integer >= 1).",
      "Flips preserve the active thread limit while moving between v1/v2 modes.",
    ],
  },
  health: {
    usage: "aura health [--json]",
    summary: "Check proxy health. Exits 0 if healthy, 1 otherwise.",
    details: ["Use --json for structured output: {ok, pid, port}."],
  },
  mcp: {
    usage: "aura mcp",
    summary: "Run Aura's local, read-only MCP integration server over stdio.",
    details: ["Copy the declaration from Setup → Integrations into a compatible coding agent."],
  },
};

function packageVersion(): string {
  const raw = readFileSync(join(repoRoot, "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { version?: unknown };
  return typeof parsed.version === "string" ? parsed.version : "unknown";
}

export function printVersion(): void {
  console.log(`Aura AI ${packageVersion()}`);
}

export function printUsage(): void {
  console.log(`Aura AI (aura) — Universal provider gateway for coding agents

Usage:
  aura init                    Interactive setup (provider + Codex config injection)
  aura start [--port <port>]   Start the proxy server (auto-syncs models to Codex)
  aura stop                    Stop the proxy AND restore native Codex (plain codex works again)
  aura restore                 Restore native Codex without stopping (alias: eject)
  aura restore back            Re-point codex at the running proxy (undo restore)
  aura recover-history --legacy-openai
                               Explicitly recover pre-backup syncResumeHistory rows
  aura uninstall               Remove service/shim/config and restore native Codex (alias: remove)
  aura service [sub]           Run as a background service (default: install/update/start)
  aura codex-shim <sub>        Auto-start proxy when \`codex\` launches (install|status|uninstall|remove)
  aura tray <sub>              Windows status tray (install|start|stop|status|uninstall)
  aura ensure                  Ensure the proxy is running and Codex config/cache are current
  aura sync                    Fetch models from providers and inject into Codex config
  aura sync-cache              Refresh Codex's model cache from the active catalog
  aura status                  Check proxy server status
  aura doctor                  Diagnose environment/network issues (WSL, proxy, ChatGPT reachability)
  aura debug [provider|usage ...]
                              provider/usage on|off|status|reset|logs [-f]
  aura login <provider>        OAuth login (xai) — opens browser, stores token in ~/.opencodex/auth.json
  aura logout <provider>       Remove a stored OAuth login
  aura gui                     Open the Aura dashboard
  aura update [--tag <tag>]    Update Aura AI (keeps preview installs on @preview)
  aura restart                 Stop and restart the proxy
  aura v2 <sub>                multi_agent_v2 surface (status|on|off|mode|threads)
  aura health [--json]         Check proxy health (exit 0=healthy, 1=not)
  aura provider <sub>          Manage providers (list|add|remove|show|set-default)
  aura account <sub>           Accounts/keys (list|current|use|refresh|auto-switch|remove|add-key)
  aura models <sub>            List models; manage custom models (add|remove|list-custom)
  aura claude [args...]        Launch Claude Code wired to the proxy (model discovery on)
  aura mcp                     Run Aura's local read-only Integration MCP server
  aura help [command]          Show help
  aura --version | -v          Print version

Examples:
  aura init                    Set up provider and inject into Codex
  aura start                   Start on default port (10100)
  aura start --port 8080       Start on custom port
  aura help service            Show service command help
  aura sync                    Sync available models to Codex`);
}

export function hasHelpFlag(values: string[]): boolean {
  return values.some(value => value === "--help" || value === "-h" || value === "help");
}

export function printSubcommandUsage(name: string | undefined): void {
  const entry = name ? helpEntries[name] : undefined;
  if (!entry) {
    console.error(`Unknown command: ${name ?? ""}`.trim());
    printUsage();
    process.exit(1);
  }
  console.log(`Usage: ${entry.usage}\n\n${entry.summary}`);
  if (entry.details?.length) console.log(`\n${entry.details.join("\n")}`);
}
