// Rasuwa flood explorer: 3D terrain, the modelled water, reported events and their sources.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Flood2D } from './flood2d.mjs?v=3';
import { InfraLayer, RAMP_CSS, RiverLayer } from './layers.mjs?v=3';
import { Terrain } from './terrain.mjs?v=3';
import { buildTimeline, clockOf, esc, renderAbout, renderEvent, renderHowSure, renderFeature, renderLegendMini, renderLegendRows, renderPlace, renderProfile, renderReach, renderSources, renderXsec, updatePlace } from './ui.mjs?v=4';
import { dataUrl, decodeRise, fetchGz } from './decode.mjs?v=3';
import { Model, Water } from './water.mjs?v=3';

const BASE = 'data/rasuwa';
// a file that fails to load at the start stops the page; say so instead of showing "Loading" for ever
const failed = (e) => {
  const el = document.getElementById('loading');
  if (el) el.textContent = `Could not load the map data (${e?.message ?? e}). Please reload the page.`;
};
addEventListener('unhandledrejection', (e) => failed(e.reason));
addEventListener('error', (e) => failed(e.error ?? e.message));
const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// a missing file gives null; some hosts answer a missing path with the page itself, so a body that is not JSON does too
const json = (url) => fetch(dataUrl(url)).then((r) => (r.ok ? r.json().catch(() => null) : null));
const runs2d = await json(`${BASE}/layers/flood2d/index.json`);
// a run named in the address only if it exists; otherwise the central run
let run2d = (runs2d?.runs.find((r) => r.name === qs.get('scenario2d')) ?? runs2d?.runs.find((r) => r.name === 'central') ?? runs2d?.runs[0])?.name;
const [scene0, meta, bandsBuf, facts, events, osm, change, xsMeta, xsBuf, f2meta] = await Promise.all([
  json(`${BASE}/scene.json`),
  json(`${BASE}/model.json`),
  fetchGz(`${BASE}/model_rise.bin`),
  json(`${BASE}/facts.json`),
  json(`${BASE}/layers/events.json`),
  json(`${BASE}/layers/osm.json`),
  json(`${BASE}/layers/change.json`),
  json(`${BASE}/sections.json`),
  fetch(dataUrl(`${BASE}/sections.bin`)).then((r) => (r.ok ? r.arrayBuffer() : null)),
  run2d ? json(`${BASE}/layers/flood2d/${run2d}/meta.json`) : null,
]);
const xs = xsMeta && xsBuf ? { meta: xsMeta, z: new Float32Array(xsBuf) } : null;
if (!events) throw new Error('layers/events.json missing: run data/build_layers.py events');
facts.front = events.front;
const model = new Model(meta, decodeRise(bandsBuf));

// renderer, camera, light
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // sharper costs about a quarter more GPU on Retina screens
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('sky').after(renderer.domElement);
const scene = new THREE.Scene();
// the scene is drawn again only when something changed (see the loop at the end)
let dirty = true;
const markDirty = () => {
  dirty = true;
};
scene.fog = new THREE.Fog(0x6d756f, 30000, 120000);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 30, 500000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.zoomToCursor = true; // the wheel zooms toward the point under the pointer, not the middle of the view
controls.screenSpacePanning = false; // dragging with the right button moves over the ground
controls.listenToKeyEvents(window); // arrow keys pan
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 600;
controls.maxDistance = 220000;
scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x3a3328, 1.6));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.4);
sun.position.set(-30000, 40000, 10000);
scene.add(sun);

// river stations with a unit normal across the river
const st = scene0.stations.map(([km, x, z, bed]) => ({ km, x, z, bed }));
st.forEach((s, i) => {
  const a = st[Math.max(0, i - 3)];
  const b = st[Math.min(st.length - 1, i + 3)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz) || 1;
  s.tx = dx / l;
  s.tz = dz / l;
  s.nx = -s.tz;
  s.nz = s.tx;
});
// the station nearest to a chainage (stations are in chainage order; on a tie the upstream one)
const stationAt = (km) => {
  let lo = 0;
  let hi = st.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (st[mid].km < km) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(st[lo - 1].km - km) <= Math.abs(st[lo].km - km)) return st[lo - 1];
  return st[lo];
};

const terrain = new Terrain(scene, scene0, BASE, renderer);
await terrain.loadOverview();
const water = new Water(scene, st, model);
const river = new RiverLayer(scene, st, model, events.front);
// the 2-D flood map, when exported; it replaces the 1-D water sheets on the map (the 1-D bands stay in the panels)
let flood2d = f2meta ? new Flood2D(scene, terrain, `${BASE}/layers/flood2d/${run2d}`, f2meta) : null;
try {
  await flood2d?.init();
} catch (err) {
  console.warn('2D flood map not loaded:', err.message);
  flood2d.dispose();
  flood2d = null;
}
if (flood2d) water.setVisible(false);
// buildings, bridges and facilities: the building points (about 1 MB) are fetched when the layer is first switched on
let infra = null;
let infraLoading = null;
function ensureInfra() {
  if (infra || infraLoading || !osm) return infraLoading;
  infraLoading = fetch(dataUrl(`${BASE}/layers/buildings.bin`))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`buildings.bin: ${r.status}`))))
    .then((buf) => {
      infra = new InfraLayer(scene, osm, buf);
      infra.setResolution(innerWidth, innerHeight);
      applyLayers();
    })
    .catch((err) => console.warn('buildings not loaded:', err.message))
    .finally(() => {
      infraLoading = null;
    });
  return infraLoading;
}
if (change) terrain.setOverlay(`${BASE}/layers/change`, false);
const layerOn = { river: true, events: true, infra: false, change: false };
const setResolution = () => {
  river.setResolution(innerWidth, innerHeight);
  infra?.setResolution(innerWidth, innerHeight);
};
setResolution();
$('loading').remove();

// places shown on the map and in the chapter list (the lakes stay in the data but not on the map)
const PLACES = scene0.places.filter((p) => !/lake/i.test(p.name));
facts.profilePlaces = PLACES.filter((p) => ['Syabrubesi', 'Betrawati', 'Galchhi gauge', 'Malekhu', 'Mugling', 'Devghat'].includes(p.name)).map((p) => ({ km: p.chainage_km, name: p.name.replace(' gauge', '') }));
const short = (n) =>
  ({ Devighat: 'Devighat (Nuwakot)', Devghat: 'Devghat (Chitwan)' })[n] ?? n.replace(' gauge', '').replace(' (CLaSH)', '').replace(' (Budhi Gandaki mouth)', '');

