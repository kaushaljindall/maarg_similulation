"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Pause, Play, RotateCcw, Zap } from "lucide-react";
import { makeVehicle, pointAlong, stepLane, type LaneVehicle } from "@/lib/lane-sim";
import { BASE_GREEN, BASE_RED, DEFAULT_UPSTREAM, ELAPSED, HEADWAY, LANES, YELLOW, computePlan, type Upstream } from "@/lib/signal-logic";
import { useFrame } from "@/lib/use-frame";
import { CctvCamera, TrafficLight, type Lamp } from "./illustrations";
import { Btn, ExplainTabs, Panel, Section, SimBadge, TechChip, cn, useRunEvent } from "./ui";

const PX = 0.75;
const STOP = 400;
const ALLRED = 2;
const EW_GREEN = BASE_RED - YELLOW - ALLRED * 2;
const DECIDE_AT = 3;

type Phase = { ns: Lamp; ew: Lamp; label: string; left: number };

function phaseAt(t: number, nsGreen: number): Phase {
  let acc = 0;
  for (let cycleN = 0; cycleN < 20; cycleN++) {
    const seq = [
      { d: cycleN === 0 ? nsGreen - ELAPSED : BASE_GREEN, ns: "green", ew: "red", label: "NS GREEN" },
      { d: YELLOW, ns: "yellow", ew: "red", label: "NS AMBER" },
      { d: ALLRED, ns: "red", ew: "red", label: "ALL-RED" },
      { d: EW_GREEN, ns: "red", ew: "green", label: "EW GREEN" },
      { d: YELLOW, ns: "red", ew: "yellow", label: "EW AMBER" },
      { d: ALLRED, ns: "red", ew: "red", label: "ALL-RED" },
    ] as const;
    for (const c of seq) {
      if (t < acc + c.d) return { ns: c.ns, ew: c.ew, label: c.label, left: acc + c.d - t };
      acc += c.d;
    }
  }
  return { ns: "red", ew: "red", label: "ALL-RED", left: 0 };
}

type Sim = { t: number; ns: LaneVehicle[][]; ew: LaneVehicle[][]; nsIds: Set<number>; stopped: Set<number> };

function buildSim(up: Upstream[], ewQueue: number): Sim {
  const ns: LaneVehicle[][] = [[], [], []];
  const ew: LaneVehicle[][] = [[], [], []];
  const nsIds = new Set<number>();
  const p = up[0];
  for (let i = 0; i < p.n; i++) {
    const r = Math.floor(i / LANES);
    const v = makeVehicle(0, p.v / 3.6, STOP - p.d - r * HEADWAY * (p.v / 3.6));
    v.v = p.v / 3.6;
    ns[i % LANES].push(v);
    nsIds.add(v.id);
  }
  const q = Math.min(ewQueue, 30);
  for (let i = 0; i < q; i++) {
    const v = makeVehicle(0, 9, STOP - 3 - Math.floor(i / LANES) * 7.5);
    v.v = 0;
    ew[i % LANES].push(v);
  }
  const p3 = up[2];
  for (let i = 0; i < p3.n; i++) {
    const r = Math.floor(i / LANES);
    const v = makeVehicle(0, p3.v / 3.6, STOP - p3.d - r * HEADWAY * (p3.v / 3.6));
    ew[i % LANES].push(v);
  }
  return { t: 0, ns, ew, nsIds, stopped: new Set() };
}

