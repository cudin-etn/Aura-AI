import { useCallback, useEffect, useState } from "react";
import { Notice } from "../ui";
import { IconCheck, IconServer, IconBot, IconSparkle, IconGlobe, IconSliders } from "../icons";
import { useT } from "../i18n";
import { modelLabel } from "../model-display";
import AddProviderModal from "../components/AddProviderModal";
import { AuraRoutePreview } from "../components/AuraVisuals";

type ProfileId = "saver" | "balanced" | "quality";
type AuraProfile = {
  activeProfile: ProfileId;
  profiles: ProfileId[];
  available: string[];
  profile: { roles: { orchestrator: { model: string } } };
};
type AuraClient = {
  id: "codex" | "claude-code" | "opencode" | "zcode" | "factory" | "generic";
  label: string;
  maturity: "production" | "basic" | "experimental";
  configurable: boolean;
  connected: boolean;
};
type AuraCapability = {
  id: string;
  label: string;
  status: "available" | "partial" | "planned";
  endpoint?: string;
  note: string;
};
type AuraOptimizer = {
  enabled: boolean;
  deduplicate: boolean;
  reduceLogs: boolean;
  preset: "lite" | "full" | "ultra";
};
type Config = {
  defaultProvider: string;
  providers: Record<string, { disabled?: boolean }>;
};

