// Budhi Gandaki 11 Oct 2026: can water from the Syar pond alone explain the flood? Compares the breach peak of the
// largest pond the Syar inflow could fill (data/syar_pond.py) with the discharge that a 20-25 m flood surface at
// Salleri needs in our DEM section (research/events.md: largest surge ~06:30, 20-25 m, NDRRMA SitRep 3 and 4).
// Usage (from the repo root): node model/check_budhi.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { breachEnsemble, empiricalMarkers } from './breach.mjs';
import { ratings } from './route.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = (f) => JSON.parse(readFileSync(join(ROOT, 'model/data', f), 'utf8'));
const pond = data('budhi_gandaki_syar_pond.json');
const hyd = data('budhi_gandaki_hydraulics.json');
const fmt = (x) => Math.round(x).toLocaleString('en');

// 1. breach of (a) the largest pond the inflow allows and (b) the pond that matches the reported 1.5 km length
const interp = (x, xs, ys) => {
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + ((x - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]);
  return ys.at(-1);
};
const rows = pond.table.filter((r) => r.length_km > 0);
const lens = rows.map((r) => r.length_km);
const cases = [
  ['largest pond the inflow allows', pond.inflow_limited.h_m[1], pond.inflow_limited.volume_max_Mm3[1]],
  ['pond matching the reported 1.5 km', interp(1.5, lens, rows.map((r) => r.h_m)), interp(1.5, lens, rows.map((r) => r.volume_Mm3))],
];
for (const [label, hD, vMm3] of cases) {
  console.log(`${label}: ${vMm3.toFixed(2)} Mm3 behind a ${hD.toFixed(1)} m blockage`);
  for (const m of empiricalMarkers(hD, vMm3 * 1e6)) console.log(`  ${m.label.padEnd(56)} ${fmt(m.q)} m3/s`);
  const ens = breachEnsemble({ hD, vL: vMm3 * 1e6, qIn: 100, n: 400, seed: 11 });
  console.log(`  breach ensemble (400 runs)                               ${fmt(ens.qPeak.p5)} / ${fmt(ens.qPeak.p50)} / ${fmt(ens.qPeak.p95)} m3/s`);
}

// 2. discharge for a 20-25 m flood surface at Salleri, from our section rating, for the effective n range
const salleri = hyd.places.find((p) => p.name === 'Salleri').chainage_km;
const k = hyd.sections.reduce((b, s, i) => (Math.abs(s.km - salleri) < Math.abs(hyd.sections[b].km - salleri) ? i : b), 0);
console.log(`\nSalleri section at km ${hyd.sections[k].km} (place at km ${salleri}), slope ${hyd.sections[k].slope}`);
for (const n of [0.035, 0.05, 0.07, 0.1]) {
  const r = ratings(hyd.sections.slice(k, k + 1), n)[0];
  const at = (h) => r.Q[Math.round(h / 0.5)];
  console.log(`  n ${n.toFixed(3)}: 20 m -> ${fmt(at(20))} m3/s, 25 m -> ${fmt(at(25))} m3/s`);
}
