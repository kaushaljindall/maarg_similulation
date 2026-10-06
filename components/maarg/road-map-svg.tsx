"use client";

import { JOURNEY_PATH, MAP_EDGES, MAP_NODES, node } from "@/lib/road-map";

export function RoadMapSvg({
  showRoads = true,
  showCameras = true,
  showJunctions = true,
  trajectory = 0,
  activeCams = [],
  rejectedCams = [],
  selected,
  onSelect,
  showDistances,
  label,
}: {
  showRoads?: boolean;
  showCameras?: boolean;
  showJunctions?: boolean;
  trajectory?: number;
  activeCams?: string[];
  rejectedCams?: string[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  showDistances?: boolean;
  label: string;
}) {
  const pathD = JOURNEY_PATH.map((id, i) => {
    const n = node(id);
    return `${i ? "L" : "M"} ${n.x} ${n.y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 670 430" className="block w-full grid-bg" role="img" aria-label={label}>
      {showRoads &&
        MAP_EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          return (
            <g key={`${e.a}${e.b}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#16263c" strokeWidth={16} strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2a4a72" strokeWidth={1.5} strokeDasharray="6 6" />
              {showDistances && (
                <text x={(a.x + b.x) / 2 + (a.x === b.x ? 10 : 0)} y={(a.y + b.y) / 2 + (a.y === b.y ? -12 : 0)} fontSize={9} className="fill-muted font-mono">
                  {e.m} m
                </text>
              )}
            </g>
          );
        })}

      {trajectory > 0 && (
        <path
          d={pathD}
          fill="none"
          stroke="#2fbf71"
          strokeWidth={4}
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - trajectory}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      )}

      {showJunctions &&
        MAP_NODES.filter((n) => n.kind === "junction").map((n) => (
          <g
            key={n.id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? `Junction ${n.id}` : undefined}
            onClick={() => onSelect?.(n.id)}
            onKeyDown={(e) => e.key === "Enter" && onSelect?.(n.id)}
            className={onSelect ? "cursor-pointer outline-none" : undefined}
          >
            <rect x={n.x - 13} y={n.y - 13} width={26} height={26} rx={4} fill={selected === n.id ? "#1d3a63" : "#10223b"} stroke={selected === n.id ? "#e7eef8" : "#3d8bfd"} strokeOpacity={selected === n.id ? 1 : 0.6} />
            <text x={n.x + 18} y={n.y - 14} fontSize={10.5} fontWeight={600} className="fill-foreground font-mono">
              {n.id}
            </text>
          </g>
        ))}

      {MAP_NODES.filter((n) => n.kind === "entry").map((n) => (
        <text key={n.id} x={n.x} y={n.y + (n.y > 400 ? 14 : -10)} textAnchor="middle" fontSize={9} className="fill-muted font-mono">
          {n.id}
        </text>
      ))}

      {showCameras &&
        MAP_NODES.filter((n) => n.kind === "camera").map((n) => {
          const active = activeCams.includes(n.id);
          const rejected = rejectedCams.includes(n.id);
          const color = rejected ? "#e5484d" : active ? "#2fbf71" : "#3d8bfd";
          return (
            <g
              key={n.id}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={onSelect ? `Camera ${n.id}` : undefined}
              onClick={() => onSelect?.(n.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect?.(n.id)}
              className={onSelect ? "cursor-pointer outline-none" : undefined}
            >
              {active && <circle cx={n.x} cy={n.y} r={13} fill={color} opacity={0.18} />}
              <circle cx={n.x} cy={n.y} r={7} fill="#06101d" stroke={color} strokeWidth={selected === n.id ? 3 : 2} />
              <circle cx={n.x} cy={n.y} r={2.5} fill={color} />
              <text x={n.x + 10} y={n.y + 16} fontSize={9.5} className="font-mono" fill={color}>
                {n.id}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
