// Terrain: an overview grid (120 m) split into chunks, and 30 m detail tiles along the river that replace the
// overview chunk under them when the camera comes close. Heights come from data/build_app.py (Copernicus DEM).
import * as THREE from 'three';
import { dataUrl, decodeHeights, fetchGz } from './decode.mjs?v=3';

const SKIRT_M = 250; // vertical skirt that hides cracks between tiles of different resolution
const LOAD_KM = 26; // load detail tiles whose centre is this close to the view target
const MAX_TILES = 16;
const SHOW_KM = 14; // draw detail tiles this close to the view target; farther tiles stay loaded, the overview shows

// colours by height when no imagery is available
const PALETTE = [
  [0, [0.36, 0.48, 0.24]],
  [1500, [0.3, 0.42, 0.21]],
  [2800, [0.42, 0.42, 0.31]],
  [3900, [0.55, 0.51, 0.44]],
  [4800, [0.9, 0.92, 0.93]],
];
function colourAt(h) {
  for (let i = 1; i < PALETTE.length; i++) {
    if (h <= PALETTE[i][0]) {
      const [h0, c0] = PALETTE[i - 1];
      const [h1, c1] = PALETTE[i];
      const f = (h - h0) / (h1 - h0);
      return c0.map((v, k) => v + f * (c1[k] - v));
    }
  }
  return PALETTE.at(-1)[1];
}

// index and UV buffers shared by every grid of the same size: the 30 m tiles all have the same shape, so they
// upload these once instead of once per tile (geometries give them back before they are disposed: release())
const shared = new Map();
function sharedIndex(rows, cols, ring) {
  const key = `i${rows}x${cols}${ring ? 's' : ''}`;
  if (!shared.has(key)) {
    const n = rows * cols;
    const m = ring ? ring.length : 0;
    const idx = new Uint32Array((rows - 1) * (cols - 1) * 6 + m * 6);
    let o = 0;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        idx[o++] = a;
        idx[o++] = a + cols;
        idx[o++] = a + 1;
        idx[o++] = a + 1;
        idx[o++] = a + cols;
        idx[o++] = a + cols + 1;
      }
    }
    for (let k = 0; k < m; k++) {
      const a = n + k;
      const b = n + ((k + 1) % m);
      const a2 = n + m + k;
      const b2 = n + m + ((k + 1) % m);
      idx[o++] = a; // faces point outward
      idx[o++] = b;
      idx[o++] = a2;
      idx[o++] = b;
      idx[o++] = b2;
      idx[o++] = a2;
    }
    shared.set(key, new THREE.BufferAttribute(idx, 1));
  }
  return shared.get(key);
}

// the border loop, clockwise seen from above (north edge west to east, east edge, south edge, west edge)
function borderRing(rows, cols) {
  const ring = [];
  for (let c = 0; c < cols; c++) ring.push(c);
  for (let r = 1; r < rows; r++) ring.push(r * cols + cols - 1);
  for (let c = cols - 2; c >= 0; c--) ring.push((rows - 1) * cols + c);
  for (let r = rows - 2; r > 0; r--) ring.push(r * cols);
  return ring;
}

