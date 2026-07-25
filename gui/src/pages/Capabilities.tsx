import { useCallback, useEffect, useState } from "react";
import { IconGlobe } from "../icons";
import { Notice } from "../ui";
import { useT, type TKey } from "../i18n";

type Capability = {
  id: string;
  label: string;
  status: "available" | "partial" | "planned";
  endpoint?: string;
  note: string;
};

const CAPABILITY_LINKS: Record<string, string> = {
  "model-discovery": "#models",
  "fallback-combos": "#combos",
  chat: "#claude",
  image: "#models",
  vision: "#models",
  "web-search": "#models",
};

const CAPABILITY_KEYS: Record<string, { label: TKey; note: TKey }> = {
  "model-discovery": { label: "capability.model-discovery.label", note: "capability.model-discovery.note" },
  "fallback-combos": { label: "capability.fallback-combos.label", note: "capability.fallback-combos.note" },
  chat: { label: "capability.chat.label", note: "capability.chat.note" },
  image: { label: "capability.image.label", note: "capability.image.note" },
  vision: { label: "capability.vision.label", note: "capability.vision.note" },
  "web-search": { label: "capability.web-search.label", note: "capability.web-search.note" },
  "web-fetch": { label: "capability.web-fetch.label", note: "capability.web-fetch.note" },
  tts: { label: "capability.tts.label", note: "capability.tts.note" },
  stt: { label: "capability.stt.label", note: "capability.stt.note" },
  embeddings: { label: "capability.embeddings.label", note: "capability.embeddings.note" },
};

function capabilityKey(id: string, part: "label" | "note"): TKey {
  return CAPABILITY_KEYS[id]?.[part] ?? "capabilities.subtitle";
}

export default function Capabilities({ apiBase }: { apiBase: string }) {
  const t = useT();
  const [items, setItems] = useState<Capability[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/aura/capabilities`);
      const body = await response.json() as { capabilities?: Capability[]; error?: string };
      if (!response.ok) throw new Error(body.error || t("aura.loadFail"));
      setItems(body.capabilities ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("aura.loadFail"));
    }
  }, [apiBase, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const copyEndpoint = async (item: Capability) => {
    if (!item.endpoint) return;
    const endpoint = new URL(`${apiBase}${item.endpoint}`, window.location.origin).toString();
    await navigator.clipboard.writeText(endpoint);
    setCopied(item.id);
  };

  const available = items.filter(item => item.status === "available").length;
  const partial = items.filter(item => item.status === "partial").length;
  const planned = items.filter(item => item.status === "planned").length;

  return (
    <>
      <div className="page-head"><h2>{t("nav.capabilities")}</h2></div>
      <p className="page-sub">{t("capabilities.subtitle")}</p>
      {error && <Notice tone="err">{error}</Notice>}

      <div className="grid-3">
        <section className="card" style={{ padding: 16 }}><span className="muted">{t("aura.capability.available")}</span><div className="stat-value">{available}</div></section>
        <section className="card" style={{ padding: 16 }}><span className="muted">{t("aura.capability.partial")}</span><div className="stat-value">{partial}</div></section>
        <section className="card" style={{ padding: 16 }}><span className="muted">{t("aura.capability.planned")}</span><div className="stat-value">{planned}</div></section>
      </div>

      <div className="grid-2" style={{ alignItems: "stretch", marginTop: 18 }}>
        {items.map(item => (
          <section className="card" style={{ padding: 16 }} key={item.id}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <div className="row" style={{ gap: 10 }}>
                <IconGlobe aria-hidden style={{ width: 20, height: 20, flexShrink: 0 }} />
                <div>
                  <h3 style={{ margin: 0 }}>{t(capabilityKey(item.id, "label"))}</h3>
                  {item.endpoint && <code className="text-label">{item.endpoint}</code>}
                </div>
              </div>
              <span className={`badge ${item.status === "available" ? "badge-accent" : item.status === "partial" ? "badge-warn" : "badge-muted"}`}>
                {t(`aura.capability.${item.status}` as TKey)}
              </span>
            </div>
            <p className="muted leading-body">{t(capabilityKey(item.id, "note"))}</p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {item.endpoint && (
                <button type="button" className="btn btn-ghost" onClick={() => void copyEndpoint(item)}>
                  {copied === item.id ? t("capabilities.copied") : t("capabilities.copyEndpoint")}
                </button>
              )}
              {CAPABILITY_LINKS[item.id] && <a className="btn btn-ghost" href={CAPABILITY_LINKS[item.id]}>{t("capabilities.openSettings")}</a>}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
