#!/usr/bin/env python3
"""Rasuwa, 26 Aug 2026: the flood from Syabrubesi to Devghat with the 2-D shallow-water solver (swe2d.py).

Domain: the 30 m DEM cells within 2 km of the river and at most 60 m above its bed, from km 35.5 to Devghat, with
the river burned in at the corridor bed: the centreline and the active channel mapped from Sentinel-2
(data/channel.py), as in the app. Inflow at Syabrubesi: the hydrograph of one run of the 1-D
ensemble (model/validate_rasuwa.mjs), so the 2-D runs start from flows already checked against the reports. Base
flows of the tributaries (Tadi and others, Budhi Gandaki, Marsyangdi, Kali Gandaki) as in the 1-D runs. The river
starts from a base-flow state that settled for sixteen hours from normal depth (cached per roughness and base
flows), then runs one more hour before the flood enters. Below Devghat (km 192.5 on) the water leaves through the
edge of the domain at normal flow: unit discharge h^(5/3) S^(1/2) / n with the bed slope of the last 7.5 km.

Records: water level at the reported gauges every minute, discharge at Galchhi and above Devghat, the depth of every
cell every 3 minutes, and per cell the highest depth, the highest speed and the first time the water rose 0.5 m.

Usage (from the repo root):
  .venv/bin/python model/flood2d_rasuwa.py shown
      the three runs shown in the app (SHOWN, B = 130 m, n = 0.03); then model/export_flood2d.py for each
  .venv/bin/python model/flood2d_rasuwa.py calibrate
      the calibration grid; FLOOD2D_WIDTHS, FLOOD2D_VOLUMES (million m3), FLOOD2D_PEAKS (thousand m3/s) and
      FLOOD2D_CAL_NAME (output name) set it (research/methods.md 4.9)
  .venv/bin/python model/flood2d_rasuwa.py <p5|p50|p95|params.json> <manning_n>
FLOOD2D_BURN_M sets the half width B of the band burned in at the bed (default 130 m, the calibrated value).
Writes out/derived/rasuwa/<name>.json, or flood2d_<name>_n<n>.npz and .json.
"""

import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data"))
from build_app import burn_river
from channel import burn_channel
from swe2d import Grid, Solver

ROOT = Path(__file__).resolve().parents[1]
DER = ROOT / "out/derived/rasuwa"
HYD = ROOT / "model/data/rasuwa_hydraulics.json"
UTM = "EPSG:32645"
LATERAL_M = 2000.0
ABOVE_BED_M = 60.0
KM_START = 35.5
KM_OUTFLOW = 192.5
OUTFLOW = "normal"  # in the hot-start cache key: the outflow rule changes the base state
BURN_M = float(__import__("os").environ.get("FLOOD2D_BURN_M", "130"))  # half width of the band burned in at the bed
SETTLE_H = 16  # hours of base flow before the run (in the hot-start cache key)
# the runs shown in the app: name -> (label, inflow volume in million m3, inflow peak in thousand m3/s); methods.md 4.9
SHOWN = {"low": ("lower", 60, 60), "central": ("central", 75, 60), "high": ("upper", 90, 80)}
DEVGHAT_BASE = 2713.0
FRAME_S = 180
T_END_MIN = 18 * 60 + 44 - 8 * 60  # 18:44
GAUGES = {"Betrawati": 64.3, "Galchhi": 97.1, "Malekhu": 119.4, "Mugling": 157.1, "Devghat": 191.9}


def pulse(base: float, q_peak: float, volume: float, rise: float):
    """The 1-D inflow (route.mjs pulse): straight rise, exponential fall releasing the volume."""
    rise = min(rise, 1.8 * volume / q_peak)
    tau = (volume - 0.5 * q_peak * rise) / q_peak
    return lambda t: base if t <= 0 else base + (q_peak * t / rise if t < rise else q_peak * np.exp(-(t - rise) / tau))


