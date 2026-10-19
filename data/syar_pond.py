#!/usr/bin/env python3
"""Budhi Gandaki, 11 Oct 2026: the pond behind the debris blockage at the Ungdilung - Syar Khola confluence.

The only published size is the field observation that water ponded for about 1.5 km up the Syar Khola (NDRRMA
SitRep 3 and 4; research/events.md). Dam height and pond volume are not published. This script turns the pond
length into a dam height and a volume with the pre-event DEM:

1. Find the confluence: route a valley-floor path from Chumling (on the Syar) down to the event corridor; the
   confluence is where that path meets the corridor.
2. For each dam height hD above the confluence bed, fill the Syar valley up to the level bed + hD, from a seed on
   the Syar just above the confluence, with the dam itself as a wall (cells within WALL_M of the confluence).
3. Record the pond area, volume and length (the longest path through the flooded cells from the dam).
4. Keep the heights whose pond length falls in the observed range.

Input: out/derived/budhi_gandaki/{dem_utm.tif, corridor.json} (data/prepare.py).
Output: out/derived/budhi_gandaki/syar_pond.json and model/data/budhi_gandaki_syar_pond.json (input of model/check_budhi.mjs).

Limits: the DEM (Copernicus GLO-30, a surface model, made from 2011-2015 radar) sees the river surface, not the
bed, and the valley may have changed since. The volume is therefore only an estimate of the order of magnitude.

Usage (from the repo root): .venv/bin/python data/syar_pond.py
"""

import json
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from scipy.ndimage import label, minimum_filter
from skimage.graph import MCP_Geometric, route_through_array

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "out/derived/budhi_gandaki"
APP_DATA = ROOT / "model/data"
UTM = "EPSG:32645"
CHUMLING = (28.4740, 84.9627)  # lat, lon (OSM; research/events.md)
WALL_M = 150.0  # the dam: cells this close to the confluence hold no water
SEED_M = 300.0  # the pond seed: this far up the Syar path from the confluence
HEIGHTS = np.arange(5.0, 120.0 + 1e-9, 5.0)
POND_KM = (1.0, 2.0)  # "about 1.5 km" read as 1.0 to 2.0 km
# Water can only pond as fast as the Syar brings it. Syar Khola at the Chumchet headworks (565-574 km2): adopted
# October mean flow 20.92 m3/s, 100-year flood 486 m3/s (Chilime project presentation, p. 25 and 31; methods.md
# [47]). Inflow taken as 10 to 100 m3/s (up to about five times the October mean). Blockage time: 1 h ("about one
# hour before the highest surge the Syar stopped", NDRRMA) to 2.2 h (from the 04:20 failure to the 06:30 surge).
INFLOW_M3S = (10.0, 100.0)
BLOCK_H = (1.0, 2.2)


