// node --test model/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { breachEnsemble, breachRun, empirical, empiricalMarkers } from './breach.mjs';

const near = (actual, expected, rel, msg) =>
  assert.ok(Math.abs(actual - expected) <= rel * expected, `${msg}: ${actual.toFixed(1)} vs ${expected} (+/-${rel * 100}%)`);

// research/methods.md 3.3: H_d = 30 m, V_l = 5e6 m3, full breach
test('empirical relations reproduce the worked example', () => {
  const H = 30;
  const V = 5e6;
  near(empirical.costa1985H(H), 1406, 0.01, 'E1');
  near(empirical.costa1985V(V), 1655, 0.01, 'E2');
  near(empirical.costa1985HV(H, V), 1561, 0.01, 'E3');
  near(empirical.costaSchuster1988(H, V), 1540, 0.01, 'E4');
  near(empirical.froehlich1995(V, H), 3900, 0.01, 'E8');
  near(empirical.pengZhang2012(H, V, 'low'), 420, 0.01, 'E10 low');
  near(empirical.pengZhang2012(H, V, 'medium'), 1444, 0.01, 'E10 medium');
  near(empirical.pengZhang2012(H, V, 'high'), 7266, 0.01, 'E10 high');
  near(empirical.criticalFlow(H), 15440, 0.01, 'critical flow');
});

test('markers are labelled and the Froehlich band brackets its value', () => {
  const m = empiricalMarkers(30, 5e6);
  assert.equal(m.length, 6);
  const fr = m.find((x) => x.id === 'E8');
  assert.ok(fr.band[0] < fr.q && fr.q < fr.band[1]);
});

test('a breach run conserves mass and stays under the critical-flow bound', () => {
  const p = { hD: 30, vL: 5e6, kmh: 40, hB: 30, r: 1, z: 1, m: 2.5 };
  const res = breachRun(p);
  assert.ok(res.released <= p.vL * 1.001, `released ${res.released} > lake ${p.vL}`);
  assert.ok(res.released >= p.vL * 0.95, `lake should drain: released ${res.released}`);
  // with b = r * depth = depth and a little side slope, the peak cannot exceed a few times g^0.5 h^2.5
  assert.ok(res.qPeak < 3 * empirical.criticalFlow(30), `peak ${res.qPeak}`);
  assert.ok(res.qPeak > 0);
});

test('faster erosion gives a higher peak (small-lake regime)', () => {
  const base = { hD: 30, vL: 5e6, hB: 30, r: 1, z: 1, m: 2.5 };
  const slow = breachRun({ ...base, kmh: 10 }).qPeak;
  const fast = breachRun({ ...base, kmh: 100 }).qPeak;
  assert.ok(fast > slow * 1.5, `fast ${fast} vs slow ${slow}`);
});

test('the ensemble is reproducible and ordered', () => {
  const a = breachEnsemble({ hD: 30, vL: 5e6, n: 120, seed: 7 });
  const b = breachEnsemble({ hD: 30, vL: 5e6, n: 120, seed: 7 });
  assert.equal(a.qPeak.p50, b.qPeak.p50);
  assert.ok(a.qPeak.p5 < a.qPeak.p50 && a.qPeak.p50 < a.qPeak.p95);
  // the band should be wide: methods.md expects a factor of 3 to 10 overall
  assert.ok(a.qPeak.p95 / a.qPeak.p5 > 2, `spread ${a.qPeak.p95 / a.qPeak.p5}`);
  assert.equal(a.hydro.t.length, a.hydro.p50.length);
});
