#!/usr/bin/env python3
"""Export 2-D flood runs (flood2d_rasuwa.py) for the app: water depth every 3 minutes on the cells the flood reaches.

For each detail tile (app/data/rasuwa/scene.json) and for the overview grid, the cells where the water rises at
least 0.25 m above its base level at some time and stands above the app ground. The 2-D model burns a wider channel
than the app shows (an effective conveyance width, research/methods.md 4.9), so the depths are written against the
app ground (app/data/rasuwa/terrain): the depth a viewer sees, and none where the water stays below that ground.
Per cell: the app ground, the base level above it (negative where the base water stays below it), the visible depth
in every frame, the highest visible depth and speed, and the arrival time of a 0.5 m rise.

Encoding (format 3; little endian; each file is gzipped, the app inflates it), per tile file
layers/flood2d/<scenario>/<tile>.bin and overview.bin:
  uint32 n_cells, uint32 n_frames, uint32 bytes of the index block
  index block: the vertex indices in the tile grid (row * cols + col), ascending, each as its difference from the
    previous one in LEB128 (7 bits a byte), then zero bytes up to a multiple of 4
  float32 [n] app ground (m)
  int16 [n] base water level above the app ground (cm, may be negative)
  uint8 [n][n_frames] visible depth per cell over time, d = 45 (v / 255)^2 m (finer near the surface), each frame
    stored as its difference from the frame before (mod 256)
  uint8 [n] highest visible depth, same code
  uint8 [n] highest speed, 0.1 m/s
  uint16 [n] arrival, minutes after 08:00 (65535: no 0.5 m rise)

cells.bin (gzipped), every cell drawn on a tile (for the place panel): uint32 n; uint16 [n] DEM row;
uint16 [n] DEM col; uint16 [n] arrival; uint8 [n] highest visible depth (same code); uint8 [n] highest speed (0.1 m/s).

Usage (from the repo root): .venv/bin/python model/export_flood2d.py <run.npz> <scenario name> [label]
"""

import gzip
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data"))
from build_app import load_heights

sys.path.insert(0, str(Path(__file__).resolve().parent))
from flood2d_rasuwa import OBS

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app/data/rasuwa"
DMAX = 45.0
MIN_RISE = 0.25
FRAME_S = 180


def enc(d: np.ndarray) -> np.ndarray:
    return np.clip(np.round(np.sqrt(np.clip(d, 0, DMAX) / DMAX) * 255), 0, 255).astype(np.uint8)


def leb128(values: np.ndarray) -> bytes:
    out = bytearray()
    for v in values.tolist():
        while True:
            b = v & 0x7F
            v >>= 7
            out.append(b | (0x80 if v else 0))
            if not v:
                break
    return bytes(out)


def pack(path: Path, idx, ground, base, frames, hmax, vmax, arrive) -> None:
    order = np.argsort(idx, kind="stable")  # ascending indices give small differences
    idx, ground, base, frames = idx[order], ground[order], base[order], frames[:, order]
    hmax, vmax, arrive = hmax[order], vmax[order], arrive[order]
    n, nf = idx.size, frames.shape[0]
    block = leb128(np.diff(idx.astype(np.int64), prepend=0))
    block += b"\0" * (-len(block) % 4)
    codes = enc(frames).T.astype(np.int16)  # [n][nf]
    delta = (np.diff(codes, axis=1, prepend=0) % 256).astype(np.uint8)
    a = np.where(np.isnan(arrive), 65535, np.clip(np.round(arrive), 0, 65534)).astype("<u2")
    raw = b"".join(
        [
            np.array([n, nf, len(block)], "<u4").tobytes(),
            block,
            ground.astype("<f4").tobytes(),
            np.clip(np.round(base * 100), -32768, 32767).astype("<i2").tobytes(),
            delta.tobytes(),
            enc(hmax).tobytes(),
            np.clip(np.round(vmax * 10), 0, 255).astype(np.uint8).tobytes(),
            a.tobytes(),
        ]
    )
    path.write_bytes(gzip.compress(raw, 9, mtime=0))