def scenario(name: str) -> dict:
    """The run of the 1-D pools (both roughness structures) whose Galchhi peak is closest to the 5, 50 or 95 % value."""
    pool = []
    for s in ("uniform", "jarrett"):
        pool += json.loads((DER / f"validation_{s}.json").read_text())["pool"]
    q = np.array([r["galchhiPeakQ"] for r in pool])
    target = np.percentile(q, {"p5": 5, "p50": 50, "p95": 95}[name])
    r = pool[int(np.argmin(np.abs(q - target)))]
    return {"name": name, "galchhi_peak_1d": float(r["galchhiPeakQ"]), **r["p"]}


def build_domain() -> dict:
    with rasterio.open(DER / "dem_utm.tif") as src:
        z = src.read(1).astype(np.float64)
        tf = src.transform
    z = np.where(np.isnan(z), np.nanmax(z), z)
    corridor = json.loads((DER / "corridor.json").read_text())
    zb = z.astype(np.float32)
    burn_river(zb, tf, corridor, radius=BURN_M)
    burn_channel(zb, tf, corridor)  # the active channel mapped from Sentinel-2 (data/channel.py)
    z = zb.astype(np.float64)
    t = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    st = [s for s in corridor["stations"] if s["km"] >= KM_START - 0.2]
    xy = np.array([t.transform(s["lon"], s["lat"]) for s in st])
    km = np.array([s["km"] for s in st])
    bed = np.array([s["bed_m"] for s in st])
    res = tf.a
    rr = ((tf.f - xy[:, 1]) / res - 0.5).round().astype(int)
    cc = ((xy[:, 0] - tf.c) / res - 0.5).round().astype(int)
    seed = np.ones(z.shape, bool)
    seed[rr, cc] = False
    dist, (ir, ic) = ndimage.distance_transform_edt(seed, return_indices=True)
    dist *= res
    # nearest station index per cell via the station raster
    sid = np.full(z.shape, -1, np.int32)
    sid[rr, cc] = np.arange(len(st))
    near = sid[ir, ic]
    mask = (dist <= LATERAL_M) & (z <= bed[near] + ABOVE_BED_M) & (km[near] >= KM_START) & (near >= 0)
    lab, _ = ndimage.label(mask)
    keep = lab == lab[rr[len(st) // 2], cc[len(st) // 2]]
    rows, cols = np.nonzero(keep)
    r0, r1, c0, c1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
    sub = (slice(r0, r1), slice(c0, c1))
    return {
        "mask": keep[sub],
        "z": z[sub],
        "dist": dist[sub],
        "near": near[sub],
        "st_km": km,
        "st_bed": bed,
        "st_xy": xy,
        "origin_rc": (int(r0), int(c0)),
        "transform": tf,
        "shape_full": z.shape,
    }


def base_levels(dom: dict, sc: dict, n: float) -> np.ndarray:
    """Water level per station at base flow: normal depth in the DEM section tables for the base discharge."""
    hyd = json.loads(HYD.read_text())
    secs = [s for s in hyd["sections"] if s["km"] >= KM_START - 0.6]
    sk = np.array([s["km"] for s in secs])
    level = np.zeros(len(dom["st_km"]))
    for i, k in enumerate(dom["st_km"]):
        s = secs[int(np.argmin(np.abs(sk - k)))]
        q = base_at(k, sc)
        tab = np.array(s["table"])
        qh = tab[:, 4] * np.sqrt(s["slope"]) / n
        level[i] = s["bed_m"] + float(np.interp(q, qh, tab[:, 0]))
    # the corridor bed (a running minimum) can sit below the section bed: never start below it
    return np.maximum(level, dom["st_bed"])


KM = {"syabrubesi": 35.7, "galchhi": 97.1, "benighat": 120.6, "mugling": 157.1, "devghat": 192.7}


def base_at(km: float, sc: dict) -> float:
    """Base flow along the river, as in validate_rasuwa.mjs."""

    def step(at: float, q: float) -> float:
        return q * min(1.0, max(0.0, (km - at) / 1.0 + 0.5))

    f = min(1.0, max(0.0, (km - KM["syabrubesi"]) / (KM["galchhi"] - KM["syabrubesi"])))
    trunk = sc["baseSya"] + f * sc["addGal"]
    return trunk + step(KM["benighat"], sc["addBudhi"]) + step(KM["mugling"], sc["addMarsyangdi"])


OBS = [  # the eight checks of validate_rasuwa.mjs plus the Galchhi stage rise; minutes after 08:00
    ("Betrawati", "front_1m", 65, 90),
    ("Galchhi", "front_1m", 135, 160),
    ("Galchhi", "peak_time", 155, 185),
    ("Malekhu", "front_1m", 190, 220),
    ("Malekhu", "peak_time", 210, 240),
    ("Mugling", "front_1m", 225, 300),
    ("Devghat", "peak_time", 435, 525),
    ("Devghat", "peak_q", 5850 * 0.75, 5850 * 1.25),
    ("Galchhi", "peak_rise_m", 7.0, 10.4),  # +8.5 (CLaSH) to 8.9 m (ICIMOD), with 1.5 m for the surface model
]


class Corridor:
    """The domain, its sources and its gauges; built once per process."""

    def __init__(self):
        dom = build_domain()
        self.dom = dom
        g = Grid(dom["mask"], dom["z"], dom["transform"].a)
        self.g = g
        self.near = dom["near"][g.rows, g.cols]
        self.dist = dom["dist"][g.rows, g.cols]
        self.km = dom["st_km"][self.near]
        km, dist = self.km, self.dist
        self.inflow_cells = (km >= KM["syabrubesi"]) & (km <= KM["syabrubesi"] + 0.5) & (dist <= 45.0)
        self.gal_cells = (km > KM["syabrubesi"] + 0.5) & (km <= KM["galchhi"]) & (dist <= 30.0)
        self.budhi = (np.abs(km - (KM["benighat"] - 0.3)) <= 0.3) & (dist <= 45.0)
        self.mars = (np.abs(km - KM["mugling"]) <= 0.3) & (dist <= 45.0)
        # outflow: domain cells below Devghat with a 4-neighbour outside the domain
        m = dom["mask"]
        pad = np.pad(m, 1)
        edge = ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        self.outflow = edge[g.rows, g.cols] & (km >= KM_OUTFLOW)
        st_km, st_bed = dom["st_km"], dom["st_bed"]
        far = st_km >= st_km.max() - 7.5
        slope = float(-np.polyfit(st_km[far] * 1000.0, st_bed[far], 1)[0])
        self.k_out = np.sqrt(max(slope, 1e-4)) / g.dx  # times h^(5/3) / n: the depth loss rate of an edge cell
        self.gauge = {}
        for nm, k in GAUGES.items():
            cand = np.nonzero((np.abs(km - k) <= 0.15) & (dist <= 60.0))[0]
            self.gauge[nm] = int(cand[np.argmin(g.z[cand])])
        self.sec = {nm: np.nonzero(np.abs(km - k) <= 0.05)[0] for nm, k in (("Galchhi", 97.1), ("Devghat", 191.9))}
        self.tang = {}
        for nm in self.sec:
            i = int(np.argmin(np.abs(dom["st_km"] - GAUGES[nm])))
            a, b = dom["st_xy"][max(0, i - 3)], dom["st_xy"][min(len(dom["st_xy"]) - 1, i + 3)]
            d = (b - a) / np.hypot(*(b - a))
            self.tang[nm] = (d[0], -d[1])  # grid x east, grid y south

    def fixed_sources(self, sc: dict) -> np.ndarray:
        area = self.g.dx * self.g.dx
        f = np.zeros(self.g.n)
        f[self.gal_cells] += sc["addGal"] / (self.gal_cells.sum() * area)
        f[self.budhi] += sc["addBudhi"] / (self.budhi.sum() * area)
        f[self.mars] += sc["addMarsyangdi"] / (self.mars.sum() * area)
        return f

    def drain(self, s: Solver, n: float, dt: float) -> float:
        """Normal-flow outflow through the edge cells below Devghat (semi-implicit, so a cell never goes negative).
        Returns the volume that left (m3)."""
        o = self.outflow
        h = s.h[o]
        keep = 1.0 / (1.0 + dt * self.k_out / n * np.power(np.maximum(h, 0.0), 2.0 / 3.0))
        s.h[o] = h * keep
        s.hu[o] *= keep
        s.hv[o] *= keep
        return float(np.sum(h * (1.0 - keep))) * self.g.dx * self.g.dx

    def base_state(self, sc: dict, n: float) -> dict:
        """The river at base flow after SETTLE_H hours of settling from normal depth (cached under a fingerprint of
        the terrain, the outflow rule, the settling time, the roughness and the base flows). Records the largest and
        the 99th-percentile level change in the last hour (drift_m)."""
        terrain = hashlib.sha1(self.g.z.tobytes()).hexdigest()[:10]
        flows = f"{sc['baseSya']:.0f}_{sc['addGal']:.0f}_{sc['addBudhi']:.0f}_{sc['addMarsyangdi']:.0f}"
        key = f"flood2d_base_{terrain}_{OUTFLOW}_s{SETTLE_H}_n{n:.3f}_{flows}.npz"
        path = DER / key
        if path.exists():
            d = np.load(path)
            return {k: d[k] for k in ("h", "hu", "hv", "drift_m")}
        g = self.g
        s = Solver(g, n)
        lv = base_levels(self.dom, sc, n)[self.near]
        s.h = np.where(self.dist <= 300.0, np.maximum(0.0, lv - g.z), 0.0)
        fixed = self.fixed_sources(sc)
        q_in = sc["baseSya"] / (self.inflow_cells.sum() * g.dx * g.dx)
        h_15 = None
        while s.t < SETTLE_H * 3600:
            if h_15 is None and s.t >= (SETTLE_H - 1) * 3600:
                h_15 = s.h.copy()
            dt = min(s.max_dt(), 5.0)
            s.src = fixed.copy()
            s.src[self.inflow_cells] += q_in
            s.step(dt)
            self.drain(s, n, dt)
        wet = s.h > 0.3
        change = np.abs(s.h - h_15)[wet]
        print(
            f"  base state {key}: level change in the last hour: max {change.max():.2f} m, 99 % {np.percentile(change, 99):.2f} m",
            flush=True,
        )
        drift = np.array([change.max(), np.percentile(change, 99)])
        np.savez_compressed(path, h=s.h, hu=s.hu, hv=s.hv, drift_m=drift)
        return {"h": s.h.copy(), "hu": s.hu.copy(), "hv": s.hv.copy(), "drift_m": drift}


def simulate(cor: Corridor, sc: dict, n: float, tag: str | None = None) -> dict:
    """Run one flood from one hour before it enters; tag set: keep frames and per-cell fields in tag.npz."""
    t_wall = time.time()
    g = cor.g
    base = cor.base_state(sc, n)
    s = Solver(g, n)
    s.h, s.hu, s.hv = base["h"].copy(), base["hu"].copy(), base["hv"].copy()
    h_base = base["h"].copy()
    t0_min = sc["startMin"] - 60.0
    area = g.dx * g.dx
    hydro = pulse(sc["baseSya"], sc["qPeak"], sc["volume"], sc["riseMin"] * 60)
    start_s = 60.0 * 60.0
    fixed = cor.fixed_sources(sc)
    n_min = int(T_END_MIN - t0_min) + 1
    level_series = {nm: np.zeros(n_min) for nm in GAUGES}
    q_series = {nm: np.zeros(n_min) for nm in cor.sec}
    keep = tag is not None
    n_frames = (T_END_MIN - 44) * 60 // FRAME_S + 1
    frames = np.zeros((n_frames, g.n), np.float16) if keep else None
    hmax = np.zeros(g.n)
    vmax = np.zeros(g.n)
    arrive = np.full(g.n, np.nan, np.float32)
    t_end = (T_END_MIN - t0_min) * 60.0
    next_min, frame_k, steps, v_in, v_out = 0, 0, 0, 0.0, 0.0
    next_frame_t = (44 - t0_min) * 60.0
    v0 = s.volume()
    while s.t < t_end:
        dt = min(s.max_dt(), 5.0)
        q_in = hydro(s.t - start_s)
        s.src = fixed.copy()
        s.src[cor.inflow_cells] += q_in / (cor.inflow_cells.sum() * area)
        v_in += (q_in + sc["addGal"] + sc["addBudhi"] + sc["addMarsyangdi"]) * dt
        s.step(dt)
        v_out += cor.drain(s, n, dt)
        steps += 1
        if s.t >= start_s and steps % 4 == 0:  # peaks last minutes; every 4th step (about 3 s) is enough
            hmax = np.maximum(hmax, s.h)
            spd = np.hypot(s.hu, s.hv) / np.maximum(s.h, 1e-3)
            vmax = np.maximum(vmax, np.where(s.h > 0.05, spd, 0.0))
            new = np.isnan(arrive) & (s.h - h_base >= 0.5)
            arrive[new] = t0_min + s.t / 60.0
        while next_min < n_min and s.t >= next_min * 60.0:
            for nm, i in cor.gauge.items():
                level_series[nm][next_min] = s.h[i] + g.z[i]
            for nm, idx in cor.sec.items():
                tx, ty = cor.tang[nm]
                # cells in a 100 m band across the river: discharge = sum of unit discharges x cell width / band length
                q_series[nm][next_min] = float(np.sum(s.hu[idx] * tx + s.hv[idx] * ty) * area / 100.0)
            next_min += 1
        if keep and s.t >= next_frame_t and frame_k < n_frames:
            frames[frame_k] = s.h
            frame_k += 1
            next_frame_t += FRAME_S
    q_series["Devghat"] = q_series["Devghat"] + max(0.0, DEVGHAT_BASE - base_at(KM["devghat"], sc))  # the Kali Gandaki joins below

    mins = t0_min + np.arange(n_min)
    i0 = 60
    out = {"scenario": sc, "n": n, "burn_m": BURN_M, "cells": int(g.n), "steps": steps, "wall_s": round(time.time() - t_wall), "gauges": {}}
    for nm, lvs in level_series.items():
        rise = lvs - lvs[i0]
        rise[:i0] = 0.0
        k_arr = int(np.argmax(rise >= 1.0)) if (rise >= 1.0).any() else None
        k_pk = i0 + int(np.argmax(lvs[i0:]))
        out["gauges"][nm] = {
            "front_1m": float(mins[k_arr]) if k_arr is not None else None,
            "peak_time": float(mins[k_pk]),
            "peak_rise_m": round(float(rise.max()), 2),
        }
    for nm, qs in q_series.items():
        k = i0 + int(np.argmax(qs[i0:]))
        out["gauges"][nm]["peak_q"] = round(float(qs[k]))
        out["gauges"][nm]["peak_q_time"] = float(mins[k])
    v1 = s.volume()
    out["volume_check"] = {
        "start_m3": round(v0),
        "end_m3": round(v1),
        "inflow_m3": round(v_in),
        "outflow_m3": round(v_out),
        "residual_fraction": round((v0 + v_in - v_out - v1) / v_in, 6),  # zero up to rounding: mass is conserved
    }
    out["base_drift_m"] = [round(float(x), 3) for x in base["drift_m"]]
    out["checks"] = [bool(o[2] <= (out["gauges"][o[0]][o[1]] or -1e9) <= o[3]) for o in OBS]
    out["hits"] = int(sum(out["checks"]))
    if keep:
        np.savez_compressed(
            DER / f"{tag}.npz",
            rows=g.rows + cor.dom["origin_rc"][0],
            cols=g.cols + cor.dom["origin_rc"][1],
            z=g.z.astype(np.float32),
            h_base=h_base.astype(np.float32),
            hmax=hmax.astype(np.float32),
            vmax=vmax.astype(np.float32),
            arrive=arrive,
            frames=frames,
            km=cor.km.astype(np.float32),
            levels=np.array([level_series[k] for k in GAUGES], np.float32),
            q=np.array([q_series[k] for k in cor.sec], np.float32),
            minutes=mins.astype(np.float32),
        )
        (DER / f"{tag}.json").write_text(json.dumps(out, indent=1))
    return out


def clock(m: float | None) -> str:
    return "-" if m is None else f"{8 + int(m // 60):02d}:{round(m % 60):02d}"


_COR = None


def _work(args: tuple) -> dict:
    global _COR
    if _COR is None:
        _COR = Corridor()
    sc, n = args
    return simulate(_COR, sc, n)


def calibrate() -> None:
    """A grid of inflow volume and peak and of the burned channel half width (an effective conveyance parameter:
    a 30 m grid resolves the 80-230 m channel with few cells and loses conveyance; methods.md 4.9), with the base
    flows of the median 1-D scenario and n = 0.03. Each width runs as its own set of processes."""
    import os
    import subprocess

    rows = []
    widths = [float(w) for w in os.environ.get("FLOOD2D_WIDTHS", "40,75,110,150").split(",")]
    name = os.environ.get("FLOOD2D_CAL_NAME", "flood2d_calibration")
    for width in widths:
        env = {**os.environ, "FLOOD2D_BURN_M": str(width)}
        out = DER / f"{name}_b{width:.0f}.json"
        subprocess.run([sys.executable, __file__, "calibrate-width", str(out)], env=env, check=True)
        rows += json.loads(out.read_text())["runs"]
    (DER / f"{name}.json").write_text(json.dumps({"obs": OBS, "runs": rows}, indent=1))


def calibrate_width(out: str) -> None:
    import os
    from concurrent.futures import ProcessPoolExecutor

    base = scenario("p50")
    n = 0.03
    grid = [
        ({**base, "volume": v * 1e6, "qPeak": q * 1e3, "riseMin": 5.0, "loss": 0.0}, n)
        for v in (float(x) for x in os.environ.get("FLOOD2D_VOLUMES", "20,40,60,90").split(","))
        for q in (float(x) for x in os.environ.get("FLOOD2D_PEAKS", "10,25,50").split(","))
    ]
    Corridor().base_state(base, n)  # the hot start, before the workers start
    with ProcessPoolExecutor(max_workers=3) as pool:
        res = list(pool.map(_work, grid))
    rows = []
    for (sc, _), r in zip(grid, res, strict=True):
        gz = r["gauges"]
        rows.append(
            {
                "burn_m": BURN_M,
                "n": n,
                "volume_Mm3": sc["volume"] / 1e6,
                "qPeak": sc["qPeak"],
                "hits": r["hits"],
                "checks": r["checks"],
                "gauges": gz,
            }
        )
        print(
            f"b {BURN_M:.0f} V {sc['volume'] / 1e6:4.0f} Q {sc['qPeak'] / 1e3:4.0f}k | hits {r['hits']} | "
            f"Betr {clock(gz['Betrawati']['front_1m'])} Gal {clock(gz['Galchhi']['front_1m'])}/{clock(gz['Galchhi']['peak_time'])} "
            f"+{gz['Galchhi']['peak_rise_m']:.1f}m Mal {clock(gz['Malekhu']['front_1m'])}/{clock(gz['Malekhu']['peak_time'])} "
            f"Mug {clock(gz['Mugling']['front_1m'])} Dev {clock(gz['Devghat']['peak_time'])} {gz['Devghat']['peak_q']:,}",
            flush=True,
        )
    Path(out).write_text(json.dumps({"runs": rows}))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "calibrate"
    if cmd == "calibrate":
        calibrate()
    elif cmd == "shown":
        cor = Corridor()
        base = scenario("p50")
        for name, (label, v, q) in SHOWN.items():
            sc = {**base, "name": name, "label": label, "volume": v * 1e6, "qPeak": q * 1e3, "riseMin": 5.0, "loss": 0.0}
            r = simulate(cor, sc, 0.03, tag=f"flood2d_{name}_n0.030")
            print(
                f"{name}: hits {r['hits']} of {len(OBS)}; volume residual {r['volume_check']['residual_fraction']}; {r['wall_s']} s",
                flush=True,
            )
    elif cmd == "calibrate-width":
        calibrate_width(sys.argv[2])
    else:  # a 1-D scenario name (p5, p50, p95) or a JSON file of parameters, and Manning's n
        n = float(sys.argv[2])
        sc = scenario(cmd) if cmd in ("p5", "p50", "p95") else json.loads(Path(cmd).read_text())
        name = cmd if cmd in ("p5", "p50", "p95") else Path(cmd).stem
        r = simulate(Corridor(), sc, n, tag=f"flood2d_{name}_n{n:.3f}")
        print(
            json.dumps(
                {k: {kk: (clock(vv) if "time" in kk or "front" in kk else vv) for kk, vv in v.items()} for k, v in r["gauges"].items()},
                indent=1,
            )
        )
        print(f"hits {r['hits']} of {len(OBS)}; {r['wall_s']} s")
