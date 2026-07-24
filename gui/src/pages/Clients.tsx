import { useCallback, useEffect, useState } from "react";
import ClaudeCode from "./ClaudeCode";
import { Notice } from "../ui";
import { useT, type TKey } from "../i18n";

type ClientRow = {
  id: "codex" | "claude-code" | "opencode" | "zcode";
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

const CLIENT_HINT_KEYS: Record<ClientRow["id"], TKey> = {
  codex: "clients.codex.hint",
  "claude-code": "clients.claude-code.hint",
  opencode: "clients.opencode.hint",
  zcode: "clients.zcode.hint",
};

export default function Clients({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [preview, setPreview] = useState<OpenCodePreview | null>(null);
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
      setModel(current => current && available.includes(current) ? current : (available[0] ?? ""));
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
    if (!model) return;
    setBusy("opencode-preview");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode?model=${encodeURIComponent(model)}`);
      const body = await response.json() as OpenCodePreview & { error?: string };
      if (!response.ok) throw new Error(body.error || t("clients.previewFailed"));
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
    if (!model) return;
    setBusy("opencode-apply");
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
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

  return (
    <>
      <div className="page-head"><h2>{t("nav.clients")}</h2></div>
      <p className="page-sub">{t("aura.clientsHint")}</p>
      {status && <Notice tone={ok ? "ok" : "err"}>{status}</Notice>}

      <div className="grid-2">
        {clients.map(client => (
          <section className="card" style={{ padding: 16 }} key={client.id}>
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
                <select className="input" value={model} onChange={event => { setModel(event.target.value); setPreview(null); }} aria-label={t("aura.openCodeModel")}>
                  {models.length === 0 && <option value="">{t("models.noRouted")}</option>}
                  {models.map(candidate => <option value={candidate} key={candidate}>{candidate}</option>)}
                </select>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={() => void previewOpenCode()} disabled={!model || busy !== null}>{t("clients.preview")}</button>
                  <button className="btn btn-primary" onClick={() => void applyOpenCode()} disabled={!model || busy !== null}>{client.connected ? t("aura.reconnect") : t("aura.connect")}</button>
                  {client.connected && <button className="btn btn-ghost" onClick={() => void restoreOpenCode()} disabled={busy !== null}>{t("aura.restore")}</button>}
                </div>
                {preview && (
                  <div className="notice notice-ok text-label">
                    <div><strong>{t("clients.previewPath")}:</strong> <code>{preview.path}</code></div>
                    <div><strong>{t("clients.previewChanges")}:</strong> <code>{preview.changes.join(", ")}</code></div>
                  </div>
                )}
              </div>
            )}

            {client.id === "zcode" && <span className="muted text-label">{t("clients.experimental")}</span>}
          </section>
        ))}
      </div>

      {showClaude && (
        <section className="card" style={{ padding: 16, marginTop: 18 }}>
          <ClaudeCode apiBase={apiBase} />
        </section>
      )}
    </>
  );
}
