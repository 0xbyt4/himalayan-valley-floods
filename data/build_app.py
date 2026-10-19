#!/usr/bin/env python3
"""Build the 3D scene data of the app for the Rasuwa corridor.

Steps:
- terrain: an overview height grid (120 m) of the whole corridor area, and detail tiles (30 m, 10 km) along the
  river. The river is burned into the heights at the corridor bed (data/prepare.py): the surface model fills narrow
  gorges, so without this the modelled water would sit under the ground.
- imagery: Sentinel-2 true colour for every detail tile (10 m) and for the overview (40 m), before the flood
  (October-November 2025) and after it (late September to mid October 2026). Clouds and cloud shadows are masked with
  each scene's scene classification layer (SCL); each pixel takes the first clear scene in a fixed order.

Frame: x east and z south in metres from the centre of the DEM area (UTM 45N), y up in metres above sea level.
Outputs go to app/data/rasuwa/ (scene.json, terrain/, imagery/).
Inputs: out/derived/rasuwa/{dem_utm.tif, corridor.json} (data/prepare.py); imagery is read over HTTP from
the Earth Search STAC (sentinel-2-c1-l2a) and cached in out/cache/s2/.

Usage (from the repo root): .venv/bin/python data/build_app.py [terrain] [imagery | tiles] [sections]
"""

import gzip
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "out/derived/rasuwa"
CACHE = ROOT / "out/cache/s2"
OUT = ROOT / "app/data/rasuwa"
UTM = "EPSG:32645"
TILE_CELLS = 332  # 332 cells of 30 m = 9.96 km = 83 overview cells; tiles share their edge row and column
OVERVIEW_M = 120.0
BUFFER_M = 3000.0  # detail tiles cover the river and this much to each side
STAC = "https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/{id}"
SCL_CLEAR = {2, 4, 5, 6, 7, 11}  # dark area, vegetation, bare, water, unclassified, snow; not cloud or shadow

# scenes in order of preference; each pixel takes the first clear one (research/data_sources.md lists the IDs)
BEFORE = [
    "S2B_T45RUM_20251021T051010_L2A",
    "S2B_T45RTM_20251021T051010_L2A",
    "S2B_T45RUL_20251021T051010_L2A",
    "S2B_T45RTL_20251021T051010_L2A",
    "S2C_T45RUM_20251026T050936_L2A",
    "S2C_T45RTM_20251026T050936_L2A",
    "S2C_T45RTL_20251026T050936_L2A",
    "S2C_T45RUL_20251016T050637_L2A",
    "S2C_T45RTL_20251016T050637_L2A",
    "S2B_T45RUM_20251110T050141_L2A",
    "S2B_T45RUL_20251110T050141_L2A",
    "S2B_T45RTM_20251110T050141_L2A",
]
AFTER = [
    "S2C_T45RUM_20261001T050516_L2A",
    "S2C_T45RTL_20261011T050657_L2A",
    "S2C_T45RUL_20260928T045730_L2A",
    "S2B_T45RUL_20261013T050025_L2A",
    "S2C_T45RTM_20261001T050516_L2A",
    "S2C_T45RTM_20261011T050657_L2A",
    "S2C_T45RUM_20260928T045730_L2A",
    "S2B_T45RUM_20261013T050025_L2A",
    "S2C_T45RUM_20261011T050657_L2A",
    "S2B_T45RUM_20261006T050354_L2A",
    "S2A_T45RUM_20261003T050648_L2A",
    "S2C_T45RUL_20261011T050657_L2A",
    "S2B_T45RTL_20261006T050354_L2A",
    "S2B_T45RTL_20261016T050607_L2A",
    "S2B_T45RTM_20261006T050354_L2A",
    "S2A_T45RTM_20261003T050648_L2A",
    "S2B_T45RTM_20261016T050607_L2A",
    "S2C_T45RTL_20261001T050516_L2A",
    "S2A_T45RTL_20261003T050648_L2A",
    "S2C_T45RUL_20261001T050516_L2A",
    "S2B_T45RUL_20261006T050354_L2A",
    "S2B_T45RUL_20261016T050607_L2A",
    "S2B_T45RUM_20261016T050607_L2A",
]


def load_dem() -> tuple[np.ndarray, rasterio.Affine]:
    with rasterio.open(SRC / "dem_utm.tif") as src:
        z = src.read(1).astype(np.float32)
        tf = src.transform
    return np.where(np.isnan(z), np.nanmin(z), z), tf


HEIGHT_STEP = 0.1  # m: heights are stored as whole multiples of this (error at most 0.05 m; the DEM's own is ~4 m)


