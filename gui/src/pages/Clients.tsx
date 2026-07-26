import { useCallback, useEffect, useState } from "react";
import ClaudeCode from "./ClaudeCode";
import { MultiSelect, Notice, Select } from "../ui";
import { useT, type TKey } from "../i18n";
import { IconX } from "../icons";

type ClientRow = {
  id: "codex" | "claude-code" | "claude-desktop" | "opencode" | "zcode" | "factory" | "cursor" | "kiro" | "antigravity" | "cline" | "roo" | "continue" | "kilo" | "droid" | "openclaw" | "generic";
  label: string;
  maturity: "production" | "basic" | "experimental";
  protocols: string[];
  endpoints: string[];
  configurable: boolean;
  connected: boolean;
};

type ProfileResponse = { available?: string[] };
type OpenCodePreview = {
  path: string;
  exists: boolean;
  model: string;
  models: string[];
  modelCount: number;
  provider: string;
  changes: string[];
};
type ClientPreview = OpenCodePreview;
type ClaudeDesktopState = {
  supported: boolean;
  exists: boolean;
  backupExists: boolean;
  modelCount: number;
  mode: "static" | "hybrid" | "discovery" | null;
  modes: string[];
};
type GuideTarget = "zcode" | "cursor" | "kiro" | "antigravity" | "cline" | "roo" | "continue" | "kilo" | "droid" | "openclaw" | "generic";
type ClientGuide = {
  baseUrl: string;
  model: string;
  protocols: { responses: string; chatCompletions: string; messages: string };
  authHeader: string;
  authEnv: string;
  notes: string[];
};

const CLIENT_HINT_KEYS: Record<ClientRow["id"], TKey> = {
  codex: "clients.codex.hint",
  "claude-code": "clients.claude-code.hint",
  "claude-desktop": "clients.claude-desktop.hint",
  opencode: "clients.opencode.hint",
  zcode: "clients.zcode.hint",
  factory: "clients.factory.hint",
  generic: "clients.generic.hint",
  cursor: "clients.generic.hint",
  kiro: "clients.generic.hint",
  antigravity: "clients.generic.hint",
  cline: "clients.generic.hint",
  roo: "clients.generic.hint",
  continue: "clients.generic.hint",
  kilo: "clients.generic.hint",
  droid: "clients.generic.hint",
  openclaw: "clients.generic.hint",
};