// labels
const labelLayer = $('labels');
const labels = [];
function addLabel(html, cls, getPos, onClick, layer = null) {
  const d = document.createElement('div');
  d.className = `lab ${cls}`;
  d.innerHTML = `${html}<i></i>`;
  if (onClick) d.onclick = onClick;
  labelLayer.appendChild(d);
  labels.push({ d, getPos, layer });
  return d;
}
const placeLabel = new Map();
for (const p of PLACES) {
  const s = stationAt(p.chainage_km);
  const pos = new THREE.Vector3(s.x, s.bed + 150, s.z);
  placeLabel.set(p.name, addLabel(`${esc(short(p.name))}<small>km ${p.chainage_km}</small>`, '', () => pos, () => select(p, true)));
}
let frontPos = null;
addLabel('flood front', 'front', () => frontPos);

// river layer labels: a mark every 10 km and the reported front zone above Syabrubesi
for (let k = 10; k <= 180; k += 10) {
  const s = stationAt(k);
  const pos = new THREE.Vector3(s.x, s.bed + 40, s.z);
  addLabel(`km ${k}`, 'kmlab', () => pos, null, 'river');
}
let upperFrontPos = null;
addLabel('debris flow front, from reports', 'upfront', () => upperFrontPos, null, 'river');

// reported event points
const ICON = { source: '&#10035;', landslide: '&#9650;', lake: '&#9670;', gauge: '&#9646;', evidence: '&#8597;' };
for (const p of events.points) {
  const pos = new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z) + 520, p.z); // above the place labels
  addLabel(`<span class="ic">${ICON[p.kind] || '&#8226;'}</span>${esc(p.name)}`, 'evt', () => pos, () => showEvent(p), 'events');
}
function showEvent(p) {
  selected = null;
  markChapter(null);
  renderEvent($('place'), p, facts);
  $('place').hidden = false;
}

// camera moves
const fly = { t: 1, from: null, to: null };
function flyTo(target, pos) {
  fly.from = { target: controls.target.clone(), pos: camera.position.clone() };
  fly.to = { target: new THREE.Vector3(...target), pos: new THREE.Vector3(...pos) };
  fly.t = 0;
}
function viewOf(p) {
  // stand upstream and to one side of the place, looking down the valley
  const s = stationAt(p.chainage_km);
  return {
    target: [s.x + s.tx * 1500, s.bed, s.z + s.tz * 1500],
    pos: [s.x - s.tx * 5200 + s.nx * 2600, s.bed + 2600, s.z - s.tz * 5200 + s.nz * 2600],
  };
}
const whole = (() => {
  const xs = st.map((s) => s.x);
  const zs = st.map((s) => s.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  // close enough that the edge of the terrain model stays out of the frame
  return { target: [cx, 800, cz], pos: [cx + 25000 * 0.66, 44000, cz + 78000 * 0.66] };
})();

// river index: the places in river order; the line fills with water down to the front (updateIndex)
const chapList = $('chapList');
const chapterLink = new Map();
const addChapter = (label, km, onClick, cls = '') => {
  const li = document.createElement('li');
  li.className = cls;
  li.innerHTML = `<button type="button"><span>${esc(label)}</span><span class="km">${km == null ? '' : `km ${Math.round(km)}`}</span></button>`;
  li.querySelector('button').onclick = onClick;
  chapList.appendChild(li);
  return li;
};
addChapter('Whole river', null, () => {
  selected = null;
  renderSelected();
  flyTo(whole.target, whole.pos);
  markChapter(null);
}, 'whole');
for (const p of PLACES) chapterLink.set(p.name, addChapter(short(p.name), p.chainage_km, () => select(p, true)));
const markChapter = (name) => {
  for (const [n, li] of chapterLink) li.classList.toggle('on', n === name);
  for (const [n, d] of placeLabel) d.classList.toggle('sel', n === name);
};
const frontMark = document.createElement('div');
frontMark.className = 'front';
frontMark.innerHTML = '<i></i>';
chapList.appendChild(frontMark);
// the front dot sits between the two rows around its chainage; rows down to it are wet
function updateIndex(km) {
  const rows = PLACES.map((p) => chapterLink.get(p.name));
  const cap = $('frontcap').querySelector('span');
  frontMark.hidden = km == null;
  if (km == null) {
    chapList.style.setProperty('--wet', '0px');
    for (const r of rows) r.classList.remove('wet');
    cap.textContent = 'collapse at 08:37';
    return;
  }
  cap.textContent = `flood front at ${clockOf(minute)} \u00b7 km ${Math.round(km)}`;
  if (!chapList.offsetParent) return; // the index is not shown (phone)
  const kms = PLACES.map((p) => p.chainage_km);
  const y = (j) => rows[j].offsetTop + rows[j].offsetHeight / 2;
  let i = kms.findIndex((k) => k > km);
  if (i < 0) i = kms.length;
  const top = i === 0 ? y(0) : i === kms.length ? y(kms.length - 1) : y(i - 1) + ((km - kms[i - 1]) / (kms[i] - kms[i - 1])) * (y(i) - y(i - 1));
  frontMark.style.top = `${top}px`;
  chapList.style.setProperty('--wet', `${Math.max(0, top - 8)}px`);
  rows.forEach((r, j) => r.classList.toggle('wet', kms[j] <= km));
}

// selection
let selected = null;
function select(p, move) {
  selected = p;
  markChapter(p.name);
  if (move) {
    const v = viewOf(p);
    flyTo(v.target, v.pos);
  }
  if (p.chainage_km >= model.km[0]) $('xsecKm').value = p.chainage_km;
  renderSelected();
  if (!$('xsec').hidden) drawXsec();
}
const drawXsec = () => xs && renderXsec($('xsecSvg'), $('xsecWhere'), xs, model, Number($('xsecKm').value), minute);
function renderSelected() {
  const el = $('place');
  updateStepper();
  if (!selected) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  let f2 = null;
  if (flood2d?.visible) {
    const s = stationAt(selected.chainage_km);
    const g = flood2d.meta.gauges[selected.name.replace(' gauge', '')];
    f2 = { meta: flood2d.meta, gauge: g, river: flood2d.at(s.x, s.z, 300), point: flood2d.at(selected.x, selected.z, 60) };
  }
  renderPlace(el, selected, minute, model, facts, f2);
}

// time
const slider = $('slider');
const updateTrack = buildTimeline($('track'), slider, facts, (m) => {
  minute = m;
  slider.value = m;
  markDirty();
});
const t0 = Number(qs.get('t') ?? -14);
let minute = Number.isFinite(t0) ? Math.max(-14, Math.min(600, t0)) : -14;
slider.value = minute;
let playing = false;
let playUntil = null; // a tour step stops the play here
let speed = 60;
slider.oninput = () => {
  minute = Number(slider.value);
  playUntil = null; // a hand on the slider ends a tour step's stop time
};
const PLAY = 'M7 4.5v15l13-7.5z';
const PAUSE = 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z';
function setPlaying(on) {
  if (on && minute >= 600) minute = -14; // start again from 08:30
  playing = on;
  $('playIcon').setAttribute('d', playing ? PAUSE : PLAY);
  $('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
}
$('play').onclick = () => {
  playUntil = null;
  setPlaying(!playing);
};
const setSpeed = (v) => {
  speed = v;
  document.querySelectorAll('[data-speed]').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.speed) === v);
    b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === v));
  });
};
document.querySelectorAll('[data-speed]').forEach((a) => (a.onclick = () => setSpeed(Number(a.dataset.speed))));

