import { useCallback, useEffect, useMemo, useState } from "react";
import { Notice, EmptyState } from "../ui";
import { IconArrowUp, IconArrowDown, IconX, IconCheck, IconSearch, IconBot, IconInfo } from "../icons";
import { useT } from "../i18n/shared";
import { Trans } from "../i18n/provider";
import { modelLabel } from "../model-display";

type AuraProfileId = "saver" | "balanced" | "quality";
type AuraRole = "orchestrator" | "explorer" | "worker" | "reviewer" | "tester" | "docs";
type AuraAssignment = { model: string; effort: string };
type AuraProfile = {
  id: AuraProfileId;
  roles: Record<AuraRole, AuraAssignment>;
  maxSubagents: number;
  tokenBudgetPerTask: number;
};
type AuraProfileResponse = {
  activeProfile: AuraProfileId;
  profile: AuraProfile;
  profiles: AuraProfileId[];
  roles: AuraRole[];
  available: string[];
};

const AURA_EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];

export default function Subagents({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [available, setAvailable] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aura, setAura] = useState<AuraProfileResponse | null>(null);
  const [auraSaving, setAuraSaving] = useState(false);

  const chosenSet = useMemo(() => new Set(chosen), [chosen]);

  const load = useCallback(async () => {
    try {
      const [r, auraData] = await Promise.all([
        fetch(`${apiBase}/api/subagent-models`).then(res => res.json()),
        fetch(`${apiBase}/api/aura/profile`).then(res => res.json() as Promise<AuraProfileResponse>),
      ]);
      const avail: string[] = r.available ?? [];
      const availSet = new Set(avail);
      setAvailable(avail);
      setChosen((r.chosen ?? []).filter((m: string) => availSet.has(m)));
      setAura(auraData);
    } catch {
      setOk(false);
      setStatus(t("sub.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [apiBase, t]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const toggle = (m: string) => {
    setStatus("");
    setChosen(prev => prev.includes(m) ? prev.filter(x => x !== m) : (prev.length >= 5 ? prev : [...prev, m]));
  };
  const move = (i: number, dir: -1 | 1) => {
    setChosen(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    setStatus("");
    try {
      const r = await fetch(`${apiBase}/api/subagent-models`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: chosen }),
      });
      const d = await r.json();
      setOk(r.ok);
      setStatus(r.ok
        ? t("sub.saved", { n: d.applied?.length ?? 0, cmd: "ocx sync" })
        : (d.error || t("sub.saveFailed")));
    } catch {
      setOk(false);
      setStatus(t("sub.networkError"));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter(m => !q || m.toLowerCase().includes(q));
  }, [available, query]);

  const saveAura = async (profile: AuraProfileId, roles?: AuraProfile["roles"]) => {
    setAuraSaving(true);
    setStatus("");
    try {
      const response = await fetch(`${apiBase}/api/aura/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, ...(roles ? { roles } : {}) }),
      });
      const data = await response.json() as AuraProfileResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || t("sub.auraSaveFailed"));
      setAura(data);
      const nextChosen = [...new Set(["worker", "explorer", "reviewer", "tester", "docs"]
        .map(role => data.profile.roles[role as AuraRole].model))].slice(0, 5);
      setChosen(nextChosen);
      setOk(true);
      setStatus(t("sub.auraSaved"));
    } catch (error) {
      setOk(false);
      setStatus(error instanceof Error ? error.message : t("sub.auraSaveFailed"));
    } finally {
      setAuraSaving(false);
    }
  };

  const updateAuraRole = (role: AuraRole, patch: Partial<AuraAssignment>) => {
    setAura(current => current ? {
      ...current,
      profile: {
        ...current.profile,
        roles: {
          ...current.profile.roles,
          [role]: { ...current.profile.roles[role], ...patch },
        },
      },
    } : current);
  };

  if (loading) return <div className="muted" style={{ padding: 8 }}>{t("sub.loading")}</div>;

  return (
    <>
      <div className="page-head"><h2>{t("nav.subagents")}</h2></div>
      <p className="page-sub"><Trans k="sub.subtitle" cmd="spawn_agent" /></p>

      {status && <Notice tone={ok ? "ok" : "err"}>{status}</Notice>}

      {aura && (
        <section className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div className="h-section" style={{ marginTop: 0 }}>{t("sub.auraTitle")}</div>
          <p className="muted leading-body">{t("sub.auraSubtitle")}</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
            {aura.profiles.map(profile => (
              <button
                key={profile}
                type="button"
                className={`btn ${aura.activeProfile === profile ? "btn-primary" : "btn-ghost"}`}
                onClick={() => void saveAura(profile)}
                disabled={auraSaving}
              >
                {profile[0].toUpperCase() + profile.slice(1)}
              </button>
            ))}
          </div>
          <p className="muted text-label">
            {t("sub.auraParent")}: <code>{modelLabel(aura.profile.roles.orchestrator.model)}</code>
            {" · "}{aura.profile.roles.orchestrator.effort}
          </p>
          <p className="muted text-label">
            {t("sub.auraLimits", {
              agents: aura.profile.maxSubagents,
              tokens: aura.profile.tokenBudgetPerTask.toLocaleString(),
            })}
          </p>
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {aura.roles.map(role => (
              <div key={role} className="row" style={{ gap: 10, alignItems: "center" }}>
                <strong style={{ width: 92, textTransform: "capitalize" }}>{role}</strong>
                <select
                  className="input"
                  aria-label={`${role} model`}
                  value={aura.profile.roles[role].model}
                  onChange={event => updateAuraRole(role, { model: event.target.value })}
                  style={{ flex: 1 }}
                >
                  {aura.available.map(model => <option key={model} value={model}>{modelLabel(model)}</option>)}
                </select>
                <select
                  className="input"
                  aria-label={`${role} effort`}
                  value={aura.profile.roles[role].effort}
                  onChange={event => updateAuraRole(role, { effort: event.target.value })}
                  style={{ width: 112 }}
                >
                  {AURA_EFFORTS.map(effort => <option key={effort} value={effort}>{effort}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void saveAura(aura.activeProfile, aura.profile.roles)}
            disabled={auraSaving}
            style={{ marginTop: 12 }}
          >
            {auraSaving ? t("common.saving") : t("sub.auraApply")}
          </button>
        </section>
      )}

      <div className="h-section">{t("sub.featured")} <span className="count">{chosen.length}/5</span></div>
      <div className="row muted text-label leading-body" style={{ alignItems: "flex-start", gap: 8, margin: "-2px 0 10px", maxWidth: "80ch" }}>
        <IconInfo width={15} height={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <span><Trans k="sub.orderHint" cmd="spawn_agent" /></span>
      </div>
      {chosen.length === 0 ? (
        <EmptyState title={t("sub.noneSelected")} />
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {chosen.map((m, i) => (
            <div key={m} className="card panel-accent row" style={{ padding: "8px 12px", gap: 10 }}>
              <span className="mono font-bold" style={{ width: 18, color: "var(--accent)" }}>{i + 1}</span>
              <code className="mono" style={{ flex: 1, color: "var(--text)" }}>{modelLabel(m)}</code>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("sub.moveUp", { m })}>
                <IconArrowUp />
              </button>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => move(i, 1)} disabled={i === chosen.length - 1} aria-label={t("sub.moveDown", { m })}>
                <IconArrowDown />
              </button>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => toggle(m)} aria-label={t("sub.removeAria", { m })} style={{ color: "var(--red)" }}>
                <IconX />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={save}>{t("common.save")}</button>
      </div>

      <div className="h-section">{t("sub.models")} <span className="count">{filtered.length}</span></div>
      <div className="row" style={{ marginBottom: 10, gap: 8 }}>
        <IconSearch width={15} height={15} aria-hidden="true" style={{ color: "var(--faint)", flexShrink: 0 }} />
        <input
          className="input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("sub.search")}
          aria-label={t("sub.search")}
          style={{ flex: 1 }}
        />
      </div>
      <div className="stack" style={{ gap: 6, maxHeight: 360, overflowY: "auto" }}>
        {filtered.map(m => {
          const sel = chosenSet.has(m);
          const full = !sel && chosen.length >= 5;
          return (
            <button
              key={m}
              type="button"
              className={`card row${sel ? " panel-accent" : ""}`}
              onClick={() => toggle(m)}
              disabled={full}
              aria-pressed={sel}
              style={{ width: "100%", opacity: full ? 0.45 : 1, cursor: full ? "not-allowed" : "pointer" }}
            >
              <span style={{ width: 16, height: 16, flexShrink: 0, color: "var(--accent)", display: "inline-flex" }}>
                {sel && <IconCheck style={{ width: 16, height: 16 }} />}
              </span>
              <IconBot style={{ width: 15, height: 15, color: "var(--faint)", flexShrink: 0 }} />
              <code className="mono" style={{ color: "var(--text)" }}>{modelLabel(m)}</code>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState title={t("sub.noModels")} />
        )}
      </div>
    </>
  );
}
