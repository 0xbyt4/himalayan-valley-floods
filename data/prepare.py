#!/usr/bin/env python3
"""Derive the river corridor of each event from the Copernicus DEM: centreline, long profile, cross-sections and
the downstream distance (chainage) of each named place.

Method (research/methods.md, model chain step 1):
1. Mosaic the GLO-30 tiles over the event area and reproject to UTM 45N (EPSG:32645) at 30 m.
2. Relative relief z_rel = z - (minimum of z within about 600 m): close to 0 on valley floors.
3. Snap each downstream place to the lowest cell within 700 m (OSM village nodes often sit on terraces above the
   river); the source points are kept as they are.
4. Route a least-cost path through the snapped waypoints with cost 1 + (z_rel / 8 m)^2, so the path keeps to the
   valley floor (skimage.graph.route_through_array).
5. Smooth the path, resample every 100 m, and read the bed as the lowest DEM value within 60 m of each station,
   forced to fall downstream (a running minimum). The DEM is a surface model: in narrow gorges the true bed can be
   5-15 m lower (research/methods.md).
6. Cross-sections every 250 m, perpendicular to the centreline, 2 km to each side, sampled every 30 m.

Outputs (out/derived/<event>/, not committed): corridor.json (centreline, profile, places), sections.npz,
dem_utm.tif (the reprojected DEM) and preview.png (hillshade, path and places).

Usage (from the repo root): .venv/bin/python data/prepare.py [rasuwa] [budhi_gandaki]
"""

import json
import math
import sys
from dataclasses import dataclass
from itertools import pairwise
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image, ImageDraw
from pyproj import Transformer
from rasterio.merge import merge
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform_bounds
from scipy.ndimage import gaussian_filter1d, map_coordinates, minimum_filter
from skimage.graph import route_through_array

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "out/raw/dem"
OUT = ROOT / "out/derived"
UTM = "EPSG:32645"
RES = 30.0


@dataclass(frozen=True)
class Place:
    name: str
    lat: float
    lon: float
    snap: bool  # snap to the valley floor (False for the source and the lakes)
    grade: str  # confidence of the coordinate, from research/events.md
    route: bool = True  # route the path through it (False: only measure its chainage)


# waypoints in flow order; coordinates and grades from research/events.md
EVENTS: dict[str, dict] = {
    "rasuwa": {
        "bbox": (84.30, 27.70, 85.62, 28.40),
        "places": [
            Place("Collapse source (CLaSH)", 28.292511, 85.530220, False, "LIKELY"),
            Place("Lake below the collapsed glacier", 28.292884, 85.510942, False, "LIKELY"),
            Place("Lende Khola lake (USGS second event)", 28.332916, 85.482467, False, "LIKELY"),
            Place("Rasuwagadhi", 28.2774, 85.3777, True, "SOLID"),
            Place("Timure", 28.2555, 85.3702, True, "SOLID"),
            Place("Syabrubesi", 28.1633, 85.3344, True, "LIKELY"),
            Place("Mailung", 28.0718, 85.2070, True, "LIKELY"),
            Place("Betrawati", 27.9731, 85.1860, True, "SOLID"),
            Place("Trishuli Bazaar", 27.9226, 85.1490, True, "LIKELY"),
            Place("Devighat", 27.8625, 85.1141, True, "LIKELY"),
            Place("Galchhi gauge", 27.7961, 85.0003, True, "LIKELY"),
            Place("Malekhu", 27.8137, 84.8272, True, "UNCERTAIN"),
            Place("Benighat (Budhi Gandaki mouth)", 27.7835, 84.7951, True, "UNCERTAIN", route=False),
            Place("Mugling", 27.8568, 84.5619, True, "UNCERTAIN"),
            Place("Devghat", 27.71, 84.43, True, "LIKELY"),  # DHM station 450 page (rounded); was an admin centroid
        ],
    },
    "budhi_gandaki": {
        "bbox": (84.70, 27.74, 85.05, 28.58),
        "places": [
            Place("Source failure (USGS)", 28.532, 84.942, False, "SOLID"),
            Place("Chumling", 28.4740, 84.9627, True, "UNCERTAIN", route=False),  # on the Syar, above the confluence
            Place("Nyak", 28.4435, 84.8937, True, "UNCERTAIN"),
            Place("Philim", 28.3933, 84.8966, True, "UNCERTAIN"),
            Place("Sirdibas", 28.3809, 84.8891, True, "UNCERTAIN"),
            Place("Salleri", 28.3601, 84.8884, True, "UNCERTAIN"),
            Place("Jagat", 28.3514, 84.8959, True, "UNCERTAIN"),
            Place("Yaru", 28.3254, 84.9081, True, "UNCERTAIN"),
            Place("Dobhan", 28.2955, 84.9059, True, "UNCERTAIN"),
            Place("Tatopani", 28.2757, 84.8985, True, "UNCERTAIN"),
            Place("Khorlabesi", 28.2544, 84.8831, True, "UNCERTAIN"),
            Place("Machhakhola", 28.2293, 84.8738, True, "UNCERTAIN"),
            Place("Lapubesi", 28.1774, 84.8797, True, "UNCERTAIN"),
            Place("Soti Khola", 28.1353, 84.8547, True, "UNCERTAIN"),
            Place("Arughat (gauge 445)", 28.0462, 84.8124, True, "UNCERTAIN"),
            Place("Benighat", 27.7835, 84.7951, True, "UNCERTAIN"),
        ],
    },
}


