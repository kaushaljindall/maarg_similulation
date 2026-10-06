// Simulated city traffic model used by the Traffic Intelligence view and Live City mode.
// 1 canvas unit = 1 metre. Vehicles drive on the LEFT (Indian road convention).

export type Axis = "NS" | "EW";
export type CityMode = "normal" | "emergency" | "vip";
export type Timing = "adaptive" | "fixed";

type Node = { id: string; x: number; y: number; kind: "junction" | "gate"; label: string; c: number; r: number };
type Edge = {
  id: number;
  from: number;
  to: number;
  len: number;
  axis: Axis;
  dx: number;
  dy: number;
  ox: number;
  oy: number;
  vehicles: Vehicle[];
  camera?: Camera;
};
type Camera = { id: string; edge: number; s: number; x: number; y: number };

type VehicleKind = "car" | "bus" | "bike" | "auto" | "ambulance" | "vip" | "escort";
type Vehicle = {
  id: number;
  kind: VehicleKind;
  edge: number;
  s: number;
  v: number;
  vmax: number;
  len: number;
  color: string;
  stopped: boolean;
  wait: number;
  route?: number[];
  routeIdx?: number;
};

type SignalState = "green" | "yellow" | "allred";
type Signal = {
  phase: Axis;
  state: SignalState;
  t: number;
  planned: number;
  extended: number;
  redWait: number;
  priority: null | { axis: Axis; by: "emergency" | "vip" };
  corridor: "none" | "preclear" | "active" | "recovery";
  recoveryT: number;
  decided: boolean;
};

type Packet = { pts: [number, number][]; p: number; speed: number; kind: "obs" | "decision" | "video" };

export type Alert = { id: number; t: number; level: "info" | "warn" | "alert" | "ok"; text: string };

export type JunctionStats = {
  id: string;
  current: number;
  incoming: number;
  outgoing: number;
  avgSpeed: number;
  queue: number;
  predicted20: number;
  phase: Axis;
  state: SignalState;
  phaseTime: number;
  planned: number;
  corridor: Signal["corridor"];
  occupancy: number;
};

export type CityStats = {
  vehicles: number;
  avgSpeed: number;
  stopped: number;
  density: number;
  congestion: "Low" | "Moderate" | "High";
  observations: number;
  decisions: number;
  simTime: number;
};