// switches
const pick = (attr, fn) =>
  document.querySelectorAll(`[${attr}]`).forEach((a) => {
    a.onclick = () => {
      document.querySelectorAll(`[${attr}]`).forEach((b) => {
        b.classList.toggle('on', b === a);
        b.setAttribute('aria-pressed', String(b === a));
      });
      fn(a.getAttribute(attr));
    };
  });
pick('data-tex', (k) => terrain.setImagery(k));
pick('data-band', (k) => water.showUpper(k === 'p95'));
pick('data-model', (k) => {
  const two = k === '2d' && flood2d;
  flood2d?.setVisible(Boolean(two));
  water.setVisible(!two);
  $('bandField').hidden = Boolean(two);
  $('runField').hidden = !two || !flood2d || runs2d.runs.length < 2;
  applyLayers();
  renderSelected();
});
if (!flood2d) {
  $('modelRow').remove();
  $('bandField').hidden = false;
}
// the exported 2-D runs: switching loads the other run in place
const runRow = $('runRow');
const RUN_LABEL = { lower: 'Smaller flood', central: 'Middle', upper: 'Larger flood' };
const runHint = (name) => {
  const r = runs2d.runs.find((x) => x.name === name);
  if (r) $('runHint').textContent = `${r.volume_Mm3} million m³ of water at Syabrubesi, peak ${r.q_peak.toLocaleString('en')} m³/s. Each run fits ${r.hits} of ${runs2d.checks} reported times, levels and flows.`;
};
if (flood2d && runs2d.runs.length > 1) {
  runRow.innerHTML = runs2d.runs.map((r) => `<button type="button" data-run="${esc(r.name)}" class="${r.name === run2d ? 'on' : ''}" aria-pressed="${r.name === run2d}">${esc(RUN_LABEL[r.label] ?? r.label)}</button>`).join('');
  runHint(run2d);
  let request = 0; // a later click wins over a run still loading
  const markRun = (name) => {
    document.querySelectorAll('[data-run]').forEach((a) => {
      a.classList.toggle('on', a.dataset.run === name);
      a.setAttribute('aria-pressed', String(a.dataset.run === name));
    });
    runHint(name);
  };
  pick('data-run', async (name) => {
    const ask = ++request;
    runHint(name);
    const m = await json(`${BASE}/layers/flood2d/${name}/meta.json`);
    if (ask !== request) return;
    if (!m) {
      markRun(run2d);
      return;
    }
    const next = new Flood2D(scene, terrain, `${BASE}/layers/flood2d/${name}`, m);
    next.visible = false; // hidden until it replaces the current run
    try {
      await next.init();
    } catch (err) {
      console.warn('2D run not loaded:', err.message);
      next.dispose();
      if (ask === request) markRun(run2d);
      return;
    }
    if (ask !== request) {
      next.dispose();
      return;
    }
    flood2d.dispose();
    flood2d = next;
    flood2d.onChange = markDirty;
    run2d = name;
    // the state the switches show now, not the state when the click started
    flood2d.trace = document.querySelector('[data-trace]').getAttribute('aria-checked') === 'true';
    flood2d.setVisible(document.querySelector('[data-model="2d"]').classList.contains('on'));
    flood2d.update(minute);
    applyLayers();
    renderSelected();
    markDirty();
  });
} else $('runField').hidden = true;
const traceLink = document.querySelector('[data-trace]');
traceLink.onclick = () => {
  const on = traceLink.getAttribute('aria-checked') !== 'true';
  traceLink.setAttribute('aria-checked', String(on));
  water.showTrace(on);
  if (flood2d) flood2d.trace = on;
};
// follow the front: the chainage to follow at each minute, worked out once. Above Syabrubesi it is the middle of the
// reported front zone, below it the modelled front; before the collapse, the source. The raw track jumps where the
// zone hands over to the model (about 11 km in a minute) and has gaps, so it is filled, kept from going back and
// averaged over 8 minutes: the camera then moves on at an even pace instead of waiting and then rushing.
const FOLLOW_STEP = 0.25; // minutes
const followTrack = (() => {
  const n = Math.round((600 + 14) / FOLLOW_STEP) + 1;
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const m = -14 + i * FOLLOW_STEP;
    const zone = river.upperFront(m + 44);
    const zk = zone.reach != null && zone.reach < model.km[0] - 0.2 ? ((zone.passed ?? 0) + zone.reach) / 2 : null;
    raw[i] = model.front(m) ?? zk ?? (m + 44 < 37 ? 0 : NaN);
  }
  // fill the gaps linearly between known points, then never go back
  let lastI = 0;
  for (let i = 1; i < n; i++) {
    if (Number.isNaN(raw[i])) continue;
    for (let j = lastI + 1; j < i; j++) raw[j] = raw[lastI] + ((raw[i] - raw[lastI]) * (j - lastI)) / (i - lastI);
    lastI = i;
  }
  for (let j = lastI + 1; j < n; j++) raw[j] = raw[lastI];
  for (let i = 1; i < n; i++) raw[i] = Math.max(raw[i], raw[i - 1]);
  const w = Math.round(4 / FOLLOW_STEP); // +- 4 minutes
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i - w; j <= i + w; j++) s += raw[Math.min(n - 1, Math.max(0, j))];
    out[i] = s / (2 * w + 1);
  }
  return out;
})();
// the camera path of `follow the front`, worked out once along the follow track: the camera stands behind the front
// on the valley axis (12 km of river around it) and looks 2.5 km ahead. The axis direction is averaged over 10
// minutes, so the camera turns slowly instead of with every bend (at 1 minute per second, about 10 seconds).
const followPath = (() => {
  const n = followTrack.length;
  const idx = Array.from(followTrack, (km) => st.indexOf(stationAt(km)));
  let ang = idx.map((i) => {
    const a = st[Math.max(0, i - 60)];
    const b = st[Math.min(st.length - 1, i + 60)];
    return Math.atan2(b.z - a.z, b.x - a.x);
  });
  for (let i = 1; i < n; i++) ang[i] = ang[i - 1] + Math.atan2(Math.sin(ang[i] - ang[i - 1]), Math.cos(ang[i] - ang[i - 1])); // unwrap
  const w = Math.round(3 / FOLLOW_STEP);
  const wa = Math.round(5 / FOLLOW_STEP); // the direction over 10 minutes
  for (let pass = 0; pass < 2; pass++) {
    const prev = ang;
    ang = prev.map((_, i) => {
      let s = 0;
      for (let j = i - wa; j <= i + wa; j++) s += prev[Math.min(n - 1, Math.max(0, j))];
      return s / (2 * wa + 1);
    });
  }
  // the point followed: the river line averaged over 4 km (no bends), then over the same 6 minutes
  const line = idx.map((i) => {
    let x = 0;
    let z = 0;
    let c = 0;
    for (let j = Math.max(0, i - 20); j <= Math.min(st.length - 1, i + 20); j++, c++) {
      x += st[j].x;
      z += st[j].z;
    }
    return [x / c, z / c, st[i].bed];
  });
  const anchor = line.map((_, i) => {
    const sum = [0, 0, 0];
    for (let j = i - w; j <= i + w; j++) line[Math.min(n - 1, Math.max(0, j))].forEach((v, k) => (sum[k] += v));
    return sum.map((v) => v / (2 * w + 1));
  });
  return anchor.map(([x, z, bed], i) => {
    const ax = Math.cos(ang[i]);
    const az = Math.sin(ang[i]);
    return { pos: [x - ax * 4500 - az * 1800, bed + 2200, z - az * 4500 + ax * 1800], target: [x + ax * 2500, bed + 100, z + az * 2500] };
  });
})();
const followTrackKm = (m) => {
  if (m + 44 < 37) return null;
  const x = (Math.min(600, Math.max(-14, m)) + 14) / FOLLOW_STEP;
  const i = Math.min(followTrack.length - 2, Math.floor(x));
  return followTrack[i] + (followTrack[i + 1] - followTrack[i]) * (x - i);
};
function followView(m) {
  const x = (Math.min(600, Math.max(-14, m)) + 14) / FOLLOW_STEP;
  const i = Math.min(followPath.length - 2, Math.floor(x));
  const u = x - i;
  const [a, b] = [followPath[i], followPath[i + 1]];
  const pos = a.pos.map((v, k) => v + (b.pos[k] - v) * u);
  const target = a.target.map((v, k) => v + (b.target[k] - v) * u);
  pos[1] = Math.max(pos[1], terrain.heightAt(pos[0], pos[2]) + 1500); // clear of steep walls near the source
  return { pos, target };
}
let follow = false;
function setFollow(on) {
  follow = on;
  $('followBtn').setAttribute('aria-pressed', String(on));
  if (follow) {
    const v = followView(minute); // glide to the front first, then follow it
    flyTo(v.target, v.pos);
  }
}
$('followBtn').onclick = () => setFollow(!follow);
// imagery labels from the scene dates
const span = (dates) => {
  const d = dates.map((x) => new Date(`${x}T00:00:00Z`));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const f = (x, y) => `${x.getUTCDate()} ${MON[x.getUTCMonth()]}${y ? ` ${x.getUTCFullYear()}` : ''}`;
  return `${f(d[0], false)} - ${f(d.at(-1), true)}`;
};
if (!terrain.hasImagery) {
  for (const b of document.querySelectorAll('[data-tex]')) b.disabled = true;
  $('texHint').textContent = 'Satellite images are not built (data/build_app.py imagery); the terrain shows height colours.';
} else $('texHint').textContent = `Before: ${span(scene0.imagery.before.dates)} · after: ${span(scene0.imagery.after.dates)}. Copernicus Sentinel-2, clouds masked.`;

