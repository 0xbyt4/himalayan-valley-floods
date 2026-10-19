// 2-D flood: the water depth above the app ground on every cell the flood reaches, every 3 minutes
// (model/export_flood2d.py). On a detail tile the water is a mesh on the tile's 30 m grid; elsewhere on the 120 m
// overview grid. Where the water has fallen again, a thin muddy trace marks the highest extent so far.
// Per cell: d.ground is the app ground, d.base the base water level above it (negative where the river at base flow
// stays below the app ground), and each frame the visible depth (0 where the water stays below the ground).
import * as THREE from 'three';
import { fetchGz } from './decode.mjs?v=3';

const MIN_RISE = 0.25; // m above the base level before water is drawn
const SHOW = 0.05; // m of visible depth before water is drawn
const HIDE = -80; // m below the ground: a vertex that is not drawn
const DEEP = 8; // m: the depth shown in the darkest colour
// colours as in the legend (sRGB hex); vertex colours are linear, so convert
const rgb = (hex) => new THREE.Color(hex).toArray();
const SHALLOW = rgb('#9e8057');
const DEEPC = rgb('#45301c');
const MUD = rgb('#a88f6b');

// a water file (model/export_flood2d.py, format 3, already inflated); frames come back frame-major: frames[k * n + i]
function parse(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const n = dv.getUint32(0, true);
  const nf = dv.getUint32(4, true);
  let o = 12;
  const idx = new Uint32Array(n);
  for (let i = 0, p = o, acc = 0; i < n; i++) {
    let v = 0;
    let s = 1;
    let b;
    do {
      b = u8[p++];
      v += (b & 0x7f) * s;
      s *= 128;
    } while (b & 0x80);
    acc += v;
    idx[i] = acc;
  }
  o += dv.getUint32(8, true);
  const ground = new Float32Array(buf.slice(o, o + 4 * n));
  o += 4 * n;
  const base = Float32Array.from(new Int16Array(buf.slice(o, o + 2 * n)), (v) => v / 100);
  o += 2 * n;
  const frames = new Uint8Array(nf * n);
  for (let i = 0; i < n; i++) {
    let a = 0;
    const r = o + i * nf;
    for (let k = 0; k < nf; k++) {
      a = (a + u8[r + k]) & 255;
      frames[k * n + i] = a;
    }
  }
  o += nf * n;
  return { n, nf, idx, ground, base, frames, hmax: u8.slice(o, o + n), vmax: u8.slice(o + n, o + 2 * n), arrive: new Uint16Array(buf.slice(o + 2 * n, o + 4 * n)) };
}

