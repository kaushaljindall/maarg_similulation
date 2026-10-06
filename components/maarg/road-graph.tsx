"use client";

import { useState } from "react";
import { NODE_INFO, junctionInfo } from "@/lib/road-map";
import { RoadMapSvg } from "./road-map-svg";
import { ExplainTabs, Panel, Section, SimBadge, TechChip, cn } from "./ui";

export function RoadGraph() {
  const [layers, setLayers] = useState({ roads: true, cameras: true, junctions: true, trajectory: false, distances: true });
  const [sel, setSel] = useState<string | null>("CAM_07");
  const info = sel ? (sel.startsWith("CAM") ? NODE_INFO[sel] : junctionInfo(sel)) : null;

  return (
    <Section
      id="gis"
      n="08"
      kicker="GIS + road graph"
      title="The city as a graph: cameras, junctions and roads"
      lead="MAARG understands not only where a vehicle was detected, but how that location connects to the rest of the road network — which camera feeds which signal, and how far away it is."
      actions={<TechChip id="postgis" />}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel
          title="Road graph · click a camera or junction"
          right={<SimBadge />}
        >
          <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
            {(Object.keys(layers) as (keyof typeof layers)[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={layers[k]}
                onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[11px] capitalize transition-colors",
                  layers[k] ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted hover:text-foreground",
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <RoadMapSvg
            showRoads={layers.roads}
            showCameras={layers.cameras}
            showJunctions={layers.junctions}
            showDistances={layers.distances && layers.roads}
            trajectory={layers.trajectory ? 1 : 0}
            selected={sel}
            onSelect={setSel}
            label="Interactive road graph of cameras and junctions"
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Graph model">
            <div className="flex flex-col items-center gap-1 p-4 font-mono text-xs">
              <span className="rounded border border-primary px-2 py-1 text-primary">CAM_A · node</span>
              <span className="h-5 w-px bg-border-strong" aria-hidden />
              <span className="text-[10px] text-muted">edge · road segment · 180 m</span>
              <span className="h-5 w-px bg-border-strong" aria-hidden />
              <span className="rounded border border-foreground/60 px-2 py-1 text-foreground">JUNCTION_01 · node</span>
              <span className="h-5 w-px bg-border-strong" aria-hidden />
              <span className="text-[10px] text-muted">edge · road segment · 240 m</span>
              <span className="h-5 w-px bg-border-strong" aria-hidden />
              <span className="rounded border border-primary px-2 py-1 text-primary">CAM_B · node</span>
            </div>
            <ul className="space-y-1 border-t border-border p-4 text-xs text-muted">
              <li><span className="text-foreground">Cameras</span> = nodes on road segments</li>
              <li><span className="text-foreground">Junctions</span> = graph nodes with signals</li>
              <li><span className="text-foreground">Roads</span> = directed edges with length</li>
            </ul>
          </Panel>
          {info && (
            <Panel title={info.type} tone="cloud">
              <div className="p-4">
                <div className="font-mono text-lg font-semibold text-foreground">{info.title}</div>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {info.lines.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-mono text-xs text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Panel>
          )}
        </div>
      </div>
      <div className="mt-4">
        <ExplainTabs
          simple={<p>Like a metro map, MAARG knows which roads join which junctions and how long each road is. That is how it knows that cars seen at CAM_07 will reach J-04 in about 18 seconds.</p>}
          technical={
            <p>
              Segments are stored as PostGIS LineStrings with direction and length; cameras are snapped to segments; junction approaches list their upstream
              cameras. Graph queries answer reachability (for association), shortest feasible paths (for trajectories) and upstream distance (for ETA).
            </p>
          }
        />
      </div>
    </Section>
  );
}