type WizardClient = "codex" | "claude-code" | "opencode" | "factory" | "zcode" | "generic";
const WIZARD_DONE_KEY = "aura-setup-complete";

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
  const [capabilities, setCapabilities] = useState<AuraCapability[]>([]);
  const [optimizer, setOptimizer] = useState<AuraOptimizer | null>(null);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardProvider, setWizardProvider] = useState("");
  const [wizardModel, setWizardModel] = useState("");
  const [wizardClient, setWizardClient] = useState<WizardClient>("codex");
  const [wizardProfile, setWizardProfile] = useState<ProfileId>("balanced");
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerProbe, setProviderProbe] = useState<{ ok: boolean; text: string } | null>(null);
  const [wizardCollapsed, setWizardCollapsed] = useState(() => {
    try { return localStorage.getItem(WIZARD_DONE_KEY) === "1"; } catch { return false; }
  });

  const load = useCallback(async () => {
    try {
      const [configData, profileData, clientData, capabilityData, optimizerData] = await Promise.all([
        fetchJson<Config>(`${apiBase}/api/config`),
        fetchJson<AuraProfile>(`${apiBase}/api/aura/profile`),
        fetchJson<{ clients: AuraClient[] }>(`${apiBase}/api/aura/clients`),
        fetchJson<{ capabilities: AuraCapability[] }>(`${apiBase}/api/aura/capabilities`),
        fetchJson<AuraOptimizer>(`${apiBase}/api/aura/optimizer`),
      ]);
      setConfig(configData);
      setProfile(profileData);
      setClients(clientData.clients);
      setCapabilities(capabilityData.capabilities);
      setOptimizer(optimizerData);
      setModel(current => current || profileData.profile.roles.orchestrator.model);
      setWizardProvider(current => current || configData.defaultProvider);
      setWizardModel(current => current || profileData.profile.roles.orchestrator.model);
      setWizardProfile(profileData.activeProfile);
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

  const updateOptimizer = async (patch: Partial<AuraOptimizer>) => {
    if (!optimizer) return;
    setBusy("optimizer");
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/api/aura/optimizer`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json() as AuraOptimizer & { error?: string };
      if (!response.ok) throw new Error(data.error || t("aura.actionFail"));
      setOptimizer(data);
      setNotice({ ok: true, text: t("aura.optimizerSaved") });
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

  const testWizardProvider = async () => {
    if (!wizardProvider) return;
    setBusy("wizard-provider-test");
    setProviderProbe(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/api/providers/test?name=${encodeURIComponent(wizardProvider)}`, {
        method: "POST",
      });
      const body = await response.json() as { ok?: boolean; message?: string; error?: string };
      const ok = response.ok && body.ok !== false;
      setProviderProbe({
        ok,
        text: body.message || body.error || (ok ? t("wizard.testPassed") : t("wizard.testFailed")),
      });
    } catch (error) {
      setProviderProbe({
        ok: false,
        text: error instanceof Error ? error.message : t("wizard.testFailed"),
      });
    } finally {
      setBusy("");
    }
  };

  const applyWizard = async () => {
    if (!profile || !effectiveWizardModel || !wizardProvider) return;
    setBusy("wizard-apply");
    setNotice(null);
    try {
      const profileResponse = await fetch(`${apiBase}/api/aura/profile`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: wizardProfile,
          roles: { orchestrator: { model: effectiveWizardModel } },
        }),
      });
      const profileBody = await profileResponse.json() as AuraProfile & { error?: string };
      if (!profileResponse.ok) throw new Error(profileBody.error || t("aura.actionFail"));

      if (wizardClient === "opencode") {
        const clientResponse = await fetch(`${apiBase}/api/aura/clients/opencode`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: effectiveWizardModel }),
        });
        const clientBody = await clientResponse.json() as { error?: string };
        if (!clientResponse.ok) throw new Error(clientBody.error || t("aura.actionFail"));
      } else if (wizardClient === "factory") {
        const clientResponse = await fetch(`${apiBase}/api/aura/clients/factory`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: effectiveWizardModel }),
        });
        const clientBody = await clientResponse.json() as { error?: string };
        if (!clientResponse.ok) throw new Error(clientBody.error || t("aura.actionFail"));
      } else if (wizardClient === "claude-code") {
        const clientResponse = await fetch(`${apiBase}/api/claude-code`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: true, model: effectiveWizardModel }),
        });
        const clientBody = await clientResponse.json() as { error?: string };
        if (!clientResponse.ok) throw new Error(clientBody.error || t("aura.actionFail"));
      }

      await load();
      setNotice({ ok: true, text: t("wizard.applied") });
      setWizardStep(0);
      setWizardCollapsed(true);
      try { localStorage.setItem(WIZARD_DONE_KEY, "1"); } catch { /* ignore */ }
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
  const wizardProviderModels = profile?.available.filter(item => item.startsWith(`${wizardProvider}/`)) ?? [];
  const wizardModels = wizardProviderModels.length > 0 ? wizardProviderModels : profile?.available ?? [];
  const effectiveWizardModel = wizardModels.includes(wizardModel) ? wizardModel : wizardModels[0] ?? "";
  const setupReady = enabledProviders > 0
    && Boolean(effectiveWizardModel)
    && clients.some(client => client.connected && client.maturity === "production");

  const selectWizardProvider = (provider: string) => {
    setWizardProvider(provider);
    setProviderProbe(null);
    const matchingModels = profile?.available.filter(item => item.startsWith(`${provider}/`)) ?? [];
    if (matchingModels.length > 0 && !matchingModels.includes(wizardModel)) {
      setWizardModel(matchingModels[0]);
    }
  };

  return (
    <>
      <div className="page-head"><h2>{t("aura.title")}</h2></div>
      <p className="page-sub">{t("aura.subtitle")}</p>
      {notice && <Notice tone={notice.ok ? "ok" : "err"}>{notice.text}</Notice>}

      <section className={`onboarding-card${wizardCollapsed ? " collapsed" : ""}`}>
        <div className="onboarding-head">
          <div>
            <div className="onboarding-title">
              <span className={`onboarding-status${setupReady ? " ready" : ""}`}><IconSparkle /></span>
              <span>
                <strong>{wizardCollapsed && setupReady ? t("wizard.readyTitle") : t("wizard.title")}</strong>
                <small>{wizardCollapsed && setupReady ? t("wizard.readyHint") : t("wizard.subtitle")}</small>
              </span>
            </div>
          </div>
          <div className="onboarding-head-actions">
            {!wizardCollapsed && <span className="badge badge-accent">{t("wizard.step", { current: wizardStep + 1, total: 4 })}</span>}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWizardCollapsed(value => !value)}>
              {wizardCollapsed ? t("wizard.change") : t("wizard.collapse")}
            </button>
          </div>
        </div>

        {!wizardCollapsed && <div className="onboarding-workspace">
          <div className="onboarding-form">
        <div className="wizard-progress" aria-hidden><i style={{ width: `${((wizardStep + 1) / 4) * 100}%` }} /></div>
        <div className="wizard-steps">
          {[t("wizard.provider"), t("wizard.model"), t("wizard.client"), t("wizard.review")].map((label, index) => (
            <button
              type="button"
              key={label}
              className={`btn btn-sm ${wizardStep === index ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setWizardStep(index)}
              disabled={index > wizardStep + 1}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {wizardStep === 0 && (
          <div className="stack" style={{ gap: 10 }}>
            <label className="text-label" htmlFor="aura-wizard-provider">{t("wizard.provider")}</label>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select id="aura-wizard-provider" className="input" value={wizardProvider} onChange={event => selectWizardProvider(event.target.value)} style={{ minWidth: 240, flex: 1 }}>
                {Object.keys(config?.providers ?? {}).map(name => <option value={name} key={name}>{name}</option>)}
              </select>
              <button type="button" className="btn btn-ghost" onClick={() => setProviderModalOpen(true)}>{t("wizard.addProvider")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => void testWizardProvider()} disabled={!wizardProvider || !!busy}>{t("wizard.test")}</button>
            </div>
            {providerProbe && <Notice tone={providerProbe.ok ? "ok" : "err"}>{providerProbe.text}</Notice>}
            <button type="button" className="btn btn-primary" onClick={() => setWizardStep(1)} disabled={!wizardProvider}>{t("wizard.continue")}</button>
          </div>
        )}

        {wizardStep === 1 && (
          <div className="stack" style={{ gap: 10 }}>
            <label className="text-label" htmlFor="aura-wizard-model">{t("wizard.model")}</label>
            <select id="aura-wizard-model" className="input" value={effectiveWizardModel} onChange={event => setWizardModel(event.target.value)}>
              {wizardModels.map(item => <option key={item} value={item}>{modelLabel(item)}</option>)}
            </select>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setWizardStep(0)}>{t("wizard.back")}</button>
              <button type="button" className="btn btn-primary" onClick={() => setWizardStep(2)} disabled={!effectiveWizardModel}>{t("wizard.continue")}</button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="text-label">{t("wizard.client")}</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {(["codex", "claude-code", "opencode", "factory", "zcode", "generic"] as const).map(client => (
                <button type="button" key={client} className={`btn ${wizardClient === client ? "btn-primary" : "btn-ghost"}`} onClick={() => setWizardClient(client)}>
                  {client === "codex" ? "Codex"
                    : client === "claude-code" ? "Claude Code"
                      : client === "opencode" ? "OpenCode"
                        : client === "factory" ? "Factory Droid"
                          : client === "zcode" ? "ZCode" : "Other AI agent"}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setWizardStep(1)}>{t("wizard.back")}</button>
              <button type="button" className="btn btn-primary" onClick={() => setWizardStep(3)}>{t("wizard.continue")}</button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="grid-2">
              <div><span className="muted text-label">{t("wizard.provider")}</span><br /><code>{wizardProvider}</code></div>
              <div><span className="muted text-label">{t("wizard.model")}</span><br /><code>{effectiveWizardModel}</code></div>
              <div><span className="muted text-label">{t("wizard.client")}</span><br /><code>{wizardClient}</code></div>
              <div>
                <span className="muted text-label">{t("aura.profile")}</span><br />
                <select className="input" value={wizardProfile} onChange={event => setWizardProfile(event.target.value as ProfileId)}>
                  {profile?.profiles.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <Notice tone="ok">{t("wizard.reviewHint")}</Notice>
            {(wizardClient === "zcode" || wizardClient === "generic") && <Notice tone="ok">{t("wizard.manualClientHint")}</Notice>}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setWizardStep(2)}>{t("wizard.back")}</button>
              <button type="button" className="btn btn-primary" onClick={() => void applyWizard()} disabled={!!busy}>{t("wizard.apply")}</button>
            </div>
          </div>
        )}
          </div>
          <AuraRoutePreview
            client={wizardClient === "claude-code" ? "Claude Code"
              : wizardClient === "opencode" ? "OpenCode"
                : wizardClient === "factory" ? "Factory Droid"
                  : wizardClient === "zcode" ? "ZCode"
                    : wizardClient === "generic" ? "Other AI agent" : "Codex"}
            provider={wizardProvider}
            model={effectiveWizardModel}
            profile={wizardProfile}
            activeStep={wizardStep}
            ready={setupReady}
          />
        </div>}
      </section>

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

      <div className="grid-2" style={{ alignItems: "start", marginTop: 18 }}>
        <section className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 10 }}>
            <IconGlobe aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
            <div>
              <div className="h-section" style={{ margin: 0 }}>{t("aura.capabilitiesTitle")}</div>
              <p className="muted">{t("aura.capabilitiesHint")}</p>
            </div>
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {capabilities.map(capability => (
              <div key={capability.id} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{capability.label}</strong>
                  <div className="muted text-label">{capability.endpoint ?? capability.note}</div>
                </div>
                <span className={`badge ${capability.status === "available" ? "badge-accent" : capability.status === "partial" ? "badge-warn" : "badge-muted"}`}>
                  {t(`aura.capability.${capability.status}` as "aura.capability.available")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 10 }}>
            <IconSliders aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
            <div>
              <div className="h-section" style={{ margin: 0 }}>{t("aura.tokenSaverTitle")}</div>
              <p className="muted">{t("aura.tokenSaverHint")}</p>
            </div>
          </div>
          {optimizer && (
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <div><strong>{t("aura.tokenSaverEnabled")}</strong><div className="muted text-label">{t("aura.tokenSaverMeasured")}</div></div>
                <button type="button" className={`toggle ${optimizer.enabled ? "on" : ""}`} aria-pressed={optimizer.enabled} onClick={() => void updateOptimizer({ enabled: !optimizer.enabled })} disabled={!!busy}>
                  <span className="toggle-knob" />
                </button>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {(["lite", "full", "ultra"] as const).map(preset => (
                  <button key={preset} type="button" className={`btn ${optimizer.preset === preset ? "btn-primary" : "btn-ghost"}`} onClick={() => void updateOptimizer({ preset })} disabled={!!busy}>
                    {t(`aura.tokenSaver.${preset}` as "aura.tokenSaver.lite")}
                  </button>
                ))}
              </div>
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={optimizer.deduplicate} onChange={event => void updateOptimizer({ deduplicate: event.target.checked })} disabled={!!busy} />
                <span>{t("aura.tokenSaverDedup")}</span>
              </label>
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={optimizer.reduceLogs} onChange={event => void updateOptimizer({ reduceLogs: event.target.checked })} disabled={!!busy} />
                <span>{t("aura.tokenSaverLogs")}</span>
              </label>
            </div>
          )}
        </section>
      </div>

      {providerModalOpen && (
        <AddProviderModal
          apiBase={apiBase}
          existingNames={Object.keys(config?.providers ?? {})}
          onClose={() => setProviderModalOpen(false)}
          onAdded={name => {
            setProviderModalOpen(false);
            selectWizardProvider(name);
            void load();
          }}
        />
      )}
    </>
  );
}
