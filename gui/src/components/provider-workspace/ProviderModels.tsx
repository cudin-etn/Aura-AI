/**
 * ProviderModels — the models tab: searchable wrapping model chips with
 * default/selected flags and copy-to-clipboard ids. Uses a wrap layout so
 * short lists fill horizontal space instead of a tall single-column stack.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../../i18n";
import type { WorkspaceItem } from "../../provider-workspace/catalog";
import { filterModels } from "../../provider-workspace/report";
import { Notice } from "../../ui";

type CapabilityDescriptor = {
  id: string;
  protocol: "responses" | "chat-completions" | "messages";
  authentication: { kind: string; keyOptional: boolean };
  discovery: { live: boolean; models: string[] };
  capabilities: {
    compact: "native" | "synthetic";
    reasoningDeclared: boolean;
    visionDeclared: boolean;
  };
};

type ProbeResult = {
  ok: boolean;
  latencyMs?: number;
  models?: number;
  message?: string;
  error?: string;
};

export default function ProviderModels({
  item,
  apiBase,
  availableModels,
  selectedModels,
  modelsLoading = false,
  modelsLoadFailed = false,
  needsReauth = false,
  onRetryModels,
  onOpenAccounts,
}: {
  item: WorkspaceItem;
  apiBase: string;
  availableModels: string[];
  selectedModels: string[];
  modelsLoading?: boolean;
  modelsLoadFailed?: boolean;
  /** Active OAuth account needs a fresh login before live discovery works. */
  needsReauth?: boolean;
  onRetryModels?: () => void;
  onOpenAccounts?: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [capability, setCapability] = useState<CapabilityDescriptor | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const copyResetRef = useRef<number | null>(null);
  const selectedSet = useMemo(() => new Set(selectedModels), [selectedModels]);
  const configuredModels = useMemo(() => item.models ?? [], [item.models]);
  const models = useMemo(
    () => filterModels(availableModels, item.defaultModel, query, configuredModels),
    [availableModels, item.defaultModel, query, configuredModels],
  );

  useEffect(() => () => {
    if (copyResetRef.current != null) window.clearTimeout(copyResetRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/aura/providers`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((body: { providers?: CapabilityDescriptor[] }) => {
        if (!cancelled) setCapability(body.providers?.find(provider => provider.id === item.name) ?? null);
      })
      .catch(() => { if (!cancelled) setCapability(null); });
    return () => { cancelled = true; };
  }, [apiBase, item.name]);

  const runProbe = async () => {
    setProbeBusy(true);
    setProbe(null);
    try {
      const response = await fetch(`${apiBase}/api/providers/test?name=${encodeURIComponent(item.name)}`, {
        method: "POST",
      });
      const body = await response.json() as ProbeResult;
      setProbe(response.ok ? body : { ...body, ok: false });
    } catch {
      setProbe({ ok: false, error: t("pws.capabilityProbeNetwork") });
    } finally {
      setProbeBusy(false);
    }
  };

  const copyModelId = async (modelId: string) => {
    try {
      await navigator.clipboard.writeText(modelId);
      setCopiedId(modelId);
      if (copyResetRef.current != null) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => {
        setCopiedId(prev => (prev === modelId ? null : prev));
        copyResetRef.current = null;
      }, 1200);
    } catch {
      /* ignore clipboard failures */
    }
  };

  const emptyBase = availableModels.length === 0 && configuredModels.length === 0 && !item.defaultModel;
  const showingConfiguredFallback = availableModels.length === 0 && configuredModels.length > 0;
  // Aggregators (OpenRouter etc.) can return thousands of ids; capping the mounted
  // chips keeps the tab responsive. Filtering narrows the list, so the cap only
  // bites on the unfiltered full catalog.
  const CHIP_RENDER_CAP = 300;
  const capped = models.length > CHIP_RENDER_CAP;
  const visibleModels = capped ? models.slice(0, CHIP_RENDER_CAP) : models;

  return (
    <div className="pws-section">
      <div className="pws-section-head">
        <h3 className="pws-section-title">{t("pws.tab.models")}</h3>
        <div className="row" style={{ gap: 8 }}>
          {models.length > 0 && (
            <span className="muted">{t("pws.modelsAvailable", { count: models.length })}</span>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void runProbe()} disabled={probeBusy}>
            {probeBusy ? t("pws.capabilityProbing") : t("pws.capabilityProbe")}
          </button>
        </div>
      </div>
      {capability && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <strong className="text-label">{t("pws.capabilityTitle")}</strong>
          <div className="row text-label" style={{ gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <span>{t("pws.capabilityProtocol")}: <code>{capability.protocol}</code></span>
            <span>{t("pws.capabilityCompact")}: <code>{capability.capabilities.compact}</code></span>
            <span>{t("pws.capabilityReasoning")}: {capability.capabilities.reasoningDeclared ? t("pws.capabilityDeclared") : t("pws.capabilityUnknown")}</span>
            <span>{t("pws.capabilityVision")}: {capability.capabilities.visionDeclared ? t("pws.capabilityDeclared") : t("pws.capabilityUnknown")}</span>
          </div>
        </div>
      )}
      {probe && (
        <Notice tone={probe.ok ? "ok" : "err"}>
          {probe.ok
            ? (probe.message ?? t("pws.capabilityProbeOk", { latency: probe.latencyMs ?? 0 }))
            : (probe.error ?? t("pws.capabilityProbeFailed"))}
        </Notice>
      )}
      {needsReauth && (
        <div className="pws-inline-error" role="status">
          <span>{t("pws.modelsNeedsReauth")}</span>
          {onOpenAccounts && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenAccounts}>
              {t("pws.tab.accounts")}
            </button>
          )}
        </div>
      )}
      {showingConfiguredFallback && !needsReauth && (
        <p className="muted text-label" style={{ marginBottom: 10 }}>{t("pws.modelsConfiguredFallback")}</p>
      )}
      {!emptyBase && (
        <input
          type="search"
          className="input pws-model-search"
          placeholder={t("pws.modelSearchPlaceholder")}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label={t("pws.modelSearchPlaceholder")}
        />
      )}
      {modelsLoading && emptyBase ? (
        <p className="muted" role="status">{t("pws.modelsLoading")}</p>
      ) : modelsLoadFailed && emptyBase ? (
        <div role="alert" className="pws-inline-error">
          <span>{t("pws.modelsLoadFailed")}</span>
          {onRetryModels && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetryModels}>
              {t("pws.retry")}
            </button>
          )}
        </div>
      ) : emptyBase ? (
        <p className="muted">{t("pws.noModels")}</p>
      ) : models.length === 0 ? (
        <p className="muted" role="status">{t("pws.noModelMatch")}</p>
      ) : (
        <div className="pws-model-list" role="list">
          {visibleModels.map(modelId => {
            const isDefault = modelId === item.defaultModel;
            const isSelected = selectedSet.has(modelId);
            const copied = copiedId === modelId;
            return (
              <div key={modelId} className="pws-model-chip" role="listitem">
                <button
                  type="button"
                  className="pws-model-chip-main"
                  onClick={() => { void copyModelId(modelId); }}
                  title={modelId}
                  aria-label={copied ? t("pws.modelCopied") : t("pws.copyModelId")}
                >
                  <span className="pws-model-id">{modelId}</span>
                </button>
                {isDefault ? <span className="badge badge-muted pws-model-flag">{t("prov.defaultBadge")}</span> : null}
                {isSelected ? <span className="badge badge-accent pws-model-flag">{t("pws.selected")}</span> : null}
              </div>
            );
          })}
        </div>
      )}
      {capped && (
        <p className="muted text-label" style={{ marginTop: 10 }}>
          {t("pws.modelsTruncated", { shown: String(CHIP_RENDER_CAP), total: String(models.length) })}
        </p>
      )}
    </div>
  );
}
