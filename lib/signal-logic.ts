// Conceptual decision logic used in the simulation. It is intentionally simple and explainable;
// it is NOT a claim about a specific production algorithm.

export const LANES = 3;
export const HEADWAY = 1.3; // s between successive vehicles in one lane of a moving platoon
export const BASE_GREEN = 30;
export const YELLOW = 5;
export const BASE_RED = 45;
export const ELAPSED = 12; // NS green has already run 12 s when the scenario starts
export const MAX_GREEN = 60;

export type Upstream = { cam: string; approach: "N" | "S" | "E"; axis: "NS" | "EW"; n: number; d: number; v: number };

export type SignalInputs = {
  up: Upstream[];
  ewQueue: number;
  downstreamOcc: number;
  historicalFactor: number;
};

export type Platoon = Upstream & { eta: number; pass: number; end: number };

export function platoon(u: Upstream): Platoon {
  const eta = u.d / (u.v / 3.6);
  const pass = Math.ceil(u.n / LANES) * HEADWAY;
  return { ...u, eta, pass, end: eta + pass };
}

export type Plan = {
  platoons: Platoon[];
  remaining: number;
  cap: number;
  capReason: string;
  ewMaxRed: number;
  ext: number;
  newGreen: number;
  kind: "extend" | "none-fits" | "none-late" | "blocked-spillback" | "capped";
  decision: string;
  reason: string;
  predicted: { cam: string; n: number }[];
  predictedTotal: number;
  window: number;
  stoppedFixed: number;
  stoppedMaarg: number;
  servedNext: Platoon[];
};

export function computePlan(inp: SignalInputs, window = 30): Plan {
  const platoons = inp.up.map(platoon);
  const remaining = BASE_GREEN - ELAPSED;
  const ewMaxRed = inp.ewQueue > 30 ? BASE_RED : inp.ewQueue > 20 ? 60 : 75;
  const byEW = ewMaxRed - BASE_RED;
  const byMax = MAX_GREEN - BASE_GREEN;
  const cap = Math.min(byEW, byMax);
  const capReason = byEW < byMax ? `cross-street (EW) red limited to ${ewMaxRed} s because ${inp.ewQueue} vehicles are waiting` : `maximum green ${MAX_GREEN} s`;

  const ns = platoons.filter((p) => p.axis === "NS" && p.n > 0);
  const candidates = ns.filter((p) => p.eta < remaining + cap && p.end > remaining);
  const servedNext = ns.filter((p) => p.eta >= remaining + cap);
  const fits = ns.filter((p) => p.end <= remaining);

  let ext = 0;
  let kind: Plan["kind"] = "none-fits";
  let decision = "Keep current timing";
  let reason = "";

  const needed = candidates.length ? Math.max(...candidates.map((p) => p.end - remaining)) : 0;

  if (inp.downstreamOcc >= 85 && candidates.length) {
    kind = "blocked-spillback";
    decision = "Do not extend North–South green";
    reason = `Downstream J-05 is ${inp.downstreamOcc}% occupied. Sending more vehicles would spill back and block J-04, so the platoon is held and metered instead.`;
  } else if (candidates.length) {
    ext = Math.min(cap, Math.round(needed));
    kind = Math.round(needed) > cap ? "capped" : "extend";
    decision = ext > 0 ? `Extend North–South GREEN by ${ext} s` : "Keep current timing";
    reason =
      kind === "capped"
        ? `Platoon needs ${Math.round(needed)} s more, but the extension is capped at ${cap} s (${capReason}). The tail is served next cycle.`
        : `${candidates.map((c) => `${c.n} vehicles from ${c.cam}`).join(" + ")} arrive in ~${Math.round(Math.min(...candidates.map((c) => c.eta)))} s and need ~${Math.round(Math.max(...candidates.map((c) => c.pass)))} s to pass. Current green ends in ${remaining} s.`;
  } else if (servedNext.length && !fits.length) {
    kind = "none-late";
    decision = "Keep timing · prepare next NS green";
    reason = `Upstream platoon arrives in ~${Math.round(Math.min(...servedNext.map((p) => p.eta)))} s — after the latest allowed green end — so it is served by the next NS green.`;
  } else {
    reason = "All predicted NS arrivals clear within the remaining green. No change needed.";
  }

  const predicted = platoons.map((p) => ({
    cam: p.cam,
    n: Math.round(p.n * Math.max(0, Math.min(1, (window - p.eta) / Math.max(p.pass, 0.1))) * inp.historicalFactor),
  }));

  const stopped = (greenEnd: number) => {
    const p = platoons[0];
    if (!p || p.axis !== "NS") return 0;
    const rows = Math.ceil(p.n / LANES);
    let s = 0;
    for (let r = 0; r < rows; r++) {
      if (p.eta + r * HEADWAY > greenEnd) s += Math.min(LANES, p.n - r * LANES);
    }
    return s;
  };

  return {
    platoons,
    remaining,
    cap,
    capReason,
    ewMaxRed,
    ext,
    newGreen: BASE_GREEN + ext,
    kind,
    decision,
    reason,
    predicted,
    predictedTotal: predicted.reduce((a, b) => a + b.n, 0),
    window,
    stoppedFixed: stopped(remaining),
    stoppedMaarg: stopped(remaining + ext),
    servedNext,
  };
}

export const DEFAULT_UPSTREAM: Upstream[] = [
  { cam: "CAM_01", approach: "N", axis: "NS", n: 42, d: 180, v: 36 },
  { cam: "CAM_02", approach: "S", axis: "NS", n: 31, d: 420, v: 30 },
  { cam: "CAM_03", approach: "E", axis: "EW", n: 18, d: 300, v: 27 },
];
