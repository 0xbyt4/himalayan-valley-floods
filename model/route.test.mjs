// node --test model/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pulse, route } from './route.mjs';

// a uniform trapezoidal valley: 10 m bed, 1:2 banks, every 500 m over 40 km
function valley(nx = 81, slope = 0.004) {
  const table = [];
  for (let h = 0; h <= 60; h += 0.5) table.push([h, 10 * h + 2 * h * h, 10 + 4 * h, 10 + 2 * h * Math.sqrt(5)]);
  return Array.from({ length: nx }, (_, i) => ({ km: i * 0.5, slope, bed_m: 1000 - i * 500 * slope, table }));
}

test('base flow with tributaries stays steady when nothing changes upstream', () => {
  const baseAt = (km) => 300 + (km > 10 ? 400 : 0) + (km > 30 ? 1500 : 0);
  const res = route({ sections: valley(), n: 0.05, inflow: () => 300, baseAt, tEnd: 4 * 3600, dt: 15, watchKm: [5, 20, 39] });
  for (const w of res.watch) {
    const lo = Math.min(...w.q);
    const hi = Math.max(...w.q);
    assert.ok(hi - lo < 1e-6 * hi, `drift at km ${w.km}: ${lo} to ${hi}`);
  }
});

test('the flood volume above base is conserved without the loss term', () => {
  const base = 300;
  const volume = 20e6;
  const inflow = pulse({ base, qPeak: 8000, volume, rise: 600 });
  const dt = 15;
  const res = route({ sections: valley(), n: 0.05, inflow, baseAt: () => base, tEnd: 12 * 3600, dt, watchKm: [40] });
  const q = res.watch[0].q;
  let out = 0;
  for (let i = 1; i < q.length; i++) out += ((q[i] + q[i - 1]) / 2 - base) * dt;
  assert.ok(Math.abs(out - volume) < 0.02 * volume, `out ${(out / 1e6).toFixed(2)} Mm3 vs in ${volume / 1e6} Mm3`);
});

test('the peak attenuates and arrives later downstream', () => {
  const inflow = pulse({ base: 300, qPeak: 8000, volume: 20e6, rise: 600 });
  const res = route({ sections: valley(), n: 0.05, inflow, baseAt: () => 300, tEnd: 8 * 3600, dt: 15, watchKm: [10, 40] });
  const [a, b] = res.watch;
  const peakAt = (w) => w.q.indexOf(Math.max(...w.q));
  assert.ok(Math.max(...b.q) < Math.max(...a.q));
  assert.ok(peakAt(b) > peakAt(a));
});

// a channel with a wide bench 4 m up: one hydraulic radius for the whole section would make Q fall at the spill
function benchValley(nx = 81, slope = 0.004) {
  const dx = 30;
  const z = Array.from({ length: 41 }, (_, i) => {
    const d = Math.abs(i - 20) * dx;
    if (d <= 30) return 0;
    if (d <= 300) return 4;
    return 4 + (d - 300) * 0.5;
  });
  const table = [];
  for (let h = 0; h <= 60; h += 0.5) {
    let a = 0;
    let b = 0;
    let f = 0;
    for (const zi of z) {
      const d = Math.max(0, h - zi);
      if (d > 0) {
        a += d * dx;
        b += dx;
        f += dx * d ** (5 / 3);
      }
    }
    table.push([h, a, b, b + 2 * h, f]);
  }
  return Array.from({ length: nx }, (_, i) => ({ km: i * 0.5, slope, bed_m: 1000 - i * 500 * slope, table }));
}

test('a section with a bench gives a smooth, single-peaked flood that never drops below base', () => {
  const base = 50;
  const inflow = pulse({ base, qPeak: 3000, volume: 15e6, rise: 900 });
  const res = route({ sections: benchValley(), n: 0.05, inflow, baseAt: () => base, tEnd: 10 * 3600, dt: 15, watchKm: [20, 40] });
  for (const w of res.watch) {
    assert.ok(Math.min(...w.q) >= base * 0.999, `dip below base at km ${w.km}: ${Math.min(...w.q)}`);
    let turns = 0;
    for (let i = 2; i < w.q.length; i++) {
      const a = w.q[i - 1] - w.q[i - 2];
      const b = w.q[i] - w.q[i - 1];
      if (Math.abs(a) > 0.5 && Math.abs(b) > 0.5 && Math.sign(a) !== Math.sign(b)) turns++;
    }
    assert.ok(turns <= 1, `${turns} turning points at km ${w.km}`);
  }
});

test('the loss term removes the stated fraction of the flood volume', () => {
  const base = 300;
  const volume = 20e6;
  const dt = 15;
  for (const loss of [0.001, 0.01]) {
    const inflow = pulse({ base, qPeak: 8000, volume, rise: 600 });
    const res = route({ sections: valley(), n: 0.05, inflow, baseAt: () => base, tEnd: 14 * 3600, dt, watchKm: [40], lossPerKm: loss });
    const q = res.watch[0].q;
    let out = 0;
    for (let i = 1; i < q.length; i++) out += ((q[i] + q[i - 1]) / 2 - base) * dt;
    const expect = Math.exp(-loss * 40);
    assert.ok(Math.abs(out / volume - expect) < 0.01, `loss ${loss}: out/in ${(out / volume).toFixed(3)} vs ${expect.toFixed(3)}`);
  }
});

test('long time steps on a steep valley stay stable and conserve the flood volume', () => {
  const base = 300;
  const volume = 20e6;
  const dt = 120; // the wave crosses a 500 m reach within one step
  const inflow = pulse({ base, qPeak: 8000, volume, rise: 600 });
  const res = route({ sections: valley(81, 0.05), n: 0.035, inflow, baseAt: () => base, tEnd: 10 * 3600, dt, watchKm: [40] });
  assert.equal(res.zeroOutflowSteps, 0);
  const q = res.watch[0].q;
  let out = 0;
  for (let i = 1; i < q.length; i++) out += ((q[i] + q[i - 1]) / 2 - base) * dt;
  assert.ok(Math.abs(out - volume) < 0.02 * volume, `out ${(out / 1e6).toFixed(2)} Mm3`);
});

test('the pulse releases the volume it is given', () => {
  const dt = 5;
  for (const [qPeak, volume, rise] of [[8000, 20e6, 600], [60000, 16e6, 900]]) {
    const f = pulse({ base: 0, qPeak, volume, rise });
    let v = 0;
    for (let t = dt; t < 48 * 3600; t += dt) v += ((f(t) + f(t - dt)) / 2) * dt;
    assert.ok(Math.abs(v - volume) < 0.01 * volume, `${(v / 1e6).toFixed(2)} vs ${volume / 1e6} Mm3`);
  }
});
