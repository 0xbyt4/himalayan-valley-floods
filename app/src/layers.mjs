// Map layers: the river coloured by arrival time, reported event points, OpenStreetMap buildings and infrastructure
// with the modelled reach of the water, and the vegetation-loss overlay (data/build_layers.py).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

const MIN0_AFTER_8 = 44; // minute 0 of the app is 08:44
const GREY = [0.42, 0.44, 0.45];

// arrival time colour: 08:37 pale yellow to 16:00 deep violet (minutes after 08:00)
const RAMP = [
  [37, [0.99, 0.91, 0.55]],
  [120, [0.97, 0.6, 0.25]],
  [240, [0.86, 0.3, 0.38]],
  [360, [0.55, 0.12, 0.55]],
  [480, [0.25, 0.08, 0.45]],
];
export function timeColour(m) {
  if (m <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    if (m <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1];
      const [b, cb] = RAMP[i];
      const f = (m - a) / (b - a);
      return ca.map((v, k) => v + f * (cb[k] - v));
    }
  }
  return RAMP.at(-1)[1];
}
export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.map(([m, c]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')}) ${(((m - 37) / (480 - 37)) * 100).toFixed(0)}%`).join(', ')})`;

// building and feature colours by modelled reach
export const REACH = {
  0: { name: 'above Syabrubesi, not modelled', css: '#8d8f8a', rgb: [0.55, 0.56, 0.54] },
  1: { name: 'not reached by the modelled peak', css: '#c8ccc4', rgb: [0.78, 0.8, 0.77] },
  2: { name: 'reached in the 95 % band only', css: '#f2c14e', rgb: [0.95, 0.76, 0.31] },
  3: { name: 'reached by the median peak', css: '#e8743b', rgb: [0.91, 0.45, 0.23] },
  4: { name: 'reached even in the 5 % band', css: '#d1365b', rgb: [0.82, 0.21, 0.36] },
};
export const KIND = {
  power: { name: 'power plant or substation', css: '#ffd84a' },
  dam: { name: 'dam or weir', css: '#5ec8e8' },
  school: { name: 'school', css: '#7fa6ff' },
  health: { name: 'health site', css: '#7ee08a' },
  station: { name: 'monitoring station', css: '#ffffff' },
};
export const reachCode = (r) => (r == null ? 0 : r[0] ? 4 : r[1] ? 3 : r[2] ? 2 : 1);

const interp = (x, xs, ys) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + ((x - xs[i - 1]) / (xs[i] - xs[i - 1])) * (ys[i] - ys[i - 1]);
  return ys.at(-1);
};

export class RiverLayer {
  constructor(scene, stations, model, front) {
    this.model = model;
    this.front = front;
    this.km0 = model.km[0];
    const all = stations;
    this.upper = all.filter((s) => s.km <= this.km0 + 0.05);
    this.lower = all.filter((s) => s.km >= this.km0 - 0.05);
    // arrival (minutes after 08:00): model median below Syabrubesi, middle of the reported envelope above it
    this.arrUpper = this.upper.map((s) => (interp(s.km, front.km, front.earliest) + interp(s.km, front.km, front.latest)) / 2);
    this.arrLower = this.lower.map((s) => {
      const j = model.sectionIndex(s.km);
      return model.meta.arrivalMin[j][1] ?? Number.NaN;
    });
    this.mat = {
      lower: new LineMaterial({ vertexColors: true, linewidth: 3.2, worldUnits: false, depthTest: true }),
      upper: new LineMaterial({ vertexColors: true, linewidth: 3.2, dashed: true, dashSize: 260, gapSize: 160, worldUnits: false }),
    };
    this.lines = {
      lower: this.line(this.lower, this.mat.lower),
      upper: this.line(this.upper, this.mat.upper),
    };
    this.lines.upper.computeLineDistances();
    scene.add(this.lines.lower, this.lines.upper);
    this.last = null;
  }

  line(st, mat) {
    const g = new LineGeometry();
    g.setPositions(st.flatMap((s) => [s.x, s.bed + 14, s.z]));
    g.setColors(st.flatMap(() => GREY));
    const l = new Line2(g, mat);
    l.frustumCulled = false;
    return l;
  }

  // the reported front zone above Syabrubesi at a minute after 08:00: the flood had certainly passed `passed` and
  // may have reached `reach`
  upperFront(m) {
    const f = this.front;
    const kmAt = (times) => {
      let k = null;
      for (let i = 0; i < f.km.length; i++) {
        if (times[i] <= m) k = f.km[i];
        else if (i > 0 && times[i - 1] <= m) k = f.km[i - 1] + ((m - times[i - 1]) / (times[i] - times[i - 1])) * (f.km[i] - f.km[i - 1]);
        if (times[i] > m) break;
      }
      return k;
    };
    return { passed: kmAt(f.latest), reach: kmAt(f.earliest) };
  }

  setResolution(w, h) {
    for (const m of Object.values(this.mat)) m.resolution.set(w, h);
  }

  setVisible(on) {
    for (const l of Object.values(this.lines)) l.visible = on;
  }

  update(minute) {
    const m = minute + MIN0_AFTER_8;
    const key = Math.round(m * 2);
    if (key === this.last) return;
    this.last = key;
    const zone = this.upperFront(m);
    const colours = (st, arr, upper) =>
      st.flatMap((s, i) => {
        if (upper && zone.reach != null && s.km > (zone.passed ?? 0) && s.km <= zone.reach) return [1, 0.62, 0.2];
        return Number.isFinite(arr[i]) && arr[i] <= m ? timeColour(arr[i]) : GREY;
      });
    this.lines.lower.geometry.setColors(colours(this.lower, this.arrLower, false));
    this.lines.upper.geometry.setColors(colours(this.upper, this.arrUpper, true));
  }
}

export class InfraLayer {
  constructor(scene, osm, buildingsBuf) {
    this.osm = osm;
    this.group = new THREE.Group();
    scene.add(this.group);
    // buildings: float32 [n][x, z, ground] then uint8 [n] code
    const n = osm.buildings.count;
    const xyz = new Float32Array(buildingsBuf, 0, n * 3);
    const code = new Uint8Array(buildingsBuf, n * 12, n);
    this.bCode = code;
    this.bXYZ = xyz;
    const mk = (pick, size, opacity) => {
      const idx = [];
      for (let i = 0; i < n; i++) if (pick(code[i])) idx.push(i);
      const pos = new Float32Array(idx.length * 3);
      const col = new Float32Array(idx.length * 3);
      idx.forEach((i, k) => {
        pos.set([xyz[i * 3], xyz[i * 3 + 2] + 4, xyz[i * 3 + 1]], k * 3);
        col.set(REACH[code[i]].rgb, k * 3);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: opacity < 1, opacity }));
      p.userData = { kind: 'building', index: idx };
      p.frustumCulled = false;
      this.group.add(p);
      return p;
    };
    this.bDim = mk((c) => c <= 1, 2.2, 0.75);
    this.bHot = mk((c) => c >= 2, 5.5, 1);
    // reached buildings are drawn after the water (which does not write depth), so they stay visible under it
    this.bHot.material.transparent = true;
    this.bHot.renderOrder = 3;

    // point features
    this.pointFeats = osm.features.filter((f) => KIND[f.kind]);
    const pos = new Float32Array(this.pointFeats.length * 3);
    const col = new Float32Array(this.pointFeats.length * 3);
    this.pointFeats.forEach((f, k) => {
      pos.set([f.x, f.ground + 8, f.z], k * 3);
      col.set(new THREE.Color(KIND[f.kind].css).toArray(), k * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 8, sizeAttenuation: false, vertexColors: true }));
    this.points.userData = { kind: 'feature' };
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // bridges and main roads as screen-width segments, coloured by reach
    this.lineFeats = osm.features.filter((f) => f.kind === 'bridge' || f.kind === 'road');
    const seg = (filter, width) => {
      const p = [];
      const c = [];
      const owner = [];
      this.lineFeats.forEach((f, fi) => {
        if (!filter(f)) return;
        const rgb = f.kind === 'bridge' ? REACH[reachCode(f.reach)].rgb : [0.55, 0.56, 0.52];
        for (let i = 0; i < f.line.length - 1; i++) {
          const [x1, z1, y1] = f.line[i];
          const [x2, z2, y2] = f.line[i + 1];
          p.push(x1, y1 + 6, z1, x2, y2 + 6, z2);
          const hot = f.kind === 'road' && (f.vreach[i] || f.vreach[i + 1]);
          const cc = hot ? REACH[3].rgb : rgb;
          c.push(...cc, ...cc);
          owner.push(fi);
        }
      });
      const geo = new LineSegmentsGeometry();
      geo.setPositions(p);
      geo.setColors(c);
      const mat = new LineMaterial({ vertexColors: true, linewidth: width, worldUnits: false });
      const l = new LineSegments2(geo, mat);
      l.userData = { kind: 'line', owner };
      l.frustumCulled = false;
      this.group.add(l);
      return l;
    };
    this.roads = seg((f) => f.kind === 'road', 1.1);
    this.bridges = seg((f) => f.kind === 'bridge', 4.5);
    this.lineMats = [this.roads.material, this.bridges.material];
    this.group.visible = false;
  }

  setResolution(w, h) {
    for (const m of this.lineMats) m.resolution.set(w, h);
  }

  setVisible(on) {
    this.group.visible = on;
  }

  // where only the 120 m overview is drawn, its surface can lie above the true ground: lift the points onto it
  // (heightAt gives the overview height; detailAt says whether a 30 m tile is shown there)
  lift(heightAt, detailAt) {
    for (const pts of [this.bDim, this.bHot, this.points]) {
      const pos = pts.geometry.attributes.position;
      if (!pts.userData.ground) pts.userData.ground = Float32Array.from({ length: pos.count }, (_, i) => pos.getY(i));
      const g = pts.userData.ground;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, detailAt(x, z) ? g[i] : Math.max(g[i], heightAt(x, z) + 4));
      }
      pos.needsUpdate = true;
    }
  }

  // nearest pickable thing under the pointer: a point feature, a reached building, a bridge
  pick(raycaster, viewDist) {
    if (!this.group.visible) return null;
    // pick radius in metres grows with the distance to the view target
    raycaster.params.Points.threshold = Math.max(25, viewDist / 150);
    raycaster.params.Line2 = { threshold: 6 };
    const hits = raycaster.intersectObjects([this.points, this.bridges, this.bHot], false);
    if (!hits.length) return null;
    const h = hits[0];
    if (h.object === this.points) return { type: 'feature', f: this.pointFeats[h.index] };
    if (h.object === this.bridges) return { type: 'feature', f: this.lineFeats[this.bridges.userData.owner[h.faceIndex ?? h.index ?? 0]] };
    const i = this.bHot.userData.index[h.index];
    return { type: 'building', code: this.bCode[i], x: this.bXYZ[i * 3], z: this.bXYZ[i * 3 + 1], ground: this.bXYZ[i * 3 + 2] };
  }
}