def dem_utm(bbox: tuple[float, float, float, float]) -> tuple[np.ndarray, rasterio.Affine]:
    """The GLO-30 mosaic over bbox, reprojected to UTM 45N at 30 m (bilinear)."""
    tiles = [rasterio.open(p) for p in sorted(RAW.glob("Copernicus_DSM_COG_10_*_DEM.tif"))]
    pad = 0.02
    mosaic, transform = merge(tiles, bounds=(bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad))
    src_crs = tiles[0].crs
    for t in tiles:
        t.close()
    xmin, ymin, xmax, ymax = transform_bounds("EPSG:4326", UTM, *bbox)
    width = math.ceil((xmax - xmin) / RES)
    height = math.ceil((ymax - ymin) / RES)
    dst_transform = from_origin(xmin, ymax, RES, RES)
    dst = np.full((height, width), np.nan, dtype=np.float32)
    reproject(
        mosaic[0].astype(np.float32),
        dst,
        src_transform=transform,
        src_crs=src_crs,
        dst_transform=dst_transform,
        dst_crs=UTM,
        resampling=Resampling.bilinear,
        src_nodata=-32767,
        dst_nodata=np.nan,
    )
    return dst, dst_transform


def to_rc(transform: rasterio.Affine, x: float, y: float) -> tuple[int, int]:
    col, row = ~transform * (x, y)
    return round(row), round(col)


def snap_to_floor(z_rel: np.ndarray, r: int, c: int, radius_cells: int, floor_m: float = 3.0) -> tuple[int, int]:
    """The nearest valley-floor cell (relative relief under floor_m) within the radius; if there is none, the
    cell of least relative relief. The lowest absolute cell would slide the point downstream along the river."""
    r0, r1 = max(r - radius_cells, 0), min(r + radius_cells + 1, z_rel.shape[0])
    c0, c1 = max(c - radius_cells, 0), min(c + radius_cells + 1, z_rel.shape[1])
    yy, xx = np.mgrid[r0:r1, c0:c1]
    dist2 = (yy - r) ** 2 + (xx - c) ** 2
    win = z_rel[r0:r1, c0:c1]
    floor = (win < floor_m) & (dist2 <= radius_cells**2)
    score = np.where(floor, dist2, np.inf) if floor.any() else np.where(dist2 <= radius_cells**2, win, np.inf)
    k = np.unravel_index(np.argmin(score), score.shape)
    return r0 + int(k[0]), c0 + int(k[1])