// panels: Layers and view, About, and the Charts sheet with one tab at a time. One side panel is open at a time.
const PANELS = { settings: 'openSettings', info: 'openInfo', charts: 'openCharts' };
function openPanel(id, on = true) {
  if (on) for (const other of Object.keys(PANELS)) if (other !== id && other !== 'charts' && id !== 'charts') openPanel(other, false);
  $(id).hidden = !on;
  $(PANELS[id]).setAttribute('aria-expanded', String(on));
  document.body.classList.toggle(`${id}-open`, on);
  markDirty();
}
const CHART_TABS = ['profile', 'xsec', 'reach'];
function showTab(id) {
  for (const k of CHART_TABS) {
    $(k).hidden = k !== id;
    document.querySelector(`[data-tab="${k}"]`).setAttribute('aria-selected', String(k === id));
  }
  if (id === 'profile') renderProfile($('profileSvg'), model, minute, facts);
  if (id === 'xsec') drawXsec();
  openPanel('charts', true);
}
// toggle(id) opens or closes a chart tab or the sources; capture mode and the URL use it
const toggle = (id) => {
  if (id === 'sources') return openPanel('info', $('info').hidden);
  if (!CHART_TABS.includes(id)) return;
  if ($(id).hidden || $('charts').hidden) showTab(id);
  else openPanel('charts', false);
};
for (const b of document.querySelectorAll('[data-tab]')) b.onclick = () => showTab(b.dataset.tab);
$('openCharts').onclick = () => ($('charts').hidden ? showTab(CHART_TABS.find((k) => !$(k).hidden) ?? 'profile') : openPanel('charts', false));
$('openSettings').onclick = () => openPanel('settings', $('settings').hidden);
$('openInfo').onclick = () => openPanel('info', $('info').hidden);
$('openSources').onclick = (e) => {
  e.preventDefault();
  openPanel('info', true);
  $('sources').scrollIntoView();
};
for (const b of document.querySelectorAll('[data-close-panel]')) b.onclick = () => openPanel(b.dataset.closePanel, false);
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-settings]')) openPanel('settings', true);
  if (e.target.closest('[data-close-card]')) {
    selected = null;
    markChapter(null);
    renderSelected();
  }
});
$('xsecKm').oninput = drawXsec;
if (!xs) document.querySelector('[data-tab="xsec"]').remove();