export function DynamicSignal() {
  const [up, setUp] = useState<Upstream[]>(DEFAULT_UPSTREAM);
  const [ewQueue, setEwQueue] = useState(12);
  const [occ, setOcc] = useState(54);
  const [hist, setHist] = useState(1);
  const [maarg, setMaarg] = useState(true);
  const [playing, setPlaying] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const plan = useMemo(() => computePlan({ up, ewQueue, downstreamOcc: occ, historicalFactor: hist }), [up, ewQueue, occ, hist]);
  const sim = useRef<Sim>(buildSim(DEFAULT_UPSTREAM, 12));

  const reset = useCallback(
    (nextUp = up, nextQ = ewQueue) => {
      sim.current = buildSim(nextUp, nextQ);
      setPlaying(false);
    },
    [up, ewQueue],
  );

  const start = useCallback(() => {
    sim.current = buildSim(up, ewQueue);
    setPlaying(true);
  }, [up, ewQueue]);
  useRunEvent("signal", start);

  const applied = maarg && sim.current.t >= DECIDE_AT;
  const nsGreen = applied ? plan.newGreen : BASE_GREEN;
  const ph = phaseAt(sim.current.t, nsGreen);

  useFrame(
    (dt) => {
      const s = sim.current;
      if (s.t > 95) {
        setPlaying(false);
        return;
      }
      s.t += dt;
      const g = maarg && s.t >= DECIDE_AT ? plan.newGreen : BASE_GREEN;
      const p = phaseAt(s.t, g);
      s.ns.forEach((lane) => {
        stepLane(lane, dt, [{ x: STOP, go: p.ns === "green" }], 980, 0.55);
        lane.forEach((v) => v.stops > 0 && s.stopped.add(v.id));
      });
      s.ew.forEach((lane) => stepLane(lane, dt, [{ x: STOP, go: p.ew === "green" }], 980, 0.55));
    },
    playing,
    svgRef,
  );

  const s = sim.current;
  const nsAll = s.ns.flat();
  const stoppedNow = s.stopped.size;
  const passedNS = up[0].n - nsAll.filter((v) => v.x < STOP).length;
  const greenShown = applied ? plan.newGreen : BASE_GREEN;
  const redShown = applied ? BASE_RED + plan.ext : BASE_RED;

  const setU = (i: number, k: "n" | "d" | "v", val: number) => {
    const next = up.map((u, j) => (j === i ? { ...u, [k]: val } : u));
    setUp(next);
    reset(next);
  };

  const camY = (STOP - Math.min(up[0].d, 395)) * PX;
  const camX3 = 720 - (STOP - Math.min(up[2].d, 395)) * PX;
  const pk1 = s.t > 0.2 && s.t < 2 ? pointAlong([[440, camY], [460, 250], [600, 70]], (s.t - 0.2) / 1.8) : null;
  const pk2 = maarg && s.t > 2.1 && s.t < DECIDE_AT ? pointAlong([[600, 70], [455, 270]], (s.t - 2.1) / (DECIDE_AT - 2.1)) : null;

  return (
    <Section
      id="signal"
      n="10"
      kicker="The core USP"
      title="Dynamic signal timing from upstream traffic"
      lead="MAARG does not only react to the queue already at a signal. It looks at cameras before the junction, estimates how many vehicles are coming and when they arrive, checks the cross street and the road ahead, and then times the upcoming signal."
      actions={
        <>
          <Btn variant="primary" onClick={start}>
            <Play className="h-4 w-4" aria-hidden /> Run scenario
          </Btn>
          <Btn onClick={() => setPlaying((p) => !p)} disabled={s.t === 0}>
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {playing ? "Pause" : "Resume"}
          </Btn>
          <Btn onClick={() => reset()}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Reset
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel
          title="Intersection J-04"
          right={
            <div className="flex items-center gap-2">
              <div role="radiogroup" aria-label="Signal control" className="flex rounded border border-border-strong p-0.5 font-mono text-[11px]">
                {[
                  { k: true, l: "MAARG dynamic" },
                  { k: false, l: "Fixed timer" },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    role="radio"
                    aria-checked={maarg === o.k}
                    onClick={() => {
                      setMaarg(o.k);
                      reset();
                    }}
                    className={cn("rounded px-2 py-0.5", maarg === o.k ? (o.k ? "bg-success text-background" : "bg-surface-3 text-foreground") : "text-muted")}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <SimBadge />
            </div>
          }
        >
          <div className="relative">
            <svg ref={svgRef} viewBox="0 0 720 720" className="block w-full" role="img" aria-label="Animated intersection J-04 with an upstream platoon approaching from the north">
              <rect width={720} height={720} fill="#0a1627" />
              {[[0, 0], [420, 0], [0, 420], [420, 420]].map(([x, y]) => (
                <g key={`${x}${y}`}>
                  <rect x={x + 16} y={y + 16} width={268} height={268} fill="#0b1829" stroke="#13263f" />
                  <rect x={x + 40} y={y + 40} width={100} height={80} fill="#0e1f36" />
                  <rect x={x + 160} y={y + 150} width={100} height={110} fill="#0e1f36" />
                </g>
              ))}
              <rect x={300} y={0} width={120} height={720} fill="#16263c" />
              <rect x={0} y={300} width={720} height={120} fill="#16263c" />
              <line x1={360} x2={360} y1={0} y2={300} stroke="#c8d3e2" strokeOpacity={0.6} strokeWidth={2} />
              <line x1={360} x2={360} y1={420} y2={720} stroke="#c8d3e2" strokeOpacity={0.6} strokeWidth={2} />
              <line x1={0} x2={300} y1={360} y2={360} stroke="#c8d3e2" strokeOpacity={0.6} strokeWidth={2} />
              <line x1={420} x2={720} y1={360} y2={360} stroke="#c8d3e2" strokeOpacity={0.6} strokeWidth={2} />
              {[320, 340, 380, 400].map((x) => (
                <line key={`v${x}`} x1={x} x2={x} y1={0} y2={300} stroke="#3a5274" strokeDasharray="8 10" />
              ))}
              {[380, 400, 320, 340].map((y) => (
                <line key={`h${y}`} x1={420} x2={720} y1={y} y2={y} stroke="#3a5274" strokeDasharray="8 10" />
              ))}
              <line x1={360} x2={420} y1={298} y2={298} stroke="#e7eef8" strokeWidth={3} />
              <line x1={422} x2={422} y1={360} y2={420} stroke="#e7eef8" strokeWidth={3} />
              <rect x={300} y={300} width={120} height={120} fill="#1a2c46" />

              <line x1={430} x2={430} y1={camY} y2={300} stroke="#3d8bfd" strokeDasharray="3 4" />
              <text x={436} y={(camY + 300) / 2} fontSize={11} className="fill-primary font-mono">
                {up[0].d} m
              </text>

              {s.ns.flat().map((v) => {
                const lane = s.ns.findIndex((l) => l.includes(v));
                const y = v.x * PX;
                if (y < -20 || y > 740) return null;
                return <rect key={v.id} x={364 + lane * 20} y={y - 9} width={11} height={18} rx={2} fill={v.stops > 0 ? "#e5484d" : v.color} />;
              })}
              {s.ew.flat().map((v) => {
                const lane = s.ew.findIndex((l) => l.includes(v));
                const x = 720 - v.x * PX;
                if (x < -20 || x > 740) return null;
                return <rect key={v.id} x={x - 9} y={364 + lane * 20} width={18} height={11} rx={2} fill={v.color} opacity={0.85} />;
              })}

              <CctvCamera x={448} y={camY - 20} scale={0.8} label="CAM_01" />
              <CctvCamera x={camX3} y={436} scale={0.8} label="CAM_03" />
              <g>
                <text x={250} y={706} fontSize={11} className="fill-muted font-mono" textAnchor="end">
                  CAM_02 · {up[1].d} m south ↓ · {up[1].n} veh
                </text>
              </g>

              <TrafficLight x={440} y={270} state={ph.ns} />
              <TrafficLight x={450} y={448} state={ph.ew} horizontal />

              <g transform="translate(560 30)">
                <rect width={150} height={50} rx={8} fill="#0c1f3a" stroke="#3d8bfd" />
                <text x={75} y={22} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-foreground">
                  MAARG
                </text>
                <text x={75} y={38} textAnchor="middle" fontSize={9.5} className="fill-muted font-mono">
                  prediction · optimiser
                </text>
              </g>
              {pk1 && <rect x={pk1[0] - 6} y={pk1[1] - 6} width={12} height={12} rx={2} fill="#3d8bfd" />}
              {pk2 && <rect x={pk2[0] - 6} y={pk2[1] - 6} width={12} height={12} rx={2} fill="#2fbf71" />}

              <g transform="translate(20 20)">
                <rect width={196} height={92} rx={8} fill="#06101d" stroke="#2a4a72" />
                <text x={14} y={24} fontSize={11} className="fill-muted font-mono">
                  J-04 · t = {s.t.toFixed(1)} s
                </text>
                <text x={14} y={58} fontSize={28} fontWeight={700} className={cn("font-mono", ph.ns === "green" || ph.ew === "green" ? "fill-success" : ph.label.includes("AMBER") ? "fill-warning" : "fill-danger")}>
                  {Math.ceil(ph.left)}s
                </text>
                <text x={14} y={80} fontSize={11} fontWeight={600} className="fill-foreground font-mono">
                  {ph.label}
                </text>
              </g>
            </svg>
            {applied && plan.ext > 0 && s.t < 14 && (
              <div className="fade-up absolute left-1/2 top-[40%] -translate-x-1/2 rounded-md border border-success bg-background/90 px-4 py-2 text-center">
                <div className="font-mono text-xs text-success">MAARG DECISION</div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  GREEN {BASE_GREEN} → {plan.newGreen} s
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-center">
            <div className="bg-surface px-3 py-2">
              <div className="font-mono text-[10px] uppercase text-muted">NS green plan</div>
              <div className={cn("font-mono text-lg font-semibold", applied && plan.ext ? "text-success" : "text-foreground")}>
                {applied && plan.ext ? `${BASE_GREEN} → ${greenShown}` : greenShown} s
              </div>
            </div>
            <div className="bg-surface px-3 py-2">
              <div className="font-mono text-[10px] uppercase text-muted">Platoon vehicles stopped</div>
              <div className={cn("font-mono text-lg font-semibold", stoppedNow ? "text-danger" : "text-success")}>
                {stoppedNow} / {up[0].n}
              </div>
            </div>
            <div className="bg-surface px-3 py-2">
              <div className="font-mono text-[10px] uppercase text-muted">Passed stop line</div>
              <div className="font-mono text-lg font-semibold text-foreground">
                {passedNS} / {up[0].n}
              </div>
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Current signal plan · J-04">
            <div className="grid grid-cols-3 gap-2 p-4">
              <div className="rounded-md border border-success/50 bg-success/10 p-3">
                <div className="font-mono text-[10px] uppercase text-success">Green (NS)</div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  {greenShown}
                  <span className="text-sm text-muted"> s</span>
                </div>
                {applied && plan.ext > 0 && <div className="font-mono text-[11px] text-success">+{plan.ext} s from {BASE_GREEN}</div>}
              </div>
              <div className="rounded-md border border-warning/50 bg-warning/10 p-3">
                <div className="font-mono text-[10px] uppercase text-warning">Yellow</div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  {YELLOW}
                  <span className="text-sm text-muted"> s</span>
                </div>
              </div>
              <div className="rounded-md border border-danger/50 bg-danger/10 p-3">
                <div className="font-mono text-[10px] uppercase text-danger">Red (NS)</div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  {BASE_RED}
                  <span className="text-sm text-muted"> s</span>
                </div>
                {applied && plan.ext > 0 && <div className="font-mono text-[11px] text-muted">EW waits {redShown} s (limit {plan.ewMaxRed})</div>}
              </div>
            </div>
          </Panel>

          <Panel title="Upstream cameras feeding J-04">
            <ul className="divide-y divide-border">
              {plan.platoons.map((p, i) => (
                <li key={p.cam} className="grid grid-cols-[auto_1fr] gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/50 font-mono text-[10px] text-primary">{p.approach}</div>
                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {p.cam}: {p.n} vehicles approaching
                      </span>
                      <span className={cn("font-mono text-xs", p.axis === "NS" ? "text-success" : "text-muted")}>{p.axis} phase</span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted">
                      {p.d} m · {p.v} km/h · ETA {p.eta.toFixed(1)} s · platoon passes in ~{p.pass.toFixed(0)} s
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Slider label="vehicles" min={0} max={60} value={p.n} onChange={(v) => setU(i, "n", v)} />
                      <Slider label="distance m" min={80} max={500} step={10} value={p.d} onChange={(v) => setU(i, "d", v)} />
                      <Slider label="km/h" min={10} max={60} value={p.v} onChange={(v) => setU(i, "v", v)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-3 border-t border-border px-4 py-3">
              <Slider label="EW queue (veh)" min={0} max={40} value={ewQueue} onChange={(v) => { setEwQueue(v); reset(up, v); }} />
              <Slider label="J-05 downstream %" min={0} max={100} value={occ} onChange={setOcc} />
              <Slider label="history ×" min={0.8} max={1.2} step={0.05} value={hist} onChange={setHist} fmt={(v) => v.toFixed(2)} />
            </div>
          </Panel>
        </div>
      </div>

      <PredictionEngine plan={plan} ewQueue={ewQueue} occ={occ} hist={hist} />

      <div className="mt-4 rounded-lg border border-success/40 bg-success/5 p-4 text-sm text-foreground">
        <Zap className="mr-2 inline h-4 w-4 text-success" aria-hidden />
        &quot;The signal is not using a fixed timer. MAARG is dynamically adapting it based on upstream traffic.&quot; With the current inputs, a fixed
        timer stops <span className="font-mono text-danger">{plan.stoppedFixed}</span> of the {up[0].n} CAM_01 vehicles; MAARG stops{" "}
        <span className="font-mono text-success">{plan.stoppedMaarg}</span>.
      </div>
    </Section>
  );
}

function Slider({ label, min, max, step = 1, value, onChange, fmt }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between font-mono text-[10px] text-muted">
        <span>{label}</span>
        <span className="text-foreground">{fmt ? fmt(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
    </label>
  );
}

function PredictionEngine({ plan, ewQueue, occ, hist }: { plan: ReturnType<typeof computePlan>; ewQueue: number; occ: number; hist: number }) {
  const c1 = plan.platoons[0];
  const inputs: [string, string][] = [
    ["Upstream camera data", plan.platoons.map((p) => `${p.cam} ${p.n}`).join(" · ")],
    ["Current signal state", `NS green, ${ELAPSED} s elapsed of ${BASE_GREEN} s (${plan.remaining} s left)`],
    ["Vehicle speed", `${c1.v} km/h (CAM_01 platoon)`],
    ["Distance", `${c1.d} m CAM_01 → stop line (PostGIS)`],
    ["Queue length", `EW ${ewQueue} vehicles waiting`],
    ["Downstream capacity", `J-05 ${occ}% occupied`],
    ["Historical pattern", `Tue 08:40 profile × ${hist.toFixed(2)}`],
  ];
  return (
    <Panel className="mt-4" tone="cloud" title="Traffic prediction engine · decision logic" right={<span className="font-mono text-[10px] text-warning">conceptual simulation</span>}>
      <div className="grid gap-3 p-4 lg:grid-cols-[1.2fr_auto_1fr_auto_1fr_auto_0.8fr]">
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">Input</div>
          <ul className="space-y-1.5">
            {inputs.map(([k, v], i) => (
              <li key={k} className="text-xs">
                <span className="text-foreground">{i > 0 && <span className="text-primary">+ </span>}{k}</span>
                <div className="font-mono text-[11px] text-muted">{v}</div>
              </li>
            ))}
          </ul>
        </div>
        <Arrow />
        <div className="rounded-md border border-primary/50 bg-primary/10 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-primary">Prediction</div>
          <p className="text-sm text-foreground">
            Predicted arrival: <span className="font-mono font-semibold">{c1.n} vehicles</span> from CAM_01 expected in{" "}
            <span className="font-mono font-semibold">{c1.eta.toFixed(0)} s</span>
          </p>
          <p className="mt-2 text-sm text-foreground">
            &quot;Estimated vehicles reaching J-04 in next {plan.window} s: <span className="font-mono font-semibold">{plan.predictedTotal}</span>&quot;
          </p>
          <div className="mt-2 space-y-1 rounded bg-background/60 p-2 font-mono text-[10.5px] leading-4 text-muted">
            <div>ETA = distance ÷ speed = {c1.d} ÷ {(c1.v / 3.6).toFixed(1)} m/s = {c1.eta.toFixed(1)} s</div>
            <div>
              pass = ⌈{c1.n} ÷ {LANES} lanes⌉ × {HEADWAY} s = {c1.pass.toFixed(1)} s
            </div>
          </div>
        </div>
        <Arrow />
        <div className={cn("rounded-md border p-3", plan.kind === "blocked-spillback" ? "border-danger/60 bg-danger/10" : "border-success/50 bg-success/10")}>
          <div className={cn("mb-2 font-mono text-[10px] uppercase tracking-wider", plan.kind === "blocked-spillback" ? "text-danger" : "text-success")}>Decision engine</div>
          <p className="font-mono text-sm font-semibold text-foreground">&quot;{plan.decision}&quot;</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{plan.reason}</p>
          <div className="mt-2 space-y-1 rounded bg-background/60 p-2 font-mono text-[10.5px] leading-4 text-muted">
            <div>ext = ETA + pass − remaining green</div>
            <div>cap = min(max green {BASE_GREEN + 30} s, EW red ≤ {plan.ewMaxRed} s) → {plan.cap} s</div>
            <div>spillback check: J-05 &lt; 85% {occ < 85 ? "✓" : "✗"}</div>
          </div>
        </div>
        <Arrow />
        <div className="rounded-md border border-success/50 bg-surface-2 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-success">Signal controller</div>
          <div className="font-mono text-2xl font-semibold text-success">GREEN: {plan.newGreen} s</div>
          <p className="mt-1 text-xs text-muted">Yellow {YELLOW} s and all-red clearance unchanged; local interlock enforces safety.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TechChip id="prediction" />
            <TechChip id="optimizer" />
            <TechChip id="controller" />
          </div>
        </div>
      </div>
      <div className="border-t border-border p-4">
        <ExplainTabs
          simple={<p>MAARG sees a big group of cars just one block away. If the light turned red now, almost all of them would have to stop. So it keeps the light green a little longer — but only as long as the cross street can afford to wait and the road ahead has room.</p>}
          technical={
            <p>
              This view uses transparent rule-based logic: platoon ETA from PostGIS distance and live speed, discharge time from lane count and a
              {` ${HEADWAY}`} s headway, an extension bounded by maximum green, a cross-street maximum-red constraint that tightens with EW queue length, and a
              downstream spillback guard. A production optimiser could replace these rules with model-based prediction; the inputs, constraints and
              outputs remain the same.
            </p>
          }
        />
      </div>
    </Panel>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-muted">
      <ArrowRight className="hidden h-5 w-5 lg:block" aria-hidden />
      <ArrowDown className="h-5 w-5 lg:hidden" aria-hidden />
    </div>
  );
}
