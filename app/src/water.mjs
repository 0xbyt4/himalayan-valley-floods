// Water: the modelled rise above the normal river (model/export_app.mjs) drawn as a level sheet across the river at
// each corridor station. The sheet is as wide as the modelled water surface in the DEM section (plus a margin) and
// the terrain hides it wherever the ground is higher, so its edge follows the valley sides.
import * as THREE from 'three';

const MARGIN = 40; // m beyond the modelled half width, so the sheet meets the terrain
const MIN_RISE = 0.3; // below this the normal river in the imagery is shown instead

export class Model {
  constructor(meta, bands) {
    this.meta = meta;
    this.bands = bands; // Int16Array [band][section][minute], centimetres
    this.km = meta.sections;
    this.nSec = this.km.length;
    this.nMin = meta.minutes;
    // highest median rise up to each minute, for the high-water trace
    this.cummax = new Float32Array(this.nSec * this.nMin);
    for (let j = 0; j < this.nSec; j++) {
      let m = 0;
      for (let t = 0; t < this.nMin; t++) {
        m = Math.max(m, bands[this.nSec * this.nMin + j * this.nMin + t] / 100);
        this.cummax[j * this.nMin + t] = m;
      }
    }
  }

  // the highest median rise (m) at a chainage up to a minute after 08:44
  maxSoFar(km, minute) {
    const s = this.sectionAt(km);
    if (s == null || minute <= 0) return 0;
    const t = Math.min(this.nMin - 1, Math.floor(minute));
    const s0 = Math.floor(s);
    const s1 = Math.min(this.nSec - 1, s0 + 1);
    const f = s - s0;
    return this.cummax[s0 * this.nMin + t] * (1 - f) + this.cummax[s1 * this.nMin + t] * f;
  }

  // fractional section index for a chainage; null upstream of the model
  sectionAt(km) {
    const k = this.km;
    if (km < k[0] - 0.6 || km > k.at(-1) + 0.6) return null;
    if (km <= k[0]) return 0;
    if (km >= k.at(-1)) return this.nSec - 1;
    let j = 1;
    while (k[j] < km) j++;
    return j - 1 + (km - k[j - 1]) / (k[j] - k[j - 1]);
  }

  // rise (m) at a chainage and a minute after 08:44 for band 0 (p5), 1 (p50) or 2 (p95)
  rise(km, minute, band = 1) {
    const s = this.sectionAt(km);
    if (s == null || minute <= 0) return 0;
    const m = Math.min(this.nMin - 1, minute);
    const s0 = Math.floor(s);
    const s1 = Math.min(this.nSec - 1, s0 + 1);
    const m0 = Math.floor(m);
    const m1 = Math.min(this.nMin - 1, m0 + 1);
    const fs = s - s0;
    const fm = m - m0;
    const at = (j, t) => this.bands[band * this.nSec * this.nMin + j * this.nMin + t] / 100;
    return (at(s0, m0) * (1 - fs) + at(s1, m0) * fs) * (1 - fm) + (at(s0, m1) * (1 - fs) + at(s1, m1) * fs) * fm;
  }

  // the farthest chainage where the median rise is at least 1 m. At a section's own chainage rise() reduces to the
  // value of that section interpolated in time, so the bands are read directly (the same numbers, without a section
  // search per section)
  front(minute) {
    if (minute <= 0) return null;
    const m = Math.min(this.nMin - 1, minute);
    const m0 = Math.floor(m);
    const m1 = Math.min(this.nMin - 1, m0 + 1);
    const fm = m - m0;
    const base = this.nSec * this.nMin; // band 1 (median)
    for (let j = this.nSec - 1; j >= 0; j--) {
      const r = (this.bands[base + j * this.nMin + m0] / 100) * (1 - fm) + (this.bands[base + j * this.nMin + m1] / 100) * fm;
      if (r >= 1) return this.km[j];
    }
    return null;
  }

  // half the modelled water surface width at a chainage for a rise (m), from the section tables
  halfWidth(km, rise) {
    const s = this.sectionAt(km);
    if (s == null) return 0;
    const tw = this.meta.topWidth[Math.round(s)];
    const r = Math.min(39.999, Math.max(0, rise));
    const i = Math.floor(r);
    return (tw[i] + (r - i) * (tw[i + 1] - tw[i])) / 2;
  }

  sectionIndex(km) {
    let best = 0;
    for (let j = 0; j < this.nSec; j++) if (Math.abs(this.km[j] - km) < Math.abs(this.km[best] - km)) best = j;
    return best;
  }
}

export class Water {
  constructor(scene, stations, model) {
    this.model = model;
    this.st = stations.filter((s) => model.sectionAt(s.km) != null);
    this.sheets = {
      p50: this.sheet(new THREE.MeshStandardMaterial({ color: 0x6b5338, roughness: 0.45, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
      p95: this.sheet(new THREE.MeshBasicMaterial({ color: 0xe6d3a8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })),
      // where the water has already fallen: a muddy trace at the highest median level so far
      trace: this.sheet(new THREE.MeshBasicMaterial({ color: 0xa47e52, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })),
    };
    this.sheets.p95.mesh.visible = false;
    scene.add(this.sheets.p50.mesh, this.sheets.p95.mesh, this.sheets.trace.mesh);
  }

  sheet(material) {
    const n = this.st.length;
    const pos = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = 2 * i;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, material);
    mesh.frustumCulled = false;
    return { mesh, pos, g };
  }

  // while the 1-D water is hidden, a choice is remembered and applied when it shows again
  showUpper(on) {
    if (this.hidden) this.wasUpper = on;
    else this.sheets.p95.mesh.visible = on;
  }

  showTrace(on) {
    if (this.hidden) this.wasTrace = on;
    else this.sheets.trace.mesh.visible = on;
  }

  // the whole 1-D water on or off (the 2-D model draws its own); remembers the median, 95 % and trace choices
  setVisible(on) {
    if (this.hidden === !on) return;
    this.hidden = !on;
    this.sheets.p50.mesh.visible = on;
    if (!on) {
      this.wasUpper = this.sheets.p95.mesh.visible;
      this.wasTrace = this.sheets.trace.mesh.visible;
      this.sheets.p95.mesh.visible = false;
      this.sheets.trace.mesh.visible = false;
    } else {
      this.sheets.p95.mesh.visible = Boolean(this.wasUpper);
      this.sheets.trace.mesh.visible = this.wasTrace ?? true;
    }
  }

  update(minute) {
    if (this.hidden) return;
    for (const [key, band] of [['p50', 1], ['p95', 2], ['trace', -1]]) {
      const s = this.sheets[key];
      if (key !== 'p50' && !s.mesh.visible) continue;
      this.st.forEach((st, i) => {
        let r = band < 0 ? this.model.maxSoFar(st.km, minute) : this.model.rise(st.km, minute, band);
        // the trace shows only where the water has fallen at least half a metre below its highest level
        if (band < 0 && r - this.model.rise(st.km, minute, 1) < 0.5) r = 0;
        const y = r < MIN_RISE ? st.bed - 60 : st.bed + 0.6 + r;
        const hw = Math.min(900, this.model.halfWidth(st.km, r) + MARGIN);
        s.pos.set([st.x + st.nx * hw, y, st.z + st.nz * hw, st.x - st.nx * hw, y, st.z - st.nz * hw], i * 6);
      });
      s.g.attributes.position.needsUpdate = true;
      s.g.computeVertexNormals();
    }
  }
}
