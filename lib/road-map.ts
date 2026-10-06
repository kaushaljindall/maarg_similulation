export type MapNode = { id: string; x: number; y: number; kind: "junction" | "camera" | "entry"; on?: string };

// Junction grid (map units, not to scale). Distances in metres are given per edge.
export const MAP_NODES: MapNode[] = [
  { id: "J-06", x: 160, y: 50, kind: "junction" },
  { id: "J-07", x: 370, y: 50, kind: "junction" },
  { id: "J-10", x: 560, y: 50, kind: "junction" },
  { id: "J-04", x: 160, y: 170, kind: "junction" },
  { id: "J-08", x: 370, y: 170, kind: "junction" },
  { id: "J-09", x: 560, y: 170, kind: "junction" },
  { id: "J-02", x: 160, y: 310, kind: "junction" },
  { id: "J-03", x: 370, y: 310, kind: "junction" },
  { id: "J-05", x: 560, y: 310, kind: "junction" },
  { id: "S-IN", x: 160, y: 410, kind: "entry" },
  { id: "W-IN", x: 30, y: 170, kind: "entry" },
  { id: "E-OUT", x: 640, y: 170, kind: "entry" },
  { id: "CAM_01", x: 160, y: 380, kind: "camera", on: "S-IN→J-02" },
  { id: "CAM_07", x: 160, y: 232, kind: "camera", on: "J-02→J-04" },
  { id: "CAM_14", x: 262, y: 170, kind: "camera", on: "J-04→J-08" },
  { id: "CAM_22", x: 468, y: 170, kind: "camera", on: "J-08→J-09" },
  { id: "CAM_03", x: 265, y: 310, kind: "camera", on: "J-02→J-03" },
  { id: "CAM_09", x: 560, y: 240, kind: "camera", on: "J-05→J-09" },
  { id: "CAM_11", x: 370, y: 110, kind: "camera", on: "J-08→J-07" },
  { id: "CAM_05", x: 90, y: 170, kind: "camera", on: "W-IN→J-04" },
];

export const MAP_EDGES: { a: string; b: string; m: number }[] = [
  { a: "J-06", b: "J-07", m: 520 },
  { a: "J-07", b: "J-10", m: 480 },
  { a: "J-04", b: "J-08", m: 500 },
  { a: "J-08", b: "J-09", m: 470 },
  { a: "J-02", b: "J-03", m: 520 },
  { a: "J-03", b: "J-05", m: 480 },
  { a: "J-06", b: "J-04", m: 400 },
  { a: "J-04", b: "J-02", m: 430 },
  { a: "J-07", b: "J-08", m: 400 },
  { a: "J-08", b: "J-03", m: 430 },
  { a: "J-10", b: "J-09", m: 400 },
  { a: "J-09", b: "J-05", m: 430 },
  { a: "S-IN", b: "J-02", m: 900 },
  { a: "W-IN", b: "J-04", m: 350 },
  { a: "J-09", b: "E-OUT", m: 300 },
];

export const JOURNEY_PATH = ["S-IN", "CAM_01", "J-02", "CAM_07", "J-04", "CAM_14", "J-08", "CAM_22", "J-09"];

export function node(id: string) {
  return MAP_NODES.find((n) => n.id === id)!;
}

export type NodeInfo = { title: string; type: string; lines: [string, string][] };

export const NODE_INFO: Record<string, NodeInfo> = {
  "CAM_01": { title: "CAM_01", type: "Camera node", lines: [["On segment", "S-IN → J-02 (northbound)"], ["Feeds signal", "J-02 south approach"], ["Distance to J-02", "≈ 250 m"], ["Upstream of", "J-02 → J-04"]] },
  "CAM_07": { title: "CAM_07", type: "Camera node", lines: [["On segment", "J-02 → J-04 (northbound)"], ["Feeds signal", "J-04 south approach (NS phase)"], ["Distance to J-04", "≈ 180 m"], ["Upstream camera", "CAM_01 via J-02"]] },
  "CAM_14": { title: "CAM_14", type: "Camera node", lines: [["On segment", "J-04 → J-08 (eastbound)"], ["Feeds signal", "J-08 west approach"], ["Distance to J-08", "≈ 260 m"], ["Upstream", "CAM_07 / CAM_05 via J-04"]] },
  "CAM_22": { title: "CAM_22", type: "Camera node", lines: [["On segment", "J-08 → J-09 (eastbound)"], ["Feeds signal", "J-09 west approach"], ["Distance to J-09", "≈ 240 m"], ["Upstream", "CAM_14 / CAM_11 via J-08"]] },
  "CAM_03": { title: "CAM_03", type: "Camera node", lines: [["On segment", "J-02 → J-03 (eastbound)"], ["Feeds signal", "J-03 west approach"], ["Distance to J-03", "≈ 270 m"]] },
  "CAM_09": { title: "CAM_09", type: "Camera node", lines: [["On segment", "J-05 → J-09 (northbound)"], ["Feeds signal", "J-09 south approach"], ["Distance from CAM_07", "≈ 2.1 km by road"]] },
  "CAM_11": { title: "CAM_11", type: "Camera node", lines: [["On segment", "J-08 → J-07 (northbound)"], ["Feeds signal", "J-07 south approach"]] },
  "CAM_05": { title: "CAM_05", type: "Camera node", lines: [["On segment", "W-IN → J-04 (eastbound)"], ["Feeds signal", "J-04 west approach (EW phase)"], ["Distance to J-04", "≈ 200 m"]] },
};

export function junctionInfo(id: string): NodeInfo {
  const conn = MAP_EDGES.filter((e) => e.a === id || e.b === id).map((e) => {
    const other = e.a === id ? e.b : e.a;
    return [other, `${e.m} m`] as [string, string];
  });
  const cams = MAP_NODES.filter((n) => n.kind === "camera" && n.on?.endsWith(`→${id}`)).map((n) => n.id);
  return {
    title: id,
    type: "Junction (graph node · signalised)",
    lines: [...conn.map(([o, m]) => [`Road to ${o}`, m] as [string, string]), ["Upstream cameras", cams.length ? cams.join(", ") : "none mapped"]],
  };
}