// a mesh over a regular grid (rows x cols, x0..x1, z0..z1) for the given vertex set
function gridMesh(d, rows, cols, x0, x1, z0, z1, material) {
  const pos = new Float32Array(d.n * 3);
  const col = new Float32Array(d.n * 4); // rgba: the trace is drawn more transparent than the water
  const at = new Map();
  for (let i = 0; i < d.n; i++) {
    const r = Math.floor(d.idx[i] / cols);
    const c = d.idx[i] % cols;
    at.set(d.idx[i], i);
    pos[i * 3] = x0 + (c / (cols - 1)) * (x1 - x0);
    pos[i * 3 + 1] = d.ground[i] + HIDE;
    pos[i * 3 + 2] = z0 + (r / (rows - 1)) * (z1 - z0);
  }
  const tri = [];
  for (let i = 0; i < d.n; i++) {
    const k = d.idx[i];
    const c = k % cols;
    if (c === cols - 1) continue;
    const a = i;
    const b = at.get(k + 1);
    const e = at.get(k + cols);
    const f = at.get(k + cols + 1);
    if (b !== undefined && e !== undefined) tri.push(a, e, b);
    if (b !== undefined && e !== undefined && f !== undefined) tri.push(b, e, f);
    else if (b === undefined && e !== undefined && f !== undefined) tri.push(a, e, f);
    else if (e === undefined && b !== undefined && f !== undefined) tri.push(a, f, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.setIndex(tri);
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

export class Flood2D {
  constructor(scene, terrain, base, meta) {
    this.scene = scene;
    this.terrain = terrain;
    this.base = base;
    this.meta = meta;
    this.dmax = meta.dmax;
    this.lut = Float32Array.from({ length: 256 }, (_, v) => meta.dmax * (v / 255) ** 2); // depth code to metres
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.tiles = new Map(); // name -> { d, mesh, maxSoFar, lastF }
    this.overview = null;
    this.cells = null;
    this.trace = true;
    this.visible = true;
    this.onChange = () => {}; // called when a tile's water has loaded
  }

  async init() {
    const ov = this.terrain.data.overview;
    const d = parse(await fetchGz(`${this.base}/overview.bin`)); // throws when missing: run model/export_flood2d.py
    if (this.disposed) return;
    this.overview = { d, mesh: gridMesh(d, ov.rows, ov.cols, ov.x[0], ov.x[1], ov.z[0], ov.z[1], this.material), max: new Float32Array(d.n), lastF: -1 };
    // overview vertices inside a detail tile: hidden while that tile is shown (the tile has its own water)
    const n = ov.chunk_cells;
    this.overview.tileOf = Array.from(d.idx, (k) => {
      const r = Math.floor(k / ov.cols);
      const c = k % ov.cols;
      return `t${String(Math.floor(r / n)).padStart(2, '0')}_${String(Math.floor(c / n)).padStart(2, '0')}`;
    });
    this.overview.mesh.visible = this.visible;
    this.scene.add(this.overview.mesh);
    const cb = await fetchGz(`${this.base}/cells.bin`).catch(() => null);
    if (cb && !this.disposed) {
      const n = new Uint32Array(cb, 0, 1)[0];
      const u16 = new Uint16Array(cb.slice(4, 4 + 6 * n));
      const u8 = new Uint8Array(cb, 4 + 6 * n, 2 * n);
      this.cells = { n, row: u16.subarray(0, n), col: u16.subarray(n, 2 * n), arrive: u16.subarray(2 * n), hmax: u8.subarray(0, n), vmax: u8.subarray(n) };
    }
    // after the first frames, when the page is idle (Safari has no requestIdleCallback)
    (window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500)))(() => this.preload());
  }

  // fetch every tile's water of this run in the background, one after another (under 1 MB), so the detailed water
  // is there before the camera reaches a tile instead of the coarse overview water standing in while it loads
  async preload() {
    for (const e of this.terrain.tiles.values()) {
      if (this.disposed) return;
      if (e.meta.name in this.meta.tiles && !this.tiles.has(e.meta.name)) await this.loadTile(e);
    }
  }

  async loadTile(entry) {
    const name = entry.meta.name;
    if (this.tiles.has(name) || !(name in this.meta.tiles)) return;
    this.tiles.set(name, null); // loading
    const buf = await fetchGz(`${this.base}/${name}.bin`).catch(() => null);
    if (!buf || this.disposed) {
      this.tiles.set(name, false); // missing: not asked for again, and not counted as loading
      return;
    }
    let d;
    try {
      d = parse(buf);
    } catch (err) {
      console.warn(`2D water ${name} unreadable:`, err.message);
      this.tiles.set(name, false); // as missing: a broken file must not hold the loading state (and frame capture)
      return;
    }
    if (this.disposed) return;
    const t = entry.meta;
    const mesh = gridMesh(d, t.rows, t.cols, t.x[0], t.x[1], t.z[0], t.z[1], this.material);
    mesh.visible = false; // update() shows it with its tile
    this.scene.add(mesh);
    this.tiles.set(name, { d, mesh, max: new Float32Array(d.n), lastF: -1 });
    this.onChange();
  }

  // the drawn 30 m cell nearest to (x, z) within `radius` m (cells.bin): arrival of a 0.5 m rise (minutes after
  // 08:00), highest visible depth and speed, and its distance
  at(x, z, radius) {
    const c = this.cells;
    if (!c) return null;
    const o = this.terrain.data.overview;
    const cell = (o.x[1] - o.x[0]) / (o.cols - 1) / (o.cell_m / 30); // 30 m: DEM cell k of the overview vertex k / 4
    let best = -1;
    let bd = radius;
    for (let i = 0; i < c.n; i++) {
      const dist = Math.hypot(o.x[0] + c.col[i] * cell - x, o.z[0] + c.row[i] * cell - z);
      if (dist < bd) {
        bd = dist;
        best = i;
      }
    }
    if (best < 0) return null;
    return { dist: bd, arrive: c.arrive[best] === 65535 ? null : c.arrive[best], hmax: this.dec(c.hmax[best]), vmax: c.vmax[best] / 10 };
  }

  // true while a tile's water is still loading (for frame capture)
  busy() {
    for (const g of this.tiles.values()) if (g === null) return true;
    return false;
  }

  dec(v) {
    return this.lut[v];
  }

  // write the water of one grid at frame position f (fractional); vertices with hide[i] = 1 are not drawn. Skipped
  // when nothing it depends on changed since the last paint of this grid (the time, the trace switch, the mask).
  paint(g, f, hide = null, hideVersion = 0) {
    const key = `${f}|${this.trace}|${hideVersion}`;
    if (g.paintKey === key) return false;
    g.paintKey = key;
    const { d, mesh } = g;
    const pos = mesh.geometry.attributes.position.array;
    const col = mesh.geometry.attributes.color.array;
    const f0 = Math.max(0, Math.min(d.nf - 1, Math.floor(f)));
    const f1 = Math.min(d.nf - 1, f0 + 1);
    const w = Math.max(0, Math.min(1, f - f0));
    const lut = this.lut;
    // highest depth so far: recomputed when the time goes back, extended when it goes forward
    if (f0 < g.lastF) {
      g.max.fill(0);
      g.lastF = -1;
    }
    for (let k = g.lastF + 1; k <= f0; k++) {
      const row = k * d.n;
      for (let i = 0; i < d.n; i++) {
        const v = lut[d.frames[row + i]];
        if (v > g.max[i]) g.max[i] = v;
      }
    }
    g.lastF = Math.max(g.lastF, f0);
    const r0 = f0 * d.n;
    const r1 = f1 * d.n;
    for (let i = 0; i < d.n; i++) {
      const h = (1 - w) * lut[d.frames[r0 + i]] + w * lut[d.frames[r1 + i]];
      let y = d.ground[i] + HIDE;
      let c0 = SHALLOW[0];
      let c1 = SHALLOW[1];
      let c2 = SHALLOW[2];
      let a = 0;
      if (!(hide && hide[i])) {
        if (h > SHOW && h - d.base[i] >= MIN_RISE) {
          y = d.ground[i] + h;
          const t = Math.min(1, h / DEEP);
          c0 = SHALLOW[0] + t * (DEEPC[0] - SHALLOW[0]);
          c1 = SHALLOW[1] + t * (DEEPC[1] - SHALLOW[1]);
          c2 = SHALLOW[2] + t * (DEEPC[2] - SHALLOW[2]);
          a = 0.9;
        } else if (this.trace && g.max[i] > SHOW && g.max[i] - d.base[i] >= MIN_RISE) {
          y = d.ground[i] + Math.max(d.base[i], 0) + 0.3; // a thin layer of mud where the water has been
          c0 = MUD[0];
          c1 = MUD[1];
          c2 = MUD[2];
          a = 0.4;
        }
      }
      pos[i * 3 + 1] = y;
      col[i * 4] = c0;
      col[i * 4 + 1] = c1;
      col[i * 4 + 2] = c2;
      col[i * 4 + 3] = a;
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.color.needsUpdate = true;
    return true;
  }

  dispose() {
    this.disposed = true;
    const all = [this.overview, ...this.tiles.values()].filter(Boolean);
    for (const g of all) {
      this.scene.remove(g.mesh);
      g.mesh.geometry.dispose();
    }
    this.material.dispose();
    this.tiles.clear();
    this.overview = null;
  }

  setVisible(on) {
    this.visible = on;
    if (this.overview) this.overview.mesh.visible = on;
    for (const g of this.tiles.values()) if (g) g.mesh.visible = on && g.shown;
  }

  // minute: minutes after 08:44 (frame 0). Returns true when any water was repainted.
  update(minute) {
    if (!this.visible || !this.overview) return false;
    const f = minute / this.meta.frame_min;
    // the overview water steps aside on a tile only once that tile's own water is loaded, so no gap shows while it loads
    let painted = false;
    const shown = [];
    for (const e of this.terrain.tiles.values()) {
      const on = Boolean(e.mesh && e.mesh.visible);
      if (on && !this.tiles.has(e.meta.name)) this.loadTile(e);
      const g = this.tiles.get(e.meta.name);
      if (g && on) shown.push(e.meta.name);
      if (g) {
        g.shown = on;
        g.mesh.visible = on;
        if (on) painted = this.paint(g, f) || painted;
      }
    }
    const ov = this.overview;
    const sig = shown.join(',');
    if (sig !== ov.maskSig) {
      ov.maskSig = sig;
      ov.maskVersion = (ov.maskVersion ?? 0) + 1;
      const on = new Set(shown);
      ov.mask = Uint8Array.from(ov.tileOf, (name) => (on.has(name) ? 1 : 0));
    }
    return this.paint(ov, f, ov.mask, ov.maskVersion) || painted;
  }
}
