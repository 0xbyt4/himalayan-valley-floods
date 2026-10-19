// Flood routing down a river with a nonlinear Muskingum-Cunge method in storage form (research/methods.md 4.2, 4.6),
// on hydraulic tables from the DEM (data/hydraulics.py). Plain ES module: runs in the browser and in Node.
// Units: SI. Times in seconds from the start of the inflow hydrograph.

/**
 * Per-section rating for a Manning's n: discharge, area, top width at each tabulated stage.
 * Q(h) = F S^(1/2) / n, with F the conveyance factor summed over vertical strips (data/hydraulics.py), which grows
 * with h. Tables without it fall back to one hydraulic radius, Q = (1/n) A (A/P)^(2/3) S^(1/2), forced to grow.
 */
export function ratings(sections, n) {
  return sections.map((s) => {
    const nS = typeof n === 'function' ? n(s) : n;
    const rows = s.table;
    const h = new Float64Array(rows.length);
    const A = new Float64Array(rows.length);
    const B = new Float64Array(rows.length);
    const Q = new Float64Array(rows.length);
    let qMax = 0;
    for (let i = 0; i < rows.length; i++) {
      const [hh, a, b, p, f] = rows[i];
      h[i] = hh;
      A[i] = a;
      B[i] = Math.max(b, 1);
      const conv = f ?? (a > 0 ? a * (a / Math.max(p, 1e-6)) ** (2 / 3) : 0);
      const q = (conv * Math.sqrt(s.slope)) / nS;
      qMax = Math.max(qMax, q, i > 0 ? Q[i - 1] + 1e-6 : 0);
      Q[i] = qMax;
    }
    return { km: s.km, slope: s.slope, bed: s.bed_m, h, A, B, Q };
  });
}

// stage, area, top width and kinematic celerity dQ/dA at discharge q, by interpolation in the rating table
export function atQ(r, q) {
  const { Q, h, A, B } = r;
  if (q <= Q[1]) {
    const f = q / Math.max(Q[1], 1e-9);
    return { h: h[1] * f, A: A[1] * f, B: B[1], c: Q[1] / Math.max(A[1], 1e-9) };
  }
  let lo = 1;
  let hi = Q.length - 1;
  if (q >= Q[hi]) {
    const c = (Q[hi] - Q[hi - 1]) / Math.max(A[hi] - A[hi - 1], 1e-9);
    return { h: h[hi] + (q - Q[hi]) / Math.max(c * B[hi], 1e-9), A: A[hi] + (q - Q[hi]) / c, B: B[hi], c, beyond: true };
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (Q[mid] <= q) lo = mid;
    else hi = mid;
  }
  const f = (q - Q[lo]) / (Q[hi] - Q[lo]);
  const c = (Q[hi] - Q[lo]) / Math.max(A[hi] - A[lo], 1e-9);
  return { h: h[lo] + f * (h[hi] - h[lo]), A: A[lo] + f * (A[hi] - A[lo]), B: B[lo] + f * (B[hi] - B[lo]), c };
}

/**
 * Route an inflow hydrograph from the first section to the last.
 * @param {object} o
 * @param {Array}  o.sections   hydraulic sections (km, slope, bed_m, table), upstream to downstream
 * @param {number|((section:object)=>number)} o.n  Manning's n, one value or per section
 * @param {(t:number)=>number} o.inflow  discharge entering the first section at time t (includes its base flow)
 * @param {(km:number)=>number} o.baseAt base flow along the river (tributaries join as lateral inflow)
 * @param {number} o.tEnd       simulated time (s)
 * @param {number} [o.dt]       time step (s)
 * @param {number[]} [o.watchKm] chainages where the full series is kept
 * @param {number} [o.lossPerKm] fraction of the flow above base lost per km (sediment deposition and valley storage
 *   that a water-only model does not have); 0 by default
 * @returns {{t: Float64Array, watch: Array<{km:number, q:Float64Array, h:Float64Array}>, peak: Float64Array,
 *   tPeak: Float64Array, km: Float64Array}}
 */
