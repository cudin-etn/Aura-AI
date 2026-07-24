import { IconCheck, IconGrid, IconList, IconSparkle } from "../icons";
import { useT } from "../i18n";

export type LayoutSkin = "focus" | "canvas";

function LayoutPreview({ skin }: { skin: LayoutSkin }) {
  return (
    <div className={`layout-preview layout-preview--${skin}`} aria-hidden>
      <span className="layout-preview-rail" />
      <span className="layout-preview-panel">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export default function Appearance({
  layoutSkin,
  onLayoutSkinChange,
}: {
  layoutSkin: LayoutSkin;
  onLayoutSkinChange: (skin: LayoutSkin) => void;
}) {
  const t = useT();

  return (
    <div className="appearance-page">
      <div className="page-head">
        <div>
          <h2>{t("appearance.title")}</h2>
          <p className="page-sub">{t("appearance.subtitle")}</p>
        </div>
        <span className="appearance-live-badge"><IconSparkle /> {t("appearance.live")}</span>
      </div>

      <section className="appearance-section">
        <div className="appearance-section-copy">
          <h3>{t("appearance.layoutTitle")}</h3>
          <p>{t("appearance.layoutHint")}</p>
        </div>
        <div className="layout-skin-grid" role="radiogroup" aria-label={t("appearance.layoutTitle")}>
          {([
            { id: "focus" as const, Icon: IconList, title: t("appearance.focus"), hint: t("appearance.focusHint") },
            { id: "canvas" as const, Icon: IconGrid, title: t("appearance.canvas"), hint: t("appearance.canvasHint") },
          ]).map(({ id, Icon, title, hint }) => {
            const selected = layoutSkin === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`layout-skin-card${selected ? " selected" : ""}`}
                onClick={() => onLayoutSkinChange(id)}
              >
                <LayoutPreview skin={id} />
                <span className="layout-skin-copy">
                  <span className="layout-skin-title"><Icon /> {title}</span>
                  <span className="layout-skin-hint">{hint}</span>
                </span>
                <span className="layout-skin-check" aria-hidden>{selected && <IconCheck />}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