const COLORS = ["#dfe7f2", "#b8c6da", "#8fa6c4", "#cfd8e6", "#9bb7e0", "#e9eef5"];
const YELLOW = 3;
const ALLRED = 2;
const STOP_OFFSET = 16;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export class CityEngine {
  nodes: Node[] = [];
  edges: Edge[] = [];
  out: number[][] = [];
  inc: number[][] = [];
  signals = new Map<number, Signal>();
  cameras: Camera[] = [];
  packets: Packet[] = [];
  alerts: Alert[] = [];
  mode: CityMode = "normal";
  timing: Timing = "adaptive";
  t = 0;
  nextId = 1;
  alertId = 1;
  observations = 0;
  decisions = 0;
  target: number;
  width: number;
  height: number;
  cloud = { x: 0, y: 0, w: 0, h: 0 };
  cols: number;
  rows: number;
  spacing: number;
  ox: number;
  oy: number;
  hospitalNode = -1;
  priorityRoute: number[] = [];
  lastCongestionAlert = new Map<number, number>();

  constructor(opts: { cols: number; rows: number; spacing: number; target: number; cloudBand?: boolean }) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.spacing = opts.spacing;
    this.target = opts.target;
    const gate = opts.spacing * 0.55;
    const top = opts.cloudBand ? 120 : 0;
    this.ox = gate + 20;
    this.oy = top + gate + 10;
    this.width = this.ox * 2 + (opts.cols - 1) * opts.spacing;
    this.height = this.oy + gate + 30 + (opts.rows - 1) * opts.spacing;
    this.cloud = { x: this.width / 2 - 170, y: 18, w: 340, h: 62 };
    this.build(gate);
  }

  private jIndex(c: number, r: number) {
    return r * this.cols + c;
  }

  private build(gate: number) {
    let n = 1;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const id = `J-${String(n++).padStart(2, "0")}`;
        this.nodes.push({ id, x: this.ox + c * this.spacing, y: this.oy + r * this.spacing, kind: "junction", label: id, c, r });
      }
    }
    const addGate = (x: number, y: number, attach: number, label: string) => {
      this.nodes.push({ id: label, x, y, kind: "gate", label, c: -1, r: -1 });
      const g = this.nodes.length - 1;
      this.addRoad(g, attach);
      return g;
    };
    this.out = [];
    this.inc = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols - 1; c++) this.addRoad(this.jIndex(c, r), this.jIndex(c + 1, r));
    }
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows - 1; r++) this.addRoad(this.jIndex(c, r), this.jIndex(c, r + 1));
    }
    for (let r = 0; r < this.rows; r++) {
      const y = this.oy + r * this.spacing;
      addGate(this.ox - gate, y, this.jIndex(0, r), `W${r}`);
      const e = addGate(this.ox + (this.cols - 1) * this.spacing + gate, y, this.jIndex(this.cols - 1, r), `E${r}`);
      if (r === Math.floor(this.rows / 2)) this.hospitalNode = e;
    }
    for (let c = 0; c < this.cols; c++) {
      const x = this.ox + c * this.spacing;
      addGate(x, this.oy - gate, this.jIndex(c, 0), `N${c}`);
      addGate(x, this.oy + (this.rows - 1) * this.spacing + gate, this.jIndex(c, this.rows - 1), `S${c}`);
    }
    this.nodes.forEach((nd, i) => {
      if (nd.kind === "junction") {
        this.signals.set(i, {
          phase: Math.random() > 0.5 ? "NS" : "EW",
          state: "green",
          t: rand(0, 15),
          planned: 25,
          extended: 0,
          redWait: 0,
          priority: null,
          corridor: "none",
          recoveryT: 0,
          decided: false,
        });
      }
    });
    let cn = 1;
    this.edges.forEach((e) => {
      const toNode = this.nodes[e.to];
      if (toNode.kind !== "junction") return;
      if ((e.id + toNode.c + toNode.r) % 2 !== 0 && this.nodes[e.from].kind !== "gate") return;
      const s = e.len * 0.42;
      const cam: Camera = {
        id: `CAM_${String(cn++).padStart(2, "0")}`,
        edge: e.id,
        s,
        x: this.nodes[e.from].x + e.dx * s + e.ox * 2.2,
        y: this.nodes[e.from].y + e.dy * s + e.oy * 2.2,
      };
      e.camera = cam;
      this.cameras.push(cam);
    });
  }

  private addRoad(a: number, b: number) {
    this.addEdge(a, b);
    this.addEdge(b, a);
  }

  private addEdge(a: number, b: number) {
    const A = this.nodes[a];
    const B = this.nodes[b];
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    const dx = (B.x - A.x) / len;
    const dy = (B.y - A.y) / len;
    const id = this.edges.length;
    // Left-hand traffic: offset to the left of travel direction.
    this.edges.push({ id, from: a, to: b, len, axis: Math.abs(dx) > 0.5 ? "EW" : "NS", dx, dy, ox: dy * 6, oy: -dx * 6, vehicles: [] });
    (this.out[a] ||= []).push(id);
    (this.inc[b] ||= []).push(id);
  }

  setMode(m: CityMode) {
    if (m === this.mode) return;
    this.clearPriority();
    this.mode = m;
    if (m === "emergency") this.spawnPriority("ambulance");
    if (m === "vip") this.spawnPriority("vip");
    if (m === "normal") this.alert("ok", "System returned to normal dynamic optimisation");
  }

  setTiming(t: Timing) {
    this.timing = t;
    this.alert("info", t === "adaptive" ? "MAARG adaptive timing enabled" : "Fixed-time plan enabled (25 s greens)");
  }

  private clearPriority() {
    this.edges.forEach((e) => (e.vehicles = e.vehicles.filter((v) => !["ambulance", "vip", "escort"].includes(v.kind))));
    this.signals.forEach((s) => {
      s.priority = null;
      if (s.corridor !== "none") s.corridor = "none";
    });
    this.priorityRoute = [];
  }

  private spawnPriority(kind: "ambulance" | "vip") {
    const midRow = Math.floor(this.rows / 2);
    let route: number[];
    if (kind === "ambulance") {
      const start = this.nodes.findIndex((n) => n.id === `W${midRow}`);
      route = [start];
      for (let c = 0; c < this.cols; c++) route.push(this.jIndex(c, midRow));
      route.push(this.hospitalNode);
    } else {
      const col = Math.min(1, this.cols - 1);
      const start = this.nodes.findIndex((n) => n.id === `N${col}`);
      route = [start];
      for (let r = 0; r < this.rows; r++) route.push(this.jIndex(col, r));
      route.push(this.jIndex(col + 1, this.rows - 1));
      for (let c = col + 2; c < this.cols; c++) route.push(this.jIndex(c, this.rows - 1));
      route.push(this.nodes.findIndex((n) => n.id === `E${this.rows - 1}`));
    }
    this.priorityRoute = route;
    const e0 = this.edgeBetween(route[0], route[1]);
    if (e0 < 0) return;
    const members: VehicleKind[] = kind === "ambulance" ? ["ambulance"] : ["escort", "vip", "escort"];
    members.forEach((k, i) => {
      this.edges[e0].vehicles.push({
        id: this.nextId++,
        kind: k,
        edge: e0,
        s: Math.max(0, 30 - i * 14),
        v: 12,
        vmax: kind === "ambulance" ? 16 : 13,
        len: 6,
        color: k === "ambulance" ? "#ffffff" : k === "vip" ? "#0b0f17" : "#3d8bfd",
        stopped: false,
        wait: 0,
        route,
        routeIdx: 1,
      });
    });
    if (kind === "ambulance") {
      this.alert("alert", `Emergency vehicle E-102 detected at ${this.edges[e0].camera?.id ?? "entry camera"} · route predicted to Hospital`);
      this.alert("alert", "AMBULANCE GREEN CORRIDOR ACTIVATED");
    } else {
      this.alert("warn", "Planned VIP route received · coordinated priority corridor scheduled");
    }
  }

  edgeBetween(a: number, b: number) {
    return (this.out[a] || []).find((e) => this.edges[e].to === b) ?? -1;
  }

  private alert(level: Alert["level"], text: string) {
    this.alerts.unshift({ id: this.alertId++, t: this.t, level, text });
    if (this.alerts.length > 40) this.alerts.length = 40;
  }

  private spawn() {
    const gates = this.nodes.map((n, i) => (n.kind === "gate" ? i : -1)).filter((i) => i >= 0);
    const g = gates[Math.floor(Math.random() * gates.length)];
    const e = this.out[g][0];
    const edge = this.edges[e];
    if (edge.vehicles.some((v) => v.s < 14)) return;
    const r = Math.random();
    const kind: VehicleKind = r < 0.08 ? "bus" : r < 0.3 ? "bike" : r < 0.42 ? "auto" : "car";
    edge.vehicles.push({
      id: this.nextId++,
      kind,
      edge: e,
      s: 0,
      v: rand(6, 10),
      vmax: kind === "bus" ? rand(8, 10) : rand(10, 14),
      len: kind === "bus" ? 11 : kind === "bike" ? 3 : 5,
      color: kind === "auto" ? "#f2c14e" : kind === "bus" ? "#6f93c9" : COLORS[Math.floor(Math.random() * COLORS.length)],
      stopped: false,
      wait: 0,
    });
  }

  private isPriority(v: Vehicle) {
    return v.kind === "ambulance" || v.kind === "vip" || v.kind === "escort";
  }

  private canGo(edge: Edge, distToStop: number) {
    const to = this.nodes[edge.to];
    if (to.kind !== "junction") return true;
    const sig = this.signals.get(edge.to)!;
    if (sig.phase !== edge.axis) return false;
    if (sig.state === "green") return true;
    if (sig.state === "yellow") return distToStop < 6;
    return false;
  }

  private nextEdge(v: Vehicle, edge: Edge): number {
    if (v.route && v.routeIdx !== undefined) {
      const a = v.route[v.routeIdx];
      const b = v.route[v.routeIdx + 1];
      if (b === undefined) return -1;
      return this.edgeBetween(a, b);
    }
    const options = (this.out[edge.to] || []).filter((e) => this.edges[e].to !== edge.from);
    if (!options.length) return -1;
    const straight = options.find((e) => this.edges[e].dx === edge.dx && this.edges[e].dy === edge.dy);
    if (straight !== undefined && Math.random() < 0.55) return straight;
    return options[Math.floor(Math.random() * options.length)];
  }

  approachDemand(j: number, axis: Axis, horizon: number) {
    let n = 0;
    for (const e of this.inc[j] || []) {
      const edge = this.edges[e];
      if (edge.axis !== axis) continue;
      for (const v of edge.vehicles) {
        const d = edge.len - STOP_OFFSET - v.s;
        if (d < 0) continue;
        const eta = d / Math.max(v.v, 4);
        if (eta <= horizon) n++;
      }
      // Upstream camera link: vehicles one block upstream heading towards this junction.
      const from = edge.from;
      if (this.nodes[from].kind === "junction" && horizon > 8) {
        for (const ue of this.inc[from] || []) {
          const uedge = this.edges[ue];
          if (uedge.axis !== axis || uedge.dx !== edge.dx || uedge.dy !== edge.dy) continue;
          for (const v of uedge.vehicles) {
            const d = uedge.len - v.s + edge.len - STOP_OFFSET;
            if (d / Math.max(v.v, 6) <= horizon) n++;
          }
        }
      }
    }
    return n;
  }

  private queueOn(j: number, axis?: Axis) {
    let q = 0;
    for (const e of this.inc[j] || []) {
      const edge = this.edges[e];
      if (axis && edge.axis !== axis) continue;
      for (const v of edge.vehicles) if (v.v < 1 && edge.len - v.s < 120) q++;
    }
    return q;
  }

  private updateSignals(dt: number) {
    this.signals.forEach((s, j) => {
      s.t += dt;
      if (s.state !== "green" || s.priority) s.redWait += dt;
      if (s.corridor === "recovery") {
        s.recoveryT -= dt;
        if (s.recoveryT <= 0) s.corridor = "none";
      }
      if (s.state === "yellow") {
        if (s.t >= YELLOW) {
          s.state = "allred";
          s.t = 0;
        }
        return;
      }
      if (s.state === "allred") {
        if (s.t >= ALLRED) {
          s.state = "green";
          s.phase = s.priority ? s.priority.axis : s.phase === "NS" ? "EW" : "NS";
          s.t = 0;
          s.extended = 0;
          s.decided = false;
          s.planned = this.timing === "fixed" ? 25 : 14;
          if (s.priority) s.corridor = "active";
        }
        return;
      }
      if (s.priority) {
        if (s.phase !== s.priority.axis) {
          s.state = "yellow";
          s.t = 0;
          s.corridor = "preclear";
        } else s.corridor = "active";
        return;
      }
      if (this.timing === "fixed") {
        s.planned = 25;
        if (s.t >= 25) this.endGreen(s);
        return;
      }
      const other: Axis = s.phase === "NS" ? "EW" : "NS";
      const minG = 10;
      const maxG = 45;
      if (s.t < minG) return;
      const demandGreen = this.approachDemand(j, s.phase, 6);
      const demandOther = this.queueOn(j, other) + this.approachDemand(j, other, 4);
      const upstream = this.approachDemand(j, s.phase, 14);
      if (s.t >= maxG || (demandGreen === 0 && demandOther > 0) || (s.t >= 18 && demandOther > 10 && demandGreen < 3)) {
        this.endGreen(s);
        return;
      }
      if (demandGreen > 0 && s.t >= s.planned) {
        const ext = Math.min(maxG - s.planned, Math.max(3, Math.round(upstream * 1.2)));
        if (ext > 0) {
          s.planned += ext;
          s.extended += ext;
          if (!s.decided) {
            s.decided = true;
            this.decisions++;
            const n = this.nodes[j];
            this.packets.push({ pts: [[this.cloud.x + this.cloud.w / 2, this.cloud.y + this.cloud.h], [n.x + 18, n.y - 18], [n.x, n.y]], p: 0, speed: 0.9, kind: "decision" });
            if (Math.random() < 0.25) this.alert("info", `${n.id}: ${upstream} vehicles predicted from upstream · ${s.phase} green extended +${ext} s`);
          }
        } else this.endGreen(s);
      } else if (demandGreen === 0 && s.t >= s.planned) this.endGreen(s);
    });
  }

  private endGreen(s: Signal) {
    s.state = "yellow";
    s.t = 0;
    s.redWait = 0;
  }

  private updatePriority() {
    if (this.mode === "normal") return;
    const pv: Vehicle[] = [];
    this.edges.forEach((e) => e.vehicles.forEach((v) => this.isPriority(v) && pv.push(v)));
    if (!pv.length) {
      if (this.priorityRoute.length) {
        this.signals.forEach((s) => {
          if (s.priority) {
            s.priority = null;
            s.corridor = "recovery";
            s.recoveryT = 8;
          }
        });
        this.alert("ok", this.mode === "emergency" ? "E-102 reached Hospital · corridor released, signals recovering" : "VIP convoy exited · system returning to normal optimisation");
        this.priorityRoute = [];
        const m = this.mode;
        setTimeout(() => {
          if (this.mode === m && !this.priorityRoute.length) this.spawnPriority(m === "emergency" ? "ambulance" : "vip");
        }, 6000);
      }
      return;
    }
    const lead = pv.reduce((a, b) => (a.routeIdx! > b.routeIdx! || (a.routeIdx === b.routeIdx && a.s > b.s) ? a : b));
    const tail = pv.reduce((a, b) => (a.routeIdx! < b.routeIdx! || (a.routeIdx === b.routeIdx && a.s < b.s) ? a : b));
    const route = lead.route!;
    const horizon = this.mode === "emergency" ? 16 : 20;
    for (let i = 1; i < route.length; i++) {
      const j = route[i];
      const sig = this.signals.get(j);
      if (!sig) continue;
      const tailPassed = i < tail.routeIdx!;
      if (tailPassed) {
        if (sig.priority) {
          sig.priority = null;
          sig.corridor = "recovery";
          sig.recoveryT = 10;
          this.alert("ok", `${this.nodes[j].id}: priority released · cross traffic resumed`);
        }
        continue;
      }
      let dist = 0;
      const edge = this.edges[lead.edge];
      if (i < lead.routeIdx!) continue;
      dist += edge.len - lead.s;
      for (let k = lead.routeIdx!; k < i; k++) {
        const e = this.edgeBetween(route[k], route[k + 1]);
        if (e >= 0) dist += this.edges[e].len;
      }
      const eta = dist / Math.max(lead.v, 8);
      const e = this.edgeBetween(route[i - 1], j);
      const axis = e >= 0 ? this.edges[e].axis : "EW";
      if (eta <= horizon && !sig.priority) {
        sig.priority = { axis, by: this.mode === "emergency" ? "emergency" : "vip" };
        sig.corridor = sig.phase === axis && sig.state === "green" ? "active" : "preclear";
        this.alert(this.mode === "emergency" ? "alert" : "warn", `${this.nodes[j].id}: ${sig.corridor === "active" ? "holding green" : "pre-clearing cross traffic"} for ${this.mode === "emergency" ? "E-102" : "VIP convoy"} (ETA ${Math.round(eta)} s)`);
      }
    }
  }

  step(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.1);
    this.t += dt;
    let count = 0;
    this.edges.forEach((e) => (count += e.vehicles.length));
    if (count < this.target && Math.random() < 0.6) this.spawn();
    this.updateSignals(dt);
    this.updatePriority();

    const moves: { v: Vehicle; from: Edge }[] = [];
    for (const edge of this.edges) {
      edge.vehicles.sort((a, b) => b.s - a.s);
      for (let i = 0; i < edge.vehicles.length; i++) {
        const v = edge.vehicles[i];
        let gap = Infinity;
        if (i > 0) gap = edge.vehicles[i - 1].s - edge.vehicles[i - 1].len - v.s - 2.5;
        else {
          const next = this.peekNext(v, edge);
          if (next >= 0) {
            const nv = this.edges[next].vehicles;
            const last = nv.length ? nv.reduce((a, b) => (a.s < b.s ? a : b)) : null;
            if (last) gap = edge.len - v.s + last.s - last.len - 2.5;
          }
        }
        let target = Math.min(v.vmax, Math.max(0, gap / 1.4));
        const stopS = edge.len - STOP_OFFSET;
        const dStop = stopS - v.s;
        if (dStop > -2 && !this.canGo(edge, dStop)) target = Math.min(target, Math.max(0, dStop / 1.1));
        v.v = target < v.v ? target : Math.min(target, v.v + 3 * dt);
        const prevS = v.s;
        v.s += v.v * dt;
        if (v.v < 0.6) {
          if (!v.stopped) v.stopped = true;
          v.wait += dt;
        } else v.stopped = false;
        if (edge.camera && prevS < edge.camera.s && v.s >= edge.camera.s) this.onCamera(edge, v);
        if (v.s >= edge.len) moves.push({ v, from: edge });
      }
    }
    for (const { v, from } of moves) {
      const ne = this.peekNext(v, from);
      from.vehicles = from.vehicles.filter((x) => x !== v);
      if (ne < 0) continue;
      v.s = v.s - from.len;
      v.edge = ne;
      if (v.routeIdx !== undefined) v.routeIdx++;
      (v as Vehicle & { _next?: number })._next = undefined;
      this.edges[ne].vehicles.push(v);
    }

    for (const p of this.packets) p.p += dt * p.speed;
    this.packets = this.packets.filter((p) => p.p < p.pts.length - 1);

    if (Math.floor(this.t) % 4 === 0 && Math.floor(this.t - dt) % 4 !== 0) this.checkCongestion();
  }

  private peekNext(v: Vehicle, edge: Edge) {
    const vv = v as Vehicle & { _next?: number; _nextFor?: number };
    if (vv._next === undefined || vv._nextFor !== edge.id) {
      vv._next = this.nextEdge(v, edge);
      vv._nextFor = edge.id;
    }
    return vv._next;
  }

  private onCamera(edge: Edge, v: Vehicle) {
    this.observations++;
    const to = this.nodes[edge.to];
    if (this.isPriority(v)) {
      this.packets.push({ pts: [[edge.camera!.x, edge.camera!.y], [to.x + 18, to.y - 18], [this.cloud.x + this.cloud.w / 2, this.cloud.y + this.cloud.h]], p: 0, speed: 1.2, kind: "obs" });
      return;
    }
    if (this.packets.length < 70 && Math.random() < 0.35) {
      this.packets.push({ pts: [[edge.camera!.x, edge.camera!.y], [to.x + 18, to.y - 18], [this.cloud.x + 40 + Math.random() * (this.cloud.w - 80), this.cloud.y + this.cloud.h]], p: 0, speed: rand(0.8, 1.2), kind: "obs" });
    }
  }

  private checkCongestion() {
    this.signals.forEach((_, j) => {
      const q = this.queueOn(j);
      const last = this.lastCongestionAlert.get(j) ?? -999;
      if (q >= 14 && this.t - last > 40) {
        this.lastCongestionAlert.set(j, this.t);
        this.alert("warn", `Congestion building at ${this.nodes[j].id} · queue ${q} vehicles`);
      }
    });
  }

  junctionAt(x: number, y: number) {
    let best = -1;
    let bd = 26;
    this.nodes.forEach((n, i) => {
      if (n.kind !== "junction") return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  junctionStats(j: number): JunctionStats {
    const s = this.signals.get(j)!;
    let incoming = 0;
    let speedSum = 0;
    let current = 0;
    let occ = 0;
    let occCap = 0;
    for (const e of this.inc[j] || []) {
      const edge = this.edges[e];
      incoming += edge.vehicles.length;
      edge.vehicles.forEach((v) => {
        speedSum += v.v;
        if (edge.len - v.s < 40) current++;
        occ += v.len + 2.5;
      });
      occCap += edge.len;
    }
    let outgoing = 0;
    for (const e of this.out[j] || []) {
      const edge = this.edges[e];
      edge.vehicles.forEach((v) => v.s < 40 && current++);
      outgoing += edge.vehicles.length;
    }
    return {
      id: this.nodes[j].id,
      current,
      incoming,
      outgoing,
      avgSpeed: incoming ? (speedSum / incoming) * 3.6 : 0,
      queue: this.queueOn(j),
      predicted20: this.approachDemand(j, "NS", 20) + this.approachDemand(j, "EW", 20),
      phase: s.phase,
      state: s.state,
      phaseTime: s.t,
      planned: s.planned,
      corridor: s.corridor,
      occupancy: occCap ? Math.min(100, (occ / occCap) * 100) : 0,
    };
  }

  cityStats(): CityStats {
    let n = 0;
    let sp = 0;
    let st = 0;
    let occ = 0;
    let cap = 0;
    this.edges.forEach((e) => {
      cap += e.len;
      e.vehicles.forEach((v) => {
        n++;
        sp += v.v;
        if (v.v < 1) st++;
        occ += v.len + 2.5;
      });
    });
    const density = cap ? (occ / cap) * 100 : 0;
    return {
      vehicles: n,
      avgSpeed: n ? (sp / n) * 3.6 : 0,
      stopped: st,
      density,
      congestion: density > 22 ? "High" : density > 12 ? "Moderate" : "Low",
      observations: this.observations,
      decisions: this.decisions,
      simTime: this.t,
    };
  }

  junctionIds() {
    return this.nodes.map((n, i) => (n.kind === "junction" ? i : -1)).filter((i) => i >= 0);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    opts: { heatmap: boolean; packets: boolean; selected: number; cloudBand: boolean; cameras: boolean; timers: boolean },
  ) {
    const W = this.width;
    const H = this.height;
    ctx.fillStyle = "#06101d";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#0b1829";
    const sp = this.spacing;
    for (let r = -1; r < this.rows; r++) {
      for (let c = -1; c < this.cols; c++) {
        const x0 = this.ox + c * sp + 22;
        const y0 = this.oy + r * sp + 22;
        const w = sp - 44;
        const h = sp - 44;
        const seed = (r + 3) * 31 + (c + 3) * 17;
        for (let k = 0; k < 4; k++) {
          const bx = x0 + (k % 2) * (w / 2) + 4;
          const by = y0 + Math.floor(k / 2) * (h / 2) + 4;
          const bw = w / 2 - 8 - ((seed * (k + 1)) % 14);
          const bh = h / 2 - 8 - ((seed * (k + 3)) % 16);
          if (bx < 0 || by < (opts.cloudBand ? 100 : 0) || bx + bw > W || by + bh > H) continue;
          ctx.fillStyle = (seed + k) % 5 === 0 ? "#0e1f36" : "#0a1627";
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeStyle = "#13263f";
          ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        }
      }
    }

    const roadW = 24;
    ctx.lineCap = "butt";
    const drawn = new Set<string>();
    for (const e of this.edges) {
      const key = [Math.min(e.from, e.to), Math.max(e.from, e.to)].join("-");
      if (drawn.has(key)) continue;
      drawn.add(key);
      const A = this.nodes[e.from];
      const B = this.nodes[e.to];
      ctx.strokeStyle = "#16263c";
      ctx.lineWidth = roadW;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
      ctx.strokeStyle = "#2a3d57";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (opts.heatmap) {
      for (const e of this.edges) {
        const occ = e.vehicles.reduce((a, v) => a + v.len + 2.5, 0) / e.len;
        const col = occ > 0.45 ? "229,72,77" : occ > 0.22 ? "242,169,59" : "47,191,113";
        const A = this.nodes[e.from];
        ctx.strokeStyle = `rgba(${col},${0.28 + Math.min(occ, 0.8) * 0.5})`;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(A.x + e.ox + e.dx * 14, A.y + e.oy + e.dy * 14);
        ctx.lineTo(A.x + e.ox + e.dx * (e.len - 14), A.y + e.oy + e.dy * (e.len - 14));
        ctx.stroke();
      }
    }

    if (this.priorityRoute.length) {
      ctx.strokeStyle = this.mode === "emergency" ? "rgba(47,191,113,0.55)" : "rgba(61,139,253,0.6)";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -this.t * 20;
      ctx.beginPath();
      this.priorityRoute.forEach((n, i) => {
        const nd = this.nodes[n];
        if (i === 0) ctx.moveTo(nd.x, nd.y);
        else ctx.lineTo(nd.x, nd.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.hospitalNode >= 0) {
      const h = this.nodes[this.hospitalNode];
      ctx.fillStyle = "#0e2a1f";
      ctx.strokeStyle = "#2fbf71";
      ctx.fillRect(h.x - 14, h.y - 44, 28, 28);
      ctx.strokeRect(h.x - 14, h.y - 44, 28, 28);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(h.x - 2.5, h.y - 38, 5, 16);
      ctx.fillRect(h.x - 8, h.y - 32.5, 16, 5);
      ctx.fillStyle = "#8ea3c0";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("HOSPITAL", h.x, h.y - 50);
    }

    this.signals.forEach((s, j) => {
      const n = this.nodes[j];
      ctx.fillStyle = j === opts.selected ? "#1d3a63" : "#13233a";
      ctx.fillRect(n.x - 14, n.y - 14, 28, 28);
      if (s.corridor !== "none") {
        ctx.strokeStyle = s.corridor === "recovery" ? "#8ea3c0" : this.mode === "vip" ? "#3d8bfd" : "#2fbf71";
        ctx.lineWidth = 2;
        ctx.strokeRect(n.x - 17, n.y - 17, 34, 34);
      }
      if (j === opts.selected) {
        ctx.strokeStyle = "#e7eef8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(n.x - 20, n.y - 20, 40, 40);
      }
      const col = (axis: Axis) => {
        if (s.state === "allred") return "#e5484d";
        if (s.phase !== axis) return "#e5484d";
        return s.state === "green" ? "#2fbf71" : "#f2a93b";
      };
      const ns = col("NS");
      const ew = col("EW");
      const lamp = (x: number, y: number, c: string) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      };
      lamp(n.x - 9, n.y - 18, ns);
      lamp(n.x + 9, n.y + 18, ns);
      lamp(n.x - 18, n.y + 9, ew);
      lamp(n.x + 18, n.y - 9, ew);
      ctx.fillStyle = "#f2a93b";
      ctx.fillRect(n.x + 15, n.y - 22, 6, 6);
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#e7eef8";
      ctx.fillText(n.id, n.x + 22, n.y + 30);
      if (opts.timers) {
        ctx.fillStyle = s.state === "green" ? "#2fbf71" : s.state === "yellow" ? "#f2a93b" : "#e5484d";
        const label = s.state === "green" ? `${s.phase} ${Math.max(0, Math.ceil(s.planned - s.t))}s${s.extended ? ` +${s.extended}` : ""}` : s.state === "yellow" ? `${s.phase} YEL` : "ALL-RED";
        ctx.fillText(s.priority ? (s.priority.by === "emergency" ? "PRIORITY" : "VIP PRI") : label, n.x + 22, n.y + 42);
      }
    });

    if (opts.cameras) {
      for (const c of this.cameras) {
        ctx.fillStyle = "#3d8bfd";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(61,139,253,0.4)";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const e of this.edges) {
      const A = this.nodes[e.from];
      for (const v of e.vehicles) {
        const x = A.x + e.dx * v.s + e.ox;
        const y = A.y + e.dy * v.s + e.oy;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(e.dy, e.dx));
        const l = v.kind === "bus" ? 11 : v.kind === "bike" ? 4 : 7;
        const w = v.kind === "bike" ? 2.2 : v.kind === "bus" ? 4.4 : 4;
        if (v.kind === "ambulance" || v.kind === "vip" || v.kind === "escort") {
          ctx.fillStyle = v.kind === "ambulance" ? "rgba(229,72,77,0.35)" : "rgba(61,139,253,0.35)";
          ctx.beginPath();
          ctx.arc(0, 0, 9 + Math.sin(this.t * 10) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = v.color;
        ctx.fillRect(-l, -w / 2 - 0.5, l, w + 1);
        if (v.kind === "ambulance") {
          ctx.fillStyle = Math.sin(this.t * 14) > 0 ? "#e5484d" : "#3d8bfd";
          ctx.fillRect(-l / 2 - 1, -w / 2, 2, w);
        }
        if (v.kind === "vip") {
          ctx.strokeStyle = "#f2a93b";
          ctx.lineWidth = 1;
          ctx.strokeRect(-l, -w / 2 - 0.5, l, w + 1);
        }
        ctx.restore();
      }
    }

    if (opts.cloudBand) {
      const c = this.cloud;
      ctx.fillStyle = "#0c1f3a";
      ctx.strokeStyle = "#3d8bfd";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e7eef8";
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MAARG CITY INTELLIGENCE CLOUD", c.x + c.w / 2, c.y + 26);
      ctx.fillStyle = "#8ea3c0";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(`Kafka ingest · ${this.observations} obs · ${this.decisions} timing decisions`, c.x + c.w / 2, c.y + 44);
    }

    if (opts.packets) {
      for (const p of this.packets) {
        const i = Math.floor(p.p);
        const f = p.p - i;
        const a = p.pts[i];
        const b = p.pts[i + 1];
        if (!a || !b) continue;
        const x = a[0] + (b[0] - a[0]) * f;
        const y = a[1] + (b[1] - a[1]) * f;
        ctx.fillStyle = p.kind === "decision" ? "#2fbf71" : "#3d8bfd";
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        ctx.strokeStyle = p.kind === "decision" ? "rgba(47,191,113,0.25)" : "rgba(61,139,253,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  }
}
