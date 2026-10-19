// Peak discharge of a natural-dam breach: empirical relations as independent markers, and a physically based
// breach model (Walder & O'Connor 1997 physics) run as a Monte Carlo ensemble. See research/methods.md, section 3.
// Units: SI (m, s, m3, m3/s) unless a name says otherwise. Plain ES module: runs in the browser and in Node.

const G = 9.81;
const RHO_W = 1000;

// ---------- empirical relations (research/methods.md, table 3.1) ----------
// hD: dam height (m); vL: lake volume released (m3); hW: drop in lake level (m)

export const empirical = {
  // E1-E3 Costa (1985), 10 landslide dams; volumes in 10^6 m3 in the original form
  costa1985H: (hD) => 6.3 * hD ** 1.59,
  costa1985V: (vL) => 672 * (vL / 1e6) ** 0.56,
  costa1985HV: (hD, vL) => 181 * (hD * (vL / 1e6)) ** 0.43,
  // E4 Costa & Schuster (1988), regression on potential energy PE = hD * vL * rho * g (J)
  costaSchuster1988: (hD, vL) => 0.0158 * (hD * vL * RHO_W * G) ** 0.41,
  // E8 Froehlich (1995b), embankment dams; Wahl (2004) 95 % band x0.53 to x2.3
  froehlich1995: (vL, hW) => 0.607 * vL ** 0.295 * hW ** 1.24,
  froehlichBand: [0.53, 2.3],
  // E10 Peng & Zhang (2012) simplified, 52 landslide dams; erodibility: 'high' | 'medium' | 'low'
  pengZhang2012: (hD, vL, erodibility) => {
    const a = { high: 1.236, medium: -0.38, low: -1.615 }[erodibility];
    if (a === undefined) throw new Error(`unknown erodibility ${erodibility}`);
    return Math.sqrt(G) * hD ** 2.5 * hD ** -1.371 * (Math.cbrt(vL) / hD) ** 1.536 * Math.exp(a);
  },
  // physical reference: critical flow through a breach of depth h and width b (b = h gives g^0.5 h^2.5)
  criticalFlow: (h, b = h) => Math.sqrt(G) * h ** 2.5 * (b / h),
};

// all markers for one dam, labelled, for display next to the ensemble (never averaged)
export function empiricalMarkers(hD, vL) {
  const fr = empirical.froehlich1995(vL, hD);
  return [
    { id: 'E4', label: 'Costa & Schuster 1988 (landslide dams)', q: empirical.costaSchuster1988(hD, vL) },
    { id: 'E10-low', label: 'Peng & Zhang 2012, low erodibility', q: empirical.pengZhang2012(hD, vL, 'low') },
    { id: 'E10-medium', label: 'Peng & Zhang 2012, medium erodibility', q: empirical.pengZhang2012(hD, vL, 'medium') },
    { id: 'E10-high', label: 'Peng & Zhang 2012, high erodibility', q: empirical.pengZhang2012(hD, vL, 'high') },
    {
      id: 'E8',
      label: 'Froehlich 1995b (constructed dams)',
      q: fr,
      band: [fr * empirical.froehlichBand[0], fr * empirical.froehlichBand[1]],
    },
    { id: 'crit', label: 'Critical flow, breach width = depth (upper reference)', q: empirical.criticalFlow(hD) },
  ];
}

// ---------- physically based breach model (research/methods.md, 3.2) ----------

// The lake: volume above the final breach invert grows as a power of the stage, V(h) = vL * (h / hD)^m, with
// m about 2 to 3 for a lake in a valley (a cone or wedge). A(h) = dV/dh.
function lakeAt(vL, hD, m) {
  return {
    volume: (h) => (h <= 0 ? 0 : vL * (h / hD) ** m),
    stage: (v) => (v <= 0 ? 0 : hD * (v / vL) ** (1 / m)),
  };
}

/**
 * One breach run. The breach starts at the crest (lake full to the crest, overtopping), cuts down at erosion rate k
 * to a final depth hB below the crest, and widens with depth (bottom width b = r * depth, at least 1 m). Outflow is
 * a broad-crested weir with side slopes: Q = 1.7 b H^1.5 + 1.35 z H^2.5 (NWS BREACH/DAMBRK form, SI).
 * @param {object} p
 * @param {number} p.hD    dam height above the lake bottom at the outlet (m)
 * @param {number} p.vL    lake volume at the crest (m3)
 * @param {number} p.kmh   vertical erosion rate (m per hour)
 * @param {number} p.hB    final breach depth below the crest (m), at most hD
 * @param {number} p.r     bottom width / breach depth
 * @param {number} p.z     side slope (horizontal : vertical)
 * @param {number} p.m     stage-volume exponent of the lake
 * @param {number} [p.qIn] inflow from the river (m3/s)
 * @param {number} [p.dt]  time step (s)
 * @param {number} [p.tMax] longest simulated time (s)
 * @returns {{t: Float64Array, q: Float64Array, qPeak: number, tPeak: number, released: number}}
 */
