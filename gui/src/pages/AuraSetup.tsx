import { useCallback, useEffect, useState } from "react";
import { Notice } from "../ui";
import { IconCheck, IconServer, IconBot, IconSparkle } from "../icons";
import { useT } from "../i18n";
import { modelLabel } from "../model-display";

type ProfileId = "saver" | "balanced" | "quality";
type AuraProfile = {
  activeProfile: ProfileId;
  profiles: ProfileId[];
  available: string[];
  profile: { roles: { orchestrator: { model: string } } };
};
type AuraClient = {
  id: "codex" | "claude-code" | "opencode" | "zcode";
  label: string;
  maturity: "production" | "basic" | "experimental";
  configurable: boolean;
  connected: boolean;
};
type Config = {
  defaultProvider: string;
  providers: Record<string, { disabled?: boolean }>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

export default function AuraSetup({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(null);
  const [profile, setProfile] = useState<AuraProfile | null>(null);
  const [clients, setClients] = useState<AuraClient[]>([]);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [configData, profileData, clientData] = await Promise.all([
        fetchJson<Config>(`${apiBase}/api/config`),
        fetchJson<AuraProfile>(`${apiBase}/api/aura/profile`),
        fetchJson<{ clients: AuraClient[] }>(`${apiBase}/api/aura/clients`),
      ]);
      setConfig(configData);
      setProfile(profileData);
      setClients(clientData.clients);
      setModel(current => current || profileData.profile.roles.orchestrator.model);
    } catch {
      setNotice({ ok: false, text: t("aura.loadFail") });
    }
  }, [apiBase, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const applyProfile = async (next: ProfileId) => {
    setBusy(next);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/api/aura/profile`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: next }),
      });
      const data = await response.json() as AuraProfile & { error?: string };
      if (!response.ok) throw new Error(data.error || t("aura.actionFail"));
      setProfile(data);
      setModel(data.profile.roles.orchestrator.model);
      setNotice({ ok: true, text: t("aura.saved") });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : t("aura.actionFail") });
    } finally {
      setBusy("");
    }
  };

  const updateOpenCode = async (method: "PUT" | "DELETE") => {
    setBusy("opencode");
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/api/aura/clients/opencode`, {
        method,
        ...(method === "PUT" ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model }),
        } : {}),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("aura.actionFail"));
      await load();
      setNotice({ ok: true, text: method === "PUT" ? t("aura.connected") : t("aura.restored") });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : t("aura.actionFail") });
    } finally {
      setBusy("");
    }
  };

  const enabledProviders = config
    ? Object.values(config.providers).filter(provider => !provider.disabled).length
    : 0;
  const openCode = clients.find(client => client.id === "opencode");

  return (
    <>
      <div className="page-head"><h2>{t("aura.title")}</h2></div>
      <p className="page-sub">{t("aura.subtitle")}</p>
      {notice && <Notice tone={notice.ok ? "ok" : "err"}>{notice.text}</Notice>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 10 }}>
            <IconServer aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
            <div>
              <div className="h-section" style={{ margin: 0 }}>{t("aura.providers")}</div>
              <p className="muted">{t("aura.providersHint", { n: enabledProviders })}</p>
            </div>
          </div>
          <p><strong>{config?.defaultProvider ?? "—"}</strong></p>
          <a className="btn btn-ghost" href="#providers">{t("aura.openProviders")}</a>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 10 }}>
            <IconBot aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
            <div>
              <div className="h-section" style={{ margin: 0 }}>{t("aura.profile")}</div>
              <p className="muted">{t("aura.profileHint")}</p>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
            {profile?.profiles.map(item => (
              <button
                key={item}
                type="button"
                className={`btn ${profile.activeProfile === item ? "btn-primary" : "btn-ghost"}`}
                disabled={!!busy}
                onClick={() => void applyProfile(item)}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <a className="btn btn-ghost" href="#subagents">{t("aura.editRoles")}</a>
        </section>
      </div>

      <section className="card" style={{ padding: 16, marginTop: 18 }}>
        <div className="row" style={{ gap: 10 }}>
          <IconSparkle aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div>
            <div className="h-section" style={{ margin: 0 }}>{t("aura.clients")}</div>
            <p className="muted">{t("aura.clientsHint")}</p>
          </div>
        </div>
        <div className="stack" style={{ gap: 10, marginTop: 14 }}>
          {clients.map(client => (
            <div key={client.id} className="row card panel-accent" style={{ padding: 12, gap: 12 }}>
              <IconCheck
                aria-hidden
                style={{ width: 18, height: 18, flexShrink: 0, color: client.connected ? "var(--ok)" : "var(--muted)" }}
              />
              <div style={{ flex: 1 }}>
                <strong>{client.label}</strong>
                <div className="muted text-label">{client.maturity}</div>
              </div>
              <span className="badge">{client.connected ? t("aura.connectedState") : t("aura.notConnected")}</span>
            </div>
          ))}
        </div>

        {openCode && (
          <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <select
              className="input"
              value={model}
              onChange={event => setModel(event.target.value)}
              aria-label={t("aura.openCodeModel")}
              style={{ minWidth: 260, flex: 1 }}
            >
              {profile?.available.map(item => <option key={item} value={item}>{modelLabel(item)}</option>)}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busy || !model}
              onClick={() => void updateOpenCode("PUT")}
            >
              {openCode.connected ? t("aura.reconnect") : t("aura.connect")}
            </button>
            {openCode.connected && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!!busy}
                onClick={() => void updateOpenCode("DELETE")}
              >
                {t("aura.restore")}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