const hideUi = () => {
  const on = document.body.classList.toggle('noui');
  $('hideUi').setAttribute('aria-pressed', String(on));
  markDirty();
};
$('hideUi').onclick = hideUi;
// keys: Space play, left and right place, L layers, H hide panels, Esc close
const PLACE_ORDER = PLACES.slice().sort((a, b) => a.chainage_km - b.chainage_km);
function stepPlace(d) {
  const i = selected ? PLACE_ORDER.indexOf(selected) : -1;
  const next = PLACE_ORDER[Math.min(PLACE_ORDER.length - 1, Math.max(0, i + d))];
  if (next) select(next, true);
}
addEventListener('keydown', (e) => {
  if (/input|textarea|select/i.test(document.activeElement?.tagName || '') || e.metaKey || e.ctrlKey || e.altKey) return;
  const inButton = document.activeElement?.tagName === 'BUTTON';
  if (e.key === 'h' || e.key === 'H') hideUi();
  else if (e.key === 'l' || e.key === 'L') openPanel('settings', $('settings').hidden);
  else if (e.key === 'Escape') {
    if (!$('intro').hidden) closeIntro();
    else for (const id of Object.keys(PANELS)) openPanel(id, false);
  } else if (e.key === ' ' && !inButton) {
    e.preventDefault();
    setPlaying(!playing);
  } else if (e.key === 'ArrowRight' && e.shiftKey) stepPlace(1);
  else if (e.key === 'ArrowLeft' && e.shiftKey) stepPlace(-1);
});

// phone: the bottom sheet (time, place stepper, details) drags between a short and a half-height state
function updateStepper() {
  const name = $('stepName');
  if (!selected) {
    name.innerHTML = '<b>Whole river</b><span>pick a place with the arrows</span>';
    $('stepValue').textContent = '';
    return;
  }
  const i = PLACE_ORDER.indexOf(selected);
  name.innerHTML = `<b>${esc(short(selected.name))}</b><span>km ${Math.round(selected.chainage_km)} &middot; ${i + 1} of ${PLACE_ORDER.length} &middot; tap for details</span>`;
  const sec = model.sectionAt(selected.chainage_km);
  $('stepValue').textContent = sec == null ? '' : `+${model.rise(selected.chainage_km, minute, 1).toFixed(1)} m`;
}
$('prevPlace').onclick = () => stepPlace(-1);
$('nextPlace').onclick = () => stepPlace(1);
$('stepName').onclick = () => {
  if (!selected) stepPlace(1);
  document.body.classList.toggle('sheet-half');
};
{
  let y0 = null;
  const h = $('handle');
  h.addEventListener('pointerdown', (e) => {
    y0 = e.clientY;
    h.setPointerCapture(e.pointerId);
  });
  h.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0;
    y0 = null;
    if (Math.abs(dy) < 6) document.body.classList.toggle('sheet-half');
    else document.body.classList.toggle('sheet-half', dy < 0);
  });
}

// compass: the needle shows north; a click turns the view to north up, keeping distance and tilt
const needle = document.getElementById('needle');
$('compass').onclick = () => {
  const off = camera.position.clone().sub(controls.target);
  const sph = new THREE.Spherical().setFromVector3(off);
  sph.theta = 0;
  const pos = new THREE.Vector3().setFromSpherical(sph).add(controls.target);
  flyTo(controls.target.toArray(), pos.toArray());
};
if (osm) renderReach($('reachBody'), osm, change, facts);
else document.querySelector('[data-tab="reach"]').remove();

// layers (each switch toggles on its own)
const applyLayers = () => {
  river.setVisible(layerOn.river);
  if (layerOn.infra && !infra) ensureInfra();
  infra?.setVisible(layerOn.infra);
  terrain.setOverlay(change ? `${BASE}/layers/change` : null, layerOn.change && Boolean(change));
  for (const a of document.querySelectorAll('[data-layer]')) a.setAttribute('aria-checked', String(layerOn[a.dataset.layer]));
  renderLegendMini($('legendMini'), layerOn, RAMP_CSS, flood2d?.visible ? flood2d.meta : null);
};
document.querySelectorAll('[data-layer]').forEach((a) => {
  a.onclick = () => {
    layerOn[a.dataset.layer] = !layerOn[a.dataset.layer];
    applyLayers();
  };
});
if (qs.has('layers')) {
  const want = qs.get('layers').split(',');
  for (const k of Object.keys(layerOn)) layerOn[k] = want.includes(k);
}
renderLegendRows($('settings'), RAMP_CSS, change);
applyLayers();

const raycaster = new THREE.Raycaster();
// double-click: fly to that point of the terrain, keeping the viewing direction
renderer.domElement.addEventListener('dblclick', (e) => {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(terrain.group.children.filter((o) => o.visible && !o.material.transparent), false)[0];
  if (!hit) return;
  const off = camera.position.clone().sub(controls.target);
  off.setLength(Math.min(Math.max(off.length() * 0.5, 2500), 12000));
  flyTo(hit.point.toArray(), hit.point.clone().add(off).toArray());
});
// home: back to the whole river
$('home').onclick = () => flyTo(whole.target, whole.pos);

// clicking a building, bridge or facility shows it in the side panel
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4 || !infra) return;
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = infra.pick(raycaster, camera.position.distanceTo(controls.target));
  if (!hit) return;
  selected = null;
  markChapter(null);
  renderFeature($('place'), hit, facts);
  $('place').hidden = false;
});
renderAbout($('aboutBody'), facts);
if (flood2d) {
  Promise.all(runs2d.runs.map((r) => json(`${BASE}/layers/flood2d/${r.name}/meta.json`))).then((metas) => {
    if (metas.every(Boolean) && metas[0].obs) renderHowSure($('howsure'), metas);
  });
}
$('openHowSure').onclick = (e) => {
  e.preventDefault();
  openPanel('info', true);
  $('howsure').scrollIntoView();
};
renderSources($('sourcesBody'), facts, scene0, model, flood2d ? runs2d : null);