def encode_heights(h: np.ndarray) -> bytes:
    """Heights for the app, small and accurate to 0.05 m: whole multiples of HEIGHT_STEP, each stored as its
    difference from the planar prediction left + up - upper-left (the left value on the first row, the upper value on
    the first column), zigzag-coded to 16 bits and written low bytes then high bytes, all gzipped.
    Layout before gzip: float32 step, int32 first value (steps), uint8[n] low bytes, uint8[n] high bytes.
    app/src/decode.mjs reads it."""
    q = np.rint(h.astype(np.float64) / HEIGHT_STEP).astype(np.int64)
    pred = np.zeros_like(q)
    pred[0, 1:] = q[0, :-1]
    pred[1:, 0] = q[:-1, 0]
    pred[1:, 1:] = q[1:, :-1] + q[:-1, 1:] - q[:-1, :-1]
    r = (q - pred).ravel()
    r[0] = 0
    if np.abs(r).max() >= 32768:
        raise ValueError("height step too large for 16-bit residuals")
    z = ((r << 1) ^ (r >> 63)).astype(np.uint16)
    head = np.array([HEIGHT_STEP], "<f4").tobytes() + np.array([q.ravel()[0]], "<i4").tobytes()
    return gzip.compress(head + (z & 0xFF).astype(np.uint8).tobytes() + (z >> 8).astype(np.uint8).tobytes(), 9, mtime=0)


def decode_heights(data: bytes, rows: int, cols: int) -> np.ndarray:
    """The inverse of encode_heights: float32 heights (rows, cols)."""
    raw = gzip.decompress(data)
    step = np.frombuffer(raw, "<f4", 1)[0]
    first = int(np.frombuffer(raw, "<i4", 1, 4)[0])
    n = rows * cols
    z = np.frombuffer(raw, np.uint8, n, 8).astype(np.int64) | (np.frombuffer(raw, np.uint8, n, 8 + n).astype(np.int64) << 8)
    r = ((z >> 1) ^ -(z & 1)).reshape(rows, cols)
    q = np.zeros((rows, cols), np.int64)
    q[0, 0] = first
    q[0, 1:] = first + np.cumsum(r[0, 1:])
    for i in range(1, rows):
        # left + up - upper-left along the row: q[i, j] - q[i, j-1] = r[i, j] + q[i-1, j] - q[i-1, j-1]
        q[i, 0] = q[i - 1, 0] + r[i, 0]
        q[i, 1:] = q[i, 0] + np.cumsum(r[i, 1:] + q[i - 1, 1:] - q[i - 1, :-1])
    return (q * np.float64(step)).astype(np.float32)


def load_heights(path: Path, rows: int, cols: int) -> np.ndarray:
    """App terrain heights from a file written by terrain()."""
    return decode_heights(path.read_bytes(), rows, cols)


