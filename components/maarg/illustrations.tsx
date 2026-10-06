export type Lamp = "green" | "yellow" | "red" | "off";

const LAMP_COLORS = { red: "#e5484d", yellow: "#f2a93b", green: "#2fbf71" };

export function TrafficLight({
  x,
  y,
  state,
  scale = 1,
  horizontal,
}: {
  x: number;
  y: number;
  state: Lamp;
  scale?: number;
  horizontal?: boolean;
}) {
  const lamps: ("red" | "yellow" | "green")[] = ["red", "yellow", "green"];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden>
      <rect
        x={-7}
        y={-20}
        width={horizontal ? 40 : 14}
        height={horizontal ? 14 : 40}
        rx={3}
        fill="#0a1424"
        stroke="#2a4a72"
        transform={horizontal ? "translate(-13 13)" : undefined}
      />
      {lamps.map((l, i) => {
        const on = state === l;
        const cx = horizontal ? -13 + 7 + i * 13 : 0;
        const cy = horizontal ? 0 : -13 + i * 13;
        return (
          <g key={l}>
            {on && <circle cx={cx} cy={cy} r={8} fill={LAMP_COLORS[l]} opacity={0.25} />}
            <circle cx={cx} cy={cy} r={4.5} fill={on ? LAMP_COLORS[l] : "#1b2a40"} />
          </g>
        );
      })}
    </g>
  );
}

export function CctvCamera({ x, y, flip, scale = 1, label }: { x: number; y: number; flip?: boolean; scale?: number; label?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} aria-hidden>
      <rect x={-2} y={0} width={4} height={34} fill="#2a4a72" />
      <rect x={-2} y={-2} width={18} height={4} fill="#2a4a72" />
      <g transform="translate(14 -2) rotate(18)">
        <rect x={0} y={-6} width={26} height={12} rx={2} fill="#dfe7f2" />
        <rect x={24} y={-5} width={5} height={10} rx={1} fill="#9fb1c9" />
        <circle cx={27} cy={0} r={2.5} fill="#0a1424" />
        <circle cx={5} cy={-2} r={1.4} fill="#e5484d" className="blink" />
      </g>
      {label && (
        <text
          x={0}
          y={48}
          textAnchor="middle"
          className="fill-foreground font-mono"
          fontSize={10}
          transform={flip ? "scale(-1 1)" : undefined}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export function ServerRack({ x, y, w = 70, h = 90, label, active }: { x: number; y: number; w?: number; h?: number; label?: string; active?: boolean }) {
  const units = Math.floor((h - 12) / 14);
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <rect width={w} height={h} rx={4} fill="#0d1b30" stroke="#f2a93b" strokeOpacity={0.6} />
      {Array.from({ length: units }).map((_, i) => (
        <g key={i} transform={`translate(6 ${6 + i * 14})`}>
          <rect width={w - 12} height={10} rx={1.5} fill="#132742" stroke="#25456c" />
          <circle cx={6} cy={5} r={1.8} fill={active && i % 2 === 0 ? "#2fbf71" : "#2a4a72"} className={active ? "blink" : undefined} />
          <circle cx={12} cy={5} r={1.8} fill={active && i % 3 === 0 ? "#f2a93b" : "#2a4a72"} />
          <rect x={w - 34} y={3} width={18} height={4} rx={1} fill="#1d3352" />
        </g>
      ))}
      {label && (
        <text x={w / 2} y={h + 14} textAnchor="middle" fontSize={10} className="fill-edge font-mono">
          {label}
        </text>
      )}
    </g>
  );
}

export function CloudShape({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children?: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={14} fill="#0c1f3a" stroke="#3d8bfd" strokeOpacity={0.7} />
      <path
        d={`M ${w * 0.08} 0 q ${w * 0.06} -18 ${w * 0.16} -6 q ${w * 0.08} -20 ${w * 0.2} -4 q ${w * 0.1} -16 ${w * 0.18} 0`}
        fill="none"
        stroke="#3d8bfd"
        strokeOpacity={0.45}
      />
      {children}
    </g>
  );
}

export function CarTop({ x, y, rot = 0, color = "#dfe7f2", len = 22, wid = 11, kind = "car" }: { x: number; y: number; rot?: number; color?: string; len?: number; wid?: number; kind?: "car" | "bus" | "bike" | "ambulance" | "vip" }) {
  if (kind === "bike") {
    return (
      <g transform={`translate(${x} ${y}) rotate(${rot})`}>
        <rect x={-3} y={-8} width={6} height={16} rx={3} fill={color} />
      </g>
    );
  }
  const L = kind === "bus" ? len * 1.7 : len;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-wid / 2} y={-L / 2} width={wid} height={L} rx={3} fill={kind === "vip" ? "#0b0f17" : color} stroke={kind === "vip" ? "#f2a93b" : "none"} />
      <rect x={-wid / 2 + 1.5} y={-L / 2 + 3} width={wid - 3} height={L * 0.18} rx={1.5} fill="#0a1424" opacity={0.75} />
      {kind === "ambulance" && (
        <>
          <rect x={-wid / 2} y={-1.5} width={wid} height={3} fill="#e5484d" />
          <rect x={-1.5} y={-L / 2 + 1} width={3} height={2} fill="#3d8bfd" className="blink" />
        </>
      )}
    </g>
  );
}
