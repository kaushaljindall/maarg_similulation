"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { LAYER_META, TECH, type TechSpec } from "@/lib/sim-data";
import { useSim } from "./sim-context";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Section({
  id,
  n,
  kicker,
  title,
  lead,
  actions,
  children,
}: {
  id: string;
  n: string;
  kicker: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} data-section={id} className="scroll-mt-20 border-b border-border px-4 py-14 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              {n} · {kicker}
            </p>
            <h2 className="mt-2 text-balance text-2xl font-semibold text-foreground md:text-3xl">{title}</h2>
            {lead && <p className="mt-3 text-pretty leading-relaxed text-muted">{lead}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </section>
  );
}

export function Panel({
  className,
  children,
  title,
  right,
  tone = "default",
}: {
  className?: string;
  children: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
  tone?: "default" | "edge" | "cloud" | "alert";
}) {
  const toneClass = {
    default: "border-border",
    edge: "border-edge/40",
    cloud: "border-primary/40",
    alert: "border-danger/50",
  }[tone];
  return (
    <div className={cn("rounded-lg border bg-surface", toneClass, className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="font-mono text-xs uppercase tracking-wider text-muted">{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function SimBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning",
        className,
      )}
    >
      Simulation
    </span>
  );
}

export function Btn({
  children,
  onClick,
  variant = "default",
  className,
  ariaPressed,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  className?: string;
  ariaPressed?: boolean;
  disabled?: boolean;
}) {
  const v = {
    default: "border-border-strong bg-surface-2 text-foreground hover:bg-surface-3",
    primary: "border-primary bg-primary text-white hover:bg-primary/85",
    ghost: "border-transparent bg-transparent text-muted hover:text-foreground hover:bg-surface-2",
    danger: "border-danger/60 bg-danger/15 text-foreground hover:bg-danger/25",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TechChip({ id, label }: { id: string; label?: string }) {
  const { openSpec } = useSim();
  const spec = TECH[id];
  if (!spec) return null;
  const color = LAYER_META[spec.layer].color;
  return (
    <button
      type="button"
      onClick={() => openSpec(id)}
      className="inline-flex items-center gap-1.5 rounded border border-border-strong bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary"
      title={`What does ${spec.name} do?`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label ?? spec.tech}
    </button>
  );
}

export function ExplainTabs({ simple, technical }: { simple: ReactNode; technical: ReactNode }) {
  const [tab, setTab] = useState<"simple" | "technical">("simple");
  const id = useId();
  return (
    <div className="rounded-lg border border-border bg-surface-2/60">
      <div role="tablist" aria-label="Explanation level" className="flex border-b border-border">
        {(["simple", "technical"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={`${id}-${t}`}
            aria-selected={tab === t}
            aria-controls={`${id}-panel`}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
              tab === t ? "border-b-2 border-primary text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {t === "simple" ? "Simple explanation" : "Technical explanation"}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        className="p-4 text-sm leading-relaxed text-foreground/90"
      >
        {tab === "simple" ? simple : technical}
      </div>
    </div>
  );
}

export function SpecGrid({ spec, compact }: { spec: TechSpec; compact?: boolean }) {
  const rows: [string, string][] = [
    ["Receives", spec.receives],
    ["Does", spec.does],
    ["Outputs", spec.outputs],
    ["Why needed", spec.why],
  ];
  return (
    <dl className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-md border border-border bg-background/60 p-3">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{k}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[size];
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm md:p-10">
      <div className="fixed inset-0" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn("fade-up relative w-full rounded-xl border border-border-strong bg-surface shadow-2xl outline-none", w)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "ok" | "warn" | "bad" | "info";
}) {
  const c = { ok: "text-success", warn: "text-warning", bad: "text-danger", info: "text-primary" }[tone ?? "info"];
  return (
    <div className="rounded-md border border-border bg-background/50 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("mt-0.5 font-mono text-lg font-semibold tabular-nums", tone ? c : "text-foreground")}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function useInterval(cb: () => void, ms: number | null) {
  const saved = useRef(cb);
  useEffect(() => {
    saved.current = cb;
  }, [cb]);
  useEffect(() => {
    if (ms === null) return;
    const t = setInterval(() => saved.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function useRunEvent(id: string, run: () => void) {
  const saved = useRef(run);
  useEffect(() => {
    saved.current = run;
  }, [run]);
  useEffect(() => {
    const h = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) saved.current();
    };
    window.addEventListener("maarg:run", h);
    return () => window.removeEventListener("maarg:run", h);
  }, [id]);
}

export function triggerRun(id: string) {
  window.dispatchEvent(new CustomEvent("maarg:run", { detail: id }));
}

export function JsonView({ data, highlight }: { data: Record<string, unknown>; highlight?: string[] }) {
  const entries = Object.entries(data);
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-[13px] leading-6">
      <span className="text-muted">{"{"}</span>
      {"\n"}
      {entries.map(([k, v], i) => (
        <span key={k} className={cn("block", highlight?.includes(k) && "bg-primary/10")}>
          {"  "}
          <span className="text-primary">&quot;{k}&quot;</span>
          <span className="text-muted">: </span>
          <span className={typeof v === "string" ? "text-success" : "text-warning"}>
            {typeof v === "string" ? `"${v}"` : String(v)}
          </span>
          {i < entries.length - 1 && <span className="text-muted">,</span>}
        </span>
      ))}
      <span className="text-muted">{"}"}</span>
    </pre>
  );
}