// start view (URL: ?place=Galchhi&t=120&tex=after&band=p95&cam=follow for direct links and screenshots)
if (qs.get('tex') === 'after') document.querySelector('[data-tex="after"]')?.click();
if (qs.get('band') === 'p95') document.querySelector('[data-band="p95"]').click();
if (qs.get('cam') === 'follow') setFollow(true);
if (qs.get('profile')) toggle('profile');
if (qs.get('xsec')) toggle('xsec');
if (qs.get('noui')) hideUi();
const start = PLACES.find((p) => qs.get('place') && p.name.startsWith(qs.get('place')));
if (start) {
  select(start, false);
  const v = viewOf(start);
  controls.target.set(...v.target);
  camera.position.set(...v.pos);
} else {
  renderSelected();
  controls.target.set(...whole.target);
  camera.position.set(...whole.pos);
}

// first visit: a short introduction with two ways in. Not shown for a link to a moment (place, t, cam), with noui,
// in capture mode, or once it was closed before in this browser.
const introSeen = (() => {
  try {
    return localStorage.getItem('hvf-intro') === '1';
  } catch {
    return false;
  }
})();
function closeIntro() {
  $('intro').hidden = true;
  $('scrim').hidden = true;
  document.body.classList.remove('intro');
  try {
    localStorage.setItem('hvf-intro', '1');
  } catch {
    // private mode: the introduction shows again next time
  }
  markDirty();
}
if (!introSeen && !['place', 't', 'cam', 'noui', 'capture', 'layers', 'tex', 'tour', 'model'].some((k) => qs.has(k))) {
  $('introToll').innerHTML = `${esc(facts.toll.text)} <span class="g ${esc(facts.toll.grade)}">${esc(facts.toll.grade)}</span>`;
  $('intro').hidden = false;
  $('scrim').hidden = false;
  document.body.classList.add('intro');
  $('introTour').focus();
}
$('introTour').onclick = () => {
  closeIntro();
  startTour(0);
};
$('introFollow').onclick = () => {
  closeIntro();
  minute = -14;
  slider.value = minute;
  setSpeed(300); // about 2 minutes for the whole day
  setFollow(true);
  setPlaying(true);
};
$('introExplore').onclick = () => {
  closeIntro();
  minute = 120; // 10:44: the water is in the valley
  slider.value = minute;
};

// one place to set the view: the time, the place (flying there unless instant), the layers (the exact list), the
// imagery, follow, speed and playback. The tour uses it; the URL is read into it at the start.
function setState(s) {
  if (s.minute != null) {
    minute = s.minute;
    slider.value = minute;
  }
  if (s.tex) document.querySelector(`[data-tex="${s.tex}"]`)?.click();
  if (s.layers) {
    for (const k of Object.keys(layerOn)) layerOn[k] = s.layers.includes(k);
    applyLayers();
  }
  if (s.follow != null) setFollow(s.follow);
  if (s.follow) {
    selected = null; // the camera follows the front, not a place
    markChapter(null);
    renderSelected();
  } else if (s.place !== undefined) {
    const p = s.place && PLACES.find((q) => q.name === s.place);
    if (p) select(p, true);
    else {
      selected = null;
      markChapter(null);
      renderSelected();
      flyTo(whole.target, whole.pos);
    }
  }
  if (s.speed) setSpeed(s.speed);
  if (s.play != null) setPlaying(s.play);
  markDirty();
}

// the guided tour: eight steps through the day; each step sets its view, and step 4 plays the flood down the valley.
// The numbers in the texts are those in facts.json, layers/osm.json, layers/change.json and the 2-D run metadata.
const TOUR = [
  { title: 'The valley', text: 'This is the valley on the morning of 26 August 2026: 193 km of river, from the collapse source near the Nepal–China border to Devghat. The land is to scale.', s: { minute: -14, place: null, layers: ['river', 'events'], tex: 'before' } },
  { title: '08:37 · the collapse', text: 'A mass of rock and ice broke away above the Lhende Glacier. Seismometers recorded it at 08:37:10.', s: { minute: -7, place: 'Collapse source (CLaSH)', layers: ['events'], tex: 'before' } },
  { title: 'The first 36 km', text: 'Here the flood was a debris flow of ice, rock and water, which a water-only model cannot represent. The orange stretch shows where reports place the front; the reports disagree.', s: { minute: 6, place: 'Syabrubesi', layers: ['river', 'events'], tex: 'before' } },
  { title: 'Down the valley', text: "From Syabrubesi the model carries the water. Betrawati's gauge stopped sending at 09:20; the flood reached Galchhi near 10:28.", s: { minute: 36, layers: ['river'], tex: 'before', follow: true, speed: 300, play: true }, until: 104 },
  { title: '10:50 · Galchhi', text: 'At the Galchhi gauge the water rose by about 8.5 m (CLaSH) to 8.9 m (ICIMOD) near 10:50. The middle spread-map run gives +7.4 m at 10:42.', s: { minute: 126, place: 'Galchhi gauge', layers: ['river'], tex: 'before', follow: false } },
  { title: 'What the water reached', text: 'Coloured dots are buildings the modelled water reaches: 359 in the river-level model\'s most likely case. Reports count 7,570 affected private buildings in five districts. The model carries water only, starts at Syabrubesi and its levels run low, so it reaches far fewer.', s: { minute: 140, place: 'Trishuli Bazaar', layers: ['infra'], tex: 'before', follow: false } },
  { title: 'Before and after', text: 'The same valley from satellite, before and after. Pink marks vegetation lost on the valley floor: 1,706 ha along the whole river (our analysis, not an official damage map).', s: { minute: 600, place: 'Betrawati', layers: ['change'], tex: 'after', follow: false } },
  { title: 'How sure is this?', text: 'At Devghat the flood peaked at 16:00; the Flood Forecasting Division gives about 5,850 m³/s. Each of the three spread-map runs fits 7 of 9 reported times, levels and flows; the table in About shows which they miss.', s: { minute: 436, place: 'Devghat', layers: ['river'], tex: 'before', follow: false }, open: 'howsure' },
];
let tourStep = null;
function startTour(i) {
  tourStep = Math.max(0, Math.min(TOUR.length - 1, i));
  const st8 = TOUR[tourStep];
  document.body.classList.add('touring');
  $('tour').hidden = false;
  $('tourStep').textContent = `Tour · step ${tourStep + 1} of ${TOUR.length}`;
  $('tourTitle').textContent = st8.title;
  $('tourText').textContent = st8.text;
  $('tourBack').disabled = tourStep === 0;
  $('tourNext').textContent = tourStep === TOUR.length - 1 ? 'Finish' : 'Next';
  for (const id of Object.keys(PANELS)) openPanel(id, false);
  setPlaying(false);
  playUntil = st8.until ?? null;
  setState({ follow: false, ...st8.s });
  if (st8.open === 'howsure') {
    openPanel('info', true);
    // scroll the panel only (not the page), and stop below its sticky header
    const info = $('info');
    info.scrollTop += $('howsure').getBoundingClientRect().top - info.getBoundingClientRect().top - info.querySelector('.hd').offsetHeight - 8;
  }
}
function endTour() {
  tourStep = null;
  playUntil = null;
  $('tour').hidden = true;
  document.body.classList.remove('touring');
}
$('tourNext').onclick = () => (tourStep === TOUR.length - 1 ? endTour() : startTour(tourStep + 1));
$('tourBack').onclick = () => startTour(tourStep - 1);
$('tourExit').onclick = endTour;
addEventListener('keydown', (e) => {
  if (tourStep == null || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'ArrowRight' && !e.shiftKey) $('tourNext').click();
  if (e.key === 'ArrowLeft' && !e.shiftKey && tourStep > 0) $('tourBack').click();
  if (e.key === 'Escape') endTour();
});
if (qs.get('model') === '1d') document.querySelector('[data-model="1d"]')?.click();
if (qs.has('tour')) startTour(Number(qs.get('tour')) - 1 || 0);

