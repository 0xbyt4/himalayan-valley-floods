#!/usr/bin/env python3
"""Build the map layers of the app for the Rasuwa corridor (app/data/rasuwa/layers/).

Steps:
- events: reported points (collapse source, second landslide, post-event lakes, gauges, reported flow heights) and the
  envelope of reported front times above Syabrubesi, where the flood is not modelled. All from research/events.md.
- osm: buildings, bridges, main roads, power plants, dams and weirs, gauging stations, schools and health sites within
  2 km of the river, from OpenStreetMap through the Overpass API (ODbL). The raw answer is kept in out/.
- exposure: for each OSM feature, whether the modelled peak water (5, 50 and 95 % bands, model/export_app.mjs)
  reaches it: the ground is below the modelled peak level and the feature lies within the modelled water width at
  the nearest cross-section (plus one DEM cell).
- change: loss of vegetation between before and after the flood from Sentinel-2 red and near-infrared bands
  (NDVI), on the valley floor along the river, as transparent overlays for the detail tiles.

Usage (from the repo root): .venv/bin/python data/build_layers.py [events] [osm] [exposure] [change]
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app/data/rasuwa"
OUT = APP / "layers"
RAW = ROOT / "out/raw/osm"
CACHE = ROOT / "out/cache/s2"
DEM = ROOT / "out/derived/rasuwa/dem_utm.tif"
UTM = "EPSG:32645"
OVERPASS = "https://overpass-api.de/api/interpreter"
STAC = "https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/{id}"
BUFFER_M = 2000

# --- shared ---------------------------------------------------------------------------------------------------


def scene() -> dict:
    return json.loads((APP / "scene.json").read_text())


def to_frame(sc: dict):
    """lon, lat -> app frame (x east, z south) in metres."""
    t = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    x0, y0 = sc["origin_utm"]

    def f(lon: float, lat: float) -> tuple[float, float]:
        x, y = t.transform(lon, lat)
        return round(x - x0, 1), round(y0 - y, 1)

    return f


def write(name: str, data: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(data, separators=(",", ":")))


# --- events ---------------------------------------------------------------------------------------------------

# kind: source | landslide | lake | gauge | evidence. Coordinates and grades from research/events.md B2-B4 and E1-E3.
POINTS = [
    (
        "source", "Collapse source", 28.292511, 85.530220,
        "Approximate source of the ice-rock avalanche (CLaSH, from Planet images of 25 and 28 Aug). The USGS catalogue places the signal 2.8 km to the south-west.",
        "LIKELY", ["clash", "usgs"],
    ),
    (
        "lake", "Impact depression and its lake", 28.292884, 85.510942,
        "The mass fell about 1,000 to 1,400 m into this depression and ran about 450 m up the opposite slope. A lake about 530 m long then formed here; it drained through the ground on 31 Aug.",
        "LIKELY", ["clash", "icimod"],
    ),
    (
        "landslide", "Second landslide, 11:45", 28.3281, 85.4798,
        "Second landslide signal at 11:45:35 (USGS M4.2, SOLID). It dammed the Lhende Khola at the Chhochen confluence at about 2,800 m (LIKELY).",
        "LIKELY", ["usgs2", "icimod"],
    ),
    (
        "lake", "Landslide-dam lake, Chhochen confluence", 28.332916, 85.482467,
        "A lake of about 0.11 km2 formed behind the second landslide; it overflowed and drained on 28 Aug.",
        "LIKELY", ["clash", "ndrrma", "icimod"],
    ),
    (
        "gauge", "Border at Rasuwagadhi: station 446.22, flow height", 28.2774, 85.3777,
        "Station destroyed; its level fell slowly from the afternoon of 25 Aug until it stopped, which may show an upstream blockage or a normal recession (station location approximate). Trimlines put the flow 40 to 134 m above the river here (Geopera); observers at Timure reported a flood 200 to 300 m high (relayed).",
        "UNCERTAIN", ["icimod", "geopera", "ndrrma"],
    ),
    (
        "evidence", "Flow height in the gorges", 28.215, 85.352,
        "Median flow height about 70 m in the gorges above Syabrubesi (Geopera trimlines); valley walls scoured 100 to 200 m up (Zhao et al.).",
        "UNCERTAIN", ["geopera", "zhao"],
    ),
    (
        "gauge", "Syabrubesi station (446.25)", 28.1633, 85.3344,
        "Destroyed; stopped at 08:50 according to NDRRMA and the RDNA (ICIMOD gives 08:50 for Rasuwagadhi). Location approximate.",
        "DISPUTED", ["ndrrma", "rdna", "icimod"],
    ),
    (
        "gauge", "Betrawati (Phalakhu) station (446.8)", 27.9731, 85.1860,
        "Stopped transmitting at 09:20; last level 3.55 m, below warning (4.1 m). Location approximate.",
        "SOLID", ["ndrrma"],
    ),
    (
        "gauge", "Galchhi station", 27.7961, 85.0003,
        "Stayed in operation: +8.5 m at 10:50 (CLaSH); about 8.9 m maximum stage (ICIMOD).",
        "LIKELY", ["clash", "icimod"],
    ),
    (
        "gauge", "Phurke station near Malekhu", 27.8137, 84.8272,
        "Above warning 11:26, above danger 11:43, then lost with its bridge. Location approximate (Malekhu).",
        "SOLID", ["ndrrma", "clash"],
    ),
    (
        "gauge", "Devghat station (450)", 27.71, 84.43,
        "Narayani below the Kali Gandaki: peak 6.57 m at 16:00, about 5,850 m3/s. Location from the DHM station page, rounded to 0.01 deg.",
        "SOLID", ["ndrrma", "rdna"],
    ),
]  # fmt: skip

# reported front times above Syabrubesi, minutes after 08:00: (km, earliest, latest, text, grade, sources)
FRONT_REPORTS = [
    (0.0, 37.2, 37.2, "Collapse, 08:37:10", "SOLID", ["usgs"]),
    (21.5, 44, 45, "Debris at Gyirong port about 7 min after the collapse (CCTV)", "LIKELY", ["icimod", "clash"]),
    (22.2, 40, 65, "Rasuwagadhi: 08:40 to 09:05 in different reports", "DISPUTED", ["ndrrma", "icimod"]),
    (23.7, 43, 85, "Timure: about 08:53 (CLaSH) to 09:25 (other reports)", "DISPUTED", ["clash", "geopera"]),
    (35.7, 50, 60, "Syabrubesi: 08:50 to 09:00", "DISPUTED", ["ndrrma", "clash"]),
]


def front_envelope(reports: list) -> tuple[list[float], list[float], list[float]]:
    """Earliest and latest front times along the river that respect a front moving downstream: the earliest time
    at a place is no earlier than at any place above it, the latest no later than at any place below it."""
    km = [r[0] for r in reports]
    lo = [float(v) for v in np.maximum.accumulate([r[1] for r in reports])]
    hi = [float(v) for v in np.minimum.accumulate([r[2] for r in reports][::-1])[::-1]]
    return km, lo, [max(a, b) for a, b in zip(lo, hi, strict=True)]


def events() -> None:
    sc = scene()
    f = to_frame(sc)
    pts = []
    for kind, name, lat, lon, text, grade, src in POINTS:
        x, z = f(lon, lat)
        pts.append({"kind": kind, "name": name, "lat": lat, "lon": lon, "x": x, "z": z, "text": text, "grade": grade, "src": src})
    km, lo, hi = front_envelope(FRONT_REPORTS)
    write(
        "events.json",
        {
            "note": "Reported points and front times from research/events.md; not model output.",
            "points": pts,
            "front": {
                "note": "Envelope of reported front times above Syabrubesi, minutes after 08:00, for a front that moves downstream; bounded in practice by the Gyirong and Syabrubesi reports, so some reports (Timure 09:10-09:25, Rasuwagadhi 09:00-09:05) fall outside it.",
                "km": km,
                "earliest": [round(float(v), 1) for v in lo],
                "latest": [round(float(v), 1) for v in hi],
                "reports": [{"km": r[0], "text": r[3], "grade": r[4], "src": r[5]} for r in FRONT_REPORTS],
            },
        },
    )
    print(f"events: {len(pts)} points; front envelope {list(zip(km, lo, hi, strict=True))}")


# --- osm ------------------------------------------------------------------------------------------------------


def overpass(query: str, name: str) -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(OVERPASS, data=data, headers={"User-Agent": "himalaya-flood-explorer (research, no bulk use)"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=400) as r:
                body = r.read()
            ans = json.loads(body)
            # an overloaded server can answer with no elements or with a runtime remark: do not keep that
            if ans.get("elements") and not ans.get("remark"):
                break
            print(f"  overpass {name}: empty or partial answer ({ans.get('remark')}); retry {attempt + 1}")
        except (OSError, ValueError) as e:
            print(f"  overpass {name}: {e}; retry {attempt + 1}")
        time.sleep(30 * (attempt + 1))
    else:
        raise RuntimeError(f"overpass {name} failed")
    path.write_bytes(body)
    return json.loads(body)


def osm() -> None:
    sc = scene()
    t = Transformer.from_crs(UTM, "EPSG:4326", always_xy=True)
    x0, y0 = sc["origin_utm"]
    line = []
    for km, x, z, _ in sc["stations"][::10]:  # one point per km
        lon, lat = t.transform(x + x0, y0 - z)
        line += [f"{lat:.5f}", f"{lon:.5f}"]
    around = f"around:{BUFFER_M},{','.join(line)}"
    q_build = f'[out:json][timeout:600];way["building"]({around});out center tags;'
    q_infra = f"""[out:json][timeout:600];
