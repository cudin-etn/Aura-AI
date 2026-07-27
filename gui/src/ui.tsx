/* Shared UI primitives built on the design-system classes in styles.css. */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconAlert } from "./icons";
import { IconChevron } from "./icons";

export function Switch({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick} disabled={disabled}
      aria-pressed={on} aria-label={label ?? (on ? "enabled" : "disabled")}>
      <span className="knob" />
    </button>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "err"; children: ReactNode }) {
  return (
    <div className={`notice ${tone === "ok" ? "notice-ok" : "notice-err"}`} role="status">
      {tone === "ok" ? <IconCheck /> : <IconAlert />}
      <span>{children}</span>
    </div>
  );
}

export interface SelectOption { value: string; label: React.ReactNode; searchText?: string; group?: string }

function useFloatingDropdown(
  open: boolean,
  placement: "below" | "right" = "below",
  align: "left" | "right" = "left",
) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const gap = 7;
      const preferredMaxHeight = 280;
      const minWidth = Math.min(Math.max(rect.width, 220), window.innerWidth - margin * 2);
      if (placement === "right") {
        const fitsRight = rect.right + gap + minWidth <= window.innerWidth - margin;
        const left = fitsRight
          ? rect.right + gap
          : Math.max(margin, rect.left - gap - minWidth);
        setFloatingStyle({
          position: "fixed",
          top: Math.max(margin, Math.min(rect.top, window.innerHeight - margin - 120)),
          left,
          width: minWidth,
          maxHeight: Math.max(120, window.innerHeight - margin * 2),
        });
        return;
      }
      const below = window.innerHeight - rect.bottom - margin - gap;
      const above = rect.top - margin - gap;
      const placeAbove = below < 160 && above > below;
      const maxHeight = Math.max(120, Math.min(preferredMaxHeight, placeAbove ? above : below));
      const desiredLeft = align === "right" ? rect.right - minWidth : rect.left;
      const left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - margin - minWidth));
      setFloatingStyle({
        position: "fixed",
        top: placeAbove ? Math.max(margin, rect.top - gap - maxHeight) : rect.bottom + gap,
        left,
        width: minWidth,
        maxHeight,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [align, open, placement]);

  return { anchorRef, dropdownRef, floatingStyle };
}

export function Select({ value, options, onChange, disabled, label, style, align, placement, dropdownStyle, compactIcon }: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  style?: CSSProperties;
  align?: "left" | "right";
  placement?: "below" | "right";
  dropdownStyle?: CSSProperties;
  /** Compact utility controls can show an icon instead of the selected label. */
  compactIcon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { anchorRef, dropdownRef, floatingStyle } = useFloatingDropdown(open, placement, align);
  const current = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!anchorRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [anchorRef, dropdownRef, open]);

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="select-dropdown select-dropdown-portal"
      role="listbox"
      aria-label={label}
      style={{ ...floatingStyle, ...dropdownStyle }}
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="option"
          aria-selected={o.value === value}
          className={`select-option${o.value === value ? " active" : ""}`}
          onClick={() => { onChange(o.value); setOpen(false); }}
        >{o.label}</button>
      ))}
    </div>
  ) : null;

  return (
    <div ref={anchorRef} className="custom-select" style={{ position: "relative", display: "inline-block", ...style }}>
      <button
        type="button"
        className={`select-trigger${compactIcon ? " select-trigger--icon" : ""}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="select-value">{compactIcon ?? current?.label ?? value}</span>
        {!compactIcon && <span className="select-chevron" aria-hidden><IconChevron /></span>}
      </button>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}

export function MultiSelect({
  values,
  options,
  onChange,
  disabled,
  label,
  summary,
  searchPlaceholder,
  selectAllLabel,
  clearLabel,
  style,
}: {
  values: string[];
  options: SelectOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  label?: string;
  summary: ReactNode;
  searchPlaceholder: string;
  selectAllLabel: string;
  clearLabel: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { anchorRef, dropdownRef, floatingStyle } = useFloatingDropdown(open);
  const selected = new Set(values);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter(option => (option.searchText ?? String(option.label)).toLowerCase().includes(normalizedQuery))
    : options;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [anchorRef, dropdownRef, open]);

  const toggle = (value: string) => {
    if (selected.has(value)) onChange(values.filter(item => item !== value));
    else onChange([...values, value]);
  };
  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="select-dropdown select-dropdown-portal multi-select-dropdown"
      role="listbox"
      aria-label={label}
      aria-multiselectable="true"
      style={floatingStyle}
    >
      <div className="multi-select-tools">
        <input
          className="input multi-select-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          autoFocus
          onKeyDown={event => {
            if (event.key === "ArrowDown" && filtered.length > 0) {
              event.preventDefault();
              optionRefs.current[0]?.focus();
            }
          }}
        />
        <div className="multi-select-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onChange(options.map(option => option.value))}>{selectAllLabel}</button>
          <button type="button" className="btn btn-ghost" onClick={() => onChange([])}>{clearLabel}</button>
        </div>
      </div>
      <div className="multi-select-options">
        {filtered.map((option, index) => {
          const showGroup = option.group && option.group !== filtered[index - 1]?.group;
          return (
            <div key={option.value}>
              {showGroup && <div className="multi-select-group">{option.group}</div>}
              <button
                ref={element => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={selected.has(option.value)}
                className={`select-option multi-select-option${selected.has(option.value) ? " active" : ""}`}
                onClick={() => toggle(option.value)}
                tabIndex={index === focusedIndex ? 0 : -1}
                onFocus={() => setFocusedIndex(index)}
                onKeyDown={event => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const next = event.key === "ArrowDown"
                      ? Math.min(filtered.length - 1, index + 1)
                      : Math.max(0, index - 1);
                    setFocusedIndex(next);
                    optionRefs.current[next]?.focus();
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    const next = event.key === "Home" ? 0 : Math.max(0, filtered.length - 1);
                    setFocusedIndex(next);
                    optionRefs.current[next]?.focus();
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggle(option.value);
                  }
                }}
              >
                <span className="multi-select-check" aria-hidden>{selected.has(option.value) ? "✓" : ""}</span>
                <span>{option.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div ref={anchorRef} className="custom-select" style={{ position: "relative", display: "inline-block", ...style }}>
      <button
        type="button"
        className="select-trigger"
        onClick={() => {
          if (disabled) return;
          setFocusedIndex(0);
          optionRefs.current = [];
          setOpen(value => !value);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="select-value">{summary}</span>
        <span className="select-chevron" aria-hidden><IconChevron /></span>
      </button>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}

export function EmptyState({ icon, title, children, className, style }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={className ? `empty ${className}` : "empty"} style={style}>
      {icon}
      <div className="title">{title}</div>
      {children && <div className="text-control">{children}</div>}
    </div>
  );
}