export function route({ sections, n, inflow, baseAt, tEnd, dt = 20, watchKm = [], lossPerKm = 0 }) {
  const R = ratings(sections, n);
  const nx = R.length;
  const nt = Math.ceil(tEnd / dt) + 1;
  const km = Float64Array.from(R, (r) => r.km);
  const lateral = new Float64Array(nx);
  for (let j = 1; j < nx; j++) lateral[j] = Math.max(0, baseAt(km[j]) - baseAt(km[j - 1]));
  let prev = new Float64Array(nx);
  prev[0] = inflow(0);
  for (let j = 1; j < nx; j++) prev[j] = prev[j - 1] + lateral[j];
  const base = Float64Array.from(prev);
  const watchIdx = watchKm.map((k) => {
    let best = 0;
    for (let j = 0; j < nx; j++) if (Math.abs(km[j] - k) < Math.abs(km[best] - k)) best = j;
    return best;
  });
  const watch = watchIdx.map((j) => ({ km: km[j], j, q: new Float64Array(nt), h: new Float64Array(nt) }));
  const peak = Float64Array.from(prev);
  const tPeak = new Float64Array(nx);
  const t = new Float64Array(nt);
  const record = (step, Q) => {
    for (const w of watch) {
      w.q[step] = Q[w.j];
      w.h[step] = atQ(R[w.j], Q[w.j]).h;
    }
  };
  record(0, prev);
  let next = new Float64Array(nx);
  let zeroOutflowSteps = 0;
  let weightLimitedSteps = 0;
  const reachArea = (j, q) => 0.5 * (atQ(R[j], q).A + atQ(R[j + 1], q).A);
  const reachSlowness = (j, q) => 0.5 * (1 / Math.max(atQ(R[j], q).c, 1e-3) + 1 / Math.max(atQ(R[j + 1], q).c, 1e-3));
  // Cunge weighting X for reach j at a reference discharge, from the cell Reynolds number D = q / (B S c dx). In flat
  // reaches D > 1 gives X < 0, which is unstable; X is held at 0 there (a reservoir: stable, with some extra damping).
  const weight = (j, qRef, dx) => {
    const g = atQ(R[j + 1], qRef);
    const D = qRef / (g.B * R[j + 1].slope * Math.max(g.c, 0.3) * dx);
    return Math.min(0.5, Math.max(0, 0.5 * (1 - D)));
  };
  // Storage of each reach is the water in it, S = dx A(Qw), with Qw = X I + (1 - X) O (nonlinear Muskingum-Cunge in
  // storage form; dS/dQw = dx / c, so K = dx / c as in the linear method). O is the reach outflow before the
  // tributary joins and before any loss. Each step solves continuity, S_new = S_old + dt (I - O) with trapezoid
  // averages, for O_new: the water balance is exact, and the storage follows the valley shape, so a wide bench
  // slows the wave without the jumps that a K taken from the local celerity gives.
  const dxs = Float64Array.from({ length: nx - 1 }, (_, j) => (km[j + 1] - km[j]) * 1000);
  const S = new Float64Array(nx - 1);
  for (let j = 0; j < nx - 1; j++) S[j] = dxs[j] * reachArea(j, prev[j]); // steady start: I = O
  let oPrev = new Float64Array(nx); // reach outflow (index j + 1 for reach j) at the last step
  for (let j = 1; j < nx; j++) oPrev[j] = prev[j] - lateral[j];
  let oNext = new Float64Array(nx);
  for (let s = 1; s < nt; s++) {
    t[s] = s * dt;
    next[0] = inflow(t[s]);
    for (let j = 0; j < nx - 1; j++) {
      const iOld = prev[j];
      const iNew = next[j];
      const oOld = oPrev[j + 1];
      const dx = dxs[j];
      let X = weight(j, (iOld + iNew + oOld) / 3, dx);
      const rhs = S[j] + (dt / 2) * (iOld + iNew - oOld);
      const gX = (x, o) => dx * reachArea(j, x * iNew + (1 - x) * o) + (dt / 2) * o - rhs;
      // While the front enters a reach, its outflow must not fall. With a large X and a steep front it would (the
      // negative C0 coefficient of the linear method; Ponce and Theurer 1982), so X is lowered to the largest value
      // that keeps O_new >= O_old (X = 0 does whenever the reach already held at least dx A(O_old)). The tolerance
      // keeps rounding noise in a steady flow from counting as a rising front.
      const tol = 1e-9 * Math.max(1, iOld);
      if (iNew > iOld + tol && iNew > oOld + tol && X > 0 && gX(X, oOld) > 0) {
        let lo = 0;
        let hi = X;
        for (let it = 0; it < 30; it++) {
          const mid = 0.5 * (lo + hi);
          if (gX(mid, oOld) > 0) hi = mid;
          else lo = mid;
        }
        X = lo;
        weightLimitedSteps++;
      }
      // g(o) = dx A(X I + (1 - X) o) + dt/2 o - rhs grows with o: safeguarded Newton on [lo, hi]
      const g = (o) => gX(X, o);
      let oNew;
      if (g(0) >= 0) {
        oNew = 0;
        zeroOutflowSteps++;
      } else {
        let lo = 0;
        let hi = Math.max(oOld, iNew, 1);
        while (g(hi) < 0) {
          lo = hi;
          hi *= 2;
        }
        oNew = Math.min(Math.max(oOld, lo), hi);
        for (let it = 0; it < 40; it++) {
          const v = g(oNew);
          if (v < 0) lo = oNew;
          else hi = oNew;
          const step = v / (dx * (1 - X) * reachSlowness(j, X * iNew + (1 - X) * oNew) + dt / 2);
          let cand = oNew - step;
          if (!(cand > lo && cand < hi)) cand = 0.5 * (lo + hi);
          if (Math.abs(cand - oNew) <= 1e-7 * Math.max(1, oNew)) {
            oNew = cand;
            break;
          }
          oNew = cand;
        }
      }
      S[j] += (dt / 2) * (iOld + iNew - oOld - oNew);
      oNext[j + 1] = oNew;
      let qNew = oNew + lateral[j + 1];
      // the loss acts on what leaves the reach, not on its storage
      if (lossPerKm > 0 && qNew > base[j + 1]) qNew = base[j + 1] + (qNew - base[j + 1]) * Math.exp(-lossPerKm * (dx / 1000));
      next[j + 1] = qNew;
    }
    for (let j = 0; j < nx; j++) {
      if (next[j] > peak[j]) {
        peak[j] = next[j];
        tPeak[j] = t[s];
      }
    }
    record(s, next);
    [prev, next] = [next, prev];
    [oPrev, oNext] = [oNext, oPrev];
  }
  return { t, watch, peak, tPeak, km, base, zeroOutflowSteps, weightLimitedSteps };
}

// first time a series rises a given amount above its starting value (the arrival of the front)
export function arrival(t, series, rise) {
  const v0 = series[0];
  for (let i = 0; i < series.length; i++) if (series[i] - v0 >= rise) return t[i];
  return Number.NaN;
}

// a hydrograph with a straight rise to the peak and an exponential fall that releases the given volume (the rise is
// shortened if it alone would hold more than 90 % of the volume)
export function pulse({ base, qPeak, volume, rise: riseIn }) {
  const rise = Math.min(riseIn, (1.8 * volume) / qPeak);
  const fallVol = volume - 0.5 * qPeak * rise;
  const tau = fallVol / qPeak;
  return (t) => {
    if (t <= 0) return base;
    if (t < rise) return base + (qPeak * t) / rise;
    return base + qPeak * Math.exp(-(t - rise) / tau);
  };
}