export default function Clients({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [openCodeModels, setOpenCodeModels] = useState<string[]>([]);
  const [openCodeModel, setOpenCodeModel] = useState("");
  const [factoryModels, setFactoryModels] = useState<string[]>([]);
  const [factoryModel, setFactoryModel] = useState("");
  const [preview, setPreview] = useState<OpenCodePreview | null>(null);
  const [factoryPreview, setFactoryPreview] = useState<ClientPreview | null>(null);
  const [guide, setGuide] = useState<ClientGuide | null>(null);
  const [guideTarget, setGuideTarget] = useState<GuideTarget | null>(null);
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showClaude, setShowClaude] = useState(false);
  const [claudeDesktop, setClaudeDesktop] = useState<ClaudeDesktopState | null>(null);
  const [claudeDesktopMode, setClaudeDesktopMode] = useState<"static" | "hybrid" | "discovery">("static");

  const load = useCallback(async () => {
    try {
      const [clientResponse, profileResponse, desktopResponse] = await Promise.all([
        fetch(`${apiBase}/api/aura/clients`),
        fetch(`${apiBase}/api/aura/profile`),
        fetch(`${apiBase}/api/aura/clients/claude-desktop`),
      ]);
      if (!clientResponse.ok || !profileResponse.ok || !desktopResponse.ok) throw new Error("load failed");
      const clientBody = await clientResponse.json() as { clients?: ClientRow[] };
      const profileBody = await profileResponse.json() as ProfileResponse;
      const desktopBody = await desktopResponse.json() as ClaudeDesktopState;
      const available = profileBody.available ?? [];
      setClients(clientBody.clients ?? []);
      setClaudeDesktop(desktopBody);
      if (desktopBody.mode) setClaudeDesktopMode(desktopBody.mode);
      setModels(available);
      setOpenCodeModels(current => {
        const retained = current.filter(model => available.includes(model));
        return retained.length > 0 ? retained : available;
      });
      setOpenCodeModel(current => current && available.includes(current) ? current : (available[0] ?? ""));
      setFactoryModels(current => {
        const retained = current.filter(model => available.includes(model));
        return retained.length > 0 ? retained : available;
      });
      setFactoryModel(current => current && available.includes(current) ? current : (available[0] ?? ""));
    } catch {
      setOk(false);
      setStatus(t("aura.loadFail"));
    }
  }, [apiBase, t]);

  const applyClaudeDesktop = async () => {
    setBusy("claude-desktop");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/claude-desktop`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: claudeDesktopMode }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.actionFail"));
      setOk(true);
      setStatus(t("clients.claudeDesktopConnected"));
      await load();
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("aura.actionFail"));
    } finally {
      setBusy(null);
    }
  };

  const restoreClaudeDesktop = async () => {
    setBusy("claude-desktop");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/claude-desktop`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.actionFail"));
      setOk(true);
      setStatus(t("clients.claudeDesktopRestored"));
      await load();
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("aura.actionFail"));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const previewOpenCode = async () => {
    if (!openCodeModel || openCodeModels.length === 0) return;
    setBusy("opencode-preview");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode?defaultModel=${encodeURIComponent(openCodeModel)}`);
      const body = await response.json() as OpenCodePreview & { error?: string };
      if (!response.ok) throw new Error(body.error || t("clients.previewFailed"));
      setFactoryPreview(null);
      setGuideTarget(null);
      setPreview(body);
      setOk(true);
      setStatus(t("clients.previewReady"));
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("clients.previewFailed"));
    } finally {
      setBusy(null);
    }
  };

  const applyOpenCode = async () => {
    if (!openCodeModel || openCodeModels.length === 0) return;
    setBusy("opencode-apply");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: openCodeModels, defaultModel: openCodeModel }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.actionFail"));
      setPreview(null);
      setOk(true);
      setStatus(t("aura.connected"));
      await load();
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("aura.actionFail"));
    } finally {
      setBusy(null);
    }
  };

  const updateOpenCodeModels = (next: string[]) => {
    setOpenCodeModels(next);
    setPreview(null);
    if (!next.includes(openCodeModel)) setOpenCodeModel(next[0] ?? "");
  };

  const restoreOpenCode = async () => {
    setBusy("opencode-restore");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.actionFail"));
      setPreview(null);
      setOk(true);
      setStatus(t("aura.restored"));
      await load();
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("aura.actionFail"));
    } finally {
      setBusy(null);
    }
  };

  const previewFactory = async () => {
    if (!factoryModel || factoryModels.length === 0) return;
    setBusy("factory-preview");
    setStatus("");
    try {
      const query = `${factoryModels.map(model => `model=${encodeURIComponent(model)}`).join("&")}&defaultModel=${encodeURIComponent(factoryModel)}`;
      const response = await fetch(`${apiBase}/api/aura/clients/factory?${query}`);
      const body = await response.json() as ClientPreview & { error?: string };
      if (!response.ok) throw new Error(body.error || t("clients.previewFailed"));
      setPreview(null);
      setGuideTarget(null);
      setFactoryPreview(body);
      setOk(true);
      setStatus(t("clients.previewReady"));
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("clients.previewFailed"));
    } finally {
      setBusy(null);
    }
  };

  const applyFactory = async () => {
    if (!factoryModel || factoryModels.length === 0) return;
    setBusy("factory-apply");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/factory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: factoryModels, defaultModel: factoryModel }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.actionFail"));
      setFactoryPreview(null);
      setOk(true);
      setStatus(t("clients.factoryConnected"));
      await load();
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("aura.actionFail"));
    } finally {
      setBusy(null);
    }
  };

  const restoreFactory = async () => {
    setBusy("factory-restore");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/factory`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.actionFail"));
      setFactoryPreview(null);
      setOk(true);
      setStatus(t("clients.factoryRestored"));
      await load();
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("aura.actionFail"));
    } finally {
      setBusy(null);
    }
  };

  const loadGuide = async (target: GuideTarget) => {
    setBusy(`guide-${target}`);
    try {
      const response = await fetch(`${apiBase}/api/aura/client-guide?client=${encodeURIComponent(target)}&model=${encodeURIComponent(openCodeModel || "YOUR_MODEL")}`);
      const body = await response.json() as ClientGuide & { error?: string };
      if (!response.ok) throw new Error(body.error || t("clients.guideFailed"));
      setPreview(null);
      setFactoryPreview(null);
      setGuide(body);
      setGuideTarget(target);
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("clients.guideFailed"));
    } finally {
      setBusy(null);
    }
  };

  const copyGuide = async () => {
    if (!guide) return;
    const text = [
      `${t("clients.guideAuraBaseUrl")}: ${guide.baseUrl}`,
      `${t("clients.guideResponses")}: ${guide.protocols.responses}`,
      `${t("clients.guideChatCompletions")}: ${guide.protocols.chatCompletions}`,
      `${t("clients.guideMessages")}: ${guide.protocols.messages}`,
      `${t("clients.guideModel")}: ${guide.model}`,
      `${t("clients.guideAuthHeader")}: ${guide.authHeader}`,
      `${t("clients.guideAuthEnv")}: ${guide.authEnv}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setOk(true);
    setStatus(t("clients.guideCopied"));
  };

  const toggleClaude = async (connected: boolean) => {
    setBusy("claude-code");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/claude-code`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !connected }),
      });
      if (!response.ok) throw new Error(t("aura.actionFail"));
      setOk(true);
      setStatus(!connected ? t("clients.connected") : t("clients.disconnected"));
      await load();
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("aura.actionFail"));
    } finally {
      setBusy(null);
    }
  };

  const closeDetail = () => {
    setPreview(null);
    setFactoryPreview(null);
    setGuideTarget(null);
  };

  const openCodeModelOptions = models.map(model => {
    const slash = model.indexOf("/");
    return {
      value: model,
      label: model,
      searchText: model,
      group: slash > 0 ? model.slice(0, slash) : "OpenAI",
    };
  });
  const openCodeDefaultOptions = openCodeModels.map(model => ({ value: model, label: model }));
  const factoryModelOptions = models.map(model => ({
    value: model,
    label: model,
    searchText: model,
    group: model.includes("/") ? model.split("/", 1)[0] : "OpenAI",
  }));
  const factoryDefaultOptions = factoryModels.map(model => ({ value: model, label: model }));
  const detailOpen = !!preview || !!factoryPreview || (!!guide && !!guideTarget);

  return (
    <div className="clients-page">
      <div className="page-head"><h2>{t("nav.clients")}</h2></div>
      <p className="page-sub">{t("aura.clientsHint")}</p>
      {status && <div className="client-toast"><Notice tone={ok ? "ok" : "err"}>{status}</Notice></div>}

      <div className="clients-grid">
        {clients.map(client => (
          <section className="card client-card" key={client.id}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{client.label}</h3>
                <p className="muted text-label" style={{ margin: "4px 0 0" }}>
                  {client.protocols.join(", ") || t("clients.noStableProtocol")}
                </p>
              </div>
              <span className={`badge ${client.connected ? "badge-accent" : "badge-muted"}`}>
                {client.connected ? t("aura.connectedState") : t("aura.notConnected")}
              </span>
            </div>
            <p className="muted leading-body">{t(CLIENT_HINT_KEYS[client.id])}</p>

            {client.id === "codex" && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => { location.hash = "codex-auth"; }}>{t("nav.accounts")}</button>
                <button className="btn btn-ghost" onClick={() => { location.hash = "models"; }}>{t("nav.models")}</button>
              </div>
            )}

            {client.id === "claude-code" && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={() => void toggleClaude(client.connected)} disabled={busy === client.id}>
                  {client.connected ? t("clients.disconnect") : t("aura.connect")}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowClaude(value => !value)}>
                  {t("clients.advanced")}
                </button>
              </div>
            )}

            {client.id === "claude-desktop" && claudeDesktop && (
              <div className="stack" style={{ gap: 8 }}>
                <Select
                  value={claudeDesktopMode}
                  options={claudeDesktop.modes.map(mode => ({ value: mode, label: mode }))}
                  onChange={value => setClaudeDesktopMode(value as "static" | "hybrid" | "discovery")}
                  disabled={!claudeDesktop.supported || busy !== null}
                  label={t("clients.claudeDesktopMode")}
                  style={{ width: "100%" }}
                />
                <span className="muted text-caption">{t("clients.claudeDesktopModels", { count: String(claudeDesktop.modelCount) })}</span>
                <span className="muted text-caption">{claudeDesktop.backupExists ? t("clients.claudeDesktopBackupReady") : t("clients.claudeDesktopBackupOnApply")}</span>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={() => void applyClaudeDesktop()} disabled={!claudeDesktop.supported || busy !== null}>{client.connected ? t("aura.reconnect") : t("aura.connect")}</button>
                  {client.connected && <button className="btn btn-ghost" onClick={() => void restoreClaudeDesktop()} disabled={busy !== null}>{t("aura.restore")}</button>}
                </div>
              </div>
            )}

            {client.id === "opencode" && (
              <div className="stack" style={{ gap: 8 }}>
                <MultiSelect
                  values={openCodeModels}
                  options={openCodeModelOptions}
                  onChange={updateOpenCodeModels}
                  disabled={models.length === 0}
                  label={t("clients.compatibleModels")}
                  summary={t("pws.modelCount", { count: String(openCodeModels.length) })}
                  searchPlaceholder={t("clients.searchModels")}
                  selectAllLabel={t("clients.selectAllCompatible")}
                  clearLabel={t("clients.clearModels")}
                  style={{ width: "100%" }}
                />
                <Select
                  value={openCodeModel}
                  options={openCodeDefaultOptions}
                  onChange={value => { setOpenCodeModel(value); setPreview(null); }}
                  disabled={openCodeModels.length === 0}
                  label={t("clients.defaultModel")}
                  style={{ width: "100%" }}
                />
                <span className="muted text-caption">{t("clients.connectAllHint")}</span>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={() => void previewOpenCode()} disabled={!openCodeModel || openCodeModels.length === 0 || busy !== null}>{t("clients.preview")}</button>
                  <button className="btn btn-primary" onClick={() => void applyOpenCode()} disabled={!openCodeModel || openCodeModels.length === 0 || busy !== null}>{client.connected ? t("aura.reconnect") : t("aura.connect")}</button>
                  {client.connected && <button className="btn btn-ghost" onClick={() => void restoreOpenCode()} disabled={busy !== null}>{t("aura.restore")}</button>}
                </div>
              </div>
            )}

            {client.id === "zcode" && <span className="muted text-label">{t("clients.experimental")}</span>}

            {client.id === "factory" && (
              <div className="stack" style={{ gap: 8 }}>
                <MultiSelect
                  values={factoryModels}
                  options={factoryModelOptions}
                  onChange={next => { setFactoryModels(next); if (!next.includes(factoryModel)) setFactoryModel(next[0] ?? ""); setFactoryPreview(null); }}
                  disabled={models.length === 0}
                  label={t("clients.compatibleModels")}
                  summary={t("pws.modelCount", { count: String(factoryModels.length) })}
                  searchPlaceholder={t("clients.searchModels")}
                  selectAllLabel={t("clients.selectAllCompatible")}
                  clearLabel={t("clients.clearModels")}
                  style={{ width: "100%" }}
                />
                <Select
                  value={factoryModel}
                  options={factoryDefaultOptions}
                  onChange={value => { setFactoryModel(value); setFactoryPreview(null); }}
                  disabled={factoryModels.length === 0}
                  label={t("clients.defaultModel")}
                  style={{ width: "100%" }}
                />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={() => void previewFactory()} disabled={!factoryModel || factoryModels.length === 0 || busy !== null}>{t("clients.preview")}</button>
                  <button className="btn btn-primary" onClick={() => void applyFactory()} disabled={!factoryModel || factoryModels.length === 0 || busy !== null}>{client.connected ? t("aura.reconnect") : t("aura.connectFactory")}</button>
                  {client.connected && <button className="btn btn-ghost" onClick={() => void restoreFactory()} disabled={busy !== null}>{t("aura.restoreFactory")}</button>}
                </div>
              </div>
            )}

            {(["zcode", "cursor", "kiro", "antigravity", "cline", "roo", "continue", "kilo", "droid", "openclaw", "generic"] as const).includes(client.id as GuideTarget) && (
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={() => void loadGuide(client.id as GuideTarget)} disabled={busy !== null}>{t("clients.openGuide")}</button>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {showClaude && (
        <section className="card client-advanced-panel">
          <ClaudeCode apiBase={apiBase} />
        </section>
      )}

      {detailOpen && (
        <dialog open className="client-detail-drawer" aria-label={preview || factoryPreview ? t("clients.preview") : t("clients.guideSteps")}>
          <div className="client-detail-head">
            <div>
              <span className="muted text-label">{preview || factoryPreview ? t("clients.preview") : t("clients.guideSteps")}</span>
              <strong>{preview ? "OpenCode" : factoryPreview ? "Factory Droid" : guideTarget === "zcode" ? "ZCode" : t("nav.clients")}</strong>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" onClick={closeDetail} aria-label={t("common.close")}>
              <IconX aria-hidden />
            </button>
          </div>
          {(preview || factoryPreview) && (
            <div className="client-detail-body text-control">
              <div className="client-detail-row"><strong>{t("clients.previewPath")}</strong><code>{(preview ?? factoryPreview)!.path}</code></div>
              <div className="client-detail-row"><strong>{t("clients.compatibleModels")}</strong><span>{t("pws.modelCount", { count: String((preview ?? factoryPreview)!.modelCount) })}</span></div>
              <div className="client-detail-row"><strong>{t("clients.defaultModel")}</strong><code>{(preview ?? factoryPreview)!.model}</code></div>
              <div className="client-detail-row"><strong>{t("clients.previewChanges")}</strong><code>{(preview ?? factoryPreview)!.changes.join(", ")}</code></div>
            </div>
          )}
          {guide && guideTarget && (
            <div className="client-detail-body text-control">
              <div className="client-detail-row"><strong>{t("clients.guideBaseUrl")}</strong><code>{guide.baseUrl}</code></div>
              <div className="client-detail-row"><strong>{t("clients.guideModel")}</strong><code>{guide.model}</code></div>
              <ol className="client-guide-steps">
                <li>{t("clients.guideStepOne")}</li>
                <li>{t("clients.guideStepTwo")}</li>
                <li>{t("clients.guideStepThree")}</li>
              </ol>
              <button className="btn btn-primary" onClick={() => void copyGuide()}>{t("clients.copyGuide")}</button>
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
