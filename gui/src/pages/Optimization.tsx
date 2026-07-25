import { useCallback, useEffect, useState } from "react";
import { IconSliders } from "../icons";
import { Notice } from "../ui";
import { useT, type TKey } from "../i18n";

type Optimizer = {
  enabled: boolean;
  deduplicate: boolean;
  reduceLogs: boolean;
  preset: "lite" | "full" | "ultra";
};

export default function Optimization({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [optimizer, setOptimizer] = useState<Optimizer | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/aura/optimizer`);
      const body = await response.json() as Optimizer & { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.loadFail"));
      setOptimizer(body);
    } catch (cause) {
      setNotice({ ok: false, text: cause instanceof Error ? cause.message : t("aura.loadFail") });
    }
  }, [apiBase, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = async (patch: Partial<Optimizer>) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/api/aura/optimizer`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json() as Optimizer & { error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.actionFail"));
      setOptimizer(body);
      setNotice({ ok: true, text: t("aura.optimizerSaved") });
    } catch (cause) {
      setNotice({ ok: false, text: cause instanceof Error ? cause.message : t("aura.actionFail") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head"><h2>{t("nav.optimization")}</h2></div>
      <p className="page-sub">{t("optimization.subtitle")}</p>
      {notice && <Notice tone={notice.ok ? "ok" : "err"}>{notice.text}</Notice>}

      {optimizer && (
        <section className="card" style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 16 }}>
            <div className="row" style={{ gap: 10 }}>
              <IconSliders aria-hidden style={{ width: 22, height: 22 }} />
              <div><h3 style={{ margin: 0 }}>{t("aura.tokenSaverTitle")}</h3><p className="muted" style={{ margin: "4px 0 0" }}>{t("aura.tokenSaverMeasured")}</p></div>
            </div>
            <button type="button" className={`toggle ${optimizer.enabled ? "on" : ""}`} aria-pressed={optimizer.enabled} aria-label={t("aura.tokenSaverEnabled")} onClick={() => void update({ enabled: !optimizer.enabled })} disabled={busy}>
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {(["lite", "full", "ultra"] as const).map(preset => (
              <button key={preset} type="button" className={`btn ${optimizer.preset === preset ? "btn-primary" : "btn-ghost"}`} onClick={() => void update({ preset })} disabled={busy}>
                {t(`aura.tokenSaver.${preset}` as TKey)}
              </button>
            ))}
          </div>

          <div className="stack" style={{ gap: 12, marginTop: 18 }}>
            <label className="card panel-accent row" style={{ padding: 14, gap: 10 }}>
              <input type="checkbox" checked={optimizer.deduplicate} onChange={event => void update({ deduplicate: event.target.checked })} disabled={busy} />
              <span><strong>{t("aura.tokenSaverDedup")}</strong><small className="muted" style={{ display: "block" }}>{t("optimization.dedupHint")}</small></span>
            </label>
            <label className="card panel-accent row" style={{ padding: 14, gap: 10 }}>
              <input type="checkbox" checked={optimizer.reduceLogs} onChange={event => void update({ reduceLogs: event.target.checked })} disabled={busy} />
              <span><strong>{t("aura.tokenSaverLogs")}</strong><small className="muted" style={{ display: "block" }}>{t("optimization.logsHint")}</small></span>
            </label>
          </div>
        </section>
      )}

      <div className="grid-2" style={{ marginTop: 18 }}>
        <section className="card" style={{ padding: 16 }}><h3>{t("optimization.protectedTitle")}</h3><p className="muted">{t("optimization.protectedHint")}</p><a className="btn btn-ghost" href="#subagents">{t("optimization.openProfiles")}</a></section>
        <section className="card" style={{ padding: 16 }}><h3>{t("optimization.resultsTitle")}</h3><p className="muted">{t("optimization.resultsHint")}</p><a className="btn btn-ghost" href="#usage">{t("optimization.openInsights")}</a></section>
      </div>
    </>
  );
}
