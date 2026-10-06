// Minimal 1-D car-following model (metres, seconds) used by several illustrative views.

export type LaneVehicle = {
  id: number;
  x: number;
  v: number;
  vmax: number;
  len: number;
  color: string;
  stopped: boolean;
  stops: number;
  spawnT: number;
  delay: number;
  seenAt?: number;
};

export type StopLine = { x: number; go: boolean };

const PALETTE = ["#dfe7f2", "#b8c6da", "#9bb7e0", "#cfd8e6", "#f2c14e", "#8fa6c4"];

let nid = 1;
export function makeVehicle(t: number, vmax = 12, x = 0): LaneVehicle {
  return {
    id: nid++,
    x,
    v: vmax * 0.9,
    vmax,
    len: 5,
    color: PALETTE[nid % PALETTE.length],
    stopped: false,
    stops: 0,
    spawnT: t,
    delay: 0,
  };
}

export function stepLane(list: LaneVehicle[], dt: number, stops: StopLine[], length: number, headway = 1.3) {
  list.sort((a, b) => b.x - a.x);
  const finished: LaneVehicle[] = [];
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    let gap = Infinity;
    if (i > 0) gap = list[i - 1].x - list[i - 1].len - v.x - 2.5;
    let target = Math.min(v.vmax, Math.max(0, gap / headway));
    for (const s of stops) {
      const d = s.x - v.x;
      if (d < -1 || s.go) continue;
      target = Math.min(target, Math.max(0, (d - 1) / 1.1));
      break;
    }
    v.v = target < v.v ? target : Math.min(target, v.v + 3 * dt);
    v.x += v.v * dt;
    const isStopped = v.v < 0.5;
    if (isStopped && !v.stopped) v.stops++;
    v.stopped = isStopped;
    v.delay += Math.max(0, 1 - v.v / v.vmax) * dt;
    if (v.x > length) finished.push(v);
  }
  if (finished.length) {
    for (const f of finished) list.splice(list.indexOf(f), 1);
  }
  return finished;
}

export function pointAlong(pts: [number, number][], f: number): [number, number] {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const k = segs[i] ? d / segs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

export function polyD(pts: [number, number][]) {
  return pts.map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`).join(" ");
}