def corridor(event: str) -> None:
    spec = EVENTS[event]
    out = OUT / event
    out.mkdir(parents=True, exist_ok=True)
    z, tf = dem_utm(spec["bbox"])
    zf = np.where(np.isnan(z), np.nanmax(z), z)
    z_rel = zf - minimum_filter(zf, size=41)
    cost = 1.0 + (z_rel / 8.0) ** 2
    to_utm = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    to_ll = Transformer.from_crs(UTM, "EPSG:4326", always_xy=True)

    # waypoints
    nodes = []
    for p in spec["places"]:
        x, y = to_utm.transform(p.lon, p.lat)
        r, c = to_rc(tf, x, y)
        if p.snap:
            r, c = snap_to_floor(z_rel, r, c, round(700 / RES))
        nodes.append((r, c))

    # least-cost path through the waypoints
    path: list[tuple[int, int]] = []
    routed = [n for n, p in zip(nodes, spec["places"], strict=True) if p.route]
    for a, b in pairwise(routed):
        seg, _ = route_through_array(cost, a, b, fully_connected=True, geometric=True)
        path += seg if not path else seg[1:]
    rc = np.array(path, dtype=float)
    xs = tf.c + (rc[:, 1] + 0.5) * tf.a
    ys = tf.f + (rc[:, 0] + 0.5) * tf.e

    # smooth and resample every 100 m
    xs_s, ys_s = gaussian_filter1d(xs, 3), gaussian_filter1d(ys, 3)
    seg_len = np.hypot(np.diff(xs_s), np.diff(ys_s))
    chain = np.concatenate([[0.0], np.cumsum(seg_len)])
    stations = np.arange(0.0, chain[-1], 100.0)
    sx, sy = np.interp(stations, chain, xs_s), np.interp(stations, chain, ys_s)

    def sample(px: np.ndarray, py: np.ndarray) -> np.ndarray:
        cols = (px - tf.c) / tf.a - 0.5
        rows = (py - tf.f) / tf.e - 0.5
        return map_coordinates(zf, [rows, cols], order=1, mode="nearest")

    # bed: lowest DEM value within 60 m of each station, then a running minimum downstream
    offs = np.array([(dx, dy) for dx in (-60, -30, 0, 30, 60) for dy in (-60, -30, 0, 30, 60) if dx * dx + dy * dy <= 3600])
    bed_raw = np.min(np.stack([sample(sx + dx, sy + dy) for dx, dy in offs]), axis=0)
    bed = np.minimum.accumulate(bed_raw)

    # cross-sections every 250 m, perpendicular, +/- 2 km every 30 m
    tx, ty = np.gradient(sx), np.gradient(sy)
    tn = np.hypot(tx, ty)
    nx, ny = -ty / tn, tx / tn
    sec_idx = np.arange(0, len(stations), 2.5).astype(int)  # one section every 250 m
    lateral = np.arange(-2000.0, 2000.0 + 1, RES)
    sections = np.stack([sample(sx[i] + nx[i] * lateral, sy[i] + ny[i] * lateral) for i in sec_idx]).astype(np.float32)

    # places: chainage along the centreline and distance off it
    places = []
    for p, (r, c) in zip(spec["places"], nodes, strict=True):
        px, py = tf.c + (c + 0.5) * tf.a, tf.f + (r + 0.5) * tf.e
        d = np.hypot(sx - px, sy - py)
        k = int(np.argmin(d))
        x0, y0 = to_utm.transform(p.lon, p.lat)
        places.append(
            {
                "name": p.name,
                "lat": p.lat,
                "lon": p.lon,
                "grade": p.grade,
                "snap_shift_m": round(float(np.hypot(px - x0, py - y0))),
                "chainage_km": round(float(stations[k]) / 1000, 2),
                "bed_m": round(float(bed[k]), 1),
                "off_path_m": round(float(d[k])),
            }
        )

    lon, lat = to_ll.transform(sx, sy)
    data = {
        "event": event,
        "crs": UTM,
        "dem": "Copernicus DEM GLO-30 (surface model), reprojected to UTM 45N at 30 m",
        "station_spacing_m": 100,
        "length_km": round(float(stations[-1]) / 1000, 2),
        "stations": [
            {
                "km": round(float(s) / 1000, 2),
                "lon": round(float(a), 6),
                "lat": round(float(b), 6),
                "bed_m": round(float(e), 1),
                "dem_min_m": round(float(f), 1),
            }
            for s, a, b, e, f in zip(stations, lon, lat, bed, bed_raw, strict=True)
        ],
        "places": places,
    }
    (out / "corridor.json").write_text(json.dumps(data, indent=1))
    np.savez_compressed(out / "sections.npz", station_km=stations[sec_idx] / 1000, lateral_m=lateral, z=sections)
    with rasterio.open(
        out / "dem_utm.tif",
        "w",
        driver="GTiff",
        height=z.shape[0],
        width=z.shape[1],
        count=1,
        dtype="float32",
        crs=UTM,
        transform=tf,
        nodata=np.nan,
        compress="deflate",
        predictor=3,
        tiled=True,
    ) as dst:
        dst.write(z, 1)
    preview(zf, tf, rc, nodes, spec["places"], out / "preview.png")
    print(f"{event}: {data['length_km']} km, {len(stations)} stations, {len(sec_idx)} sections")
    for p in places:
        print(
            f"  {p['chainage_km']:7.2f} km  bed {p['bed_m']:7.1f} m  snap {p['snap_shift_m']:4d} m  off {p['off_path_m']:4d} m  {p['name']}"
        )


def preview(z: np.ndarray, tf: rasterio.Affine, rc: np.ndarray, nodes: list, places: list[Place], path: Path) -> None:
    """Hillshade with the routed path (red) and the snapped places (yellow), for a visual check."""
    gy, gx = np.gradient(z, RES)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = math.radians(315), math.radians(45)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    img = Image.fromarray((np.clip(shade, 0, 1) * 255).astype(np.uint8)).convert("RGB")
    scale = 1600 / max(img.size)
    img = img.resize((round(img.width * scale), round(img.height * scale)))
    d = ImageDraw.Draw(img)
    d.line([(c * scale, r * scale) for r, c in rc[::3]], fill=(230, 40, 30), width=2)
    for p, (r, c) in zip(places, nodes, strict=True):
        x, y = c * scale, r * scale
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(250, 210, 40))
        d.text((x + 6, y - 6), p.name, fill=(255, 255, 160))
    img.save(path)


if __name__ == "__main__":
    for ev in sys.argv[1:] or list(EVENTS):
        corridor(ev)
