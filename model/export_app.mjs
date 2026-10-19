// Export the Rasuwa model results for the app: for every routed section and every minute from 08:44 to 18:44 NPT,
// the 5 / 50 / 95 % stage rise above the normal river across the runs used for the bands in research/methods.md 4.6
// (the pools of both roughness structures in out/derived/rasuwa/validation_{uniform,jarrett}.json).
// Also per section: bands of the peak discharge, the peak rise and the arrival time (first 1 m rise).
// Usage (from the repo root): node model/export_app.mjs
// Writes app/data/rasuwa/model.json and model_rise.bin: the bands as Int16 centimetres [band][section][minute], stored
// per series (band and section) as zigzag differences from one minute to the next, low bytes then high bytes, gzipped
// (app/src/decode.mjs decodeRise).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pulse, route } from './route.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const hyd = JSON.parse(readFileSync(join(ROOT, 'model/data/rasuwa_hydraulics.json'), 'utf8'));
const place = (name) => hyd.places.find((p) => p.name.startsWith(name)).chainage_km;
const KM = {
  syabrubesi: place('Syabrubesi'),
  galchhi: place('Galchhi'),
  benighat: place('Benighat'),
  mugling: place('Mugling'),
  devghat: place('Devghat'),
};
const sections = hyd.sections.filter((s) => s.km >= KM.syabrubesi - 0.01);
const slopes = sections.map((s) => s.slope).sort((a, b) => a - b);
const S_MEDIAN = slopes[Math.floor(slopes.length / 2)];
const DEVGHAT_BASE = 2713;

// the same base flow and roughness construction as validate_rasuwa.mjs
function setup(p, structure) {
  const stepUp = (km, at, q) => q * Math.min(1, Math.max(0, (km - at) / 1.0 + 0.5));
  const baseNoKali = (km) => {
    const f = Math.min(1, Math.max(0, (km - KM.syabrubesi) / (KM.galchhi - KM.syabrubesi)));
    return p.baseSya + f * p.addGal + stepUp(km, KM.benighat, p.addBudhi) + stepUp(km, KM.mugling, p.addMarsyangdi);
  };
  const kali = Math.max(0, DEVGHAT_BASE - baseNoKali(KM.devghat));
  const baseAt = (km) => baseNoKali(km) + stepUp(km, KM.devghat - 1.0, kali);
  const n = structure === 'uniform' ? p.n : (s) => Math.min(0.2, Math.max(0.02, p.n * (s.slope / S_MEDIAN) ** 0.38));
  return { baseAt, n };
}

const MIN0 = 44; // minute 0 of the export = 08:44
const NMIN = 601; // to 18:44
const DT = 15;
const nSec = sections.length;
const runs = [];
for (const structure of ['uniform', 'jarrett']) {
  const v = JSON.parse(readFileSync(join(ROOT, `out/derived/rasuwa/validation_${structure}.json`), 'utf8'));
  for (const r of v.pool) runs.push({ structure, p: r.p });
}
console.log(`routing ${runs.length} runs over ${nSec} sections`);

const rise = runs.map(() => new Float32Array(nSec * NMIN));
const peakQ = runs.map(() => new Float32Array(nSec));
const peakRise = runs.map(() => new Float32Array(nSec));
const arrive = runs.map(() => new Float32Array(nSec).fill(Number.NaN));
runs.forEach((run, k) => {
  const { p, structure } = run;
  const { baseAt, n } = setup(p, structure);
  const inflow = pulse({ base: p.baseSya, qPeak: p.qPeak, volume: p.volume, rise: p.riseMin * 60 });
  const tEnd = (MIN0 + NMIN - p.startMin) * 60;
  const res = route({ sections, n, inflow, baseAt, tEnd, dt: DT, watchKm: sections.map((s) => s.km), lossPerKm: p.loss });
  res.watch.forEach((w, j) => {
    const h0 = w.h[0];
    for (let m = 0; m < NMIN; m++) {
      const t = (MIN0 + m - p.startMin) * 60; // seconds since the run start
      const i = Math.round(t / DT);
      rise[k][j * NMIN + m] = i < 0 ? 0 : Math.max(0, w.h[Math.min(i, w.h.length - 1)] - h0);
    }
    let qm = 0;
    let hm = 0;
    for (let i = 0; i < w.q.length; i++) {
      qm = Math.max(qm, w.q[i]);
      hm = Math.max(hm, w.h[i] - h0);
      if (Number.isNaN(arrive[k][j]) && w.h[i] - h0 >= 1) arrive[k][j] = p.startMin + (i * DT) / 60;
    }
    peakQ[k][j] = qm;
    peakRise[k][j] = hm;
  });
  if ((k + 1) % 50 === 0) console.log(`  ${k + 1} runs`);
});

