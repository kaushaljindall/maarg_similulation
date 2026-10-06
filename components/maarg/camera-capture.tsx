"use client";

import { useRef } from "react";
import { ArrowRight, Video, Server } from "lucide-react";
import { useFrame } from "@/lib/use-frame";
import { ExplainTabs, Panel, Section, SimBadge, TechChip, cn } from "./ui";

type FV = { id: number; lane: number; d: number; speed: number; type: "car" | "bus" | "bike" | "auto"; plate: string; conf: number; color: string; counted: boolean };

const HY = 110;
const BY = 540;
const COUNT_Y = 430;
const PLATES = ["DL01AB1234", "HR26DK8337", "PB65AQ0921", "CH01BX4410", "DL3CAF5521", "HR51BN7093", "PB10GH3348", "UP16CT2205"];
const COLORS = ["#dfe7f2", "#9fb1c9", "#5d7ea8", "#c9d3e0", "#2c4466", "#e8e1d0"];
const TYPE_W: Record<FV["type"], number> = { car: 0.62, bus: 0.86, bike: 0.24, auto: 0.46 };

function edges(y: number) {
  const k = (y - HY) / (BY - HY);
  return [440 - 380 * k, 520 + 380 * k];
}
function laneX(y: number, f: number) {
  const [l, r] = edges(y);
  return l + f * (r - l);
}
function yOf(d: number) {
  return HY + (BY - HY) * Math.pow(d, 1.7);
}

