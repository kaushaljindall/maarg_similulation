"use client";

import { useRef, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { makeVehicle, pointAlong, stepLane, type LaneVehicle } from "@/lib/lane-sim";
import { useFrame } from "@/lib/use-frame";
import { CctvCamera, CloudShape, ServerRack, TrafficLight, type Lamp } from "./illustrations";
import { useSim } from "./sim-context";
import { SimBadge } from "./ui";

type Sig = { phase: "EW" | "NS"; state: "green" | "yellow" | "allred"; t: number; planned: number; ext: number };
type Pkt = { pts: [number, number][]; p: number; dur: number; kind: "obs" | "decision"; label: string; onArrive?: () => void };

const J = [430, 910];
const CAM = [230, 690];
const SPEED = 3;
const EDGE_Y = 248;
const KAFKA_Y = 352;
const CLOUD = { x: 330, y: 410, w: 560, h: 120 };
const CTRL = { x: 1010, y: 410, w: 170, h: 84 };

function lamp(s: Sig, axis: "EW" | "NS"): Lamp {
  if (s.state === "allred" || s.phase !== axis) return "red";
  return s.state === "green" ? "green" : "yellow";
}

export function SystemOverview() {
  const { openSpec, setOverlay } = useSim();
  const ref = useRef<SVGSVGElement>(null);
  const sim = useRef({
    t: 0,
    east: [] as LaneVehicle[],
    west: [] as LaneVehicle[],
    south: [[], []] as LaneVehicle[][],
    sigs: [
      { phase: "EW", state: "green", t: 6, planned: 20, ext: 0 },
      { phase: "NS", state: "green", t: 2, planned: 12, ext: 0 },
    ] as Sig[],
    packets: [] as Pkt[],
    nextPlatoon: 2,
    nextSingle: 1,
    cam2Hits: [] as number[],
    lastDecision: -99,
    banner: null as null | { text: string; until: number },
    obsCount: 10420,
  });

  const [paused, setPaused] = useState(false);

  useFrame(
    (dtReal) => {
      const s = sim.current;
      const dt = dtReal * SPEED;
      s.t += dt;
      if (s.t > s.nextPlatoon) {
        for (let i = 0; i < 7; i++) s.east.push(makeVehicle(s.t, 12, -i * 16));
        s.nextPlatoon = s.t + 38;
      }
      if (s.t > s.nextSingle) {
        if (Math.random() < 0.6) s.west.push(makeVehicle(s.t, 11));
        else s.east.push(makeVehicle(s.t, 11));
        if (Math.random() < 0.5) s.south[Math.random() < 0.5 ? 0 : 1].push(makeVehicle(s.t, 9));
        s.nextSingle = s.t + 4 + Math.random() * 5;
      }

      s.sigs.forEach((g) => {
        g.t += dt;
        if (g.state === "green" && g.t >= g.planned) {
          g.state = "yellow";
          g.t = 0;
        } else if (g.state === "yellow" && g.t >= 3) {
          g.state = "allred";
          g.t = 0;
        } else if (g.state === "allred" && g.t >= 2) {
          g.state = "green";
          g.phase = g.phase === "EW" ? "NS" : "EW";
          g.t = 0;
          g.planned = g.phase === "EW" ? 20 + g.ext : 12;
          if (g.phase === "EW") g.ext = 0;
        }
      });

      const ewGo = (j: number) => lamp(s.sigs[j], "EW") === "green";
      const nsGo = (j: number) => lamp(s.sigs[j], "NS") === "green";

      const beforeE = new Map(s.east.map((v) => [v.id, v.x]));
      stepLane(s.east, dt, [{ x: J[0] - 30, go: ewGo(0) }, { x: J[1] - 30, go: ewGo(1) }], 1220);
      s.east.forEach((v) => {
        const prev = beforeE.get(v.id) ?? v.x;
        CAM.forEach((cx, ci) => {
          if (prev < cx && v.x >= cx) onObs(ci, ci === 1);
        });
      });
      stepLane(s.west, dt, [{ x: 1200 - (J[1] + 30), go: ewGo(1) }, { x: 1200 - (J[0] + 30), go: ewGo(0) }], 1220);
      s.south.forEach((lane, j) => stepLane(lane, dt, [{ x: 80, go: nsGo(j) }], 230));

      for (const p of s.packets) {
        p.p += dtReal / p.dur;
        if (p.p >= 1 && p.onArrive) {
          p.onArrive();
          p.onArrive = undefined;
        }
      }
      s.packets = s.packets.filter((p) => p.p < 1);
      if (s.banner && s.t > s.banner.until) s.banner = null;

      function onObs(camIdx: number, eastbound: boolean) {
        s.obsCount++;
        const ex = J[camIdx];
        s.packets.push({
          pts: [[ex, EDGE_Y + 40], [ex, KAFKA_Y + 14], [CLOUD.x + (camIdx ? 400 : 160), CLOUD.y]],
          p: 0,
          dur: 1.6,
          kind: "obs",
          label: `OBS-${s.obsCount}`,
        });
        if (camIdx === 1 && eastbound) {
          s.cam2Hits = [...s.cam2Hits.filter((h) => s.t - h < 12), s.t];
          if (s.cam2Hits.length >= 4 && s.t - s.lastDecision > 25) {
            s.lastDecision = s.t;
            const count = s.cam2Hits.length;
            s.packets.push({
              pts: [[CLOUD.x + CLOUD.w, CLOUD.y + 60], [CTRL.x, CTRL.y + 42]],
              p: 0,
              dur: 1.2,
              kind: "decision",
              label: "PLAN J-02",
              onArrive: () => {
                s.packets.push({
                  pts: [[CTRL.x + CTRL.w / 2, CTRL.y], [CTRL.x + CTRL.w / 2, 70], [J[1] + 46, 70]],
                  p: 0,
                  dur: 1.2,
                  kind: "decision",
                  label: "SET TIMING",
                  onArrive: () => {
                    const g = s.sigs[1];
                    if (g.phase === "EW" && g.state === "green") {
                      const old = g.planned;
                      g.planned = Math.min(36, Math.max(g.planned, g.t + 14));
                      s.banner = { text: `J-02 EW green ${Math.round(old)} → ${Math.round(g.planned)} s · ${count} vehicles approaching from CAM_02`, until: s.t + 20 };
                    } else {
                      g.ext = 8;
                      if (g.phase === "NS" && g.state === "green" && g.t > 8) g.planned = g.t;
                      s.banner = { text: `J-02 next EW green brought forward and extended +8 s · ${count} vehicles from CAM_02`, until: s.t + 20 };
                    }
                  },
                },
                );
              },
            });
          }
        }
      }
    },
    !paused,
    ref,
  );

  const s = sim.current;
  const sigs = s.sigs;

  const clickable = "cursor-pointer outline-none [&:hover>*]:opacity-90 focus-visible:[&>rect]:stroke-white";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <span className="font-mono text-xs uppercase tracking-wider text-foreground">Live system · CAM 01 → J-01 → CAM 02 → J-02</span>
          <SimBadge />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-muted md:inline-flex">
            <MousePointerClick className="h-3.5 w-3.5" aria-hidden /> Click any component or blue packet
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded border border-border-strong px-2 py-1 font-mono text-xs text-foreground hover:bg-surface-2"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
      <svg ref={ref} viewBox="0 0 1200 560" className="block w-full grid-bg" role="img" aria-label="Animated MAARG pipeline: cameras send video to edge servers, which send observations through Kafka to the MAARG cloud, which sends timing plans to the signal controller.">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--border-strong)" />
          </marker>
        </defs>

        <rect x={0} y={88} width={1200} height={48} fill="var(--surface-3)" />
        <line x1={0} x2={1200} y1={112} y2={112} stroke="var(--border-strong)" strokeDasharray="14 12" />
        {J.map((jx) => (
          <g key={jx}>
            <rect x={jx - 24} y={0} width={48} height={225} fill="var(--surface-3)" />
            <line x1={jx} x2={jx} y1={0} y2={88} stroke="var(--border-strong)" strokeDasharray="10 10" />
            <line x1={jx} x2={jx} y1={136} y2={225} stroke="var(--border-strong)" strokeDasharray="10 10" />
            <rect x={jx - 24} y={88} width={48} height={48} fill="var(--surface-3)" />
            <line x1={jx - 30} x2={jx - 30} y1={88} y2={112} stroke="var(--foreground)" strokeWidth={2} opacity={0.6} />
            <line x1={jx + 30} x2={jx + 30} y1={112} y2={136} stroke="var(--foreground)" strokeWidth={2} opacity={0.6} />
          </g>
        ))}

        {s.east.map((v) => (
          <rect key={v.id} x={v.x - 12} y={94} width={12} height={7} rx={1.5} fill={v.color} />
        ))}
        {s.west.map((v) => (
          <rect key={v.id} x={1200 - v.x} y={123} width={12} height={7} rx={1.5} fill={v.color} />
        ))}
        {s.south.map((lane, j) =>
          lane.map((v) => <rect key={v.id} x={J[j] + 8} y={v.x - 12} width={7} height={12} rx={1.5} fill={v.color} />),
        )}

        {J.map((jx, j) => (
          <g key={`sig${jx}`}>
            <TrafficLight x={jx - 46} y={66} state={lamp(sigs[j], "EW")} scale={0.75} />
            <TrafficLight x={jx + 46} y={168} state={lamp(sigs[j], "NS")} scale={0.75} />
            <text x={jx + 30} y={20} fontSize={12} fontWeight={600} className="fill-foreground font-mono">
              J-0{j + 1}
            </text>
            <text x={jx + 30} y={36} fontSize={10} className="fill-muted font-mono">
              {sigs[j].state === "green" ? `${sigs[j].phase} ${Math.max(0, Math.ceil(sigs[j].planned - sigs[j].t))}s` : sigs[j].state === "yellow" ? `${sigs[j].phase} amber` : "all-red"}
            </text>
          </g>
        ))}

        {CAM.map((cx, i) => (
          <g key={cx} role="button" tabIndex={0} aria-label={`CAM_0${i + 1}: what does the camera do?`} className={clickable} onClick={() => openSpec("camera")} onKeyDown={(e) => e.key === "Enter" && openSpec("camera")}>
            <CctvCamera x={cx} y={46} label={`CAM_0${i + 1}`} />
            <path d={`M ${cx + 30} 44 L ${cx + 120} 100 L ${cx + 40} 100 Z`} fill="var(--primary)" opacity={0.08} />
          </g>
        ))}

        {CAM.map((cx, i) => (
          <g key={`v${cx}`}>
            <path d={`M ${cx} 82 C ${cx} 180, ${J[i] - 40} 200, ${J[i] - 30} ${EDGE_Y}`} fill="none" stroke="var(--edge)" strokeWidth={3} className="flow-line" opacity={0.85} />
            <text x={(cx + J[i]) / 2 - 40} y={200} fontSize={9} className="fill-edge font-mono">
              RAW VIDEO · local
            </text>
          </g>
        ))}

        {J.map((jx, i) => (
          <g key={`e${jx}`} role="button" tabIndex={0} aria-label={`EDGE_J0${i + 1}: open edge explainer`} className={clickable} onClick={() => setOverlay("edge-explainer")} onKeyDown={(e) => e.key === "Enter" && setOverlay("edge-explainer")}>
            <ServerRack x={jx - 30} y={EDGE_Y - 10} w={60} h={52} active />
            <rect x={jx + 36} y={EDGE_Y - 6} width={128} height={44} rx={4} fill="var(--surface)" stroke="var(--edge)" strokeOpacity={0.35} />
            <text x={jx + 44} y={EDGE_Y + 9} fontSize={10} fontWeight={600} className="fill-edge font-mono">
              EDGE_J0{i + 1}
            </text>
            <text x={jx + 44} y={EDGE_Y + 22} fontSize={9} className="fill-muted font-mono">
              YOLO · ByteTrack · OCR
            </text>
            <text x={jx + 44} y={EDGE_Y + 33} fontSize={9} className="fill-muted font-mono">
              video → observations
            </text>
          </g>
        ))}

        {J.map((jx) => (
          <line key={`k${jx}`} x1={jx} x2={jx} y1={EDGE_Y + 44} y2={KAFKA_Y} stroke="var(--border-strong)" markerEnd="url(#arr)" />
        ))}

        <g role="button" tabIndex={0} aria-label="Apache Kafka: what does it do?" className={clickable} onClick={() => openSpec("kafka")} onKeyDown={(e) => e.key === "Enter" && openSpec("kafka")}>
          <rect x={300} y={KAFKA_Y} width={720} height={28} rx={4} fill="var(--surface)" stroke="var(--success)" strokeOpacity={0.6} />
          <text x={316} y={KAFKA_Y + 18} fontSize={11} fontWeight={600} className="fill-success font-mono">
            APACHE KAFKA
          </text>
          <text x={418} y={KAFKA_Y + 18} fontSize={10} className="fill-muted font-mono">
            topic maarg.observations · {s.obsCount.toLocaleString("en-IN")} events
          </text>
        </g>
        <line x1={660} x2={660} y1={KAFKA_Y + 28} y2={CLOUD.y} stroke="var(--border-strong)" markerEnd="url(#arr)" />

        <g role="button" tabIndex={0} aria-label="MAARG cloud: what happens here?" className={clickable} onClick={() => openSpec("association")} onKeyDown={(e) => e.key === "Enter" && openSpec("association")}>
          <CloudShape x={CLOUD.x} y={CLOUD.y} w={CLOUD.w} h={CLOUD.h}>
            <text x={20} y={26} fontSize={13} fontWeight={600} className="fill-foreground">
              MAARG CITY INTELLIGENCE CLOUD
            </text>
            {["Ingestion", "Association", "Trajectory", "Analytics", "Prediction", "Signal optimisation"].map((m, i) => (
              <g key={m} transform={`translate(${20 + (i % 3) * 176} ${44 + Math.floor(i / 3) * 34})`}>
                <rect width={164} height={26} rx={4} fill="var(--surface-2)" stroke="var(--primary)" strokeOpacity={0.35} />
                <text x={10} y={17} fontSize={10.5} className="fill-foreground font-mono">
                  {m}
                </text>
              </g>
            ))}
          </CloudShape>
        </g>

        <g role="button" tabIndex={0} aria-label="Signal controller: what does it do?" className={clickable} onClick={() => openSpec("controller")} onKeyDown={(e) => e.key === "Enter" && openSpec("controller")}>
          <rect x={CTRL.x} y={CTRL.y} width={CTRL.w} height={CTRL.h} rx={6} fill="var(--surface)" stroke="var(--success)" strokeOpacity={0.7} />
          <text x={CTRL.x + 12} y={CTRL.y + 22} fontSize={11} fontWeight={600} className="fill-success font-mono">
            SIGNAL CONTROLLER
          </text>
          <text x={CTRL.x + 12} y={CTRL.y + 40} fontSize={10} className="fill-muted font-mono">
            J-02 cabinet
          </text>
          <text x={CTRL.x + 12} y={CTRL.y + 56} fontSize={10} className="fill-muted font-mono">
            safety interlock · fallback
          </text>
          <text x={CTRL.x + 12} y={CTRL.y + 72} fontSize={10} className="fill-muted font-mono">
            plan from MAARG
          </text>
        </g>
        <path d={`M ${CLOUD.x + CLOUD.w} ${CLOUD.y + 60} L ${CTRL.x} ${CTRL.y + 42}`} stroke="var(--success)" strokeOpacity={0.4} fill="none" markerEnd="url(#arr)" />
        <path d={`M ${CTRL.x + CTRL.w / 2} ${CTRL.y} L ${CTRL.x + CTRL.w / 2} 70 L ${J[1] + 46} 70`} stroke="var(--success)" strokeOpacity={0.4} fill="none" strokeDasharray="4 6" />

        {s.packets.map((p, i) => {
          const [x, y] = pointAlong(p.pts, p.p);
          const isObs = p.kind === "obs";
          return (
            <g
              key={`${p.label}-${i}`}
              transform={`translate(${x} ${y})`}
              className="cursor-pointer"
              onClick={() => (isObs ? setOverlay("packet") : openSpec("optimizer"))}
              role="button"
              aria-label={isObs ? `Observation packet ${p.label}: view data inside` : "Timing plan packet"}
            >
              <circle r={12} fill="transparent" />
              <rect x={-6} y={-6} width={12} height={12} rx={2} fill={isObs ? "var(--primary)" : "var(--success)"} />
              <text x={10} y={4} fontSize={9} className={isObs ? "fill-primary font-mono" : "fill-success font-mono"}>
                {p.label}
              </text>
            </g>
          );
        })}

        {s.banner && (
          <g transform="translate(560 160)">
            <rect width={630} height={32} rx={6} fill="var(--surface)" stroke="var(--success)" />
            <text x={14} y={20} fontSize={11.5} fontWeight={600} className="fill-success font-mono">
              MAARG DECISION · {s.banner.text}
            </text>
          </g>
        )}
      </svg>
      <div className="grid gap-px border-t border-border bg-border text-xs sm:grid-cols-3">
        <Legend color="var(--edge)" title="Raw video" text="Camera → nearby edge server only. Processed locally." dashed />
        <Legend color="var(--primary)" title="Structured observation" text="~0.5 KB event per vehicle → Kafka → MAARG cloud." />
        <Legend color="var(--success)" title="Timing plan" text="Cloud decision → signal controller → the upcoming signal (J-02)." />
      </div>
    </div>
  );
}

function Legend({ color, title, text, dashed }: { color: string; title: string; text: string; dashed?: boolean }) {
  return (
    <div className="flex items-start gap-3 bg-surface px-4 py-3">
      <span className="mt-1.5 h-0.5 w-6 shrink-0" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color }} aria-hidden />
      <div>
        <div className="font-mono uppercase tracking-wider text-foreground">{title}</div>
        <div className="mt-0.5 text-muted">{text}</div>
      </div>
    </div>
  );
}
