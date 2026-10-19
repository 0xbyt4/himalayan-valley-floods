#!/usr/bin/env python3
"""The active river channel of the Rasuwa corridor before the flood, mapped from Sentinel-2.

The Copernicus DEM is a surface model: it sees the water surface, gravel bars, bank trees and bridge decks, not the
bed. A 2-D flood model on it lacks the channel that carries most of the flow, and its waves run far too slowly
(research/methods.md 4.9). This script maps the channel so it can be burned into the DEM at the corridor bed:

1. NDVI before the flood (16 Oct to 10 Nov 2025, clouds masked; data/build_layers.py reads and caches the bands)
   on each 10 km detail tile, averaged to the 30 m DEM cells.
2. Channel candidates: NDVI below 0.2 (water, gravel, sand; no vegetation), within 400 m of the centreline and at
   most 20 m above the corridor bed.
3. Keep the candidates connected to the centreline (8-neighbour), so roads, roofs and bare slopes away from the
   river drop out.

Output: out/derived/rasuwa/channel.npz (rows and cols of channel cells on the DEM grid) and a summary of
the channel width per 10 km. Usage (from the repo root): .venv/bin/python data/channel.py
"""

import json
from pathlib import Path

import numpy as np
import rasterio
from build_layers import BEFORE, ndvi_composite
from pyproj import Transformer
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
DER = ROOT / "out/derived/rasuwa"
APP = ROOT / "app/data/rasuwa"
UTM = "EPSG:32645"
NDVI_MAX = 0.2
LATERAL_M = 400.0
ABOVE_BED_M = 20.0


def main() -> None:
    scene = json.loads((APP / "scene.json").read_text())
    corridor = json.loads((DER / "corridor.json").read_text())
    with rasterio.open(DER / "dem_utm.tif") as src:
        z = src.read(1)
        tf = src.transform
    res = tf.a
    t = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    xy = np.array([t.transform(s["lon"], s["lat"]) for s in corridor["stations"]])
    bed = np.array([s["bed_m"] for s in corridor["stations"]])
    km = np.array([s["km"] for s in corridor["stations"]])
    rr = ((tf.f - xy[:, 1]) / res - 0.5).round().astype(int)
    cc = ((xy[:, 0] - tf.c) / res - 0.5).round().astype(int)
    seed = np.ones(z.shape, bool)
    seed[rr, cc] = False
    dist, (ir, ic) = ndimage.distance_transform_edt(seed, return_indices=True)
    dist *= res
    sid = np.full(z.shape, -1, np.int32)
    sid[rr, cc] = np.arange(len(km))
    near = sid[ir, ic]

    ndvi = np.full(z.shape, np.nan, np.float32)
    for tile in scene["tiles"]:
        b = tuple(tile["utm"])
        nd = ndvi_composite(BEFORE, b)  # 1024 x 1024 over the tile's cell-centre extent
        r0 = round((tf.f - b[3]) / res - 0.5)
        c0 = round((b[0] - tf.c) / res - 0.5)
        n = tile["rows"]
        # average the 10 m pixels into the tile's 30 m cells (nan where no clear view)
        edges = np.linspace(0, nd.shape[0], n + 1).astype(int)
        block = np.add.reduceat(np.add.reduceat(np.nan_to_num(nd), edges[:-1], axis=0), edges[:-1], axis=1)
        count = np.add.reduceat(np.add.reduceat((~np.isnan(nd)).astype(np.float32), edges[:-1], axis=0), edges[:-1], axis=1)
        mean = np.where(count > 0, block / np.maximum(count, 1), np.nan)
        ndvi[r0 : r0 + n, c0 : c0 + n] = mean[: z.shape[0] - r0, : z.shape[1] - c0]
    cand = (ndvi < NDVI_MAX) & (dist <= LATERAL_M) & (z - bed[near] <= ABOVE_BED_M)
    centre = dist <= 45.0
    lab, _ = ndimage.label(cand | centre, structure=np.ones((3, 3)))
    keep_labels = np.unique(lab[centre & (lab > 0)])
    channel = np.isin(lab, keep_labels) & (cand | centre)
    rows, cols = np.nonzero(channel)
    np.savez_compressed(DER / "channel.npz", rows=rows.astype(np.int32), cols=cols.astype(np.int32))
    # width per 10 km: channel area / length
    widths = {}
    kms = km[near[rows, cols]]
    for k0 in range(0, int(km.max()) + 1, 10):
        m = (kms >= k0) & (kms < k0 + 10)
        if m.any():
            widths[f"{k0}-{k0 + 10}"] = round(float(m.sum() * res * res / 10000.0))
    print(f"channel: {rows.size:,} cells; mean width (m) by 10 km: {widths}")
    (DER / "channel.json").write_text(
        json.dumps(
            {"cells": int(rows.size), "mean_width_m": widths, "ndvi_max": NDVI_MAX, "lateral_m": LATERAL_M, "above_bed_m": ABOVE_BED_M}
        )
    )


if __name__ == "__main__":
    main()


def burn_channel(z: np.ndarray, tf: rasterio.Affine, corridor: dict) -> int:
    """Lower the mapped channel cells (channel.npz) to the corridor bed at their nearest station."""
    from scipy.spatial import cKDTree

    path = DER / "channel.npz"
    if not path.exists():
        return 0
    d = np.load(path)
    rows, cols = d["rows"], d["cols"]
    t = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    xy = np.array([t.transform(s["lon"], s["lat"]) for s in corridor["stations"]])
    bed = np.array([s["bed_m"] for s in corridor["stations"]])
    cx = tf.c + (cols + 0.5) * tf.a
    cy = tf.f - (rows + 0.5) * tf.a
    _, i = cKDTree(xy).query(np.column_stack([cx, cy]))
    lower = z[rows, cols] > bed[i]
    z[rows[lower], cols[lower]] = bed[i][lower]
    return int(lower.sum())