const quant = (arr, ps) => {
  const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
  return ps.map((p) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null));
};
const PS = [0.05, 0.5, 0.95];
const bands = new Int16Array(3 * nSec * NMIN);
const col = new Float32Array(runs.length);
for (let j = 0; j < nSec; j++) {
  for (let m = 0; m < NMIN; m++) {
    for (let k = 0; k < runs.length; k++) col[k] = rise[k][j * NMIN + m];
    const q = quant(Array.from(col), PS);
    q.forEach((v, b) => (bands[b * nSec * NMIN + j * NMIN + m] = Math.round(v * 100)));
  }
}
const per = (src) => sections.map((_, j) => quant(runs.map((_, k) => src[k][j]), PS).map((v) => (v == null ? null : Math.round(v * 10) / 10)));

// top width of the water surface r metres above the lowest point of each DEM section, r = 0 to 40 m: the app draws
// the water r metres above the normal river as it appears in the surface model, so it uses the same reference
const topWidth = sections.map((s) => {
  const tab = s.table;
  return Array.from({ length: 41 }, (_, r) => tab[Math.min(tab.length - 1, r * 2)][2]);
});

const out = join(ROOT, 'app/data/rasuwa');
mkdirSync(out, { recursive: true });
// encode: uint32 series, uint32 minutes, then zigzag(minute-to-minute difference) as low bytes [all], high bytes [all]
const series = 3 * nSec;
const nAll = series * NMIN;
const packed = new Uint8Array(8 + 2 * nAll);
new DataView(packed.buffer).setUint32(0, series, true);
new DataView(packed.buffer).setUint32(4, NMIN, true);
for (let s = 0; s < series; s++) {
  for (let m = 0; m < NMIN; m++) {
    const i = s * NMIN + m;
    const d = bands[i] - (m ? bands[i - 1] : 0);
    if (d < -32768 || d > 32767) throw new Error(`model_rise: step of ${d} cm at series ${s}, minute ${m} does not fit 16 bits`);
    const z = ((d << 1) ^ (d >> 31)) & 0xffff;
    packed[8 + i] = z & 0xff;
    packed[8 + nAll + i] = z >> 8;
  }
}
writeFileSync(join(out, 'model_rise.bin'), gzipSync(packed, { level: 9 }));
writeFileSync(
  join(out, 'model.json'),
  JSON.stringify({
    note: 'Rise of the water above the normal river, from the runs used for the bands in research/methods.md 4.6 (both roughness structures). 5 / 50 / 95 % across runs. Model output, graded UNCERTAIN.',
    runs: runs.length,
    structures: { uniform: runs.filter((r) => r.structure === 'uniform').length, jarrett: runs.filter((r) => r.structure === 'jarrett').length },
    minute0: '08:44',
    minutes: NMIN,
    bands: ['p5', 'p50', 'p95'],
    riseFile: 'model_rise.bin (gzip; Int16 centimetres [band][section][minute] as zigzag minute-to-minute differences)',
    sections: sections.map((s) => s.km),
    peakQ: per(peakQ),
    peakRise: per(peakRise),
    arrivalMin: per(arrive), // minutes after 08:00
    topWidth, // m, per section, for a rise of 0..40 m
  }),
);
console.log(`wrote ${out}: ${(bands.byteLength / 1e6).toFixed(2)} MB of bands`);
