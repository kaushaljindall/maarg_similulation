"use client";

import { useEffect, useState } from "react";
import { CityEngine, type CityStats, type JunctionStats } from "@/lib/city-engine";
import { CityCanvas } from "./city-canvas";
import { ExplainTabs, Panel, Section, SimBadge, Stat, TechChip, cn } from "./ui";

export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-muted">
      <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-success" aria-hidden />GREEN = free flow</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-warning" aria-hidden />YELLOW = slowing / building</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded bg-danger" aria-hidden />RED = congested</span>
    </div>
  );
}

export function JunctionDetail({ s }: { s: JunctionStats }) {
  const sigColor = s.state === "green" ? "text-success" : s.state === "yellow" ? "text-warning" : "text-danger";
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xl font-semibold text-foreground">{s.id}</span>
        <span className={cn("font-mono text-xs", sigColor)}>
          {s.state === "green" ? `${s.phase} GREEN · ${Math.max(0, Math.ceil(s.planned - s.phaseTime))} s left` : s.state === "yellow" ? `${s.phase} AMBER` : "ALL-RED CLEARANCE"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Current vehicles" value={s.current} />
        <Stat label="Incoming" value={s.incoming} />
        <Stat label="Outgoing" value={s.outgoing} />
        <Stat label="Avg speed" value={s.avgSpeed.toFixed(0)} unit="km/h" />
        <Stat label="Queue length" value={s.queue} unit="veh" tone={s.queue > 12 ? "bad" : s.queue > 6 ? "warn" : "ok"} />
        <Stat label="Predicted · 20 s" value={s.predicted20} unit="arrivals" tone="info" />
      </div>
      {s.corridor !== "none" && (
        <div className="rounded border border-success/50 bg-success/10 px-3 py-2 font-mono text-xs text-success">Corridor state: {s.corridor.toUpperCase()}</div>
      )}
    </div>
  );
}

export function TrafficIntelligence() {
  const [engine, setEngine] = useState<CityEngine | null>(null);
  const [heat, setHeat] = useState(true);
  const [sel, setSel] = useState(-1);
  const [stats, setStats] = useState<CityStats | null>(null);
  const [js, setJs] = useState<JunctionStats | null>(null);

  useEffect(() => {
    const e = new CityEngine({ cols: 4, rows: 3, spacing: 200, target: 230 });
    for (let i = 0; i < 1800; i++) e.step(0.1);
    setEngine(e);
    setSel(e.junctionIds()[5]);
  }, []);

  const tick = () => {
    if (!engine) return;
    setStats(engine.cityStats());
    if (sel >= 0) setJs(engine.junctionStats(sel));
  };

  const totalQueue = engine ? engine.junctionIds().reduce((a, j) => a + engine.junctionStats(j).queue, 0) : 0;

  return (
    <Section
      id="intelligence"
      n="09"
      kicker="Traffic intelligence"
      title="Zoom out: the whole network, measured live"
      lead="Observations from every camera become network-wide metrics. Click any intersection to see what MAARG knows about it right now."
      actions={
        <>
          <TechChip id="analytics" />
          <TechChip id="prediction" />
        </>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Vehicle count" value={stats?.vehicles ?? "—"} />
        <Stat label="Traffic density" value={stats ? stats.density.toFixed(0) : "—"} unit="%" />
        <Stat label="Average speed" value={stats ? stats.avgSpeed.toFixed(0) : "—"} unit="km/h" />
        <Stat label="Lane occupancy" value={js ? js.occupancy.toFixed(0) : "—"} unit={`% ${js?.id ?? ""}`} />
        <Stat label="Stopped" value={stats?.stopped ?? "—"} unit="veh" />
        <Stat label="Congestion" value={stats?.congestion ?? "—"} tone={stats?.congestion === "High" ? "bad" : stats?.congestion === "Moderate" ? "warn" : "ok"} />
        <Stat label="Queue (all)" value={totalQueue} unit="veh" />
        <Stat label="Arrivals 20 s" value={js?.predicted20 ?? "—"} unit={js?.id} tone="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel
          title="12-junction network · density heatmap"
          right={
            <div className="flex items-center gap-2">
              <button type="button" aria-pressed={heat} onClick={() => setHeat((h) => !h)} className="rounded border border-border-strong px-2 py-0.5 font-mono text-[11px] text-foreground hover:bg-surface-2">
                Heatmap {heat ? "on" : "off"}
              </button>
              <SimBadge />
            </div>
          }
        >
          {engine ? (
            <CityCanvas engine={engine} running speed={2} heatmap={heat} packets={false} cloudBand={false} selected={sel} onSelect={setSel} onTick={tick} label="Simulated city network with moving vehicles, traffic signals and a congestion heatmap" />
          ) : (
            <div className="aspect-[860/660] w-full animate-pulse bg-surface-2" />
          )}
          <div className="border-t border-border px-4 py-2.5">
            <HeatLegend />
          </div>
        </Panel>
        <Panel title="Intersection detail" tone="cloud">
          {js ? <JunctionDetail s={js} /> : <p className="p-4 text-sm text-muted">Click an intersection on the map.</p>}
        </Panel>
      </div>
      <div className="mt-4">
        <ExplainTabs
          simple={<p>Every road is coloured by how full it is. MAARG also counts what is waiting at each junction and what is about to arrive — the numbers it uses to time the lights.</p>}
          technical={
            <p>
              Occupancy = vehicle length + gap per metre of approach; queue = vehicles below 1 m/s within 120 m of the stop line; predicted arrivals sum
              vehicles whose ETA to the stop line (remaining distance ÷ current speed) is within the horizon, including the upstream block. Vehicles drive on
              the left. All values here come from the browser simulation.
            </p>
          }
        />
      </div>
    </Section>
  );
}
