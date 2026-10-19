// Panels: the selected place, the timeline, the river profile and the sources drawer. Plain DOM and SVG.

const MIN0 = 8 * 60 + 44; // minute 0 = 08:44
const REPO = 'https://github.com/0xbyt4/himalayan-valley-floods';
const VERSION = '2026-10-19';
// the spread-map runs by the names the run buttons use
const RUN_NAME = { lower: 'Smaller', central: 'Middle', upper: 'Larger' };
const runName = (label) => RUN_NAME[label] ?? label;

export const clockOf = (minute) => {
  const m = Math.round(MIN0 + minute);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const minuteOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m - MIN0;
};
const fmtMinAfter8 = (v) => (v == null ? '-' : clockOf(v - 44));
const n0 = (v) => (v == null ? '-' : Math.round(v).toLocaleString('en'));
const n1 = (v) => (v == null ? '-' : v.toFixed(1));
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function srcLinks(facts, ids) {
  return ids
    .map((id) => {
      const s = facts.sources[id];
      if (!s) return '';
      const name = s.short || s.label;
      return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.label)}">${esc(name)}</a>` : esc(name);
    })
    .join(' &middot; ');
}

// the card head: title, a line under it, and a close button (main.mjs closes the card on [data-close-card])
const cardHead = (title, sub) =>
  `<div class="hd"><div><h3>${esc(title)}</h3><div class="km">${sub}</div></div><button type="button" class="ibtn sm" data-close-card aria-label="Close"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
const kmText = (km) => (km === 0 ? 'the collapse source' : `${n1(km)} km down the river from the collapse`);
const BAR_MAX = 30; // m: the range bar of the place card

// the spread map (2-D run) at a place: its gauge record when the place is a gauge, the river at the place's chainage
// (the drawn cell nearest to that river station) and whether the water reached the map pin itself
function place2d(f2) {
  if (!f2) return '';
  const { meta, gauge: g, river: c, point } = f2;
  let rows = '';
  if (g) {
    rows += `<tr><td>Flood arrives at the gauge (water up 1 m)</td><td>${fmtMinAfter8(g.front_1m)}</td></tr><tr><td>Highest water above usual</td><td>+${n1(g.peak_rise_m)} m, ${fmtMinAfter8(g.peak_time)}</td></tr>`;
    if (g.peak_q) rows += `<tr><td>Peak flow</td><td>${n0(g.peak_q)} m&sup3;/s</td></tr>`;
  }
  if (c) rows += `<tr><td>First water on the river here (0.5 m up)</td><td>${c.arrive == null ? '-' : fmtMinAfter8(c.arrive)}</td></tr><tr><td>Deepest water, fastest flow</td><td>${n1(c.hmax)} m, ${n1(c.vmax)} m/s</td></tr>`;
  rows += `<tr><td>Water at the map pin</td><td>${point ? `${n1(point.hmax)} m at most` : 'none modelled'}</td></tr>`;
  return `<div class="sec"><details><summary>Spread map, ${esc(runName(meta.label)).toLowerCase()} run</summary><table>${rows}</table>
    <div class="src">30 m model cells. The pin marks the town or the station building, which can sit above the river; the river rows are for the river itself. <span class="g MODEL">MODEL</span></div></details></div>`;
}

const reportedRow = (facts, f) => `<div class="fact">${esc(f.text)}<span class="g ${esc(f.grade)}">${esc(f.grade)}</span><div class="src">${srcLinks(facts, f.src)}</div></div>`;

// the place card: built once per selection; only the lines that change with time are updated afterwards
export function renderPlace(el, place, minute, model, facts, f2 = null) {
  const sec = model.sectionAt(place.chainage_km);
  const obs = facts.places[place.name] || [];
  let html = cardHead(place.name.replace(' gauge', '').replace(' (CLaSH)', ''), `${place.name.includes('gauge') ? 'river gauge &middot; ' : ''}${kmText(place.chainage_km)}`);
  if (sec == null) {
    html += `<div class="sec"><div class="cap">Model</div><div class="fact">Not modelled here. Above Syabrubesi the flood carried avalanche ice and rock, and no gauge survived the peak. The water model starts at Syabrubesi, km 35.7.</div>`;
    if (facts.front && place.chainage_km > 0) {
      const [a, b] = frontAt(facts.front, place.chainage_km);
      html += `<div class="fact" style="margin-top:10px">The front arrived between ${fmtMinAfter8(a)} and ${fmtMinAfter8(b)}: the range for a front moving downstream, bounded by the Gyirong and Syabrubesi reports; some reports fall outside it.<span class="g DISPUTED">DISPUTED</span><div class="src">${facts.front.reports.map((r) => esc(r.text)).join('; ')}</div></div>`;
    }
    html += '</div>';
    if (obs.length) html += `<div class="sec"><div class="cap">What agencies and scientists reported</div>${obs.map((f) => reportedRow(facts, f)).join('')}</div>`;
  } else {
    const j = model.sectionIndex(place.chainage_km);
    const m = model.meta;
    const rep = facts.reported_rise?.[place.name];
    html += `<div class="hero"><b data-live="now">+0.0 m</b><span>water above the usual river level at <span data-live="clock" class="num">-</span> &middot; river-level model, most likely</span></div>
      <div class="band"><span data-live="band">likely range -</span> <span class="g MODEL">MODEL</span></div>
      <div class="bar" aria-hidden="true"><i data-live="range"></i><b data-live="tick"></b>${rep ? `<u style="left:${(Math.min(rep.m[0], BAR_MAX) / BAR_MAX) * 100}%;width:max(6px, ${((rep.m[1] - rep.m[0]) / BAR_MAX) * 100}%)"></u>` : ''}</div>
      <div class="scale"><span>0</span><span>10 m</span><span>20 m</span><span>30 m</span></div>
      ${rep ? `<div class="src" style="margin-top:6px"><span style="display:inline-block;width:8px;height:10px;border:1.5px solid var(--obs);border-radius:2px;vertical-align:-1px;margin-right:5px"></span>reported highest: +${rep.m[0] === rep.m[1] ? n1(rep.m[0]) : `${n1(rep.m[0])} to ${n1(rep.m[1])}`} m near ${esc(rep.time)}</div>` : ''}`;
    if (obs.length) {
      html += `<div class="sec"><div class="cap">What agencies and scientists reported</div>${reportedRow(facts, obs[0])}</div>`;
      if (obs.length > 1) html += `<div class="sec"><details><summary>${obs.length - 1} more report${obs.length > 2 ? 's' : ''}</summary>${obs.slice(1).map((f) => reportedRow(facts, f)).join('')}</details></div>`;
    }
    html += `<div class="sec"><div class="cap">River-level model, whole day</div><table><tr><th></th><th>5 / 50 / 95 % of runs</th></tr>
      <tr><td>Flood arrives (water up 1 m)</td><td>${m.arrivalMin[j].map(fmtMinAfter8).join(' / ')}</td></tr>
      <tr><td>Highest water above usual</td><td>${m.peakRise[j].map(n1).join(' / ')} m</td></tr>
      <tr><td>Peak flow</td><td>${m.peakQ[j].map(n0).join(' / ')} m&sup3;/s</td></tr></table></div>`;
    html += place2d(f2);
  }
  el.innerHTML = html;
  updatePlace(el, place, minute, model);
}

export function updatePlace(el, place, minute, model) {
  const now = el.querySelector('[data-live="now"]');
  if (!now) return;
  const [a, b, c] = [0, 1, 2].map((band) => model.rise(place.chainage_km, minute, band));
  now.textContent = `+${n1(b)} m`;
  el.querySelector('[data-live="clock"]').textContent = clockOf(minute);
  el.querySelector('[data-live="band"]').textContent = `likely range ${n1(a)} to ${n1(c)} m (5 to 95 % of 411 runs)`;
  const pct = (v) => `${(Math.min(Math.max(v, 0), BAR_MAX) / BAR_MAX) * 100}%`;
  const r = el.querySelector('[data-live="range"]');
  r.style.left = pct(a);
  r.style.width = `calc(${pct(c)} - ${pct(a)})`;
  el.querySelector('[data-live="tick"]').style.left = pct(b);
}

// the time track: a rail filled up to now, hour marks, a diamond per reported event (its text in a tooltip on hover
// or focus, and for 2.5 s when playback passes it). The range input on top does the dragging and the keyboard.
export function buildTimeline(track, slider, facts, onJump) {
  const T0 = Number(slider.min);
  const T1 = Number(slider.max);
  const pct = (m) => ((m - T0) / (T1 - T0)) * 100;
  track.insertAdjacentHTML('beforeend', '<div class="rail"></div><div class="done"></div><div class="thumb"></div><div class="tip" hidden></div>');
  const done = track.querySelector('.done');
  const thumb = track.querySelector('.thumb');
  const tip = track.querySelector('.tip');
  for (let m = T0; m <= T1; m++) {
    const h = (MIN0 + m) / 60;
    if (!Number.isInteger(h) || h < 9) continue;
    track.insertAdjacentHTML('beforeend', `<span class="hr${h % 3 ? ' minor' : ''}" style="left:${pct(m)}%">${String(h).padStart(2, '0')}:00</span>`);
  }
  const marks = facts.events.map((e) => {
    const m = minuteOf(e.time);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ev';
    b.style.left = `${pct(m)}%`;
    b.setAttribute('aria-label', `${e.time} ${e.text} (${e.grade})`);
    const show = () => {
      tip.innerHTML = `<span class="num">${esc(e.time)}</span>${esc(e.text)} <span class="g ${esc(e.grade)}">${esc(e.grade)}</span>`;
      tip.style.left = `${Math.min(85, Math.max(15, pct(m)))}%`;
      tip.hidden = false;
    };
    b.onmouseenter = show;
    b.onfocus = show;
    b.onmouseleave = b.onblur = () => (tip.hidden = true);
    b.onclick = () => onJump(m);
    track.appendChild(b);
    return { m, b, show };
  });
  let last = null;
  let tipUntil = 0;
  return (minute, playing) => {
    done.style.width = `${pct(minute)}%`;
    thumb.style.left = `${pct(minute)}%`;
    for (const k of marks) k.b.classList.toggle('past', k.m <= minute);
    if (playing && last != null) {
      const passed = marks.find((k) => k.m > last && k.m <= minute);
      if (passed) {
        passed.show();
        tipUntil = performance.now() + 2500;
      }
    }
    if (tipUntil && performance.now() > tipUntil && !track.matches(':hover') && !track.contains(document.activeElement)) {
      tip.hidden = true;
      tipUntil = 0;
    }
    last = minute;
  };
}

// river profile: rise above the normal river along the chainage, now and at its highest
export function renderProfile(svg, model, minute, facts) {
  // one SVG unit per screen pixel, so the text keeps its shape
  const W = Math.max(600, Math.round(svg.clientWidth || 1000));
  const H = 260;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const kmMax = Math.ceil(model.km.at(-1) + 1);
  const X = (km) => 50 + (km / kmMax) * (W - 70);
  const top = Math.max(...model.meta.peakRise.map((v) => v[2] ?? 0));
  const yMax = Math.ceil(top / 5) * 5; // the whole 95 % band fits
  const Y = (r) => H - 30 - (Math.min(r, yMax) / yMax) * (H - 50);
  const k = model.km;
  const m = model.meta;
  const band = (lo, hi) => `${k.map((km, j) => `${X(km)},${Y(lo[j])}`).join(' ')} ${k.map((km, j) => `${X(km)},${Y(hi[j])}`).reverse().join(' ')}`;
  const now = [0, 1, 2].map((b) => k.map((km) => model.rise(km, minute, b)));
  let s = '';
  for (let r = 0; r <= yMax; r += yMax > 30 ? 10 : 5) s += `<line x1="50" x2="${W - 20}" y1="${Y(r)}" y2="${Y(r)}" stroke="rgba(238,240,234,.12)"/><text x="44" y="${Y(r) + 4}" text-anchor="end">+${r} m</text>`;
  for (let km = 0; km <= kmMax - 5; km += 20) s += `<text x="${X(km)}" y="${H - 10}" text-anchor="middle">${km} km</text>`;
  s += `<polygon points="${band(m.peakRise.map((v) => v[0]), m.peakRise.map((v) => v[2]))}" fill="rgba(217,137,74,.14)"/>`;
  s += `<polygon points="${band(now[0], now[2])}" fill="rgba(217,137,74,.45)"/>`;
  s += `<polyline points="${k.map((km, j) => `${X(km)},${Y(now[1][j])}`).join(' ')}" fill="none" stroke="#d9894a" stroke-width="2"/>`;
  s += `<line x1="${X(35.7)}" x2="${X(35.7)}" y1="${Y(yMax)}" y2="${Y(0)}" stroke="rgba(238,240,234,.35)" stroke-dasharray="3 3"/><text x="${X(35.7) - 6}" y="${Y(yMax) + 10}" text-anchor="end">model starts</text>`;
  // reported peak at Galchhi: +8.5 m (CLaSH) to about 8.9 m (ICIMOD)
  s += `<rect x="${X(97.1) - 4}" y="${Y(8.9)}" width="8" height="${Math.max(2, Y(8.5) - Y(8.9))}" fill="#e9c46a"/><text x="${X(97.1) + 8}" y="${Y(8.9) - 4}" fill="#e9c46a" style="fill:#e9c46a">Galchhi reported peak +8.5 to 8.9 m</text>`;
  for (const p of facts.profilePlaces || []) s += `<text x="${X(p.km)}" y="${Y(yMax) - 2}" text-anchor="middle">${esc(p.name)}</text>`;
  svg.innerHTML = s;
}

export function renderSources(el, facts, scene, model, runs2d = null) {
  const img = scene.imagery;
  el.innerHTML = `
    <p class="cap">${esc(facts.toll.text)} <span class="g ${esc(facts.toll.grade)}">${esc(facts.toll.grade)}</span> <span class="src">${srcLinks(facts, facts.toll.src)}</span></p>
    <h3>What the water shows</h3>
    <ul>
      <li>The rise of the water above the normal river, from a water-only flood routing model started at Syabrubesi (km 35.7) and checked against seven reported times and the Devghat peak flow. ${model.meta.runs} model runs make the bands (5, 50 and 95 %): ${model.meta.structures.uniform} with one roughness for the whole river and ${model.meta.structures.jarrett} with roughness scaled by slope. Grade: UNCERTAIN.</li>
      <li>Few runs meet all eight checks (8 of 16,000), so the bands also include runs that miss one of the Mugling front and the Devghat peak time, the Devghat peak by up to about 70 minutes.</li>
      <li>Modelled levels run low: the cross-sections come from a surface model that does not see the river bed under water. At Galchhi the reported peak (+8.5 to 8.9 m) sits in the upper half of the band.</li>
      <li>Above Syabrubesi the flood carried avalanche ice and rock and is not modelled; only reports are shown there.</li>
      <li>The terrain is a surface model at 30 m. Narrow gorges appear shallower than they are, so the river is burned in at the modelled bed; depths are approximate.</li>
      <li>Full method, equations, tests and limits: <a href="${REPO}/blob/main/research/methods.md" target="_blank" rel="noopener">research/methods.md</a>, section 4.6.</li>
    </ul>
    ${
      runs2d
        ? `<h3>The 2D flood map</h3>
    <ul>
      <li>Where the water spreads: a two-dimensional shallow-water model on the 30 m terrain from Syabrubesi to below Devghat, so the water can leave the channel, fill side valleys and flats, and narrow and widen with the valley. Grade: UNCERTAIN.</li>
      <li>Runs shown: ${runs2d.runs.map((r) => `${esc(runName(r.label))}: ${r.volume_Mm3} million m&sup3; with a peak of ${n0(r.q_peak)} m&sup3;/s at Syabrubesi, ${r.hits} of ${runs2d.checks} report checks met`).join('; ')}.</li>
      <li>The 30 m grid resolves the river channel with few cells, so the model burns a 260 m wide band in at the river bed, wider than the channel on the map and cut into the valley walls in gorges. It is a calibrated stand-in for the channel, and the levels at the gauges are read inside it. Depths are shown against the map terrain. Water only: no debris, sediment or bank erosion.</li>
      <li>Full method, tests and calibration: <a href="${REPO}/blob/main/research/methods.md" target="_blank" rel="noopener">research/methods.md</a>, section 4.9.</li>
    </ul>`
        : ''
    }
    <h3>Grades</h3>
    <ul><li><span class="g SOLID">SOLID</span> a primary source (agency report, instrument record, official situation report) and no conflicting source</li><li><span class="g LIKELY">LIKELY</span> a primary source marked preliminary, a named scientist's analysis, or two independent secondary sources that agree</li><li><span class="g UNCERTAIN">UNCERTAIN</span> a single secondary source, an approximate value, or a value derived here (all model results)</li><li><span class="g DISPUTED">DISPUTED</span> credible sources disagree; the range and the names are given</li></ul>
    <h3>Reported events</h3>
    <ul>${facts.events.map((e) => `<li>${esc(e.time)} &middot; ${esc(e.text)}<span class="g ${esc(e.grade)}">${esc(e.grade)}</span><br><span class="src">${srcLinks(facts, e.src)}</span></li>`).join('')}</ul>
    <h3>Sources</h3>
    <ul>${Object.values(facts.sources).map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ul>
    <h3>Data</h3>
    <ul>
      <li>Terrain: produced using Copernicus WorldDEM-30 &copy; DLR e.V. 2010-2014 and &copy; Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.</li>
      <li>Buildings, bridges, roads and facilities: &copy; OpenStreetMap contributors, ODbL (<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a>); the derived reach data is available under the ODbL.</li>
      <li>Vegetation loss: our analysis of Copernicus Sentinel-2 red and near-infrared bands (NDVI), clouds masked with the scene classification layer. Not an official damage map.</li>
      <li>Imagery: ${img ? `${esc(img.attribution)}; before ${esc(img.before.dates.join(', '))}; after ${esc(img.after.dates.join(', '))}; clouds masked per pixel with the scene classification layer; where a date has no clear view, the other date is shown in dim grey` : 'not loaded'}.</li>
    </ul>`;
}

// --- layers ---------------------------------------------------------------------------------------------------

const REACH_TEXT = ['above Syabrubesi: not modelled', 'not reached by the modelled peak', 'reached only in the 95 % band', 'reached by the median modelled peak', 'reached even in the 5 % band'];
const reachCodeOf = (r) => (r == null ? 0 : r[0] ? 4 : r[1] ? 3 : r[2] ? 2 : 1);

// a picked OpenStreetMap feature or building
export function renderFeature(el, hit, facts) {
  let html;
  if (hit.type === 'building') {
    html = `${cardHead('Building', 'OpenStreetMap footprint')}
      <div class="sec"><div class="cap">Modelled peak water</div><div class="fact">${REACH_TEXT[hit.code]}</div></div>
      <div class="sec"><div class="cap">Ground</div><div class="fact">${n0(hit.ground)} m above sea level (surface model)</div></div>`;
  } else {
    const f = hit.f;
    const kind = { bridge: 'Bridge', road: 'Road', power: 'Power plant or substation', dam: 'Dam or weir', school: 'School', health: 'Health site', station: 'Monitoring station' }[f.kind] || f.kind;
    const tags = Object.entries(f.tags || {}).map(([k, v]) => `${esc(k)}=${esc(v)}`).join(', ');
    const [type, id] = f.id.split('/');
    html = `${cardHead(f.name || kind, `${esc(kind)} &middot; ${kmText(f.km)}, ${n0(f.dist)} m from it`)}
      <div class="sec"><div class="cap">Modelled peak water</div><div class="fact">${REACH_TEXT[reachCodeOf(f.reach)]}${f.rise ? `<div class="src">highest water here, 5 / 50 / 95 % of runs: ${f.rise.map(n1).join(' / ')} m above the usual level</div>` : ''}</div></div>
      <div class="sec"><div class="cap">Ground</div><div class="fact">${n0(f.ground)} m above sea level, from the surface model at the point nearest the river${f.kind === 'bridge' ? ' (this may be the deck or the water surface)' : ''}</div></div>
      <div class="sec"><div class="cap">OpenStreetMap</div><div class="fact"><a href="https://www.openstreetmap.org/${esc(type)}/${esc(id)}" target="_blank" rel="noopener">${esc(f.id)}</a>${tags ? `<div class="src">${tags}</div>` : ''}</div></div>`;
  }
  html += `<div class="sec src">The model carries water only (no debris, sediment or bank erosion) and its levels run low; see "What the water reached" in Charts. <span class="g MODEL">MODEL</span></div>`;
  el.innerHTML = html;
  void facts;
}

export function renderEvent(el, p, facts) {
  el.innerHTML = `${cardHead(p.name, `${esc(p.kind)} &middot; ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`)}
    <div class="sec"><div class="cap">What agencies and scientists reported</div>${reportedRow(facts, p)}</div>`;
}

// the reported front above Syabrubesi at a chainage (minutes after 08:00)
export function frontAt(front, km) {
  const lerp = (arr) => {
    for (let i = 1; i < front.km.length; i++) if (km <= front.km[i]) return arr[i - 1] + ((km - front.km[i - 1]) / (front.km[i] - front.km[i - 1])) * (arr[i] - arr[i - 1]);
    return arr.at(-1);
  };
  return [lerp(front.earliest), lerp(front.latest)];
}

export function renderReach(el, osm, change, facts) {
  const c = osm.counts;
  const row = (label, k) => {
    const x = c[k] || { total: 0, modelled: 0, p5: 0, p50: 0, p95: 0 };
    return `<tr><td>${label}</td><td>${n0(x.total)}</td><td>${n0(x.total - x.modelled)}</td><td>${n0(x.p5)} / ${n0(x.p50)} / ${n0(x.p95)}</td></tr>`;
  };
  const reported = facts.reported_reach
    .map((r) => `<li><b>${esc(r.what)}:</b> ${esc(r.value)}<span class="g ${esc(r.grade)}">${esc(r.grade)}</span> <span class="src">${srcLinks(facts, r.src)}</span></li>`)
    .join('');
  const byKm = Object.entries(osm.buildings.by_km)
    .map(([k, v]) => `<tr><td>km ${esc(k)}</td><td>${n0(v.reduce((a, b) => a + b, 0))}</td><td>${n0(v[0])}</td><td>${n0(v[4])} / ${n0(v[3] + v[4])} / ${n0(v[2] + v[3] + v[4])}</td></tr>`)
    .join('');
  const ch = change
    ? `<h3>Vegetation loss seen from space</h3>
       <p>${n0(change.loss_ha)} ha of vegetation lost on the valley floor (up to ${change.method.valley_height_m} m above the river bed, within ${n0(change.method.lateral_m)} m of it), comparing ${esc('Oct-Nov 2025')} with ${esc('late Sep-mid Oct 2026')}; ${n0(change.no_clear_view_ha)} ha had no clear view. <span class="g UNCERTAIN">OUR ANALYSIS</span> <span class="src">${srcLinks(facts, ['s2'])}</span></p>
       <p class="src">By 10 km reach: ${Object.entries(change.by_km).map(([k, v]) => `km ${esc(k)} ${n0(v)} ha`).join(' &middot; ')}. Includes harvested fields and other changes that are not flood damage; it misses damage where no vegetation grew before (bare river banks, roads, roofs).</p>`
    : '<h3>Vegetation loss seen from space</h3><p>Not built yet.</p>';
  el.innerHTML = `
    <p class="cap">OpenStreetMap features within 2 km of the river (data of ${esc((osm.osm_timestamp || '').slice(0, 10))}), and whether the modelled peak water reaches them: the ground lies below the modelled peak level and inside the modelled water width at the nearest cross-section.</p>
    <table class="reach"><thead><tr><th></th><th>in OSM</th><th>above Syabrubesi (not modelled)</th><th>reached, 5 / 50 / 95 %</th></tr></thead><tbody>
      ${row('Buildings', 'building')}${row('Bridges', 'bridge')}${row('Main roads (ways)', 'road')}${row('Power plants and substations', 'power')}${row('Dams and weirs', 'dam')}${row('Schools', 'school')}${row('Health sites', 'health')}${row('Monitoring stations', 'station')}
    </tbody></table>
    <h3>What the reports say</h3><ul>${reported}</ul>
    <h3>Why the model reaches far less</h3>
    <ul>
      <li>The model carries water only. The flood also carried rock, ice, sediment and trees, cut away its banks and buried land under debris; none of that is in a water level.</li>
      <li>Its cross-sections come from a surface model that does not see the river bed, so its levels run low (at Galchhi the reported peak sits in the upper half of the band).</li>
      <li>Above Syabrubesi, where the flow was a debris flow up to tens of metres high, the model does not run at all; ${n0(Object.values(osm.buildings.by_km).reduce((t, v) => t + v[0], 0))} mapped buildings there are left out.</li>
      <li>OpenStreetMap may be incomplete, and some buildings destroyed by the flood may since have been removed from it.</li>
    </ul>
    <p>So the counts above are a lower bound from the water alone, not an estimate of the damage.</p>
    <h3>Buildings by reach of the river</h3>
    <table class="reach"><thead><tr><th></th><th>in OSM</th><th>not modelled</th><th>reached, 5 / 50 / 95 %</th></tr></thead><tbody>${byKm}</tbody></table>
    ${ch}
    <p class="src">${esc(osm.attribution)}</p>`;
}

const ARRIVAL_TICKS = [[37, '08:37'], [180, '11:00'], [300, '13:00'], [480, '16:00']];
const WATER_RAMP = 'linear-gradient(90deg,#9e8057,#45301c)';
const REACH_COLOURS = [['#d1365b', 'even the low estimate'], ['#e8743b', 'middle estimate'], ['#f2c14e', 'only the high estimate'], ['#c8ccc4', 'not reached'], ['#8d8f8a', 'outside the model']];

// the short legend: the water as shown now and, if on, the arrival colours; a button opens the layers panel
export function renderLegendMini(el, on, rampCss, model2d) {
  let html = model2d
    ? `<div class="row"><div class="lt"><span>Water depth &middot; spread map</span><button type="button" data-open-settings>All layers &rsaquo;</button></div><div class="ramp" style="background:${WATER_RAMP}"></div><div class="rt"><span>0 m</span><span>4 m</span><span>8+ m</span></div></div>`
    : `<div class="row"><div class="lt"><span>Water &middot; river-level model</span><button type="button" data-open-settings>All layers &rsaquo;</button></div><div class="src" style="margin-top:4px"><span class="dot" style="background:#6b5338"></span>most likely now <span class="dot" style="background:#a47e52;margin-left:8px"></span>highest so far <span class="dot" style="background:#e6d3a8;margin-left:8px"></span>high end</div></div>`;
  if (on.river) html += `<div class="row"><div class="lt"><span>When the flood arrived</span></div><div class="ramp" style="background:${rampCss}"></div><div class="rt">${ARRIVAL_TICKS.map(([, t]) => `<span>${t}</span>`).join('')}</div></div>`;
  el.innerHTML = html;
}

// the legend under each layer switch in the layers panel
export function renderLegendRows(root, rampCss, change) {
  const set = (k, html) => {
    const el = root.querySelector(`[data-legend="${k}"]`);
    if (el) el.innerHTML = html;
  };
  set('river', `<div class="ramp" style="background:${rampCss}"></div><span class="rt">${ARRIVAL_TICKS.map(([, t]) => `<span>${t}</span>`).join('')}</span>solid: river-level model, most likely &middot; dashed: reported times above Syabrubesi &middot; <span style="color:#ff9e33">orange</span>: where reports put the front &middot; grey: not reached yet`);
  set('events', '&#10035; source &nbsp;&#9650; landslide &nbsp;&#9670; lake &nbsp;&#9646; gauge &nbsp;&#8597; reported flow height');
  set('infra', `${REACH_COLOURS.map(([c, t]) => `<span class="lgi"><span class="dot" style="background:${c}"></span>${t}</span>`).join('')}<br>reached by the modelled peak water (river-level model) &middot; &copy; OpenStreetMap contributors, ODbL &middot; click one for details`);
  set('change', `<span class="lgi"><span class="dot" style="background:#e24aa0"></span>vegetation lost after the flood</span><span class="lgi"><span class="dot" style="background:#969696"></span>no clear view</span><br>valley floor, seen when zoomed in; our analysis of Copernicus Sentinel-2 data, not an official damage map${change ? '' : ' (not built yet)'}`);
}

// "How sure is this?": the two models in two sentences, how each 2-D run fits the reports (the checks written into
// each run's meta.json by model/export_flood2d.py), and the plain limits. runs: the meta of each run, in index order.
const OBS_WHAT = { front_1m: 'flood arrives (water up 1 m)', peak_time: 'peak', peak_rise_m: 'highest rise', peak_q: 'peak flow' };
function obsText(what, v) {
  if (v == null) return '-';
  if (what === 'peak_rise_m') return `+${n1(v)} m`;
  if (what === 'peak_q') return `${n0(v)} m&sup3;/s`;
  return fmtMinAfter8(v);
}
export function renderHowSure(el, runs) {
  const obs = runs[0].obs;
  const head = runs.map((r) => `<th>${esc(runName(r.label))}<br><span class="src">${r.volume_Mm3} million m&sup3;</span></th>`).join('');
  const rows = obs
    .map((o, i) => {
      const cells = runs
        .map((r) => {
          const v = r.gauges[o.place]?.[o.what];
          const ok = r.checks[i];
          return `<td class="${ok ? 'fit' : 'miss'}">${obsText(o.what, v)}<span class="mark">${ok ? 'fits' : 'misses'}</span></td>`;
        })
        .join('');
      const rep = o.what === 'peak_rise_m' ? `${obsText(o.what, o.lo)} to ${obsText(o.what, o.hi)}*` : `${obsText(o.what, o.lo)} to ${obsText(o.what, o.hi)}`;
      return `<tr><td>${esc(o.place)}: ${OBS_WHAT[o.what] ?? esc(o.what)}</td><td>${rep}</td>${cells}</tr>`;
    })
    .join('');
  el.innerHTML = `<h3 id="howsureTitle">How sure is this?</h3>
    <p>Two models carry the water. The <b>river-level model</b> (1-D) ran 411 times with different roughness and inflow; the map and the place card show its most likely level and the range of the middle 90 % of runs. The <b>spread map</b> (2-D) shows where the water goes on the terrain; it has three runs, a smaller, a middle and a larger flood.</p>
    <p>Each spread-map run against nine reported times, levels and flows:</p>
    <div class="scroll"><table class="score"><thead><tr><th>Check</th><th>Window from reports</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="src">Each window is built from the reports, with room for their spread and for the model (research/methods.md, sections 4.6 and 4.9); it is not itself a reported value. * The reported rise at Galchhi was +8.5 to +8.9 m; the window adds 1.5 m on each side for the terrain model, which cannot see the river bed. These reports were used to choose the runs, so the table shows how well they fit, not an independent test. A run fast enough to pass Mugling by 13:00 carries too much flow at Devghat.</p>
    <h3>What the models leave out</h3>
    <ul><li>They carry water only: no rock, ice, mud or trees, no bank erosion, no blocked bridges. The real flood was higher and did more damage.</li>
      <li>The terrain is a surface model at 30 m. It cannot see the river bed under the water, so the river channel is cut in by estimate.</li>
      <li>Above Syabrubesi (the first 36 km) the flood was a debris flow; no model runs there. The map shows only where reports put the front.</li></ul>`;
}

// the About sheet: what happened, the toll, the notice, how to read the map (the sources and method follow it)
export function renderAbout(el, facts) {
  el.innerHTML = `<p class="lead">At 08:37 on 26 August 2026 rock and ice broke away above the Lhende Glacier. The flood ran 193 km down the Bhote Koshi and Trishuli rivers, through Syabrubesi, Betrawati and Galchhi, and reached Devghat in the afternoon.</p>
    <p>${esc(facts.toll.text)}<span class="g ${esc(facts.toll.grade)}">${esc(facts.toll.grade)}</span> <span class="src">${srcLinks(facts, facts.toll.src)}</span></p>
    <p class="warn"><b>Not a warning system.</b> This page rebuilds a past event from public reports and two flood models. It is not an official hazard map. The water is a model and is shown with its uncertainty.</p>
    <h3>How to read the map</h3>
    <ul>
      <li>Press play, or drag the time bar. The clock is Nepal time on 26 August.</li>
      <li>Brown water: where a 2-D model spreads the water on the terrain. The pale mud marks where it has been.</li>
      <li>The river line turns from yellow to purple as the flood arrives. Diamonds on the time bar are reported events.</li>
      <li>Click a place for what was reported there and what the models give. Grades tell how sure a fact is.</li>
      <li>Layers and view holds the other models, the satellite images before and after, buildings and vegetation loss.</li>
    </ul>
    <div id="howsure"></div>
    <h3>Method, code and data</h3>
    <p>The method, the equations, the tests and every source are in the <a href="${REPO}/blob/main/research/methods.md" target="_blank" rel="noopener">method notes</a> and the <a href="${REPO}/blob/main/research/events.md" target="_blank" rel="noopener">event chronology</a>; the code is at <a href="${REPO}" target="_blank" rel="noopener">github.com/0xbyt4/himalayan-valley-floods</a>. Corrections are welcome as issues there.</p>
    <p class="src">Version ${VERSION} &middot; facts as of 3 October 2026 &middot; not affiliated with the agencies cited.</p>`;
}

// --- cross-section ---------------------------------------------------------------------------------------------

// ground across the valley at the model section nearest `km`, with the water at `minute` (minutes after 08:44)
export function renderXsec(svg, where, xs, model, km, minute) {
  const W = Math.max(600, Math.round(svg.clientWidth || 1000));
  const H = 240;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const j = model.sectionIndex(km);
  const lat = xs.meta.lateral_m;
  const n = lat.length;
  const z = xs.z.subarray(j * n, (j + 1) * n);
  // the bed is the lowest ground within 150 m of the centreline, as in the hydraulic tables
  let bed = Infinity;
  let ib = 0;
  lat.forEach((l, i) => {
    if (Math.abs(l) <= 150 && z[i] < bed) {
      bed = z[i];
      ib = i;
    }
  });
  const k = model.km[j];
  const lv = [0, 1, 2].map((b) => bed + model.rise(k, minute, b));
  const top = bed + Math.max(model.maxSoFar(k, minute), model.rise(k, minute, 2));
  // show the wet width with a margin, at least 600 m wide
  const wet = (level) => {
    let a = ib;
    let b = ib;
    while (a > 0 && z[a - 1] <= level) a--;
    while (b < n - 1 && z[b + 1] <= level) b++;
    return [a, b];
  };
  const [wa, wb] = wet(top + 25);
  const half = Math.max(300, Math.abs(lat[wa]) + 120, Math.abs(lat[wb]) + 120);
  const i0 = lat.findIndex((l) => l >= -half);
  const i1 = n - 1 - [...lat].reverse().findIndex((l) => l <= half);
  const zmin = bed - 5;
  // up to the higher of the shown ground and 30 m above the highest water, capped so the water stays readable
  const zTop = Math.min(Math.max(...z.subarray(i0, i1 + 1)), top + 150);
  const X = (l) => 50 + ((l + half) / (2 * half)) * (W - 70);
  const Y = (v) => H - 26 - ((v - zmin) / (zTop - zmin)) * (H - 40);
  let s = '';
  const step = zTop - zmin > 200 ? 50 : zTop - zmin > 80 ? 20 : 10;
  for (let v = Math.ceil(zmin / step) * step; v <= zTop; v += step) s += `<line x1="50" x2="${W - 20}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(238,240,234,.1)"/><text x="44" y="${Y(v) + 4}" text-anchor="end">${v} m</text>`;
  for (const l of [-half, -half / 2, 0, half / 2, half]) s += `<text x="${X(l)}" y="${H - 8}" text-anchor="middle">${l === 0 ? 'centre' : `${Math.round(l)} m`}</text>`;
  // water (median) filled between the ground and its level, over the connected wet part
  const [a, b] = wet(lv[1]);
  if (lv[1] - bed >= 0.3) {
    const pts = [];
    for (let i = Math.max(a, i0); i <= Math.min(b, i1); i++) pts.push(`${X(lat[i])},${Y(Math.min(z[i], lv[1]))}`);
    s += `<polygon points="${X(lat[Math.max(a, i0)])},${Y(lv[1])} ${pts.join(' ')} ${X(lat[Math.min(b, i1)])},${Y(lv[1])}" fill="rgba(107,83,56,.85)"/>`;
  }
  const line = (level, dash, col) => {
    const [p, q] = wet(level);
    return level - bed < 0.3 ? '' : `<line x1="${X(lat[Math.max(p, i0)])}" x2="${X(lat[Math.min(q, i1)])}" y1="${Y(level)}" y2="${Y(level)}" stroke="${col}" stroke-width="1.5" stroke-dasharray="${dash}"/>`;
  };
  s += line(lv[0], '5 4', '#e6d3a8') + line(lv[2], '5 4', '#e6d3a8') + line(bed + model.maxSoFar(k, minute), '2 3', '#c79a6b');
  s += `<polyline points="${Array.from(z.subarray(i0, i1 + 1)).map((v, i) => `${X(lat[i0 + i])},${Y(v)}`).join(' ')}" fill="none" stroke="#a9b89a" stroke-width="2"/>`;
  const depth = lv[1] - bed;
  s += `<text x="${W - 24}" y="18" text-anchor="end" style="fill:#eef0ea">km ${k} &middot; deepest water now ${depth >= 0.3 ? depth.toFixed(1) : '0'} m (5-95 %: ${(lv[0] - bed).toFixed(1)}-${(lv[2] - bed).toFixed(1)} m) above the surface-model bed</text>`;
  svg.innerHTML = s;
  where.textContent = `Section at km ${k}.`;
}
