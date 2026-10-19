// Rasuwa 26 August 2026: route a sampled flood from Syabrubesi to Devghat and keep the runs that match the observed
// times and the Devghat peak (a GLUE-style check). Observations: research/events.md, Part E1.
// Usage (from the repo root): node model/validate_rasuwa.mjs [runs] [seed] [uniform|jarrett]
// Model structure: 'uniform' uses one Manning's n for the whole river; 'jarrett' scales it with the local slope as
// n = n_ref (S / S_median)^0.38 (the slope exponent of Jarrett 1984, methods.md 4.3), so steep boulder gorges are
// rougher than the flat lower Trishuli. n_ref is then the value at the median slope.
// Writes out/derived/rasuwa/validation_<structure>.json.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from './breach.mjs';
import { arrival, pulse, route } from './route.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const hyd = JSON.parse(readFileSync(join(ROOT, 'model/data/rasuwa_hydraulics.json'), 'utf8'));
const place = (name) => hyd.places.find((p) => p.name.startsWith(name)).chainage_km;

const KM = {
  syabrubesi: place('Syabrubesi'),
  betrawati: place('Betrawati'),
  galchhi: place('Galchhi'),
  malekhu: place('Malekhu'),
  benighat: place('Benighat'),
  mugling: place('Mugling'),
  devghat: place('Devghat'),
};
const sections = hyd.sections.filter((s) => s.km >= KM.syabrubesi - 0.01);

// clock: minutes after 08:00 NPT on 26 Aug
const clock = (hh, mm) => (hh - 8) * 60 + mm;
const OBS = [
  { id: 'Betrawati front', km: KM.betrawati, kind: 'arrival', min: clock(9, 5), max: clock(9, 30), note: 'transmission stopped 09:20 (NDRRMA)' },
  { id: 'Galchhi front', km: KM.galchhi, kind: 'arrival', min: clock(10, 15), max: clock(10, 40), note: '10:28 (NDRRMA), 10:20-10:30 (CLaSH)' },
  { id: 'Galchhi peak', km: KM.galchhi, kind: 'peakTime', min: clock(10, 35), max: clock(11, 5), note: 'about 10:50 (CLaSH, ICIMOD)' },
  { id: 'Malekhu front', km: KM.malekhu, kind: 'arrival', min: clock(11, 10), max: clock(11, 40), note: '11:26 at Phurke (NDRRMA, CLaSH)' },
  { id: 'Malekhu peak', km: KM.malekhu, kind: 'peakTime', min: clock(11, 30), max: clock(12, 0), note: '11:43 at Phurke' },
  { id: 'Mugling front', km: KM.mugling, kind: 'arrival', min: clock(11, 45), max: clock(13, 0), note: 'flood had passed by 13:00 (read as: arrived before 13:00)' },
  { id: 'Devghat peak time', km: KM.devghat, kind: 'peakTime', min: clock(15, 15), max: clock(16, 45), note: '6.57 m at 16:00 (FFD)' },
  { id: 'Devghat peak flow', km: KM.devghat, kind: 'peakQ', min: 5850 * 0.75, max: 5850 * 1.25, note: '~5,850 m3/s (FFD), +/-25 %' },
];

const N = Number(process.argv[2] ?? 1500);
const rnd = mulberry32(Number(process.argv[3] ?? 2026));
const STRUCTURE = process.argv[4] ?? 'uniform';
if (!['uniform', 'jarrett'].includes(STRUCTURE)) throw new Error(`unknown structure ${STRUCTURE}`);
const slopes = sections.map((s) => s.slope).sort((a, b) => a - b);
const S_MEDIAN = slopes[Math.floor(slopes.length / 2)];
const nOf = (nRef) => (STRUCTURE === 'uniform' ? nRef : (s) => Math.min(0.2, Math.max(0.02, nRef * (s.slope / S_MEDIAN) ** 0.38)));
const logU = (a, b) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * rnd());
const U = (a, b) => a + (b - a) * rnd();

const DEVGHAT_BASE = 2713; // FFD: 57.40 Mm3 total minus 19.96 Mm3 above base, over 14:10-18:00 (13,800 s)
const watchKm = [KM.betrawati, KM.galchhi, KM.malekhu, KM.mugling, KM.devghat];