(
  way["bridge"]["highway"]({around});
  way["man_made"="bridge"]({around});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]({around});
  nwr["power"~"^(plant|generator|substation)$"]({around});
  nwr["waterway"~"^(dam|weir)$"]({around});
  nwr["man_made"~"^(monitoring_station|water_works)$"]({around});
  nwr["amenity"~"^(school|hospital|clinic|doctors|college)$"]({around});
  nwr["healthcare"]({around});
);
out geom tags;"""
    b = overpass(q_build, "rasuwa_buildings")
    i = overpass(q_infra, "rasuwa_infra")
    stamp = {"buildings": b.get("osm3s", {}).get("timestamp_osm_base"), "infra": i.get("osm3s", {}).get("timestamp_osm_base")}
    print(f"osm: {len(b['elements'])} buildings, {len(i['elements'])} other features; data as of {stamp}")


# --- exposure -------------------------------------------------------------------------------------------------


def classify(ground: float, dist: float, bed: float, rises: list[float], half_widths: list[float], cell: float = 30.0) -> list[bool]:
    """For each band: does the modelled peak water reach a point at this ground height and distance from the
    centreline? The level is the corridor bed plus the peak rise; the reach is the modelled half width plus one cell."""
    return [bool(ground <= bed + r and dist <= hw + cell) for r, hw in zip(rises, half_widths, strict=True)]


def osm_kind(tags: dict) -> str | None:
    """Facility tags come first: a school or powerhouse drawn as a building is a school or powerhouse."""
    if tags.get("bridge") and tags.get("highway") or tags.get("man_made") == "bridge":
        return "bridge"
    if tags.get("power") in ("plant", "generator", "substation"):
        return "power"
    if tags.get("waterway") in ("dam", "weir"):
        return "dam"
    if tags.get("man_made") in ("monitoring_station", "water_works"):
        return "station"
    if tags.get("amenity") in ("school", "college"):
        return "school"
    if tags.get("amenity") in ("hospital", "clinic", "doctors") or "healthcare" in tags:
        return "health"
    if tags.get("highway") in ("motorway", "trunk", "primary", "secondary", "tertiary"):
        return "road"
    if "building" in tags:
        return "building"
    return None


def exposure() -> None:
    sc = scene()
    f = to_frame(sc)
    model = json.loads((APP / "model.json").read_text())
    sec_km = np.array(model["sections"])
    st = np.array([s[:4] for s in sc["stations"]], dtype=float)  # km, x, z, bed
    with rasterio.open(DEM) as src:
        dem = src.read(1)
        dtf = src.transform
    x0, y0 = sc["origin_utm"]

    def ground(x: float, z: float) -> float:
        col = (x + x0 - dtf.c) / dtf.a - 0.5
        row = (dtf.f - (y0 - z)) / -dtf.e - 0.5
        r0, c0 = int(np.clip(np.floor(row), 0, dem.shape[0] - 2)), int(np.clip(np.floor(col), 0, dem.shape[1] - 2))
        fr, fc = row - r0, col - c0
        q = dem[r0 : r0 + 2, c0 : c0 + 2]
        return float(q[0, 0] * (1 - fr) * (1 - fc) + q[0, 1] * (1 - fr) * fc + q[1, 0] * fr * (1 - fc) + q[1, 1] * fr * fc)

    def nearest(x: float, z: float) -> tuple[int, float]:
        d = np.hypot(st[:, 1] - x, st[:, 2] - z)
        i = int(np.argmin(d))
        return i, float(d[i])

    def assess(x: float, z: float) -> dict:
        i, dist = nearest(x, z)
        km, _, _, bed = st[i]
        out = {"km": round(float(km), 2), "dist": round(dist), "ground": round(ground(x, z), 1)}
        if km < sec_km[0] - 0.6:
            out["reach"] = None  # above Syabrubesi: not modelled
            return out
        j = int(np.argmin(np.abs(sec_km - km)))
        rises = [model["peakRise"][j][b] or 0.0 for b in range(3)]
        tw = model["topWidth"][j]
        hws = [np.interp(r, np.arange(len(tw)), tw) / 2 for r in rises]
        out["rise"] = rises
        out["reach"] = classify(out["ground"], dist, bed, rises, hws)
        return out

    feats = []
    counts: dict[str, dict[str, int]] = {}
    infra_ids = {(e["type"], e["id"]) for e in json.loads((RAW / "rasuwa_infra.json").read_text())["elements"]}
    for name in ("rasuwa_buildings", "rasuwa_infra"):
        for e in json.loads((RAW / f"{name}.json").read_text())["elements"]:
            if name == "rasuwa_buildings" and (e["type"], e["id"]) in infra_ids:
                continue  # a facility drawn as a building: counted once, as the facility
            tags = e.get("tags", {})
            kind = osm_kind(tags)
            if kind is None:
                continue
            if e["type"] == "relation" and "bounds" in e:
                bd = e["bounds"]
                coords = [((bd["minlon"] + bd["maxlon"]) / 2, (bd["minlat"] + bd["maxlat"]) / 2)]
            elif "center" in e:
                coords = [(e["center"]["lon"], e["center"]["lat"])]
            elif "geometry" in e:
                coords = [(p["lon"], p["lat"]) for p in e["geometry"]]
            elif "lat" in e:
                coords = [(e["lon"], e["lat"])]
            else:
                continue
            xy = [f(lon, lat) for lon, lat in coords]
            if kind in ("road", "bridge"):
                # assess every vertex; the feature is reached if any vertex is
                parts = [assess(x, z) for x, z in xy]
                main = min(parts, key=lambda a: a["dist"])
                if main["dist"] > BUFFER_M:
                    continue
                reach = None
                if any(p["reach"] is not None for p in parts):
                    reach = [any(p["reach"][b] for p in parts if p["reach"] is not None) for b in range(3)]
                item = {
                    "kind": kind,
                    "line": [[x, z, pp["ground"]] for (x, z), pp in zip(xy, parts, strict=True)],
                    "vreach": [p["reach"][1] if p["reach"] else None for p in parts],
                    **main,
                    "reach": reach,
                }
            else:
                cx = float(np.mean([p[0] for p in xy]))
                cz = float(np.mean([p[1] for p in xy]))
                a = assess(cx, cz)
                if a["dist"] > BUFFER_M:
                    continue
                item = {"kind": kind, "x": round(cx, 1), "z": round(cz, 1), **a}
            item["id"] = f"{e['type']}/{e['id']}"
            label = tags.get("name:en") or tags.get("name")
            if label:
                item["name"] = label
            for k in (
                "bridge",
                "highway",
                "power",
                "plant:source",
                "plant:output:electricity",
                "waterway",
                "amenity",
                "building",
                "man_made",
                "bridge:structure",
            ):
                if k in tags:
                    item.setdefault("tags", {})[k] = tags[k]
            feats.append(item)
            c = counts.setdefault(kind, {"total": 0, "modelled": 0, "p5": 0, "p50": 0, "p95": 0})
            c["total"] += 1
            if item["reach"] is not None:
                c["modelled"] += 1
                for b, key in enumerate(("p5", "p50", "p95")):
                    c[key] += int(item["reach"][b])
    raw = json.loads((RAW / "rasuwa_buildings.json").read_text())
    # buildings go to a compact binary: x, z, ground (float32) and a reach code (uint8): 0 above Syabrubesi (not modelled),
    # 1 not reached, 2 reached only in the 95 % band, 3 in the median, 4 already in the 5 % band
    blds = [x for x in feats if x["kind"] == "building"]
    code = [0 if x["reach"] is None else 4 if x["reach"][0] else 3 if x["reach"][1] else 2 if x["reach"][2] else 1 for x in blds]
    xz = np.array([[x["x"], x["z"], x["ground"]] for x in blds], dtype="<f4")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "buildings.bin").write_bytes(xz.tobytes() + np.array(code, dtype=np.uint8).tobytes())
    # buildings by reach class and 10 km reach of the river
    by_km: dict[str, list[int]] = {}
    for x, c in zip(blds, code, strict=True):
        k = f"{int(x['km'] // 10 * 10)}-{int(x['km'] // 10 * 10) + 10}"
        by_km.setdefault(k, [0, 0, 0, 0, 0])[c] += 1
    write(
        "osm.json",
        {
            "note": "OpenStreetMap features within 2 km of the river, with the modelled peak water reach (5/50/95 %). reach is null above Syabrubesi, where the flood is not modelled. Buildings are in buildings.bin.",
            "attribution": "© OpenStreetMap contributors, ODbL. This derived data is available under the ODbL.",
            "osm_timestamp": raw.get("osm3s", {}).get("timestamp_osm_base"),
            "buildings": {
                "file": "buildings.bin",
                "layout": "float32 [n][x, z, ground], then uint8 [n] code",
                "count": len(blds),
                "codes": ["not modelled", "not reached", "95 % band only", "median", "5 % band"],
                "by_km": dict(sorted(by_km.items(), key=lambda kv: int(kv[0].split("-")[0]))),
            },
            "counts": counts,
            "features": [x for x in feats if x["kind"] != "building"],
        },
    )
    print("exposure counts:")
    for k, c in sorted(counts.items()):
        print(f"  {k:9s} {c}")


# --- change ---------------------------------------------------------------------------------------------------

BEFORE = [
    "S2B_T45RUM_20251021T051010_L2A", "S2B_T45RTM_20251021T051010_L2A", "S2B_T45RUL_20251021T051010_L2A",
    "S2B_T45RTL_20251021T051010_L2A", "S2C_T45RUM_20251026T050936_L2A", "S2C_T45RTM_20251026T050936_L2A",
    "S2C_T45RTL_20251026T050936_L2A", "S2C_T45RUL_20251016T050637_L2A", "S2C_T45RTL_20251016T050637_L2A",
    "S2B_T45RUM_20251110T050141_L2A", "S2B_T45RUL_20251110T050141_L2A", "S2B_T45RTM_20251110T050141_L2A",
]  # fmt: skip
AFTER = [
    "S2C_T45RUM_20261001T050516_L2A", "S2C_T45RTL_20261011T050657_L2A", "S2C_T45RUL_20260928T045730_L2A",
    "S2B_T45RUL_20261013T050025_L2A", "S2C_T45RTM_20261001T050516_L2A", "S2C_T45RTM_20261011T050657_L2A",
    "S2C_T45RUM_20260928T045730_L2A", "S2B_T45RUM_20261013T050025_L2A", "S2C_T45RUM_20261011T050657_L2A",
    "S2B_T45RUM_20261006T050354_L2A", "S2A_T45RUM_20261003T050648_L2A", "S2C_T45RUL_20261011T050657_L2A",
    "S2B_T45RTL_20261006T050354_L2A", "S2B_T45RTL_20261016T050607_L2A", "S2B_T45RTM_20261006T050354_L2A",
    "S2A_T45RTM_20261003T050648_L2A", "S2B_T45RTM_20261016T050607_L2A", "S2C_T45RTL_20261001T050516_L2A",
    "S2A_T45RTL_20261003T050648_L2A", "S2C_T45RUL_20261001T050516_L2A", "S2B_T45RUL_20261006T050354_L2A",
    "S2B_T45RUL_20261016T050607_L2A", "S2B_T45RUM_20261016T050607_L2A",
]  # fmt: skip
VEG_CLEAR = {4, 5, 6, 7}  # vegetation, bare, water, unclassified; clouds, shadows and snow are left out
NDVI_VEG = 0.35  # vegetated before
NDVI_DROP = 0.25  # loss of at least this much NDVI
VALLEY_M = 150.0  # only ground up to this height above the river bed
LATERAL_M = 1500.0
SIZE = 1024


def item(sid: str) -> dict:
    path = CACHE / f"{sid}.json"
    if not path.exists():
        with urllib.request.urlopen(STAC.format(id=sid), timeout=60) as r:
            path.write_bytes(r.read())
    return json.loads(path.read_text())


def read_band(sid: str, key: str, bounds: tuple, resampling: Resampling) -> np.ndarray | None:
    cache = CACHE / f"{sid}_{key}_{'_'.join(str(round(b)) for b in bounds)}_{SIZE}.npy"
    if cache.exists():
        a = np.load(cache)
        return None if a.size == 0 else a
    asset = item(sid)["assets"][key]
    env = rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif")
    with env, rasterio.open(asset["href"]) as src:
        left, bottom, right, top = src.bounds
        if bounds[0] >= right or bounds[2] <= left or bounds[1] >= top or bounds[3] <= bottom:
            np.save(cache, np.zeros(0, np.uint16))
            return None
        win = from_bounds(*bounds, transform=src.transform)
        a = src.read(1, window=win, out_shape=(SIZE, SIZE), boundless=True, fill_value=0, resampling=resampling)
    np.save(cache, a)
    return a


def ndvi_composite(scenes: list[str], bounds: tuple) -> np.ndarray:
    """NDVI per pixel from the first scene in which the pixel is clear (no cloud, shadow or snow); NaN if none."""
    out = np.full((SIZE, SIZE), np.nan, np.float32)
    for sid in scenes:
        if not np.isnan(out).any():
            break
        scl = read_band(sid, "scl", bounds, Resampling.nearest)
        if scl is None:
            continue
        ok = np.isin(scl, list(VEG_CLEAR)) & np.isnan(out)
        if not ok.any():
            continue
        bands = {}
        raw = {}
        for key in ("red", "nir"):
            raw[key] = read_band(sid, key, bounds, Resampling.average)
            rb = item(sid)["assets"][key].get("raster:bands", [{}])[0]
            bands[key] = raw[key].astype(np.float32) * rb.get("scale", 1e-4) + rb.get("offset", 0.0)
        red, nir = bands["red"], bands["nir"]
        valid = ok & (raw["red"] > 0) & (raw["nir"] > 0) & (red + nir > 0.02)
        nd = (nir - red) / np.maximum(nir + red, 1e-6)
        out[valid] = nd[valid]
    return out


def tile_change(tile: dict, st: np.ndarray, origin: tuple[float, float], dem: np.ndarray, dtf: rasterio.Affine) -> dict:
    """Vegetation loss on the valley floor of one detail tile; writes the overlay PNG and returns its areas."""
    x0, y0 = origin
    b = tuple(tile["utm"])
    before = ndvi_composite(BEFORE, b)
    after = ndvi_composite(AFTER, b)
    # pixel centres in the app frame, the DEM height there and the nearest river station
    xs = np.linspace(b[0], b[2], SIZE) - x0
    zs = y0 - np.linspace(b[3], b[1], SIZE)
    gx, gz = np.meshgrid(xs, zs)
    col = ((gx + x0 - dtf.c) / dtf.a).astype(int).clip(0, dem.shape[1] - 1)
    row = ((dtf.f - (y0 - gz)) / -dtf.e).astype(int).clip(0, dem.shape[0] - 1)
    h = dem[row, col]
    near = (
        (st[:, 1] > b[0] - x0 - LATERAL_M)
        & (st[:, 1] < b[2] - x0 + LATERAL_M)
        & (st[:, 2] > y0 - b[3] - LATERAL_M)
        & (st[:, 2] < y0 - b[1] + LATERAL_M)
    )
    best_d = np.full(gx.shape, np.inf, np.float32)
    best_bed = np.zeros(gx.shape, np.float32)
    best_km = np.zeros(gx.shape, np.float32)
    for km, sx, sz, bed in st[near][::2]:
        d = np.hypot(gx - sx, gz - sz).astype(np.float32)
        m = d < best_d
        best_d[m] = d[m]
        best_bed[m] = bed
        best_km[m] = km
    valley = (best_d <= LATERAL_M) & (h - best_bed <= VALLEY_M)
    seen = ~np.isnan(before) & ~np.isnan(after)
    loss = valley & seen & (before >= NDVI_VEG) & (before - after >= NDVI_DROP)
    unknown = valley & ~seen
    rgba = np.zeros((SIZE, SIZE, 4), np.uint8)
    rgba[loss] = (226, 74, 160, 210)
    rgba[unknown] = (150, 150, 150, 70)
    save_palette_png(rgba, OUT / f"change/{tile['name']}.png")
    px_ha = ((b[2] - b[0]) / SIZE) * ((b[3] - b[1]) / SIZE) / 1e4
    by_km = {}
    tens = np.floor(best_km / 10) * 10
    for km in np.unique(tens[loss]):
        by_km[int(km)] = float((loss & (tens == km)).sum() * px_ha)
    return {"name": tile["name"], "loss_ha": float(loss.sum() * px_ha), "no_view_ha": float(unknown.sum() * px_ha), "by_km": by_km}


def save_palette_png(rgba: np.ndarray, path: Path) -> None:
    """An RGBA image with few colours as an indexed PNG with a transparency table: the same pixels, about a third of
    the size of a true-colour PNG."""
    flat = rgba.reshape(-1, 4)
    colours, inv = np.unique(flat, axis=0, return_inverse=True)
    if len(colours) > 256:
        Image.fromarray(rgba, "RGBA").save(path, optimize=True)
        return
    img = Image.fromarray(inv.reshape(rgba.shape[:2]).astype(np.uint8), "P")
    img.putpalette(colours[:, :3].ravel().tolist())
    img.save(path, optimize=True, transparency=bytes(colours[:, 3].tolist()))


def change() -> None:
    sc = scene()
    st = np.array([s[:4] for s in sc["stations"]], dtype=float)
    with rasterio.open(DEM) as src:
        dem = src.read(1)
        dtf = src.transform
    (OUT / "change").mkdir(parents=True, exist_ok=True)
    for sid in BEFORE + AFTER:
        item(sid)  # fetch the STAC items once, before the threads start
    # tiles are independent and the reads wait on the network, so they run in parallel threads
    results = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(tile_change, t, st, tuple(sc["origin_utm"]), dem, dtf) for t in sc["tiles"]]
        for k, fut in enumerate(as_completed(futures)):
            r = fut.result()
            results.append(r)
            print(f"  {k + 1}/{len(futures)} {r['name']}: {r['loss_ha']:.0f} ha")
    # tiles share their edge row; the duplicate area is under 0.2 % and ignored
    total = sum(r["loss_ha"] for r in results)
    no_view = sum(r["no_view_ha"] for r in results)
    by_km: dict[int, float] = {}
    for r in results:
        for km, a in r["by_km"].items():
            by_km[km] = by_km.get(km, 0.0) + a
    write(
        "change.json",
        {
            "note": "Loss of vegetation (NDVI before >= 0.35 and a drop of at least 0.25) on the valley floor (up to 150 m above the river bed, within 1.5 km of it), between Oct-Nov 2025 and late Sep-mid Oct 2026. Clouds, shadows and snow masked with SCL. Our own analysis, not an official damage map.",
            "method": {"ndvi_before_min": NDVI_VEG, "ndvi_drop_min": NDVI_DROP, "valley_height_m": VALLEY_M, "lateral_m": LATERAL_M},
            "loss_ha": round(total, 1),
            "no_clear_view_ha": round(no_view, 1),
            "tiles": {
                r["name"]: {"loss_ha": round(r["loss_ha"], 1), "no_clear_view_ha": round(r["no_view_ha"], 1)}
                for r in sorted(results, key=lambda r: r["name"])
            },
            "by_km": {f"{k}-{k + 10}": round(v, 1) for k, v in sorted(by_km.items())},
        },
    )
    print(f"change: {total:.0f} ha of vegetation loss on the valley floor; {no_view:.0f} ha without a clear view")


if __name__ == "__main__":
    steps = sys.argv[1:] or ["events", "osm", "exposure", "change"]
    for step in ("events", "osm", "exposure", "change"):
        if step in steps:
            globals()[step]()