def main() -> None:
    with rasterio.open(SRC / "dem_utm.tif") as src:
        z = src.read(1).astype(np.float64)
        tf = src.transform
    res = tf.a
    zf = np.where(np.isnan(z), np.nanmax(z), z)
    z_rel = zf - minimum_filter(zf, size=41)
    cost = 1.0 + (z_rel / 8.0) ** 2
    corridor = json.loads((SRC / "corridor.json").read_text())
    to_utm = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)

    def rc(lat: float, lon: float) -> tuple[int, int]:
        x, y = to_utm.transform(lon, lat)
        col, row = ~tf * (x, y)
        return round(row), round(col)

    st = corridor["stations"]
    path_rc = [rc(s["lat"], s["lon"]) for s in st]
    # Chumling snapped to the nearest valley-floor cell within 700 m (as in prepare.py)
    r0, c0 = rc(*CHUMLING)
    rad = round(700 / res)
    yy, xx = np.mgrid[r0 - rad : r0 + rad + 1, c0 - rad : c0 + rad + 1]
    win = z_rel[r0 - rad : r0 + rad + 1, c0 - rad : c0 + rad + 1]
    score = np.where((win < 3.0) & ((yy - r0) ** 2 + (xx - c0) ** 2 <= rad**2), (yy - r0) ** 2 + (xx - c0) ** 2, np.inf)
    k = np.unravel_index(np.argmin(score), score.shape)
    chum = (int(yy[k]), int(xx[k]))

    # Syar path from Chumling to the corridor 3 km below the confluence region; the confluence is the first cell
    # within 2 cells of the corridor centreline
    below = next(i for i, s in enumerate(st) if s["km"] >= 12.0)
    syar, _ = route_through_array(cost, chum, path_rc[below], fully_connected=True, geometric=True)
    corr = np.array(path_rc[: below + 1])
    conf_i = next(i for i, (r, c) in enumerate(syar) if np.min(np.abs(corr - (r, c)).max(axis=1)) <= 2)
    conf = syar[conf_i]
    syar_up = syar[: conf_i + 1][::-1]  # from the confluence up the Syar
    step = np.hypot(*np.diff(np.array(syar_up, dtype=float), axis=0).T) * res
    along = np.concatenate([[0.0], np.cumsum(step)])
    seed = syar_up[int(np.searchsorted(along, SEED_M))]
    bed = float(min(zf[r, c] for r, c in syar_up[: int(np.searchsorted(along, WALL_M)) + 1]))
    conf_km = st[int(np.argmin(np.abs(corr - conf).max(axis=1)))]["km"]

    yy, xx = np.indices(zf.shape)
    wall = (yy - conf[0]) ** 2 + (xx - conf[1]) ** 2 <= (WALL_M / res) ** 2
    rows = []
    for h in HEIGHTS:
        level = bed + h
        wet = (zf < level) & ~wall
        lab, _ = label(wet, structure=np.ones((3, 3)))
        if not wet[seed]:
            rows.append({"h_m": float(h), "area_km2": 0.0, "volume_Mm3": 0.0, "length_km": 0.0, "leak": False})
            continue
        pond = lab == lab[seed]
        # the pond must not spill around the dam into the river below it
        leak = bool(np.any(pond & (zf < bed - 5.0)))
        depth = np.where(pond, level - zf, 0.0)
        mcp = MCP_Geometric(np.where(pond, 1.0, np.inf))
        start = min(zip(*np.nonzero(pond), strict=True), key=lambda p: (p[0] - conf[0]) ** 2 + (p[1] - conf[1]) ** 2)
        dist, _ = mcp.find_costs([start])
        length = float(np.max(dist[pond & np.isfinite(dist)]) * res + WALL_M)
        rows.append(
            {
                "h_m": float(h),
                "area_km2": round(float(pond.sum()) * res * res / 1e6, 4),
                "volume_Mm3": round(float(depth.sum()) * res * res / 1e6, 3),
                "length_km": round(length / 1000, 2),
                "leak": leak,
            }
        )

    ok = [r for r in rows if POND_KM[0] <= r["length_km"] <= POND_KM[1] and not r["leak"]]
    vols = np.array([r["volume_Mm3"] for r in rows])
    hs = np.array([r["h_m"] for r in rows])
    lens = np.array([r["length_km"] for r in rows])
    v_max = [q * t * 3600 / 1e6 for q, t in ((INFLOW_M3S[0], BLOCK_H[0]), (INFLOW_M3S[1], BLOCK_H[1]))]
    inflow_limited = {
        "inflow_m3s": list(INFLOW_M3S),
        "blockage_h": list(BLOCK_H),
        "volume_max_Mm3": [round(v, 3) for v in v_max],
        "h_m": [round(float(np.interp(v, vols, hs)), 1) for v in v_max],
        "length_km": [round(float(np.interp(v, vols, lens)), 2) for v in v_max],
        "inflow_needed_for_1_5_km_m3s": [round(float(np.interp(1.5, lens, vols)) * 1e6 / (t * 3600)) for t in (BLOCK_H[1], BLOCK_H[0])],
    }
    data = {
        "event": "budhi_gandaki",
        "note": (
            "Pond behind the Ungdilung - Syar confluence blockage, from the pre-event Copernicus DEM (a surface "
            "model). Only the pond length (~1.5 km, NDRRMA field observation) is observed; heights and volumes "
            "are derived here and are order-of-magnitude estimates."
        ),
        "confluence": {"chainage_km": conf_km, "bed_m": round(bed, 1), "lat_lon_rc": [int(conf[0]), int(conf[1])]},
        "observed_length_km": list(POND_KM),
        "table": rows,
        "inflow_limited": inflow_limited,
        "length_consistent": {
            "h_m": [ok[0]["h_m"], ok[-1]["h_m"]] if ok else None,
            "volume_Mm3": [ok[0]["volume_Mm3"], ok[-1]["volume_Mm3"]] if ok else None,
        },
    }
    text = json.dumps(data, indent=1)
    (SRC / "syar_pond.json").write_text(text)
    APP_DATA.mkdir(parents=True, exist_ok=True)
    (APP_DATA / "budhi_gandaki_syar_pond.json").write_text(text)
    prof = [(round(float(d)), round(float(zf[r, c]), 1)) for d, (r, c) in zip(along, syar_up, strict=True)][::8]
    print("Syar profile from the confluence (m along, DEM m):", prof)
    print(f"confluence at corridor km {conf_km}, bed {bed:.1f} m; Syar path {along[-1] / 1000:.2f} km to Chumling")
    for r in rows:
        print(
            f"  hD {r['h_m']:5.0f} m  area {r['area_km2']:7.4f} km2  volume {r['volume_Mm3']:8.3f} Mm3  length {r['length_km']:5.2f} km{'  LEAK' if r['leak'] else ''}"
        )
    print(f"consistent with a {POND_KM[0]}-{POND_KM[1]} km pond: {data['length_consistent']}")
    print(f"limited by inflow: {inflow_limited}")


if __name__ == "__main__":
    main()