def burn_river(z: np.ndarray, tf: rasterio.Affine, corridor: dict, radius: float = 40.0) -> int:
    """Lower the cells within radius metres of the centreline to the corridor bed."""
    t = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    xy = np.array([t.transform(s["lon"], s["lat"]) for s in corridor["stations"]])
    bed = np.array([s["bed_m"] for s in corridor["stations"]])
    d = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))])
    fine = np.arange(0.0, d[-1], 15.0)
    fx, fy, fb = np.interp(fine, d, xy[:, 0]), np.interp(fine, d, xy[:, 1]), np.interp(fine, d, bed)
    res = tf.a
    count = 0
    for x, y, b in zip(fx, fy, fb, strict=True):
        col, row = (x - tf.c) / res - 0.5, (tf.f - y) / res - 0.5
        r0, c0 = round(row), round(col)
        k = int(radius // res) + 2
        for r in range(r0 - k, r0 + k + 1):
            for c in range(c0 - k, c0 + k + 1):
                inside = 0 <= r < z.shape[0] and 0 <= c < z.shape[1]
                if inside and np.hypot(r - row, c - col) * res <= radius and z[r, c] > b:
                    z[r, c] = b
                    count += 1
    return count


def terrain() -> None:
    z, tf = load_dem()
    corridor = json.loads((SRC / "corridor.json").read_text())
    burned = burn_river(z, tf, corridor)
    from channel import burn_channel  # the active channel mapped from Sentinel-2

    burned += burn_channel(z, tf, corridor)
    rows, cols = z.shape
    x0 = tf.c + cols * tf.a / 2
    y0 = tf.f - rows * tf.a / 2
    (OUT / "terrain").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "terrain").iterdir():  # tiles of earlier builds that are no longer in the scene
        old.unlink()

    # overview: every 4th DEM cell (120 m), smoothed with the mean of the 3 x 3 cells around it. The vertices sit on
    # the same cell centres as the detail tiles, so a tile and the overview chunk it replaces cover the same ground.
    k = int(OVERVIEW_M / tf.a)
    zp = np.pad(z, 1, mode="edge")
    smooth = sum(zp[1 + dr : 1 + dr + rows, 1 + dc : 1 + dc + cols] for dr in (-1, 0, 1) for dc in (-1, 0, 1)) / 9.0
    ov = smooth[::k, ::k].astype("<f4")
    ov_rows, ov_cols = ov.shape
    (OUT / "terrain/overview.bin").write_bytes(encode_heights(ov))

    # detail tiles along the river
    t = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    st = np.array([t.transform(s["lon"], s["lat"]) for s in corridor["stations"]])
    tiles = []
    for tr in range(0, rows - 1, TILE_CELLS):
        for tc in range(0, cols - 1, TILE_CELLS):
            r1, c1 = min(tr + TILE_CELLS, rows - 1), min(tc + TILE_CELLS, cols - 1)
            # vertices sit at cell centres
            xa, xb = tf.c + (tc + 0.5) * tf.a, tf.c + (c1 + 0.5) * tf.a
            ya, yb = tf.f - (r1 + 0.5) * tf.a, tf.f - (tr + 0.5) * tf.a
            near = (st[:, 0] > xa - BUFFER_M) & (st[:, 0] < xb + BUFFER_M) & (st[:, 1] > ya - BUFFER_M) & (st[:, 1] < yb + BUFFER_M)
            if not near.any():
                continue
            name = f"t{tr // TILE_CELLS:02d}_{tc // TILE_CELLS:02d}"
            h = z[tr : r1 + 1, tc : c1 + 1].astype("<f4")
            (OUT / f"terrain/{name}.bin").write_bytes(encode_heights(h))
            tiles.append(
                {
                    "name": name,
                    "rows": int(h.shape[0]),
                    "cols": int(h.shape[1]),
                    "utm": [round(xa, 1), round(ya, 1), round(xb, 1), round(yb, 1)],
                    "x": [round(xa - x0, 1), round(xb - x0, 1)],
                    "z": [round(y0 - yb, 1), round(y0 - ya, 1)],
                }
            )

    # corridor stations and places in the app frame
    stations = [
        [s["km"], round(float(x - x0), 1), round(float(y0 - y), 1), s["bed_m"]] for s, (x, y) in zip(corridor["stations"], st, strict=True)
    ]
    places = []
    for p in corridor["places"]:
        x, y = t.transform(p["lon"], p["lat"])
        places.append(p | {"x": round(x - x0, 1), "z": round(y0 - y, 1)})
    scene = {
        "event": "rasuwa",
        "crs": UTM,
        "origin_utm": [round(x0, 1), round(y0, 1)],
        "note": "x east, z south, y up, metres; origin at the centre of the DEM area",
        "dem": "Copernicus DEM GLO-30 (surface model), river burned in at the corridor bed",
        "overview": {
            "file": "terrain/overview.bin",
            "rows": int(ov.shape[0]),
            "cols": int(ov.shape[1]),
            "cell_m": OVERVIEW_M,
            # vertex j at the centre of DEM cell k * j; a chunk of 83 cells spans one detail tile of 332 cells
            "x": [round(tf.c + 0.5 * tf.a - x0, 1), round(tf.c + (k * (ov_cols - 1) + 0.5) * tf.a - x0, 1)],
            "z": [round(y0 - (tf.f - 0.5 * tf.a), 1), round(y0 - (tf.f - (k * (ov_rows - 1) + 0.5) * tf.a), 1)],
            "chunk_cells": TILE_CELLS // k,
        },
        "tiles": tiles,
        "stations": stations,
        "places": places,
    }
    old = OUT / "scene.json"
    if old.exists() and "imagery" in (prev := json.loads(old.read_text())):
        scene["imagery"] = prev["imagery"]  # keep the imagery record; rerun the imagery step if the tiles changed
    old.write_text(json.dumps(scene))
    size = sum(f.stat().st_size for f in (OUT / "terrain").iterdir()) / 1e6
    print(f"terrain: overview {ov.shape}, {len(tiles)} detail tiles, {size:.1f} MB; {burned} cells burned")