const runs = [];
for (let i = 0; i < N; i++) {
  const p = {
    startMin: U(clock(8, 44), clock(8, 50)), // the front at Syabrubesi; the station was gone by 08:50
    qPeak: logU(5000, 80000), // flood peak above base flow entering at Syabrubesi
    volume: logU(15e6, 150e6), // flood volume above base flow
    riseMin: U(2, 15),
    // effective n (at the median slope for 'jarrett'): it also absorbs the DSM sections and the sediment load
    n: logU(0.02, 0.1),
    baseSya: U(150, 450), // late-monsoon base flow at Syabrubesi
    addGal: U(100, 550), // Tadi and the other tributaries between Syabrubesi and Galchhi
    addBudhi: U(250, 700), // Budhi Gandaki joining near Benighat
    addMarsyangdi: U(350, 900), // Marsyangdi joining near Mugling
    loss: logU(1e-5, 0.03), // per km: deposition and storage a water-only model lacks; near zero means none
  };
  const stepUp = (km, at, q) => q * Math.min(1, Math.max(0, (km - at) / 1.0 + 0.5));
  const baseNoKali = (km) => {
    const f = Math.min(1, Math.max(0, (km - KM.syabrubesi) / (KM.galchhi - KM.syabrubesi)));
    const trunk = p.baseSya + f * p.addGal;
    return trunk + stepUp(km, KM.benighat, p.addBudhi) + stepUp(km, KM.mugling, p.addMarsyangdi);
  };
  // the Kali Gandaki joins at Devghat: whatever makes the base 2,713 m3/s at the last section (the ramp ends 0.5 km
  // above Devghat, so the watched section gets all of it)
  const kali = Math.max(0, DEVGHAT_BASE - baseNoKali(KM.devghat));
  const baseAt = (km) => baseNoKali(km) + stepUp(km, KM.devghat - 1.0, kali);
  const inflow = pulse({ base: p.baseSya, qPeak: p.qPeak, volume: p.volume, rise: p.riseMin * 60 });
  const res = route({ sections, n: nOf(p.n), inflow, baseAt, tEnd: 9 * 3600, dt: 15, watchKm, lossPerKm: p.loss });
  const at = (km) => res.watch.find((w) => Math.abs(w.km - km) < 0.6);
  const minutes = (sec) => p.startMin + sec / 60;
  const pred = {};
  for (const o of OBS) {
    const w = at(o.km);
    if (o.kind === 'arrival') pred[o.id] = minutes(arrival(res.t, w.h, 1.0)); // a 1 m rise marks the front
    if (o.kind === 'peakTime') {
      let k = 0;
      for (let s = 1; s < w.q.length; s++) if (w.q[s] > w.q[k]) k = s;
      pred[o.id] = minutes(res.t[k]);
    }
    if (o.kind === 'peakQ') pred[o.id] = Math.max(...w.q);
  }
  const g = at(KM.galchhi);
  const ok = OBS.map((o) => pred[o.id] >= o.min && pred[o.id] <= o.max);
  runs.push({
    p,
    pred,
    ok,
    hits: ok.filter(Boolean).length,
    galchhiPeakQ: Math.max(...g.q),
    galchhiRise: Math.max(...g.h) - g.h[0],
  });
}

const accepted = runs.filter((r) => r.hits === OBS.length);
const q = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : Number.NaN;
};
const band = (raw) => {
  const arr = raw.filter((x) => Number.isFinite(x));
  return { p5: q(arr, 0.05), p50: q(arr, 0.5), p95: q(arr, 0.95), n: arr.length };
};
const fmtT = (m) => {
  if (!Number.isFinite(m)) return '  -  ';
  const r = Math.round(m);
  return `${String(8 + Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
};

console.log(`structure ${STRUCTURE}; runs ${N}; accepted (all ${OBS.length} checks) ${accepted.length}`);
const best = Math.max(...runs.map((r) => r.hits));
console.log(`best run meets ${best} of ${OBS.length}`);
for (let k = 0; k < OBS.length; k++) {
  const pass = runs.filter((r) => r.ok[k]).length;
  console.log(`  ${OBS[k].id.padEnd(18)} met by ${String(pass).padStart(5)} runs  (${OBS[k].note})`);
}
// Few runs meet both the Mugling front and the Devghat peak time (methods.md 4.6). If fewer than 20 runs meet all
// eight, the bands come from runs that meet the six other checks and at least one of these two.
const CONFLICT = ['Mugling front', 'Devghat peak time'];
const iConflict = CONFLICT.map((id) => OBS.findIndex((o) => o.id === id));
const nearly = runs.filter((r) => r.ok.every((ok, k) => ok || iConflict.includes(k)) && iConflict.some((k) => r.ok[k]));
const pool = accepted.length >= 20 ? accepted : nearly;
console.log(`runs meeting both ${CONFLICT.join(' and ')} (any other checks): ${runs.filter((r) => iConflict.every((k) => r.ok[k])).length}`);
console.log(`\nbands from ${pool === accepted ? 'accepted runs' : `runs meeting all but one of ${CONFLICT.join(' / ')}`} (${pool.length}):`);
const show = (label, b, f = (x) => Math.round(x).toLocaleString('en')) =>
  console.log(`  ${label.padEnd(34)} ${f(b.p5)} / ${f(b.p50)} / ${f(b.p95)}`);
show('peak at Syabrubesi (m3/s)', band(pool.map((r) => r.p.qPeak)));
show('volume above base (Mm3)', band(pool.map((r) => r.p.volume / 1e6)), (x) => x.toFixed(0));
show("Manning's n", band(pool.map((r) => r.p.n)), (x) => x.toFixed(3));
show('loss per km (deposition, storage)', band(pool.map((r) => r.p.loss)), (x) => x.toFixed(4));
show('Galchhi peak (m3/s; ICIMOD ~17,000)', band(pool.map((r) => r.galchhiPeakQ)));
show('Galchhi rise (m; observed +8.5 to 8.9)', band(pool.map((r) => r.galchhiRise)), (x) => x.toFixed(1));
for (const o of OBS) {
  const b = band(pool.map((r) => r.pred[o.id]));
  if (o.kind === 'peakQ') show(o.id, b);
  else console.log(`  ${o.id.padEnd(34)} ${fmtT(b.p5)} / ${fmtT(b.p50)} / ${fmtT(b.p95)}   observed window ${fmtT(o.min)}-${fmtT(o.max)}`);
}

const out = join(ROOT, 'out/derived/rasuwa');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, `validation_${STRUCTURE}.json`),
  JSON.stringify({ structure: STRUCTURE, observations: OBS, runs: N, accepted: accepted.length, best, poolRule: pool === accepted ? 'all eight' : `all but one of ${CONFLICT.join(' / ')}`, pool: pool.map((r) => ({ p: r.p, pred: r.pred, galchhiPeakQ: r.galchhiPeakQ, galchhiRise: r.galchhiRise })) }),
);
