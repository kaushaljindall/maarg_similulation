"use client";

import { useState } from "react";
import { ChevronDown, Database } from "lucide-react";
import { TECH } from "@/lib/sim-data";
import { useSim } from "./sim-context";
import { ExplainTabs, Panel, Section, SimBadge, TechChip, cn, useInterval } from "./ui";

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Receive", ids: ["ingestion", "processing"] },
  { title: "Connect", ids: ["association", "trajectory", "postgis"] },
  { title: "Understand", ids: ["analytics", "historical"] },
  { title: "Decide", ids: ["prediction", "alerts", "optimizer"] },
];

const LABELS: Record<string, string> = {
  ingestion: "Event ingestion",
  processing: "Observation processing",
  association: "Multi-camera association",
  trajectory: "Trajectory reconstruction",
  postgis: "GIS / road graph",
  analytics: "Traffic analytics",
  historical: "Historical analysis",
  prediction: "Prediction engine",
  alerts: "Alert engine",
  optimizer: "Signal optimisation engine",
};

export function CloudSection() {
  const { openSpec } = useSim();
  const [eps, setEps] = useState(1840);
  const [hot, setHot] = useState(0);
  useInterval(() => {
    setEps(1700 + Math.round(Math.random() * 300));
    setHot((h) => (h + 1) % 10);
  }, 900);
  const flat = GROUPS.flatMap((g) => g.ids);

  return (
    <Section
      id="cloud"
      n="05"
      kicker="Central intelligence"
      title="MAARG City Intelligence Cloud"
      lead="The edge understands one junction. The cloud sees every junction at once — it connects observations into journeys, measures the network and decides what the signals should do next."
    >
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-edge/50 bg-edge/5 p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-edge">Edge = local perception</div>
          <p className="mt-1 text-sm text-muted">One junction · video in · milliseconds · &quot;what is in front of this camera?&quot;</p>
        </div>
        <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-primary">Cloud = city-wide intelligence</div>
          <p className="mt-1 text-sm text-muted">All junctions · observations in · history + road graph · &quot;what will happen next, and what should we do?&quot;</p>
        </div>
      </div>

      <Panel tone="cloud" title="MAARG CITY INTELLIGENCE CLOUD" right={<div className="flex items-center gap-3"><span className="font-mono text-[11px] text-primary">{eps.toLocaleString("en-IN")} obs/s ingested</span><SimBadge /></div>}>
        <div className="grid gap-3 p-4 md:grid-cols-4">
          {GROUPS.map((g, gi) => (
            <div key={g.title} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/50 text-primary">{gi + 1}</span>
                {g.title}
              </div>
              {g.ids.map((id) => {
                const spec = TECH[id];
                const isHot = flat[hot] === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => openSpec(id)}
                    className={cn(
                      "rounded-md border p-3 text-left transition-colors",
                      isHot ? "border-primary bg-primary/15" : "border-primary/25 bg-surface-2 hover:border-primary/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{LABELS[id]}</span>
                      <span className={cn("h-1.5 w-1.5 rounded-full", isHot ? "bg-primary" : "bg-border-strong")} aria-hidden />
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-muted">{spec.does}</div>
                    <div className="mt-2 font-mono text-[10px] text-primary">{spec.tech}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Panel>
      <div className="mt-4">
        <ExplainTabs
          simple={<p>The cloud is the city&apos;s control room brain. It receives notes from every junction, recognises the same vehicle at different places, measures how traffic is moving, predicts what comes next and tells signals how to adjust.</p>}
          technical={
            <p>
              Kafka consumer services form a pipeline: ingestion → processing → association/trajectory (using the PostGIS road graph) → windowed
              analytics → prediction (live + historical baseline) → alerting and signal optimisation. State lives in Redis for low-latency reads; history
              in MongoDB and TimescaleDB.
            </p>
          }
        />
      </div>
    </Section>
  );
}

const STORES = [
  {
    id: "redis",
    purpose: "Fast current state",
    example: 'HGET junction:J-04 queue_ns  →  "23"\nZRANGE corridor:active 0 -1  →  ["E-102"]',
    holds: "Live queue lengths, current signal phase, active corridors, rolling 30 s counts",
    latency: "sub-millisecond",
  },
  {
    id: "mongodb",
    purpose: "Vehicle observations / metadata",
    example: 'db.observations.find({ plate: "DL01AB1234" })\n  .sort({ timestamp: 1 })',
    holds: "Every observation document, camera metadata, journey records",
    latency: "milliseconds",
  },
  {
    id: "timescale",
    purpose: "Time-based traffic data",
    example: "SELECT time_bucket('1 min', ts), count(*)\nFROM flows WHERE approach = 'J-04-N'\nGROUP BY 1;",
    holds: "Per-lane flow, speed and occupancy in 1-min / 15-min buckets",
    latency: "milliseconds–seconds",
  },
  {
    id: "postgis",
    purpose: "Geospatial road and camera relationships",
    example: "SELECT cam_id, ST_Length(seg.geom)\nFROM cameras JOIN segments seg ...\nWHERE seg.to_junction = 'J-04';",
    holds: "Road segments, junctions, camera positions, allowed movements",
    latency: "milliseconds",
  },
];

export function StorageLayer() {
  const [open, setOpen] = useState<string | null>("redis");
  return (
    <Section
      id="storage"
      n="06"
      kicker="Database layer"
      title="Where observations are stored — and why four different stores"
      lead="Each store is chosen for one kind of question. Expand a card to see what it holds and an example query."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {STORES.map((s) => {
          const spec = TECH[s.id];
          const isOpen = open === s.id;
          return (
            <div key={s.id} className={cn("rounded-lg border bg-surface transition-colors", isOpen ? "border-primary/60" : "border-border")}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : s.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <Database className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-semibold text-foreground">{spec.tech}</div>
                  <div className="text-sm text-muted">&quot;{s.purpose}&quot;</div>
                </div>
                <span className="hidden font-mono text-[10px] text-muted sm:inline">{s.latency}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>
              {isOpen && (
                <div className="fade-up space-y-3 border-t border-border px-4 py-3">
                  <p className="text-sm text-foreground">
                    <span className="text-muted">Holds: </span>
                    {s.holds}
                  </p>
                  <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-5 text-success">{s.example}</pre>
                  <p className="text-sm text-muted">
                    <span className="text-foreground">Why: </span>
                    {spec.why}
                  </p>
                  <TechChip id={s.id} label={`More about ${spec.tech}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
