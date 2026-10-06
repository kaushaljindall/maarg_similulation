"use client";

import { useState } from "react";
import { Check, Play, RotateCcw, X } from "lucide-react";
import { RoadMapSvg } from "./road-map-svg";
import { Btn, ExplainTabs, Panel, Section, SimBadge, TechChip, cn, useInterval, useRunEvent } from "./ui";

type Obs = { cam: string; time: string; plate: string; type: string; dir: string; speed: number; match: boolean; checks: [string, boolean, string][]; score: number; note?: string };

const OBS: Obs[] = [
  {
    cam: "CAM_01",
    time: "08:41:18",
    plate: "DL01AB1234",
    type: "car",
    dir: "north",
    speed: 38,
    match: true,
    score: 1,
    checks: [["Seed observation", true, "journey JRN-5531 opened"]],
  },
  {
    cam: "CAM_07",
    time: "08:42:16",
    plate: "DL01AB1234",
    type: "car",
    dir: "north",
    speed: 42,
    match: true,
    score: 0.97,
    checks: [
      ["License plate", true, "exact match"],
      ["Vehicle type", true, "car = car"],
      ["Spatial", true, "CAM_01 → J-02 → CAM_07 connected"],
      ["Temporal", true, "500 m in 58 s ≈ 31 km/h · feasible"],
      ["Direction", true, "north → north, allowed movement"],
      ["Speed", true, "38 → 42 km/h consistent"],
    ],
  },
  {
    cam: "CAM_09",
    time: "08:42:40",
    plate: "DL01AB1234",
    type: "car",
    dir: "north",
    speed: 40,
    match: false,
    score: 0.21,
    note: "Rejected: same plate but physically impossible — flagged for review (possible OCR error or duplicate plate).",
    checks: [
      ["License plate", true, "exact match"],
      ["Vehicle type", true, "car = car"],
      ["Spatial", false, "CAM_07 → CAM_09 ≈ 2.1 km by road"],
      ["Temporal", false, "2.1 km in 24 s ≈ 315 km/h · infeasible"],
      ["Direction", false, "not reachable from CAM_07 heading"],
      ["Speed", true, "40 km/h"],
    ],
  },
  {
    cam: "CAM_14",
    time: "08:43:05",
    plate: "DL01AB1234",
    type: "car",
    dir: "east",
    speed: 33,
    match: true,
    score: 0.95,
    checks: [
      ["License plate", true, "exact match"],
      ["Vehicle type", true, "car = car"],
      ["Spatial", true, "CAM_07 → J-04 → CAM_14 connected"],
      ["Temporal", true, "420 m in 49 s ≈ 31 km/h · feasible"],
      ["Direction", true, "north → east = right turn at J-04"],
      ["Speed", true, "42 → 33 km/h (turning)"],
    ],
  },
  {
    cam: "CAM_22",
    time: "08:44:02",
    plate: "DL01AB1234",
    type: "car",
    dir: "east",
    speed: 36,
    match: true,
    score: 0.96,
    checks: [
      ["License plate", true, "exact match"],
      ["Vehicle type", true, "car = car"],
      ["Spatial", true, "CAM_14 → J-08 → CAM_22 connected"],
      ["Temporal", true, "490 m in 57 s ≈ 31 km/h · feasible"],
      ["Direction", true, "east → east, straight"],
      ["Speed", true, "33 → 36 km/h consistent"],
    ],
  },
];

const TRAJ_STEP = [0, 0.18, 0.4, 0.4, 0.7, 1];