// a regular grid mesh: heights[r * cols + c], row 0 at z0 (north), with optional skirts and UVs over [x0,x1]x[z0,z1].
// Normals come from the height grid (central differences); skirt vertices copy the normal of the edge vertex they
// hang from. Height colours are only built for a mesh without imagery (withColour).
function gridGeometry(heights, rows, cols, x0, x1, z0, z1, uv, skirt, withColour) {
  const n = rows * cols;
  const dx = (x1 - x0) / (cols - 1);
  const dz = (z1 - z0) / (rows - 1);
  const ring = skirt ? borderRing(rows, cols) : null;
  const m = ring ? ring.length : 0;
  const total = n + 2 * m;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  for (let r = 0; r < rows; r++) {
    const rUp = r > 0 ? r - 1 : r;
    const rDn = r < rows - 1 ? r + 1 : r;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      pos[i * 3] = x0 + c * dx;
      pos[i * 3 + 1] = heights[i];
      pos[i * 3 + 2] = z0 + r * dz;
      const cL = c > 0 ? c - 1 : c;
      const cR = c < cols - 1 ? c + 1 : c;
      const hx = (heights[r * cols + cR] - heights[r * cols + cL]) / ((cR - cL) * dx);
      const hz = (heights[rDn * cols + c] - heights[rUp * cols + c]) / ((rDn - rUp) * dz);
      const l = Math.hypot(hx, 1, hz);
      nor[i * 3] = -hx / l;
      nor[i * 3 + 1] = 1 / l;
      nor[i * 3 + 2] = -hz / l;
    }
  }
  for (let k = 0; k < m; k++) {
    const src = ring[k];
    for (const [j, drop] of [
      [n + k, 0],
      [n + m + k, SKIRT_M],
    ]) {
      pos[j * 3] = pos[src * 3];
      pos[j * 3 + 1] = pos[src * 3 + 1] - drop;
      pos[j * 3 + 2] = pos[src * 3 + 2];
      nor[j * 3] = nor[src * 3];
      nor[j * 3 + 1] = nor[src * 3 + 1];
      nor[j * 3 + 2] = nor[src * 3 + 2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(sharedIndex(rows, cols, ring));
  // UVs: shared when they span the grid itself (the detail tiles), else built for this grid (overview chunks)
  const own = uv.x0 === x0 && uv.x1 === x1 && uv.z0 === z0 && uv.z1 === z1;
  const ukey = `u${rows}x${cols}${skirt ? 's' : ''}`;
  if (own && shared.has(ukey)) g.setAttribute('uv', shared.get(ukey));
  else {
    const tex = new Float32Array(total * 2);
    for (let i = 0; i < n; i++) {
      tex[i * 2] = (pos[i * 3] - uv.x0) / (uv.x1 - uv.x0);
      tex[i * 2 + 1] = 1 - (pos[i * 3 + 2] - uv.z0) / (uv.z1 - uv.z0);
    }
    for (let k = 0; k < m; k++) {
      for (const j of [n + k, n + m + k]) {
        tex[j * 2] = tex[ring[k] * 2];
        tex[j * 2 + 1] = tex[ring[k] * 2 + 1];
      }
    }
    const a = new THREE.BufferAttribute(tex, 2);
    if (own) shared.set(ukey, a);
    g.setAttribute('uv', a);
  }
  if (withColour) {
    const col = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) col.set(colourAt(pos[i * 3 + 1] + (i >= n + m ? SKIRT_M : 0)), i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  return g;
}

// dispose a grid geometry without freeing the buffers it shares with other grids
function release(g) {
  g.setIndex(null);
  for (const a of shared.values()) if (g.attributes.uv === a) g.deleteAttribute('uv');
  g.dispose();
}

export class Terrain {
  constructor(scene, data, base, renderer) {
    this.scene = scene;
    this.data = data;
    this.base = base;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.hasImagery = Boolean(data.imagery);
    this.texKey = 'before';
    this.loader = new THREE.TextureLoader();
    this.aniso = renderer.capabilities.getMaxAnisotropy();
    this.chunks = new Map(); // "ci_cj" -> mesh
    this.tiles = new Map(); // name -> { meta, mesh, state, tex }
    this.overviewTex = {};
    this.queue = 0;
    this.texPending = 0; // imagery textures still loading
    this.overlayOn = false; // the vegetation-loss overlay on the detail tiles
    this.overlayBase = null;
    this.shown = []; // detail tiles shown now
    this.version = 0; // goes up whenever the set of shown tiles changes
    this.onChange = () => {}; // called when something new can be drawn (a tile, a texture, an overlay)
  }

  // a transparent overlay drawn on every loaded detail tile (url: `${overlayBase}/${tile}.png`)
  setOverlay(base, on) {
    this.overlayBase = base;
    this.overlayOn = on;
    for (const e of this.tiles.values()) if (e.mesh) this.attachOverlay(e);
    this.onChange();
  }

  attachOverlay(e) {
    if (!this.overlayBase) return;
    if (!e.overlay) {
      const tex = this.loader.load(dataUrl(`${this.overlayBase}/${e.meta.name}.png`), () => this.onChange());
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
      e.overlay = new THREE.Mesh(e.mesh.geometry, mat);
      e.overlay.renderOrder = 1;
      this.group.add(e.overlay);
    }
    e.overlay.visible = this.overlayOn && e.mesh.visible;
  }

  // an imagery texture; resolves to the texture, or null if the image is missing
  texture(url) {
    this.texPending++;
    return new Promise((res) => {
      const t = this.loader.load(
        dataUrl(url),
        () => {
          this.texPending--;
          this.onChange();
          res(t);
        },
        undefined,
        () => {
          this.texPending--;
          t.dispose();
          res(null);
        },
      );
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.aniso;
    });
  }

  material(map) {
    return map ? new THREE.MeshLambertMaterial({ map }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  async loadOverview() {
    const ov = this.data.overview;
    const H = decodeHeights(await fetchGz(`${this.base}/${ov.file}`), ov.rows, ov.cols);
    this.ovHeights = H;
    // only the imagery date on screen is fetched; the other one when it is first asked for (setImagery)
    const first = this.hasImagery ? this.texture(`${this.base}/imagery/overview_${this.texKey}.jpg`) : null;
    if (first) this.overviewTex[this.texKey] = first;
    // one material for all overview chunks: a plain colour until the image arrives (the first frame does not wait)
    this.ovMaterial = this.hasImagery ? new THREE.MeshLambertMaterial({ color: 0x4a5a44 }) : this.material(null);
    const n = ov.chunk_cells;
    const cell = (ov.x[1] - ov.x[0]) / (ov.cols - 1);
    const uv = { x0: ov.x[0], x1: ov.x[1], z0: ov.z[0], z1: ov.z[1] };
    for (let ci = 0; ci * n < ov.rows - 1; ci++) {
      for (let cj = 0; cj * n < ov.cols - 1; cj++) {
        const r0 = ci * n;
        const c0 = cj * n;
        const r1 = Math.min(r0 + n, ov.rows - 1);
        const c1 = Math.min(c0 + n, ov.cols - 1);
        const rows = r1 - r0 + 1;
        const cols = c1 - c0 + 1;
        const h = new Float32Array(rows * cols);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h[r * cols + c] = H[(r0 + r) * ov.cols + c0 + c];
        const g = gridGeometry(h, rows, cols, ov.x[0] + c0 * cell, ov.x[0] + c1 * cell, ov.z[0] + r0 * cell, ov.z[0] + r1 * cell, uv, false, !this.hasImagery);
        const mesh = new THREE.Mesh(g, this.ovMaterial);
        this.group.add(mesh);
        this.chunks.set(`${ci}_${cj}`, mesh);
      }
    }
    if (first) {
      const key = this.texKey; // the date asked for; the user may pick the other one before the image arrives
      first.then((tex) => {
        this.overviewTex[key] = tex;
        if (this.texKey === key) this.setOverviewMap(tex);
      });
    }
    for (const t of this.data.tiles) this.tiles.set(t.name, { meta: t, mesh: null, state: 'idle', tex: {} });
  }

  // is a 30 m detail tile shown at (x, z)?
  detailAt(x, z) {
    for (const e of this.shown) {
      const m = e.meta;
      if (x >= m.x[0] && x <= m.x[1] && z >= m.z[0] && z <= m.z[1]) return true;
    }
    return false;
  }

  // ground height at (x, z) from the overview grid (used for labels and the camera)
  heightAt(x, z) {
    const ov = this.data.overview;
    const c = ((x - ov.x[0]) / (ov.x[1] - ov.x[0])) * (ov.cols - 1);
    const r = ((z - ov.z[0]) / (ov.z[1] - ov.z[0])) * (ov.rows - 1);
    const rc = Math.min(ov.rows - 1, Math.max(0, Math.round(r)));
    const cc = Math.min(ov.cols - 1, Math.max(0, Math.round(c)));
    return this.ovHeights[rc * ov.cols + cc];
  }

  async loadTile(entry) {
    entry.state = 'loading';
    this.queue++;
    try {
      const t = entry.meta;
      const heights = decodeHeights(await fetchGz(`${this.base}/terrain/${t.name}.bin`), t.rows, t.cols);
      const g = gridGeometry(heights, t.rows, t.cols, t.x[0], t.x[1], t.z[0], t.z[1], { x0: t.x[0], x1: t.x[1], z0: t.z[0], z1: t.z[1] }, true, !this.hasImagery);
      let map = null;
      const key = this.texKey;
      if (this.hasImagery) {
        map = await this.texture(`${this.base}/imagery/${t.name}_${key}.jpg`);
        if (map) entry.tex[key] = map;
        else console.warn(`tile ${t.name}: ${key} imagery missing, using height colours`);
      }
      if (!map && this.hasImagery) {
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.4), 3));
      }
      entry.mesh = new THREE.Mesh(g, this.material(map));
      entry.mesh.visible = false;
      this.group.add(entry.mesh);
      // the date may have changed while this tile loaded: setImagery skipped it, so fetch that date now
      if (this.hasImagery && this.texKey !== key) this.ensureTex(entry, this.texKey);
      entry.state = 'ready';
      this.onChange();
    } catch (e) {
      console.error(`tile ${entry.meta.name} failed`, e);
      entry.state = 'failed';
    } finally {
      this.queue--;
    }
  }

  unloadTile(entry) {
    if (!entry.mesh) return;
    if (entry.overlay) {
      this.group.remove(entry.overlay);
      entry.overlay.material.map?.dispose();
      entry.overlay.material.dispose();
      entry.overlay = null;
    }
    this.group.remove(entry.mesh);
    release(entry.mesh.geometry);
    entry.mesh.material.dispose();
    for (const t of Object.values(entry.tex)) t.dispose();
    entry.tex = {};
    entry.mesh = null;
    entry.state = 'idle';
  }

  // called every frame with the orbit target and the camera distance to it. Tiles load within LOAD_KM of the target,
  // but are drawn at 30 m only within SHOW_KM: farther away the 120 m overview is enough and costs far less.
  // Returns true when the set of shown tiles changed.
  update(target, dist) {
    const near = dist < 40000;
    const ranked = [...this.tiles.values()]
      .map((e) => {
        const cx = (e.meta.x[0] + e.meta.x[1]) / 2;
        const cz = (e.meta.z[0] + e.meta.z[1]) / 2;
        return { e, d: Math.hypot(cx - target.x, cz - target.z) };
      })
      .sort((a, b) => a.d - b.d);
    this.waiting = 0; // tiles wanted for this view and not shown yet
    const shown = [];
    ranked.forEach(({ e, d }, i) => {
      const want = near && i < MAX_TILES && d < LOAD_KM * 1000;
      const draw = want && d < SHOW_KM * 1000;
      if (draw && e.state !== 'ready' && e.state !== 'failed') this.waiting++;
      if (want && e.state === 'idle' && this.queue < 3) this.loadTile(e);
      if (!want && e.state === 'ready' && d > (LOAD_KM + 12) * 1000) this.unloadTile(e);
      const show = draw && e.state === 'ready';
      if (e.mesh) e.mesh.visible = show;
      if (show) shown.push(e);
      if (e.mesh && (e.overlay || this.overlayOn)) this.attachOverlay(e);
      const key = e.meta.name.slice(1).split('_').map(Number).join('_');
      const chunk = this.chunks.get(key);
      if (chunk) chunk.visible = !show;
    });
    const changed = shown.length !== this.shown.length || shown.some((e, i) => e !== this.shown[i]);
    if (changed) {
      this.shown = shown;
      this.version++;
    }
    return changed;
  }

  // true while tiles for the current view, their imagery or their overlays are still loading (for frame capture)
  busy() {
    if (this.waiting > 0 || this.queue > 0 || this.texPending > 0) return true;
    for (const e of this.tiles.values()) if (e.overlay && e.overlay.visible && !e.overlay.material.map?.image) return true;
    return false;
  }

  // switch the imagery date; a date not fetched yet is fetched now, and each surface keeps its old image until the
  // new one has arrived
  setImagery(key) {
    this.texKey = key;
    if (!this.hasImagery) return;
    const ov = this.overviewTex[key] ?? (this.overviewTex[key] = this.texture(`${this.base}/imagery/overview_${key}.jpg`));
    Promise.resolve(ov).then((tex) => {
      this.overviewTex[key] = tex;
      if (this.texKey === key) this.setOverviewMap(tex);
    });
    for (const e of this.tiles.values()) if (e.mesh) this.ensureTex(e, key);
  }

  // show the imagery of date `key` on a loaded tile, fetching it first if needed
  ensureTex(e, key) {
    if (e.tex[key]) return this.useTex(e, key);
    if (e.texLoading?.[key]) return;
    e.texLoading = { ...e.texLoading, [key]: true };
    this.texture(`${this.base}/imagery/${e.meta.name}_${key}.jpg`).then((tex) => {
      e.texLoading[key] = false;
      if (!tex) return;
      if (!e.mesh) return tex.dispose(); // unloaded meanwhile
      e.tex[key] = tex;
      if (this.texKey === key) this.useTex(e, key);
    });
  }

  setOverviewMap(tex) {
    if (!tex) return;
    this.ovMaterial.map = tex;
    this.ovMaterial.color.set(0xffffff);
    this.ovMaterial.needsUpdate = true;
    this.onChange();
  }

  useTex(e, key) {
    if (e.mesh.material.map === e.tex[key]) return;
    e.mesh.material.map = e.tex[key];
    e.mesh.material.needsUpdate = true;
    this.onChange();
  }
}