export function breachRun({ hD, vL, kmh, hB, r, z, m, qIn = 0, dt = 5, tMax = 48 * 3600 }) {
  const lake = lakeAt(vL, hD, m);
  const k = kmh / 3600;
  const floor = hD - Math.min(hB, hD);
  const n = Math.ceil(tMax / dt);
  const t = new Float64Array(n);
  const q = new Float64Array(n);
  let vol = vL; // lake volume; the level follows from it, so the water balance is exact
  let h = hD; // lake level above the outlet bottom
  let inv = hD; // breach invert
  let qPeak = 0;
  let tPeak = 0;
  let released = 0;
  let last = n;
  for (let i = 0; i < n; i++) {
    inv = Math.max(floor, inv - k * dt);
    const depth = hD - inv;
    const b = Math.max(1, r * depth);
    const head = Math.max(0, h - inv);
    let out = 1.7 * b * head ** 1.5 + 1.35 * z * head ** 2.5;
    // never release more than the lake holds above the invert in one step
    const avail = vol - lake.volume(inv) + qIn * dt;
    out = Math.min(out, Math.max(0, avail / dt));
    vol = Math.max(lake.volume(inv), vol + (qIn - out) * dt);
    h = lake.stage(vol);
    t[i] = i * dt;
    q[i] = out;
    released += out * dt;
    if (out > qPeak) {
      qPeak = out;
      tPeak = i * dt;
    }
    // stop once the lake has drained to the final invert and the flow is back to the inflow
    if (inv === floor && i * dt > tPeak + 3600 && out <= qIn * 1.01 + 1) {
      last = i + 1;
      break;
    }
  }
  return { t: t.subarray(0, last), q: q.subarray(0, last), qPeak, tPeak, released };
}

// seeded random numbers, so a scenario always gives the same ensemble
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_RANGES = {
  kmh: [10, 100], // Walder & O'Connor reconnaissance range; log-uniform
  hBFrac: [0.3, 1.0], // final breach depth / dam height
  r: [0.5, 3], // bottom width / depth
  z: [0.5, 1.5], // side slope
  m: [2, 3], // stage-volume exponent
};

function quantile(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Monte Carlo ensemble of breach runs.
 * @returns {{runs: Array, qPeak: {p5:number,p50:number,p95:number}, tPeak: {p5:number,p50:number,p95:number},
 *   hydro: {t: Float64Array, p5: Float64Array, p50: Float64Array, p95: Float64Array}}}
 */
export function breachEnsemble({ hD, vL, qIn = 0, n = 400, seed = 1, ranges = DEFAULT_RANGES, dt = 5 }) {
  const rnd = mulberry32(seed);
  const u = ([a, b]) => a + (b - a) * rnd();
  const logU = ([a, b]) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * rnd());
  const runs = [];
  for (let i = 0; i < n; i++) {
    const params = { hD, vL, qIn, dt, kmh: logU(ranges.kmh), hB: u(ranges.hBFrac) * hD, r: u(ranges.r), z: u(ranges.z), m: u(ranges.m) };
    const res = breachRun(params);
    runs.push({ params, ...res });
  }
  const peaks = runs.map((x) => x.qPeak).sort((a, b) => a - b);
  const tPeaks = runs.map((x) => x.tPeak).sort((a, b) => a - b);
  // hydrograph band on a common 1-minute grid, each run aligned to its own start (the start of overtopping)
  const tEnd = Math.max(...runs.map((x) => x.t[x.t.length - 1]));
  const grid = new Float64Array(Math.ceil(tEnd / 60) + 1).map((_, i) => i * 60);
  const pick = (x, tt) => {
    const i = Math.min(Math.floor(tt / dt), x.q.length - 1);
    return tt > x.t[x.t.length - 1] ? qIn : x.q[i];
  };
  const p5 = new Float64Array(grid.length);
  const p50 = new Float64Array(grid.length);
  const p95 = new Float64Array(grid.length);
  const col = new Float64Array(runs.length);
  for (let g = 0; g < grid.length; g++) {
    for (let j = 0; j < runs.length; j++) col[j] = pick(runs[j], grid[g]);
    const s = Array.from(col).sort((a, b) => a - b);
    p5[g] = quantile(s, 0.05);
    p50[g] = quantile(s, 0.5);
    p95[g] = quantile(s, 0.95);
  }
  return {
    runs,
    qPeak: { p5: quantile(peaks, 0.05), p50: quantile(peaks, 0.5), p95: quantile(peaks, 0.95) },
    tPeak: { p5: quantile(tPeaks, 0.05), p50: quantile(tPeaks, 0.5), p95: quantile(tPeaks, 0.95) },
    hydro: { t: grid, p5, p50, p95 },
  };
}