export function MultiCamera() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useInterval(
    () => {
      if (step >= OBS.length + 1) setPlaying(false);
      else setStep(step + 1);
    },
    playing ? 1600 : null,
  );
  const run = () => {
    setStep(1);
    setPlaying(true);
  };
  useRunEvent("association", run);

  const shown = OBS.slice(0, step);
  const done = step > OBS.length;
  const active = shown.filter((o) => o.match).map((o) => o.cam);
  const rejected = shown.filter((o) => !o.match).map((o) => o.cam);
  const current = shown[shown.length - 1];

  return (
    <Section
      id="association"
      n="07"
      kicker="Multi-camera association"
      title="Is this the same vehicle? Connecting observations into one journey"
      lead="Track IDs from the edge are only valid inside one camera. The cloud compares observations from different cameras using identity, time, place, direction and speed — and the road graph."
      actions={
        <>
          <Btn variant="primary" onClick={run}>
            <Play className="h-4 w-4" aria-hidden /> Run association
          </Btn>
          <Btn
            onClick={() => {
              setStep(0);
              setPlaying(false);
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Reset
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Incoming observations · plate DL01AB1234" right={<SimBadge />}>
          <ol className="space-y-2 p-4">
            {OBS.map((o, i) => {
              const visible = i < step;
              return (
                <li
                  key={o.cam}
                  className={cn(
                    "rounded-md border p-3 transition-opacity",
                    !visible && "opacity-30",
                    visible && o.match && "border-success/50 bg-success/5",
                    visible && !o.match && "border-danger/50 bg-danger/5",
                    !visible && "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                    <span className="font-semibold text-foreground">{o.cam}</span>
                    <span className="text-muted">{o.time}</span>
                    <span className="text-edge">{o.plate}</span>
                    <span className="text-muted">
                      {o.type} · {o.dir} · {o.speed} km/h
                    </span>
                    {visible && (
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", o.match ? "bg-success/20 text-success" : "bg-danger/20 text-danger")}>
                        {o.match ? (i === 0 ? "SEED" : `MATCH ${o.score.toFixed(2)}`) : `REJECT ${o.score.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                  {visible && o.note && <p className="mt-1.5 text-xs text-danger">{o.note}</p>}
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel title="Journey on the road graph">
          <RoadMapSvg trajectory={TRAJ_STEP[Math.min(step, TRAJ_STEP.length - 1)]} activeCams={active} rejectedCams={rejected} label="Road graph showing the reconstructed journey of DL01AB1234" />
          {done && (
            <div className="fade-up border-t border-success/40 bg-success/10 px-4 py-3">
              <div className="font-mono text-sm font-semibold text-success">MATCH FOUND · JOURNEY JRN-5531</div>
              <p className="text-sm text-foreground">These four observations belong to the same journey: CAM_01 → J-02 → CAM_07 → J-04 → CAM_14 → J-08 → CAM_22.</p>
              <p className="mt-1 font-mono text-xs text-muted">1,410 m in 2 min 44 s · average ≈ 31 km/h</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title={current ? `Comparison · ${current.cam} vs journey so far` : "Comparison"}>
        {current && current.checks.length > 1 ? (
          <ul className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {current.checks.map(([k, ok, d]) => (
              <li key={k} className="flex items-start gap-2 rounded-md border border-border bg-background/50 p-2.5">
                {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="pass" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="fail" />}
                <div>
                  <div className="text-sm font-medium text-foreground">{k}</div>
                  <div className="font-mono text-xs text-muted">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">Press &quot;Run association&quot; to compare: vehicle identity, license plate, timestamp, location, direction, speed, spatial relationship and temporal relationship.</p>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <ExplainTabs
          simple={<p>MAARG checks whether the same car could really have driven from one camera to the next in that time, on those roads, in that direction. If yes, the sightings are joined into one trip. A same-plate sighting that is physically impossible is rejected and flagged.</p>}
          technical={
            <p>
              Candidates are generated by plate (exact or edit-distance ≤ 1 for OCR noise) within a time window, then filtered by road-graph reachability
              (PostGIS) and feasible implied speed. Remaining candidates are scored on plate similarity, class, heading/turn legality and speed consistency;
              the best-scoring candidate above a threshold extends the journey. Scores shown are illustrative.
            </p>
          }
        />
        <div className="flex flex-wrap content-start gap-2 lg:w-48">
          <TechChip id="association" />
          <TechChip id="trajectory" />
          <TechChip id="postgis" />
        </div>
      </div>
    </Section>
  );
}
