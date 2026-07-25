import { useCallback, useEffect, useState } from "react";
import ClaudeCode from "./ClaudeCode";
import { Notice, Select } from "../ui";
import { useT, type TKey } from "../i18n";
import { IconX } from "../icons";

type ClientRow = {
  id: "codex" | "claude-code" | "opencode" | "zcode" | "factory" | "generic";
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
  provider: string;
  changes: string[];
};
type ClientPreview = OpenCodePreview;
type GuideTarget = "zcode" | "generic";
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
  opencode: "clients.opencode.hint",
  zcode: "clients.zcode.hint",
  factory: "clients.factory.hint",
  generic: "clients.generic.hint",
};

export default function Clients({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [openCodeModel, setOpenCodeModel] = useState("");
  const [factoryModel, setFactoryModel] = useState("");
  const [preview, setPreview] = useState<OpenCodePreview | null>(null);
  const [factoryPreview, setFactoryPreview] = useState<ClientPreview | null>(null);
  const [guide, setGuide] = useState<ClientGuide | null>(null);
  const [guideTarget, setGuideTarget] = useState<GuideTarget | null>(null);
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showClaude, setShowClaude] = useState(false);

  const load = useCallback(async () => {
    try {
      const [clientResponse, profileResponse] = await Promise.all([
        fetch(`${apiBase}/api/aura/clients`),
        fetch(`${apiBase}/api/aura/profile`),
      ]);
      if (!clientResponse.ok || !profileResponse.ok) throw new Error("load failed");
      const clientBody = await clientResponse.json() as { clients?: ClientRow[] };
      const profileBody = await profileResponse.json() as ProfileResponse;
      const available = profileBody.available ?? [];
      setClients(clientBody.clients ?? []);
      setModels(available);
      setOpenCodeModel(current => current && available.includes(current) ? current : (available[0] ?? ""));
      setFactoryModel(current => current && available.includes(current) ? current : (available[0] ?? ""));
    } catch {
      setOk(false);
      setStatus(t("aura.loadFail"));
    }
  }, [apiBase, t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const previewOpenCode = async () => {
    if (!openCodeModel) return;
    setBusy("opencode-preview");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode?model=${encodeURIComponent(openCodeModel)}`);
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
    if (!openCodeModel) return;
    setBusy("opencode-apply");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: openCodeModel }),
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
    if (!factoryModel) return;
    setBusy("factory-preview");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/factory?model=${encodeURIComponent(factoryModel)}`);
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
    if (!factoryModel) return;
    setBusy("factory-apply");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/factory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: factoryModel }),
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
      const response = await fetch(`${apiBase}/api/aura/client-guide?model=${encodeURIComponent(openCodeModel || "YOUR_MODEL")}`);
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

  const modelOptions = models.length > 0
    ? models.map(candidate => ({ value: candidate, label: candidate }))
    : [{ value: "", label: t("models.noRouted") }];
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

            {client.id === "opencode" && (
              <div className="stack" style={{ gap: 8 }}>
                <Select
                  value={openCodeModel}
                  options={modelOptions}
                  onChange={value => { setOpenCodeModel(value); setPreview(null); }}
                  disabled={models.length === 0}
                  label={t("aura.openCodeModel")}
                  style={{ width: "100%" }}
                />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={() => void previewOpenCode()} disabled={!openCodeModel || busy !== null}>{t("clients.preview")}</button>
                  <button className="btn btn-primary" onClick={() => void applyOpenCode()} disabled={!openCodeModel || busy !== null}>{client.connected ? t("aura.reconnect") : t("aura.connect")}</button>
                  {client.connected && <button className="btn btn-ghost" onClick={() => void restoreOpenCode()} disabled={busy !== null}>{t("aura.restore")}</button>}
                </div>
              </div>
            )}

            {client.id === "zcode" && <span className="muted text-label">{t("clients.experimental")}</span>}

            {client.id === "factory" && (
              <div className="stack" style={{ gap: 8 }}>
                <Select
                  value={factoryModel}
                  options={modelOptions}
                  onChange={value => { setFactoryModel(value); setFactoryPreview(null); }}
                  disabled={models.length === 0}
                  label={t("aura.factoryModel")}
                  style={{ width: "100%" }}
                />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={() => void previewFactory()} disabled={!factoryModel || busy !== null}>{t("clients.preview")}</button>
                  <button className="btn btn-primary" onClick={() => void applyFactory()} disabled={!factoryModel || busy !== null}>{client.connected ? t("aura.reconnect") : t("aura.connectFactory")}</button>
                  {client.connected && <button className="btn btn-ghost" onClick={() => void restoreFactory()} disabled={busy !== null}>{t("aura.restoreFactory")}</button>}
                </div>
              </div>
            )}

            {(client.id === "zcode" || client.id === "generic") && (
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