// the address follows the view, so a copied link opens this moment (place, time, camera, layers, imagery, run)
const DEFAULT_LAYERS = 'river,events';
function stateUrl() {
  const p = new URLSearchParams();
  p.set('t', String(Math.round(minute)));
  if (selected) p.set('place', selected.name);
  if (follow) p.set('cam', 'follow');
  const on = Object.keys(layerOn).filter((k) => layerOn[k]).join(',');
  if (on !== DEFAULT_LAYERS) p.set('layers', on || 'none');
  if (terrain.texKey === 'after') p.set('tex', 'after');
  if (flood2d && !flood2d.visible) p.set('model', '1d');
  if (flood2d && run2d !== 'central') p.set('scenario2d', run2d);
  if (tourStep != null) p.set('tour', String(tourStep + 1));
  return `${location.pathname}?${p}`;
}
if (!qs.has('capture')) setInterval(() => history.replaceState(null, '', stateUrl()), 1000);
$('share').onclick = async () => {
  const url = new URL(stateUrl(), location.href).href;
  let ok = true;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    ok = false;
  }
  $('toast').textContent = ok ? 'Link to this moment copied' : url;
  $('toast').hidden = false;
  setTimeout(() => ($('toast').hidden = true), ok ? 2200 : 6000);
};
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', 'A 3D map of the Bhote Koshi and Trishuli valley with the modelled flood water');

// ?debug: the camera, its controls and the follow path on window.debug, for measuring camera moves from the console
if (qs.has('debug')) window.debug = { camera, controls, followView };

// capture mode (?capture=1): an external frame-capture tool (not part of this app) sets the time, camera, imagery and layers frame by frame and waits
// until every tile for the view is shown. Panels and map labels are hidden; the tool draws its own captions.
const capturing = qs.has('capture');
if (capturing) {
  document.body.classList.add('capture'); // panels and labels shown with opacity --ui (0 by default)
  controls.enableDamping = false;
  const cap = document.createElement('div');
  cap.id = 'capCaption';
  document.body.append(cap);
  let frames = 0; // counts rendered frames, so a set() is seen by at least one full render
  window.capture = {
    frames: () => frames,
    tick: () => frames++,
    stations: st.map((s) => [s.km, s.x, s.z, s.bed, s.nx, s.nz]),
    // the chainage `follow the front` aims at for a minute (null between the reported zone and the model front)
    frontKm(m) {
      const zone = river.upperFront(m + 44);
      const zk = zone.reach != null && zone.reach < model.km[0] - 0.2 ? ((zone.passed ?? 0) + zone.reach) / 2 : null;
      return model.front(m) ?? zk ?? (m + 44 < 37 ? 0 : null);
    },
    async set(s) {
      if (s.minute != null) {
        minute = s.minute;
        slider.value = minute;
      }
      if (s.ui != null) document.body.style.setProperty('--ui', s.ui);
      if (s.place !== undefined) {
        const p = s.place && PLACES.find((q) => q.name === s.place);
        if (p) select(p, false);
        else {
          selected = null;
          renderSelected();
        }
      }
      if (s.drawers) {
        for (const [id, open] of Object.entries(s.drawers)) if ($(id) && $(id).hidden === open) toggle(id);
      }
      if (s.cam) {
        fly.t = 1;
        camera.position.set(...s.cam.pos);
        controls.target.set(...s.cam.target);
      }
      if (s.tex) terrain.setImagery(s.tex);
      if (s.layers) {
        Object.assign(layerOn, s.layers);
        applyLayers();
      }
      if (s.trace != null) {
        water.showTrace(s.trace);
        if (flood2d) flood2d.trace = s.trace;
      }
      if (s.run && flood2d && s.run !== run2d) document.querySelector(`[data-run="${s.run}"]`)?.click();
      if (s.caption != null) cap.innerHTML = s.caption;
      if (s.captionOpacity != null) cap.style.opacity = s.captionOpacity;
    },
    busy: () => terrain.busy() || Boolean(flood2d?.busy()) || Boolean(infraLoading),
    height: (x, z) => terrain.heightAt(x, z),
    runs: () => (flood2d ? run2d : null),
  };
}