export function CameraCapture() {
  const ref = useRef<SVGSVGElement>(null);
  const st = useRef({ vs: [] as FV[], next: 0, id: 1040, t: 0, clock: 8 * 3600 + 42 * 60 + 16, observations: 0, focus: null as FV | null });

  useFrame(
    (dt) => {
      const s = st.current;
      s.t += dt;
      s.clock += dt;
      if (s.t > s.next) {
        const r = Math.random();
        const type: FV["type"] = r < 0.12 ? "bus" : r < 0.3 ? "bike" : r < 0.45 ? "auto" : "car";
        const lane = s.id === 1041 ? 2 : 1 + Math.floor(Math.random() * 3);
        s.vs.push({
          id: ++s.id,
          lane,
          d: 0,
          speed: Math.round(32 + Math.random() * 20),
          type: s.id === 1042 ? "car" : type,
          plate: s.id === 1042 ? "DL01AB1234" : PLATES[s.id % PLATES.length],
          conf: s.id === 1042 ? 0.96 : Math.round((0.88 + Math.random() * 0.11) * 100) / 100,
          color: COLORS[s.id % COLORS.length],
          counted: false,
        });
        s.next = s.t + 1.1 + Math.random() * 1.2;
      }
      for (const v of s.vs) {
        v.d += dt * (v.speed / 42) * 0.17;
        if (!v.counted && yOf(v.d) > COUNT_Y) {
          v.counted = true;
          s.observations++;
          s.focus = v;
        }
      }
      s.vs = s.vs.filter((v) => v.d < 1.08);
      if (!s.focus) s.focus = s.vs[0] ?? null;
    },
    true,
    ref,
    24,
  );

  const s = st.current;
  const time = new Date(s.clock * 1000).toISOString().slice(11, 19);
  const focus = s.focus;
  const sorted = [...s.vs].sort((a, b) => a.d - b.d);

  const attrs: { k: string; v: string; src: "pixels" | "metadata" | "edge" }[] = [
    { k: "Video frames", v: "25 fps · 1920×1080", src: "pixels" },
    { k: "Vehicle position", v: focus ? `bbox in frame` : "—", src: "edge" },
    { k: "Vehicle type", v: focus?.type ?? "—", src: "edge" },
    { k: "License plate", v: focus?.plate ?? "—", src: "edge" },
    { k: "Lane", v: focus ? `Lane ${focus.lane}` : "—", src: "edge" },
    { k: "Direction", v: "Northbound", src: "edge" },
    { k: "Timestamp", v: time, src: "metadata" },
    { k: "Approx. speed", v: focus ? `${focus.speed} km/h` : "—", src: "edge" },
    { k: "Camera ID", v: "CAM_07", src: "metadata" },
    { k: "GPS / location", v: "30.7046, 76.7179", src: "metadata" },
    { k: "Confidence", v: focus ? `${Math.round(focus.conf * 100)}%` : "—", src: "edge" },
  ];

  return (
    <Section
      id="camera"
      n="01"
      kicker="Physical road"
      title="Camera capture: what the CCTV camera actually sees"
      lead="Everything starts with pixels. The camera records continuous video. Information such as vehicle type, plate and speed is not 'sent by the camera' — it is extracted from those pixels by the edge AI server next to the camera."
      actions={<TechChip id="camera" />}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel title="CAM_07 · live frame" right={<SimBadge />}>
          <svg ref={ref} viewBox="0 0 960 540" className="block w-full" role="img" aria-label="Simulated CCTV frame showing vehicles approaching with detection boxes">
            <defs>
              <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#0d1a2c" />
                <stop offset="1" stopColor="#13243b" />
              </linearGradient>
            </defs>
            <rect width={960} height={540} fill="url(#sky)" />
            {[60, 150, 230, 700, 770, 860].map((x, i) => (
              <rect key={x} x={x} y={40 + (i % 3) * 14} width={60 + (i % 2) * 30} height={80 - (i % 3) * 14} fill="#0b1626" stroke="#172b45" />
            ))}
            <path d={`M 440 ${HY} L 520 ${HY} L 900 ${BY} L 60 ${BY} Z`} fill="#1a283c" />
            {[1 / 3, 2 / 3].map((f) => (
              <path key={f} d={`M ${laneX(HY, f)} ${HY} L ${laneX(BY, f)} ${BY}`} stroke="#c8d3e2" strokeOpacity={0.5} strokeWidth={3} strokeDasharray="22 26" />
            ))}
            <path d={`M 440 ${HY} L 60 ${BY}`} stroke="#c8d3e2" strokeOpacity={0.7} strokeWidth={3} />
            <path d={`M 520 ${HY} L 900 ${BY}`} stroke="#c8d3e2" strokeOpacity={0.7} strokeWidth={3} />
            <line x1={edges(COUNT_Y)[0]} x2={edges(COUNT_Y)[1]} y1={COUNT_Y} y2={COUNT_Y} stroke="#2fbf71" strokeDasharray="8 6" strokeWidth={2} />
            <text x={edges(COUNT_Y)[1] - 150} y={COUNT_Y - 8} fontSize={12} className="fill-success font-mono">
              virtual count line
            </text>
            {[1, 2, 3].map((l) => (
              <text key={l} x={laneX(500, (l - 0.5) / 3) - 22} y={528} fontSize={13} className="fill-muted font-mono">
                LANE {l}
              </text>
            ))}

            {sorted.map((v) => {
              const y = yOf(v.d);
              const [l, r] = edges(y);
              const laneW = (r - l) / 3;
              const w = laneW * TYPE_W[v.type];
              const h = v.type === "bike" ? w * 1.8 : v.type === "bus" ? w * 0.95 : w * 0.72;
              const cx = laneX(y, (v.lane - 0.5) / 3);
              const x = cx - w / 2;
              const top = y - h;
              const big = w > 70;
              const isFocus = focus?.id === v.id;
              return (
                <g key={v.id}>
                  <rect x={x} y={top} width={w} height={h} rx={w * 0.12} fill={v.color} />
                  <rect x={x + w * 0.12} y={top + h * 0.1} width={w * 0.76} height={h * 0.32} rx={w * 0.05} fill="#0a1424" opacity={0.8} />
                  <rect x={x + w * 0.06} y={top + h * 0.62} width={w * 0.16} height={h * 0.1} fill="#f6e7b0" opacity={0.9} />
                  <rect x={x + w * 0.78} y={top + h * 0.62} width={w * 0.16} height={h * 0.1} fill="#f6e7b0" opacity={0.9} />
                  {v.type !== "bike" && (
                    <>
                      <rect x={cx - w * 0.18} y={top + h * 0.78} width={w * 0.36} height={h * 0.13} fill="#f5f5f0" stroke={big ? "#f2a93b" : "none"} strokeWidth={1.5} />
                      {big && (
                        <text x={cx} y={top + h * 0.78 + h * 0.1} textAnchor="middle" fontSize={Math.max(7, w * 0.055)} fontWeight={700} fill="#0a1424" className="font-mono">
                          {v.plate}
                        </text>
                      )}
                    </>
                  )}
                  <rect x={x - 4} y={top - 4} width={w + 8} height={h + 8} fill="none" stroke={isFocus ? "#f2a93b" : "#3d8bfd"} strokeWidth={isFocus ? 2.5 : 1.5} />
                  {w > 30 && (
                    <g transform={`translate(${x - 4} ${top - 22})`}>
                      <rect width={Math.max(110, w + 8)} height={18} fill={isFocus ? "#f2a93b" : "#3d8bfd"} />
                      <text x={5} y={13} fontSize={11} fontWeight={600} fill="#06101d" className="font-mono">
                        {v.type} {v.conf.toFixed(2)} · #{v.id}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            <g className="font-mono">
              <rect x={16} y={14} width={250} height={74} fill="#06101d" opacity={0.75} />
              <circle cx={32} cy={32} r={6} fill="#e5484d" className="blink" />
              <text x={46} y={37} fontSize={15} fontWeight={700} className="fill-foreground">
                CAM_07 · REC
              </text>
              <text x={28} y={58} fontSize={13} className="fill-foreground">
                {time} IST
              </text>
              <text x={28} y={77} fontSize={12} className="fill-muted">
                Lane 2 · Northbound ↑
              </text>
              <rect x={704} y={14} width={240} height={36} fill="#06101d" opacity={0.75} />
              <text x={716} y={37} fontSize={12} className="fill-muted">
                GPS 30.7046 N, 76.7179 E
              </text>
            </g>
          </svg>
          <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
            <div className="bg-surface px-4 py-2 font-mono text-xs text-muted">
              Observations generated: <span className="text-foreground">{s.observations}</span>
            </div>
            <div className="bg-surface px-4 py-2 font-mono text-xs text-muted">
              Vehicles in frame: <span className="text-foreground">{s.vs.length}</span>
            </div>
            <div className="bg-surface px-4 py-2 font-mono text-xs text-muted">
              Boxes drawn by: <span className="text-edge">edge AI (overlay)</span>
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Vehicle detected" tone="edge" right={<span className="font-mono text-[10px] text-edge">LAST AT COUNT LINE</span>}>
            {focus ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-4 font-mono text-sm">
                <dt className="text-muted">Vehicle ID</dt>
                <dd className="text-foreground">TEMP_{focus.id}</dd>
                <dt className="text-muted">Type</dt>
                <dd className="capitalize text-foreground">{focus.type}</dd>
                <dt className="text-muted">Plate</dt>
                <dd className="text-edge">{focus.type === "bike" ? "not readable" : focus.plate}</dd>
                <dt className="text-muted">Speed</dt>
                <dd className="text-foreground">{focus.speed} km/h</dd>
                <dt className="text-muted">Lane</dt>
                <dd className="text-foreground">{focus.lane}</dd>
                <dt className="text-muted">Confidence</dt>
                <dd className="text-foreground">{Math.round(focus.conf * 100)}%</dd>
              </dl>
            ) : (
              <p className="p-4 text-sm text-muted">Waiting for a vehicle to cross the count line…</p>
            )}
          </Panel>
          <Panel title="What is observed">
            <ul className="divide-y divide-border">
              {attrs.map((a) => (
                <li key={a.k} className="flex items-center justify-between gap-2 px-4 py-1.5 text-sm">
                  <span className="text-muted">{a.k}</span>
                  <span className="flex items-center gap-2">
                    <span className="max-w-[120px] truncate font-mono text-xs capitalize text-foreground">{a.v}</span>
                    <span
                      className={cn(
                        "rounded px-1 font-mono text-[9px] uppercase",
                        a.src === "pixels" && "bg-surface-3 text-muted",
                        a.src === "metadata" && "bg-primary/15 text-primary",
                        a.src === "edge" && "bg-edge/15 text-edge",
                      )}
                    >
                      {a.src === "pixels" ? "sensor" : a.src === "metadata" ? "config" : "edge AI"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex items-center gap-3 rounded-lg border border-edge/40 bg-surface p-4">
          <div className="flex flex-col items-center gap-1 rounded-md border border-border-strong bg-surface-2 px-4 py-3">
            <Video className="h-6 w-6 text-foreground" aria-hidden />
            <span className="font-mono text-[11px] text-foreground">RAW VIDEO</span>
            <span className="font-mono text-[10px] text-muted">~4 Mbit/s</span>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <span className="font-mono text-[10px] text-edge">local network (metres away)</span>
            <div className="relative h-1 w-full overflow-hidden rounded bg-surface-3">
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 4" aria-hidden>
                <line x1={0} x2={100} y1={2} y2={2} stroke="#f2a93b" strokeWidth={4} className="flow-line" />
              </svg>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 text-edge" aria-hidden />
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md border border-edge/60 bg-edge/10 px-4 py-3">
            <Server className="h-6 w-6 text-edge" aria-hidden />
            <span className="font-mono text-[11px] text-edge">EDGE SERVER</span>
            <span className="font-mono text-[10px] text-muted">at the junction</span>
          </div>
        </div>
        <ExplainTabs
          simple={
            <p>
              The camera does <strong>not</strong> stream every frame to the cloud for analysis. Its video goes to a small AI computer at the
              junction (the edge server), which watches the video and writes down short facts about each vehicle. Only those facts travel to the
              city system.
            </p>
          }
          technical={
            <p>
              The IP camera publishes an RTSP stream on the junction LAN. The edge node decodes it locally, so the WAN uplink carries compact
              observation events instead of continuous high-bitrate video. Raw or selected clips can still be retained at the edge or retrieved on
              demand (e.g. for evidence or audit) — the normal intelligence pipeline simply does not depend on shipping video.
            </p>
          }
        />
      </div>
    </Section>
  );
}