def scene_assets(sid: str) -> tuple[str, str, str]:
    path = CACHE / f"{sid}.json"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(STAC.format(id=sid), timeout=60) as r:
            path.write_bytes(r.read())
    item = json.loads(path.read_text())
    return item["assets"]["visual"]["href"], item["assets"]["scl"]["href"], item["properties"]["datetime"][:10]


def read_rgb(sid: str, bounds: tuple[float, float, float, float], size: int) -> np.ndarray | None:
    """True colour of one scene over bounds at size x size pixels, cloud and shadow set to 0; None if no data."""
    cache = CACHE / f"{sid}_{'_'.join(str(round(b)) for b in bounds)}_{size}.npy"
    if cache.exists():
        a = np.load(cache)
        return None if a.size == 0 else a
    vis, scl, _ = scene_assets(sid)
    env = rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif")
    with env:
        with rasterio.open(vis) as src:
            left, bottom, right, top = src.bounds
            if bounds[0] >= right or bounds[2] <= left or bounds[1] >= top or bounds[3] <= bottom:
                np.save(cache, np.zeros(0, np.uint8))
                return None
            win = from_bounds(*bounds, transform=src.transform)
            rgb = src.read(window=win, out_shape=(3, size, size), boundless=True, fill_value=0, resampling=Resampling.average)
        with rasterio.open(scl) as src:
            win = from_bounds(*bounds, transform=src.transform)
            cls = src.read(1, window=win, out_shape=(size, size), boundless=True, fill_value=0, resampling=Resampling.nearest)
    ok = np.isin(cls, list(SCL_CLEAR)) & ~np.all(rgb == 0, axis=0)
    rgb[:, ~ok] = 0
    np.save(cache, rgb)
    return rgb if ok.any() else None


def composite(scenes: list[str], bounds: tuple[float, float, float, float], size: int) -> tuple[np.ndarray, list[str]]:
    out = np.zeros((3, size, size), np.uint8)
    filled = np.zeros((size, size), bool)
    used = []
    for sid in scenes:
        if filled.all():
            break
        a = read_rgb(sid, bounds, size)
        if a is None:
            continue
        take = ~filled & ~np.all(a == 0, axis=0)
        if take.any():
            out[:, take] = a[:, take]
            filled |= take
            used.append(sid)
    return out, used


def fill_gaps(img: dict[str, np.ndarray]) -> None:
    """Where no scene gives a clear pixel, show the other date in dim grey, so a gap reads as "no clear view on this
    date" and is not mistaken for that date's ground."""
    for key, other in (("before", "after"), ("after", "before")):
        gap = np.all(img[key] == 0, axis=0)
        if gap.any():
            grey = (img[other].astype(np.float32).mean(axis=0) * 0.55 + 40).astype(np.uint8)
            img[key][:, gap] = grey[gap]