// loop. The scene is drawn only when something changed (the camera, the time, a switch, a tile or texture that
// arrived, a resize), so an idle page costs next to nothing; while playing, following or capturing it draws every frame.
let last = performance.now();
let lastPanel = -1;
let lastClock = '';
let lastNeedle = NaN;
let lastLift = -1;
terrain.onChange = markDirty;
if (flood2d) flood2d.onChange = markDirty;
controls.addEventListener('change', markDirty);
for (const ev of ['click', 'input', 'keydown', 'wheel', 'resize']) addEventListener(ev, markDirty, { passive: true });
const tmp = new THREE.Vector3();
const projected = new THREE.Vector3();
const frontVec = new THREE.Vector3();
const upperVec = new THREE.Vector3();
// the panels the map labels keep out of: their rectangles are read again only when a panel changes size or the
// window does, not every frame (reading them forces a layout)
const LABEL_FREE = ['title', 'actions', 'chapters', 'place', 'dock', 'foot', 'legendMini', 'mapctl', 'settings', 'charts', 'info', 'intro', 'stepper'];
let boxes = null;
const dropBoxes = () => {
  boxes = null;
};
const boxWatch = new ResizeObserver(dropBoxes);
for (const id of LABEL_FREE) if ($(id)) boxWatch.observe($(id));
for (const ev of ['resize', 'click', 'keydown']) addEventListener(ev, dropBoxes, { passive: true });
function placeLabels() {
  boxes ??= LABEL_FREE.map((id) => $(id))
    .filter((e) => e && !e.hidden && e.getClientRects().length > 0) // fixed elements have no offsetParent
    .map((e) => e.getBoundingClientRect());
  for (const l of labels) {
    const p = l.layer && !layerOn[l.layer] ? null : l.getPos();
    let vis = false;
    let sx = 0;
    let sy = 0;
    if (p) {
      const v = projected.copy(p).project(camera);
      const far = camera.position.distanceTo(p) > 90000 && !l.d.classList.contains('front');
      sx = Math.round(((v.x + 1) / 2) * innerWidth);
      sy = Math.round(((1 - v.y) / 2) * innerHeight);
      const covered = boxes.some((b) => sx > b.left - 60 && sx < b.right + 60 && sy > b.top - 10 && sy < b.bottom + 50);
      vis = v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02 && !far && !covered;
    }
    // write to the page only what changed
    if (vis !== l.vis) {
      l.d.style.display = vis ? 'block' : 'none';
      l.vis = vis;
    }
    if (vis && (sx !== l.sx || sy !== l.sy)) {
      l.d.style.left = `${sx}px`;
      l.d.style.top = `${sy}px`;
      l.sx = sx;
      l.sy = sy;
    }
  }
}
let lastMinute = NaN;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    minute = Math.min(600, minute + (dt * speed) / 60); // speed 60 = one model minute per second
    slider.value = minute;
    if (playUntil != null && minute >= playUntil) {
      minute = playUntil;
      playUntil = null;
      setPlaying(false);
    }
    if (minute >= 600) setPlaying(false);
  }
  updateTrack(minute, playing);
  const clock = clockOf(minute);
  if (clock !== lastClock) {
    $('tnow').textContent = clock;
    slider.setAttribute('aria-valuetext', `${clock} Nepal time`);
    lastClock = clock;
  }
  if (minute !== lastMinute) {
    lastMinute = minute;
    dirty = true;
    water.update(minute);
    river.update(minute);
    const zone = river.upperFront(minute + 44);
    const zk = zone.reach != null && zone.reach < model.km[0] - 0.2 ? ((zone.passed ?? 0) + zone.reach) / 2 : null;
    const zs = zk == null ? null : stationAt(zk);
    upperFrontPos = zs ? upperVec.set(zs.x, zs.bed + 300, zs.z) : null;
    const fk = model.front(minute);
    const fs = fk == null ? null : stationAt(fk);
    frontPos = fs ? frontVec.set(fs.x, fs.bed + 400, fs.z) : null;
  }
  if (flood2d?.update(minute)) dirty = true;

  if (fly.t < 1) {
    fly.t = Math.min(1, fly.t + dt / 1.6);
    const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - (-2 * fly.t + 2) ** 2 / 2;
    controls.target.lerpVectors(fly.from.target, fly.to.target, e);
    camera.position.lerpVectors(fly.from.pos, fly.to.pos, e);
    dirty = true;
  } else if (follow) {
    // the path itself is smooth; a short easing (0.5 s, the same at any frame rate) only softens slider jumps
    const v = followView(minute);
    const a = 1 - Math.exp(-dt / 0.5);
    // once within half a metre the camera settles, so a paused view stops redrawing
    const off = Math.max(controls.target.distanceTo(tmp.set(...v.target)), camera.position.distanceTo(projected.set(...v.pos)));
    if (off > 0.5) {
      controls.target.lerp(tmp.set(...v.target), a);
      camera.position.lerp(tmp.set(...v.pos), a);
      dirty = true;
    }
  }
  controls.update();
  // keep the pivot on the ground, so turning and zooming stay around what is under the view (it settles, then stops)
  if (fly.t >= 1 && !follow && !capturing) {
    const gy = terrain.heightAt(controls.target.x, controls.target.z);
    const off = gy - controls.target.y;
    if (Math.abs(off) > 1) {
      controls.target.y += off * 0.1;
      dirty = true;
    }
  }
  const az = Math.round((controls.getAzimuthalAngle() * 180) / Math.PI);
  if (az !== lastNeedle) {
    needle.setAttribute('transform', `rotate(${az})`);
    lastNeedle = az;
  }

  // keep the camera above the ground
  const g = terrain.heightAt(camera.position.x, camera.position.z) + 150;
  if (camera.position.y < g && !capturing) {
    camera.position.y = g;
    dirty = true;
  }

  const dist = camera.position.distanceTo(controls.target);
  scene.fog.near = dist * 0.8;
  scene.fog.far = dist * 3.2 + 30000;
  if (terrain.update(controls.target, dist)) dirty = true;
  // re-seat the building points on whichever terrain is shown, when the shown tiles change
  const liftKey = infra?.group.visible ? terrain.version : -1;
  if (liftKey >= 0 && liftKey !== lastLift) {
    infra.lift((x, z) => terrain.heightAt(x, z), (x, z) => terrain.detailAt(x, z));
    dirty = true;
  }
  lastLift = liftKey;
  if (dirty || capturing) {
    renderer.render(scene, camera);
    placeLabels();
    dirty = false;
    if (capturing) window.capture.tick();
  }

  // panels: refresh a few times per model minute, not every frame
  const mKey = Math.round(minute * 4);
  if (mKey !== lastPanel) {
    lastPanel = mKey;
    if (selected) updatePlace($('place'), selected, minute, model);
    updateIndex(followTrackKm(minute));
    if (selected) updateStepper();
    if (!$('charts').hidden && !$('profile').hidden) renderProfile($('profileSvg'), model, minute, facts);
    if (!$('charts').hidden && !$('xsec').hidden) drawXsec();
    document.querySelectorAll('.tnow2').forEach((e) => (e.textContent = clockOf(minute)));
  }
  requestAnimationFrame(frame);
}
addEventListener('resize', setResolution);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
requestAnimationFrame(frame);
window.__ready = true;