def main(run: str, name: str, label: str = "") -> None:
    d = np.load(run)
    info = json.loads(Path(run).with_suffix(".json").read_text())
    scene = json.loads((APP / "scene.json").read_text())
    rows, cols = d["rows"], d["cols"]
    z, hb = d["z"], d["h_base"]
    frames = d["frames"].astype(np.float32)
    lev = z[None, :] + frames  # water level (m)
    risen = (frames - hb[None, :]).max(axis=0) >= MIN_RISE
    out = APP / "layers/flood2d" / name
    out.mkdir(parents=True, exist_ok=True)
    for old in out.iterdir():
        old.unlink()
    sc = info["scenario"]
    meta = {
        "format": 3,
        "scenario": name,
        "label": label or sc.get("label", name),
        "volume_Mm3": round(sc["volume"] / 1e6, 1),
        "q_peak": round(sc["qPeak"]),
        "manning_n": info["n"],
        "burn_m": info.get("burn_m"),
        "hits": info["hits"],
        "checks": info["checks"],
        # the checks against the reports, in the order of "checks": place, quantity, reported window (minutes after
        # 08:00, metres or m3/s)
        "obs": [{"place": o[0], "what": o[1], "lo": o[2], "hi": o[3]} for o in OBS],
        "gauges": info["gauges"],
        "frame_min": FRAME_S // 60,
        "frame0": "08:44",
        "dmax": DMAX,
        "min_rise": MIN_RISE,
        "tiles": {},
    }
    # the app ground (DEM, 40 m band and mapped channel burned in) under every model cell, from the app's tiles
    appg = np.full(rows.size, np.nan, np.float32)
    for t in scene["tiles"]:
        tr, tc = (int(v) for v in t["name"][1:].split("_"))
        r0, c0 = tr * 332, tc * 332
        inside = (rows >= r0) & (rows < r0 + t["rows"]) & (cols >= c0) & (cols < c0 + t["cols"])
        if inside.any():
            app = load_heights(APP / f"terrain/{t['name']}.bin", t["rows"], t["cols"])
            appg[inside] = app[rows[inside] - r0, cols[inside] - c0]
    appg = np.where(np.isnan(appg), z, appg)  # no tile: the model ground
    depth = np.maximum(0.0, lev - appg[None, :])  # visible depth
    shown = risen & (depth.max(axis=0) > 0.05)  # rises and shows above the app ground at some time
    hmax_app = np.maximum(0.0, z + d["hmax"] - appg)
    # detail tiles: tile tRR_CC covers DEM rows RR*332 .. RR*332+332 and cols CC*332 .. CC*332+332 (shared edges)
    for t in scene["tiles"]:
        tr, tc = (int(v) for v in t["name"][1:].split("_"))
        r0, c0 = tr * 332, tc * 332
        sel = np.nonzero(shown & (rows >= r0) & (rows < r0 + t["rows"]) & (cols >= c0) & (cols < c0 + t["cols"]))[0]
        if sel.size == 0:
            continue
        idx = (rows[sel] - r0) * t["cols"] + (cols[sel] - c0)
        pack(
            out / f"{t['name']}.bin",
            idx,
            appg[sel],
            z[sel] + hb[sel] - appg[sel],
            depth[:, sel],
            hmax_app[sel],
            d["vmax"][sel],
            d["arrive"][sel],
        )
        meta["tiles"][t["name"]] = int(sel.size)
    # overview: each overview vertex (every 4th DEM cell) takes the highest water level of the shown cells nearest to
    # it (a 4 x 4 block) over their lowest app ground. Where that level stays under the smoothed overview terrain,
    # the terrain hides it.
    ov = scene["overview"]
    k = 4
    vr = np.clip(np.rint(rows[shown] / k).astype(np.int64), 0, ov["rows"] - 1)
    vc = np.clip(np.rint(cols[shown] / k).astype(np.int64), 0, ov["cols"] - 1)
    uk, inv = np.unique(vr * ov["cols"] + vc, return_inverse=True)

    def block(values: np.ndarray, op, fill: float) -> np.ndarray:
        r = np.full(uk.size, fill, np.float32)
        op.at(r, inv, values)
        return r

    level = np.stack([block(lev[f, shown], np.maximum, -1e9) for f in range(frames.shape[0])])
    ground = block(appg[shown], np.minimum, 1e9)
    arr = block(np.where(np.isnan(d["arrive"][shown]), np.inf, d["arrive"][shown]), np.minimum, np.inf)
    pack(
        out / "overview.bin",
        uk,
        ground,
        block((z + hb)[shown], np.maximum, -1e9) - ground,
        np.maximum(0.0, level - ground[None, :]),
        np.maximum(0.0, block((z + d["hmax"])[shown], np.maximum, -1e9) - ground),
        block(d["vmax"][shown], np.maximum, 0.0),
        np.where(np.isinf(arr), np.nan, arr),
    )
    meta["overview_cells"] = int(uk.size)
    # every shown cell, for the place panel: DEM row and col, arrival of a 0.5 m rise, highest visible depth and speed
    sel = np.nonzero(shown)[0]
    arr = d["arrive"][sel]
    cells = b"".join(
        [
            np.array([sel.size], "<u4").tobytes(),
            rows[sel].astype("<u2").tobytes(),
            cols[sel].astype("<u2").tobytes(),
            np.where(np.isnan(arr), 65535, np.clip(np.round(arr), 0, 65534)).astype("<u2").tobytes(),
            enc(hmax_app[sel]).tobytes(),
            np.clip(np.round(d["vmax"][sel] * 10), 0, 255).astype(np.uint8).tobytes(),
        ]
    )
    (out / "cells.bin").write_bytes(gzip.compress(cells, 9, mtime=0))
    meta["cells"] = int(sel.size)
    (out / "meta.json").write_text(json.dumps(meta))
    # the list of exported runs for the app's selector, smallest flood first
    runs = []
    for m in sorted((APP / "layers/flood2d").glob("*/meta.json")):
        r = json.loads(m.read_text())
        runs.append({"name": r["scenario"], "label": r["label"], "volume_Mm3": r["volume_Mm3"], "q_peak": r["q_peak"], "hits": r["hits"]})
    runs.sort(key=lambda r: (r["volume_Mm3"], r["q_peak"]))
    (APP / "layers/flood2d/index.json").write_text(json.dumps({"runs": runs, "checks": len(meta["checks"])}))
    size = sum(f.stat().st_size for f in out.iterdir()) / 1e6
    print(
        f"{name}: {risen.sum():,} of {rows.size:,} cells rise {MIN_RISE} m; {meta['cells']:,} show above the app ground in {len(meta['tiles'])} tiles; "
        f"{meta['overview_cells']:,} overview cells; {frames.shape[0]} frames; {size:.1f} MB"
    )


if __name__ == "__main__":
    main(*sys.argv[1:4])
