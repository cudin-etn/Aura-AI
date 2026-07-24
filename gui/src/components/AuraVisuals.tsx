import { IconBot, IconCheck, IconServer, IconSparkle, IconTerminal } from "../icons";
import { useT } from "../i18n";
import { modelLabel } from "../model-display";
import type { CSSProperties } from "react";

export type AuraVisualProfile = "saver" | "balanced" | "quality";

const PROFILE_SIGNALS: Record<AuraVisualProfile, { efficiency: number; quality: number; autonomy: number }> = {
  saver: { efficiency: 92, quality: 62, autonomy: 42 },
  balanced: { efficiency: 76, quality: 82, autonomy: 68 },
  quality: { efficiency: 48, quality: 96, autonomy: 90 },
};

export function AuraProfileVisual({
  profile,
  maxSubagents,
  tokenBudget,
}: {
  profile: AuraVisualProfile;
  maxSubagents?: number;
  tokenBudget?: number;
}) {
  const t = useT();
  const signals = PROFILE_SIGNALS[profile];
  return (
    <div className="aura-profile-visual" aria-label={t("visual.profileAria", { profile })}>
      <div className="aura-profile-radar" aria-hidden>
        <span style={{ "--signal": `${signals.efficiency}%` } as CSSProperties} />
        <span style={{ "--signal": `${signals.quality}%` } as CSSProperties} />
        <span style={{ "--signal": `${signals.autonomy}%` } as CSSProperties} />
        <i><IconSparkle /></i>
      </div>
      <div className="aura-profile-signals">
        {([
          [t("visual.efficiency"), signals.efficiency],
          [t("visual.quality"), signals.quality],
          [t("visual.autonomy"), signals.autonomy],
        ] as const).map(([label, value]) => (
          <div className="aura-signal" key={label}>
            <span>{label}</span>
            <span className="aura-signal-track"><i style={{ width: `${value}%` }} /></span>
          </div>
        ))}
        {(maxSubagents !== undefined || tokenBudget !== undefined) && (
          <div className="aura-profile-limits">
            {maxSubagents !== undefined && <span><IconBot /> {t("visual.agents", { n: maxSubagents })}</span>}
            {tokenBudget !== undefined && <span>{t("visual.budget", { n: tokenBudget.toLocaleString() })}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuraRoutePreview({
  client,
  provider,
  model,
  profile,
  activeStep,
  ready,
}: {
  client: string;
  provider: string;
  model: string;
  profile: AuraVisualProfile;
  activeStep: number;
  ready: boolean;
}) {
  const t = useT();
  const nodes = [
    { label: t("wizard.client"), value: client, Icon: IconTerminal, active: activeStep === 2 },
    { label: t("app.brandName"), value: profile, Icon: IconSparkle, active: activeStep === 3 },
    { label: t("wizard.model"), value: modelLabel(model) || t("visual.pending"), Icon: IconBot, active: activeStep === 1 },
    { label: t("wizard.provider"), value: provider || t("visual.pending"), Icon: IconServer, active: activeStep === 0 },
  ];

  return (
    <aside className="aura-route-preview" aria-label={t("visual.routeTitle")}>
      <div className="aura-route-preview-head">
        <div>
          <strong>{t("visual.routeTitle")}</strong>
          <p>{t("visual.routeHint")}</p>
        </div>
        <span className={`aura-live-dot${ready ? " ready" : ""}`}><i />{ready ? t("visual.ready") : t("visual.preview")}</span>
      </div>
      <div className="aura-route-flow">
        {nodes.map(({ label, value, Icon, active }, index) => (
          <div className="aura-route-node-wrap" key={label}>
            <div className={`aura-route-node${active ? " active" : ""}${ready ? " ready" : ""}`}>
              <span className="aura-route-icon">{ready && index === nodes.length - 1 ? <IconCheck /> : <Icon />}</span>
              <span><small>{label}</small><strong>{value}</strong></span>
            </div>
            {index < nodes.length - 1 && <span className="aura-route-link" aria-hidden><i /></span>}
          </div>
        ))}
      </div>
      <AuraProfileVisual profile={profile} />
    </aside>
  );
}
