import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { IconCheck, IconKey, IconLink, IconLock, IconServer, IconX } from "../icons";
import { useT } from "../i18n";

type Integration = {
  id: string;
  name: string;
  category: string;
  description: string;
  authModes: string[];
  capabilities: string[];
  upstream: string;
  clientSupport: Array<{ clientId: string; grade: "auto" | "partial" | "guided" }>;
  docsUrl?: string;
};

type Connection = {
  id: string;
  integrationId: string;
  label: string;
  status: "disconnected" | "pending-auth" | "connected" | "error";
  authMode: string;
  scopes: string[];
  resource?: string;
  updatedAt: string;
};

type AgentExport = {
  clientId: string;
  grade: "auto" | "partial" | "guided";
  mcp: { command: "aura"; args: ["mcp"] };
  connections: Array<Connection & { integrationName: string }>;
};

const CATEGORY_ORDER = ["code", "backend", "deploy", "monitoring", "project", "communication"];

export default function Integrations({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Integration | null>(null);

  const load = async () => {
    try {
      const response = await fetch(`${apiBase}/api/integrations`);
      if (!response.ok) throw new Error("integration request failed");
      const data = await response.json() as { integrations?: Integration[]; connections?: Connection[] };
      setIntegrations(data.integrations ?? []);
      setConnections(data.connections ?? []);
      setError(null);
    } catch {
      setError(t("integrations.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/integrations`)
      .then(response => {
        if (!response.ok) throw new Error("integration request failed");
        return response.json() as Promise<{ integrations?: Integration[]; connections?: Connection[] }>;
      })
      .then(data => {
        if (cancelled) return;
        setIntegrations(data.integrations ?? []);
        setConnections(data.connections ?? []);
        setError(null);
      })
      .catch(() => { if (!cancelled) setError(t("integrations.loadError")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, t]);

  const refresh = () => {
    setLoading(true);
    void load();
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return integrations.filter(item => !needle || `${item.name} ${item.description}`.toLowerCase().includes(needle));
  }, [integrations, query]);

  const connectionFor = (id: string) => connections.find(connection => connection.integrationId === id);

  return (
    <div className="page-content integrations-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow"><IconLink aria-hidden /> {t("integrations.eyebrow")}</p>
          <h1>{t("integrations.title")}</h1>
          <p className="page-sub">{t("integrations.subtitle")}</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={refresh} disabled={loading}>
          <IconLink aria-hidden /> {t("integrations.refresh")}
        </button>
      </div>

      <div className="integration-callout panel panel-accent">
        <div className="integration-callout-icon"><IconLock aria-hidden /></div>
        <div>
          <strong>{t("integrations.vaultTitle")}</strong>
          <p>{t("integrations.vaultHint")}</p>
        </div>
        <span className="status-badge status-badge--info"><IconKey aria-hidden /> {t("integrations.oneTime")}</span>
      </div>

      <AgentExportPanel apiBase={apiBase} />

      <label className="integration-search">
        <span className="sr-only">{t("integrations.search")}</span>
        <input className="input" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("integrations.searchPlaceholder")} />
      </label>

      {error && <div className="notice notice-err">{error}</div>}
      {loading && <div className="page-loading"><span className="spin" />{t("common.loading")}</div>}
      {!loading && filtered.length === 0 && <div className="panel empty-state"><IconServer aria-hidden /><strong>{t("integrations.empty")}</strong></div>}

      {!loading && CATEGORY_ORDER.map(category => {
        const items = filtered.filter(item => item.category === category);
        if (items.length === 0) return null;
        return (
          <section className="integration-group" key={category}>
            <div className="section-label">{t(`integrations.category.${category}` as never)}</div>
            <div className="integration-grid">
              {items.map(item => {
                const connection = connectionFor(item.id);
                const autoCount = item.clientSupport.filter(client => client.grade === "auto").length;
                return (
                  <article className="integration-card panel" key={item.id}>
                    <div className="integration-card-head">
                      <div className="integration-mark"><IconServer aria-hidden /></div>
                      <div className="integration-title"><h2>{item.name}</h2><span>{item.upstream}</span></div>
                      <span className={`status-badge ${connection?.status === "pending-auth" ? "status-badge--warn" : connection?.status === "connected" ? "status-badge--ok" : "status-badge--muted"}`}>
                        {connection?.status === "pending-auth" ? t("integrations.pending") : connection?.status === "connected" ? <><IconCheck aria-hidden /> {t("integrations.connected")}</> : t("integrations.available")}
                      </span>
                    </div>
                    <p>{t(`integrations.service.${item.id}` as never)}</p>
                    <div className="integration-meta">
                      <span>{t("integrations.autoClients", { n: autoCount })}</span>
                      <span>{item.authModes.join(" · ")}</span>
                    </div>
                    <div className="integration-card-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => setSelected(item)}>{t("integrations.prepare")}</button>
                      {item.docsUrl && <a className="btn btn-text" href={item.docsUrl} target="_blank" rel="noreferrer">{t("integrations.docs")}</a>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      {selected && (
        <IntegrationPrepareModal
          apiBase={apiBase}
          integration={selected}
          onClose={() => setSelected(null)}
          onPrepared={connection => {
            setConnections(current => [...current, connection]);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function AgentExportPanel({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [clientId, setClientId] = useState("codex");
  const [exportPlan, setExportPlan] = useState<AgentExport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/integrations/export?client=${encodeURIComponent(clientId)}`)
      .then(response => response.ok ? response.json() as Promise<{ export?: AgentExport }> : Promise.reject(new Error("export failed")))
      .then(data => { if (!cancelled) setExportPlan(data.export ?? null); })
      .catch(() => { if (!cancelled) setExportPlan(null); });
    return () => { cancelled = true; };
  }, [apiBase, clientId]);

  const copy = async () => {
    if (!exportPlan) return;
    const declaration = JSON.stringify({ mcpServers: { aura: exportPlan.mcp } }, null, 2);
    try { await navigator.clipboard.writeText(declaration); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <section className="integration-export panel">
      <div>
        <p className="eyebrow"><IconServer aria-hidden /> {t("integrations.mcp")}</p>
        <h2>{t("integrations.exportTitle")}</h2>
        <p>{t("integrations.exportHint")}</p>
      </div>
      <div className="integration-export-controls">
        <label className="field-label">
          <span>{t("integrations.exportClient")}</span>
          <select className="input" value={clientId} onChange={event => setClientId(event.target.value)}>
            <option value="codex">{t("integrations.export.codex")}</option><option value="claude-code">{t("integrations.export.claudeCode")}</option><option value="claude-desktop">{t("integrations.export.claudeDesktop")}</option>
            <option value="opencode">{t("integrations.export.opencode")}</option><option value="cursor">{t("integrations.export.cursor")}</option><option value="generic">{t("integrations.export.generic")}</option>
          </select>
        </label>
        <button className="btn btn-ghost" type="button" onClick={() => void copy()} disabled={!exportPlan}>{copied ? <><IconCheck aria-hidden /> {t("integrations.exportCopied")}</> : t("integrations.exportCopy")}</button>
      </div>
      {exportPlan?.connections.length ? (
        <p className="integration-export-ready">{exportPlan.connections.map(item => item.integrationName).join(" · ")}</p>
      ) : <p className="integration-export-ready integration-export-empty">{t("integrations.exportEmpty")}</p>}
      <pre className="integration-export-code" aria-label={t("integrations.exportCode")}>{JSON.stringify({ mcpServers: { aura: exportPlan?.mcp ?? { command: "aura", args: ["mcp"] } } }, null, 2)}</pre>
    </section>
  );
}

function IntegrationPrepareModal({
  apiBase,
  integration,
  onClose,
  onPrepared,
}: {
  apiBase: string;
  integration: Integration;
  onClose: () => void;
  onPrepared: (connection: Connection) => void;
}) {
  const t = useT();
  const [label, setLabel] = useState(integration.name);
  const [resource, setResource] = useState("");
  const [authMode, setAuthMode] = useState(integration.authModes[0] ?? "mcp");
  const [scopes, setScopes] = useState<string[]>([integration.capabilities[0] ?? "read"]);
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, button, select")?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const toggleScope = (scope: string) => {
    setScopes(current => current.includes(scope)
      ? current.length > 1 ? current.filter(item => item !== scope) : current
      : [...current, scope]);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/integrations/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: integration.id, label, resource, authMode, scopes, ...(secret ? { secret } : {}) }),
      });
      const data = await response.json() as { connection?: Connection; error?: string };
      if (!response.ok || !data.connection) throw new Error(data.error || "could not prepare integration");
      onPrepared(data.connection);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("integrations.prepareError"));
    } finally {
      setSaving(false);
    }
  };

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="integration-prepare-title" className="modal-card integration-modal" onMouseDown={event => event.stopPropagation()} onKeyDown={trapFocus}>
        <div className="modal-head">
          <div>
            <p className="eyebrow"><IconLink aria-hidden /> {t("integrations.eyebrow")}</p>
            <h2 id="integration-prepare-title">{t("integrations.prepareTitle", { name: integration.name })}</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t("common.close")}><IconX /></button>
        </div>
        <p className="modal-copy">{t("integrations.prepareHint")}</p>
        <label className="field-label">
          <span>{t("integrations.connectionLabel")}</span>
          <input className="input" value={label} maxLength={80} onChange={event => setLabel(event.target.value)} />
        </label>
        <label className="field-label">
          <span>{t("integrations.resource")}</span>
          <input className="input" value={resource} maxLength={240} placeholder={t("integrations.resourcePlaceholder")} onChange={event => setResource(event.target.value)} />
        </label>
        <fieldset className="integration-fieldset">
          <legend>{t("integrations.authMode")}</legend>
          <div className="integration-choice-row">
            {integration.authModes.map(mode => (
              <label key={mode} className="integration-choice"><input type="radio" name="integration-auth" checked={authMode === mode} onChange={() => setAuthMode(mode)} /> {mode}</label>
            ))}
          </div>
        </fieldset>
        {authMode === "api-key" && (
          <label className="field-label">
            <span>{t("integrations.apiKey")}</span>
            <input className="input" type="password" autoComplete="off" value={secret} placeholder={t("integrations.apiKeyPlaceholder")} onChange={event => setSecret(event.target.value)} />
          </label>
        )}
        <fieldset className="integration-fieldset">
          <legend>{t("integrations.scopes")}</legend>
          <div className="integration-choice-row">
            {integration.capabilities.map(scope => (
              <label key={scope} className="integration-choice"><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} /> {scope}</label>
            ))}
          </div>
        </fieldset>
        {error && <div className="notice notice-err" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>{t("common.cancel")}</button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving || !label.trim() || (authMode === "api-key" && !secret.trim())}>{saving ? t("common.loading") : t("integrations.prepare")}</button>
        </div>
      </div>
    </div>
  );
}