def imagery(overview: bool = True) -> None:
    """Tiles and, unless overview is False, the overview mosaic (unchanged when only the tiles moved)."""
    scene = json.loads((OUT / "scene.json").read_text())
    prev = scene.get("imagery", {})
    (OUT / "imagery").mkdir(parents=True, exist_ok=True)
    used: dict[str, set[str]] = {"before": set(), "after": set()}
    gaps = {}
    for i, tile in enumerate(scene["tiles"]):
        b = tuple(tile["utm"])
        out = {}
        for key, scenes in (("before", BEFORE), ("after", AFTER)):
            rgb, u = composite(scenes, b, 1024)
            used[key].update(u)
            gaps[f"{tile['name']}_{key}"] = round(float(np.all(rgb == 0, axis=0).mean()), 3)
            out[key] = rgb
        fill_gaps(out)
        for key, rgb in out.items():
            Image.fromarray(np.moveaxis(rgb, 0, -1)).save(OUT / f"imagery/{tile['name']}_{key}.jpg", quality=84)
        print(f"  tile {i + 1}/{len(scene['tiles'])} {tile['name']}")
    ov = scene["overview"]
    x0, y0 = scene["origin_utm"]
    b = (x0 + ov["x"][0], y0 - ov["z"][1], x0 + ov["x"][1], y0 - ov["z"][0])
    w = 4096 if overview else 0
    h = round(w * (b[3] - b[1]) / (b[2] - b[0]))
    ov_img = {}
    for key, scenes in (("before", BEFORE), ("after", AFTER)) if overview else ():
        mosaic = np.zeros((3, h, w), np.uint8)
        filled = np.zeros((h, w), bool)
        res = (b[2] - b[0]) / w
        dst_tf = from_origin(b[0], b[3], res, res)
        for sid in scenes:
            vis, scl, _ = scene_assets(sid)
            env = rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif")
            # read each scene at about 40 m (the COG overviews), then place it on the overview grid
            with env, rasterio.open(vis) as src, rasterio.open(scl) as sc:
                win = from_bounds(*b, transform=src.transform).intersection(rasterio.windows.Window(0, 0, src.width, src.height))
                shape = (max(1, round(win.height / 4)), max(1, round(win.width / 4)))
                src_rgb = src.read(window=win, out_shape=(3, *shape), resampling=Resampling.average)
                src_tf = src.window_transform(win) * rasterio.Affine.scale(win.width / shape[1], win.height / shape[0])
                swin = from_bounds(*src.window_bounds(win), transform=sc.transform)
                src_cls = sc.read(1, window=swin, out_shape=shape, resampling=Resampling.nearest)
            a = np.zeros((3, h, w), np.uint8)
            c = np.zeros((h, w), np.uint8)
            for band in range(3):
                reproject(
                    src_rgb[band],
                    a[band],
                    src_transform=src_tf,
                    src_crs=UTM,
                    dst_transform=dst_tf,
                    dst_crs=UTM,
                    resampling=Resampling.average,
                )
            reproject(src_cls, c, src_transform=src_tf, src_crs=UTM, dst_transform=dst_tf, dst_crs=UTM, resampling=Resampling.nearest)
            take = ~filled & np.isin(c, list(SCL_CLEAR)) & ~np.all(a == 0, axis=0)
            mosaic[:, take] = a[:, take]
            filled |= take
            if take.any():
                used[key].add(sid)
            if filled.mean() > 0.995:
                break
        gaps[f"overview_{key}"] = round(float(1 - filled.mean()), 3)
        ov_img[key] = mosaic
    if overview:
        fill_gaps(ov_img)
    else:  # keep the overview record of the last full run
        for key in ("before", "after"):
            used[key].update(prev.get(key, {}).get("scenes", []))
        gaps.update({k: v for k, v in prev.get("gaps", {}).items() if k.startswith("overview")})
    for key, mosaic in ov_img.items():
        Image.fromarray(np.moveaxis(mosaic, 0, -1)).save(OUT / f"imagery/overview_{key}.jpg", quality=84)
    dates = {k: sorted({scene_assets(s)[2] for s in v}) for k, v in used.items()}
    scene["imagery"] = {
        "source": "Copernicus Sentinel-2 L2A (Earth Search, sentinel-2-c1-l2a), true colour, clouds masked with SCL",
        "attribution": "Contains modified Copernicus Sentinel data 2025-2026",
        "before": {"scenes": sorted(used["before"]), "dates": dates["before"]},
        "after": {"scenes": sorted(used["after"]), "dates": dates["after"]},
        "gaps": gaps,
        "gap_fill": "where no scene of a date is clear, the other date is shown in dim grey",
    }
    (OUT / "scene.json").write_text(json.dumps(scene))
    size = sum(f.stat().st_size for f in (OUT / "imagery").iterdir()) / 1e6
    print(f"imagery: {size:.1f} MB; before {dates['before']}; after {dates['after']}")
    print("largest gaps:", sorted(gaps.items(), key=lambda kv: -kv[1])[:6])


def sections() -> None:
    """Ground profiles across the valley at the model sections (every 500 m from Syabrubesi), for the cross-section
    view: float32 [section][lateral] in sections.bin; +lateral is the left bank looking downstream."""
    model = json.loads((OUT / "model.json").read_text())
    d = np.load(SRC / "sections.npz")
    km = d["station_km"]
    idx = [int(np.argmin(np.abs(km - k))) for k in model["sections"]]
    z = d["z"][idx].astype("<f4")
    (OUT / "sections.bin").write_bytes(z.tobytes())
    meta = {
        "note": "Ground across the valley (Copernicus DEM, a surface model) at each model section; +lateral is the left bank looking downstream.",
        "km": [round(float(km[i]), 2) for i in idx],
        "lateral_m": [float(v) for v in d["lateral_m"]],
    }
    (OUT / "sections.json").write_text(json.dumps(meta))
    print(f"sections: {z.shape[0]} profiles of {z.shape[1]} points, {z.nbytes / 1e6:.2f} MB")


if __name__ == "__main__":
    steps = sys.argv[1:] or ["terrain", "imagery", "sections"]
    if "terrain" in steps:
        terrain()
    if "imagery" in steps:
        imagery()
    if "tiles" in steps:  # imagery of the detail tiles only
        imagery(overview=False)
    if "sections" in steps:
        sections()
